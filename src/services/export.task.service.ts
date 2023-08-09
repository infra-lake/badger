import { BigQuery, Table } from '@google-cloud/bigquery'
import { AggregateOptions, AggregationCursor, BSONType } from 'mongodb'
import { BadRequestError } from '../exceptions/bad-request.error'
import { InvalidStateChangeError } from '../exceptions/invalid-state-change.error'
import { UnsupportedOperationError } from '../exceptions/unsupported-operation.error'
import { ApplicationHelper, ApplicationMode } from '../helpers/application.helper'
import { BigQueryHelper } from '../helpers/bigquery.helper'
import { HTTPHelper } from '../helpers/http.helper'
import { MongoDBDocument, MongoDBHelper, MongoDBService, MongoDBValidationInput } from '../helpers/mongodb.helper'
import { ObjectHelper } from '../helpers/object.helper'
import { StampsHelper } from '../helpers/stamps.helper'
import { StringHelper } from '../helpers/string.helper'
import { ThreadHelper } from '../helpers/thread.helper'
import { Regex, TransactionalContext } from '../regex'
import { BatchIncomingMessage } from '../regex/batch'
import { Export, ExportService } from './export.service'
import { SettingsService } from './settings.service'
import { Source, SourceService } from './source.service'
import { Target, TargetService } from './target.service'
import { Worker, WorkerService } from './worker.service'

export interface ExportTask extends MongoDBDocument<ExportTask, 'transaction' | 'source' | 'target' | 'database' | 'collection'> {
    transaction: Export['transaction']
    source: Export['source']
    target: Export['target']
    database: string
    collection: string
    status: Export['status']
    worker?: Worker['name'] | null
    date?: Date
    error?: any
    count?: number
}

export type ExportTaskFromOutput = Pick<ExportTaskStateChangeInput, 'id'>
export type ExportTaskStateChangeInput = Pick<MongoDBValidationInput<ExportTask, 'transaction' | 'source' | 'target' | 'database' | 'collection'>, 'id' | 'document'> & { context: TransactionalContext }
export type ExportTaskStateChangeStopInput = Omit<ExportTaskStateChangeInput, 'id'> & { id: Pick<ExportTask, 'transaction' | 'source' | 'target' | 'database'> }
export type ExportTaskStateChangeRetryInput = Omit<ExportTaskStateChangeInput, 'id' | 'document'> & { id: Pick<ExportTask, 'transaction' | 'source' | 'target' | 'database'> }

export type ExportTaskServiceSourceOutput = {
    name: string
    count: () => Promise<number>
    find: () => AggregationCursor<Source>
}
export type ExportTaskServiceTargetOutput = {
    name: Export['target']
    client: BigQuery
    dataset: string
    table: { main: Table, temporary: Table }
}
export type ExportTaskServiceNextOutput =
    Pick<ExportTask, 'transaction' | 'status' | 'worker' | 'database' | 'collection' | 'date' | 'error' | 'count'> &
    { source: ExportTaskServiceSourceOutput, target: ExportTaskServiceTargetOutput } &
    {
        name: () => string,
        update: (date: Date, count: number, error?: Error) => Promise<void>,
        finish: (count?: number) => Promise<void>,
        error: (count?: number, cause?: any) => Promise<void>
    }

export class ExportTaskService extends MongoDBService<ExportTask, 'transaction' | 'source' | 'target' | 'database' | 'collection'> {

    protected get database() { return SettingsService.DATABASE }
    public get collection() { return 'tasks' }

    public async from({ transaction, source, target, database }: Pick<Export, 'transaction' | 'source' | 'target' | 'database'>) {

        const service = Regex.inject(SourceService)
        const collections = await service.collections({ name: source, database })

        const result = collections.map<ExportTaskFromOutput>(({ collection }) => {
            const id = { transaction, source, target, database, collection }
            return { id }
        })

        return result

    }

    public async create({ context, id }: ExportTaskStateChangeInput) {

        if (![ApplicationMode.MANAGER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${ExportTaskService.name}.create()`)
        }

        context?.logger.log('export task', 'creating...')

        await this.validate({ id, on: 'create' })

        const { transaction, source, target, database, collection } = id

        const result = await this._collection.findOneAndUpdate(
            { source, target, database, collection, $or: [{ status: 'created' }, { status: 'running' }] },
            { $setOnInsert: { transaction, source, target, database, collection, status: 'created' } },
            { upsert: true, returnDocument: 'after' }
        )

        if (!result.ok) {
            throw new Error('error when try to create export task', result.lastErrorObject)
        }

        if (transaction !== result.value?.transaction) {
            throw new Error(`there is another export task created for collection ${id.collection}, see transaction "${result.value?.transaction}"`)
        }

        context?.logger.log('export task', 'successfully created!')

    }

    public async start({ context, id, document }: ExportTaskStateChangeInput) {

        if (ApplicationHelper.MODE === ApplicationMode.MANAGER) {
            throw new UnsupportedOperationError(`${ExportTaskService.name}.start()`)
        }

        context?.logger.log('export task', 'starting...')

        await this.validate({ context, id, document, on: 'start' })

        if (ApplicationHelper.MODE === ApplicationMode.VOTER) {

            const workers = Regex.inject(WorkerService)
            const { url } = workers.get({ id: { name: document?.worker } })

            const options = {
                method: 'POST',
                headers: HTTPHelper.headers({ authenticated: true })
            }

            const response = await HTTPHelper.request({
                logger: context.logger,
                url: `${url}/start`,
                options,
                body: id
            })

            if (!response.ok()) {
                const body = await response.body()
                context.logger.error(body)
                throw new BadRequestError(`${response.statusCode} - ${response.statusMessage}`)
            }

            return

        }

        const { transaction, source, target, database, collection } = id
        const { worker } = document ?? {}

        const result = await this._collection.findOneAndUpdate(
            {
                transaction, source, target, database, collection, status: 'created',
                $or: [{ worker: { $exists: false } }, { worker: { $type: BSONType.null } }]
            },
            { $set: { status: 'running', worker } },
            { upsert: false, returnDocument: 'after' }
        )

        if (!result.ok) {
            throw new Error('error when try to run export task', result.lastErrorObject)
        }

        if (result.value?.status !== 'running') {
            throw new Error(`does not possible to set status "running" to export task`)
        }

        if (result.value?.worker !== worker) {
            throw new Error(`does not possible to set worker "${worker}" to export task`)
        }

        context?.logger.log('export task', 'successfully started!')

    }

    public async finish({ context, document, id }: ExportTaskStateChangeInput) {

        if (![ApplicationMode.WORKER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${ExportTaskService.name}.finish()`)
        }

        context?.logger.log('export task', 'finishing...')

        await this.validate({ context, id, document, on: 'finish' })

        const { transaction, source, target, database, collection } = id
        const { worker, date } = document ?? {}

        const result = await this._collection.findOneAndUpdate(
            { transaction, source, target, database, collection, worker, status: 'running' },
            { $set: { status: 'terminated', date } },
            { upsert: false, returnDocument: 'after' }
        )

        if (!result.ok) {
            throw new Error('error when try to terminate export task', result.lastErrorObject)
        }

        if (result.value?.status !== 'terminated') {
            throw new Error(`does not possible to set status "terminated" to export task`)
        }

        context?.logger.log('export task', 'successfully finished!')

    }

    public async stop({ context, id, document }: ExportTaskStateChangeStopInput) {

        if (![ApplicationMode.MANAGER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${ExportTaskService.name}.stop()`)
        }

        context?.logger.log('export task', 'stopping...')

        await this.validate({ id: id as any, document, on: 'stop' })

        const { transaction, source, target, database } = id
        const { date } = document ?? {}

        await this._collection.updateMany(
            { transaction, source, target, database, $or: [{ status: 'created' }, { status: 'running' }] },
            { $set: { status: 'stopped', date } },
            { upsert: false }
        )

        context?.logger.log('export task', 'successfully stopped!')

    }

    public async error({ context, id, document }: ExportTaskStateChangeInput) {

        if (![ApplicationMode.WORKER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${ExportTaskService.name}.error()`)
        }

        context?.logger.log('export task', 'reporting error...')

        await this.validate({ id, document, on: 'error' })

        const { transaction, source, target, database, collection } = id
        const { worker, date } = document ?? {}

        const result = await this._collection.findOneAndUpdate(
            { transaction, source, target, database, collection, worker, $or: [{ status: 'created' }, { status: 'running' }] },
            { $set: { status: 'error', date } },
            { upsert: false, returnDocument: 'after' }
        )

        if (!result.ok) {
            throw new Error('error when try to error export task', result.lastErrorObject)
        }

        if (result.value?.status !== 'error') {
            throw new Error(`does not possible to set status "error" to export task`)
        }

        context?.logger.log('export task', 'error successfully reported!')

    }

    public async retry({ context, id }: ExportTaskStateChangeRetryInput) {

        if (![ApplicationMode.MANAGER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${ExportTaskService.name}.error()`)
        }

        context?.logger.log('export task', 'set created...')

        await this.validate({ id: id as any, on: 'retry' })

        const { transaction, source, target, database } = id

        const result = await this._collection.updateMany(
            { transaction, source, target, database, status: 'error' },
            { $set: { status: 'created', worker: null } },
            { upsert: false }
        )

        context?.logger.log('export task', 'set created successfully reported!')

    }


    protected async validate({ context, id, document, on }: MongoDBValidationInput<ExportTask, 'transaction' | 'source' | 'target' | 'database' | 'collection'>) {

        const type = ExportTaskService.name

        if (on === 'insert') {
            throw new UnsupportedOperationError(`${ExportTaskService.name}.save()`)
        }

        if (on === 'delete') {
            throw new UnsupportedOperationError(`${ExportTaskService.name}.delete()`)
        }

        if (![ApplicationMode.WORKER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            if (on === 'update') {
                throw new UnsupportedOperationError(`${ExportTaskService.name}.save()`)
            }
        }

        const { transaction, source, target, database, collection } = id ?? {}

        if (StringHelper.empty(transaction)) { throw new BadRequestError('transaction is missing') }
        if (StringHelper.empty(source)) { throw new BadRequestError('source is empty') }
        if (StringHelper.empty(target)) { throw new BadRequestError('target is empty') }
        if (StringHelper.empty(database)) { throw new BadRequestError('database id is empty') }

        if (!['stop', 'retry'].includes(on)) {
            if (StringHelper.empty(collection)) { throw new BadRequestError('collection is empty') }
        }

        if (['create', 'start', 'retry'].includes(on)) {
            await this.test({ transaction, source, target, database })
        }

        if (['update', 'create', 'retry'].includes(on)) { return }

        if (['start', 'finish', 'stop', 'error'].includes(on)) {

            const { worker, date, error } = document ?? {}

            if (StringHelper.empty(worker)) { throw new BadRequestError('worker is empty') }

            if (on === 'error') {
                if (!ObjectHelper.has(error)) { throw new BadRequestError('error is empty') }
            }

            if (on !== 'stop') {

                const found = await this.get({ context, id }) as ExportTask
                const { status: old } = found ?? {}

                if (StringHelper.empty(old)) { throw new BadRequestError('task not found') }

                if (on === 'start') {

                    if (old !== 'created') {
                        throw new InvalidStateChangeError({ type, on, status: { old, new: 'running', valids: ['created'] } })
                    }

                    const exists = await this.exists({
                        context,
                        filter: { transaction, source, target, database, worker, status: 'running' }
                    })

                    if (exists) { throw new BadRequestError(`does not possible to run more than one export task at the same time for the same worker`) }

                }

                if (['finish', 'stop', 'error'].includes(on)) {

                    if (on === 'finish' && old !== 'running') {
                        throw new InvalidStateChangeError({ type, on, status: { old, new: 'terminated', valids: ['running'] } })
                    }

                    if (on === 'error' && !['created', 'running'].includes(old)) {
                        throw new InvalidStateChangeError({ type, on, status: { old, new: 'error', valids: ['created', 'running'] } })
                    }
                }

            }

            if (['finish', 'stop', 'error'].includes(on)) {

                if (!ObjectHelper.has(date)) {
                    throw new BadRequestError('date is empty')
                }

                if (!('getTime' in date) && date.constructor.name !== 'Date') {
                    throw new BadRequestError('date is invalid')
                }

            }

        }

    }

    public async test(id: Pick<ExportTask, 'transaction' | 'source' | 'target' | 'database'>) {

        try {

            const service = Regex.inject(ExportService)
            const { transaction, source, target, database } = id

            console.debug("ExportTaskService.test(id):", id)

            const document = await service.get({ id: { transaction, source, target, database } })

            if (!ObjectHelper.has(document)) {
                throw new Error('export does not found')
            }

        } catch (error) {
            throw new BadRequestError(`does not possible to test if export exists:`, error)
        }

    }

    public async busy() {
        const aggregation = this._collection.aggregate([
            { $match: { status: 'running' } },
            { $group: { _id: { worker: '$worker' }, count: { $count: {} } } }
        ])
        const temp = await aggregation.toArray()
        const result =
            temp
                .map(({ _id, _ }) => _id)
                .map(({ worker }) => worker)
                .filter(worker => !StringHelper.empty(worker))
                .map(name => ({ name } as Pick<Worker, 'name'>))
        return result
    }

    public async next({ context, worker }: { context: BatchIncomingMessage, worker: Worker['name'] }): Promise<ExportTaskServiceNextOutput | undefined> {

        const cursor = this.find({ context, filter: { worker, status: 'running' } })
        if (!await cursor.hasNext()) {
            return undefined
        }

        const task = await cursor.next() as ExportTask

        context.transaction = task.transaction

        const source = await this.source({ context, task })
        const target = await this.target({ context, task })

        const name = () => {
            const from = `${source.name}.${task.database}.${task.collection}`
            const to = target.name
            return JSON.stringify({ from, to })
        }

        const update = async (date: Date, count: number, error?: Error) => {

            const id = {
                transaction: task.transaction,
                source: source.name,
                target: target.name,
                database: task.database,
                collection: task.collection
            }

            const document = {
                status: task.status,
                worker: task.worker,
                date,
                count,
                error
            }

            await this.save({ context, id, document })

        }

        const cleanup = async () => {

            let exists = false
            try {
                exists = (await target.table.temporary.exists())[0]
            } catch (error) {
                exists = false
            }

            if (exists) {
                try { await target.table.temporary.delete() } catch (error) { }
                await ThreadHelper.sleep(1000)
                cleanup()
            }

        }

        const consolidate = async () => {

            context.logger.log(`consolidating temporary data to table "${target.table.main.metadata.id}"...`)

            const main = `\`${target.table.main.metadata.id.replace(/\:/g, '.').replace(/\./g, '`.`')}\``
            const temporary = `\`${target.table.temporary.metadata.id.replace(/\:/g, '.').replace(/\./g, '`.`')}\``

            await target.client.query(`
                INSERT ${main} (${StampsHelper.DEFAULT_STAMP_ID}, ${StampsHelper.DEFAULT_STAMP_INSERT}, data, \`hash\`)
                WITH
                    temporary AS (
                        SELECT ${StampsHelper.DEFAULT_STAMP_ID}, ${StampsHelper.DEFAULT_STAMP_INSERT}, data, \`hash\`
                        FROM ${temporary}
                    ),
                    main AS (
                        SELECT ${StampsHelper.DEFAULT_STAMP_ID}, MAX(${StampsHelper.DEFAULT_STAMP_INSERT}) AS ${StampsHelper.DEFAULT_STAMP_INSERT}
                        FROM ${main}
                        GROUP BY ${StampsHelper.DEFAULT_STAMP_ID}
                    )
                SELECT temporary.${StampsHelper.DEFAULT_STAMP_ID}, temporary.${StampsHelper.DEFAULT_STAMP_INSERT}, temporary.data, temporary.\`hash\`
                FROM temporary
                WHERE temporary.${StampsHelper.DEFAULT_STAMP_ID} NOT IN (SELECT main.${StampsHelper.DEFAULT_STAMP_ID} FROM main)
                    OR \`hash\` <> (
                        SELECT \`hash\`
                        FROM main AS B
                        INNER JOIN ${main} AS C
                                ON C.${StampsHelper.DEFAULT_STAMP_ID} = B.${StampsHelper.DEFAULT_STAMP_ID}
                                AND C.${StampsHelper.DEFAULT_STAMP_INSERT} = B.${StampsHelper.DEFAULT_STAMP_INSERT}
                        WHERE B.${StampsHelper.DEFAULT_STAMP_ID} = temporary.${StampsHelper.DEFAULT_STAMP_ID}
                            AND C.${StampsHelper.DEFAULT_STAMP_ID} = temporary.${StampsHelper.DEFAULT_STAMP_ID}
                    )
            `)

            await ThreadHelper.sleep(10000)

        }

        const finish = async (count?: number) => {

            const id = {
                transaction: task.transaction,
                source: source.name,
                target: target.name,
                database: task.database,
                collection: task.collection
            }

            const document = {
                worker,
                date: context.date,
                count: count ?? 0
            }

            await consolidate()

            await cleanup()

            await this.finish({ context, id, document })

        }

        const error = async (count?: number, cause?: any) => {

            const id = {
                transaction: task.transaction,
                source: source.name,
                target: target.name,
                database: task.database,
                collection: task.collection
            }

            const document = {
                worker,
                date: context.date,
                count: count ?? 0,
                error: cause
            }

            await this.error({ context, id, document })

        }

        return { ...task, source, target, name, update, finish, error }

    }

    private async source({ context, task }: { context: BatchIncomingMessage, task: ExportTask }): Promise<ExportTaskServiceSourceOutput> {

        const { source, target, database, collection, date } = task

        const sources = Regex.inject(SourceService)
        const client = await sources.connect({ name: source })

        const window = {
            begin: date ?? await this.last({ source, target, database, collection }),
            end: context.date
        }

        const filter = ExportService.filter(window)

        const count = async () => {
            const count = await MongoDBHelper.count({ client, database, collection, filter })
            if (count <= 0) {
                context.logger.log('there aren\'t rows to export')
            } else {
                context.logger.log(`exporting ${count.toLocaleString('pt-BR')} row(s)...`)
            }
            return count
        }

        const find = () => {
            const options: AggregateOptions = { allowDiskUse: true }
            return client.db(database).collection(collection).aggregate<Source>([
                { $addFields: { temporary: 1, [StampsHelper.DEFAULT_STAMP_UPDATE]: filter['$expr']['$and'][0]['$gt'][0] } },
                { $addFields: { match: filter['$expr'] } },
                { $project: { temporary: 0 } },
                { $match: { match: true } },
                { $project: { match: 0 } },
                { $sort: { [StampsHelper.DEFAULT_STAMP_UPDATE]: 1 } }
            ], options)
        }

        return { name: source, count, find }

    }

    private async last({ source, target, database, collection }: Pick<ExportTask, 'source' | 'target' | 'database' | 'collection'>): Promise<Date> {

        const cursor = this._collection.aggregate([
            { $match: { source, target, database, collection, status: 'terminated' } },
            {
                $group: {
                    _id: { source: "$source", target: "$target", database: "$database", collection: "$collection" },
                    value: { $max: "$date" }
                }
            }
        ])

        if (await cursor.hasNext()) {
            const { value } = await cursor.next() as any;
            return value
        }

        return new Date(0)

    }

    private async target({ context, task }: { context: BatchIncomingMessage, task: ExportTask }): Promise<ExportTaskServiceTargetOutput> {

        const { transaction, target, database, collection } = task
        const dataset = this.dataset({ database: task.database })

        const service = Regex.inject(TargetService)
        const { credentials } = await service.get({ context, id: { name: target } }) as Target
        const client = new BigQuery({ credentials })

        const main = await this.table({ client, transaction, database, collection, type: 'main', create: true }) as Table
        const temporary = await this.table({ client, transaction, database, collection, type: 'temporary', create: true }) as Table

        return { name: target, client, dataset, table: { main, temporary } }

    }

    public dataset({ database }: Pick<ExportTask, 'database'>) {
        const result = BigQueryHelper.sanitize({ value: `${StampsHelper.DEFAULT_STAMP_DATASET_NAME_PREFIX}${database}` })
        return result
    }

    public async table({ client, transaction, database, collection, type, create }: { client: BigQuery, transaction: string, database: string, collection: string, type: 'main' | 'temporary', create: boolean }) {

        let name = BigQueryHelper.sanitize({ value: collection })

        if (type === 'temporary') {
            name = BigQueryHelper.sanitize({ value: `${name}_${transaction}_temp` })
        }

        const schema = {
            name,
            fields: [
                { name: StampsHelper.DEFAULT_STAMP_ID, type: 'STRING', mode: 'REQUIRED' },
                { name: StampsHelper.DEFAULT_STAMP_INSERT, type: 'TIMESTAMP', mode: 'REQUIRED' },
                { name: 'data', type: 'JSON', mode: 'REQUIRED' },
                { name: 'hash', type: 'STRING', mode: 'REQUIRED' }
            ]
        }

        const dataset = this.dataset({ database })

        const result = await BigQueryHelper.table({ client, dataset, table: schema, create })

        return result

    }

}