import { BigQuery, BigQueryTimestamp, Table } from '@google-cloud/bigquery'
import bytes from 'bytes'
import { createHash } from 'crypto'
import { MongoClient } from 'mongodb'
import sizeof from 'object-sizeof'
import { BigQueryHelper } from '../helpers/bigquery.helper'
import { MongoDBHelper } from '../helpers/mongodb.helper'
import { ObjectHelper } from '../helpers/object.helper'
import { StampsHelper } from '../helpers/stamps.helper'
import { Regex, TransactionalContext, Worker } from '../regex'
import { Export, ExportService } from '../services/export.service'
import { Source, SourceService } from '../services/source.service'
import { Target, TargetService } from '../services/target.service'

type ExportWorkerSource = { client: MongoClient, database: string, collection: string, filter: any }
type ExportWorkerTarget = { client: BigQuery, dataset: string, table: { main: Table, temporary: Table } }
type ExportWorkerInsertInput = { table: Table, rows: any[] }

export class ExportWorker extends Worker {

    private statistics?: ExportWorkerStatistics = undefined

    public constructor(
        private readonly _context: TransactionalContext,
        private readonly _input: Export
    ) { super() }

    public get name(): string {
        const name = ExportWorker.name
        const from = `${this.input.source.name}.${this.input.source.database}.${this.input.source.collection}`
        const to = this.input.target.name
        return JSON.stringify({ name, from, to })
    }

    public get context() { return this._context }
    public get input() { return this._input }
    protected get logger() { return this.context.logger }
    protected get attempts() { return this.input.settings.attempts }
    private get stamps() { return this.input.settings.stamps }
    private get limit() { return this.input.settings.limit }
    private get window() { return this.input.window }

    protected async perform() {

        let source: ExportWorkerSource | undefined = undefined
        let target: ExportWorkerTarget | undefined = undefined

        try {

            const now = new Date()
            this.logger.log('starting export task"', JSON.parse(this.name), '" at "', now.toISOString(), '"')

            source = await this.source()
            target = await this.target()

            let count = await MongoDBHelper.count(source)
            this.logger.log(`exporting ${count.toLocaleString('pt-BR')} row(s)...`)

            let rows = []
            this.statistics = new ExportWorkerStatistics(target.table.temporary, { count })

            const cursor = MongoDBHelper.find(source)
            while (await cursor.hasNext()) {

                const document = await cursor.next()

                const row = this.row(document, now)

                rows.push(row)

                const flush = (count-- % this.limit) === 0 || count <= 0

                if (flush) {
                    rows = await this.insert({ table: target.table.temporary, rows })
                }

            }

            await this.consolidate(target)

            this.logger.log(`exported was successfully finished`)

        } catch (error) {

            this.logger.error(`error on export:\n\t${error}`)
            throw error

        } finally {

            if (ObjectHelper.has(target)) {
                try {
                    await target?.table.temporary.delete({ ignoreNotFound: true })
                } catch (error) {
                    console.error(`fail to delete temporary table: ${target?.table.temporary.id}:\n\t${JSON.stringify(error)}`)
                }
            }

        }

    }

    private async insert({ table, rows }: ExportWorkerInsertInput) {

        const included = rows
        const excluded = []

        while (this.statistics?.simulate({ rows: included }).broken) {
            const row = included.pop()
            excluded.push(row)
        }

        await table.insert(included)

        this.statistics?.update({ rows: included })
        this.logger.log(`flushing ${this.statistics}...`)

        return excluded

    }

    private async source(): Promise<ExportWorkerSource> {

        const service = Regex.inject(SourceService)

        const { name, database, collection } = this.input.source

        const { url } = await service.find({ name }).next() as Source

        const client = new MongoClient(url)

        const filter = ExportService.filter(this.stamps, this.window)

        return { client, database, collection, filter }

    }

    private async target(): Promise<ExportWorkerTarget> {

        const service = Regex.inject(TargetService)

        const { name } = this.input.target

        const { credentials } = await service.find({ name }).next() as Target

        const client = new BigQuery({ credentials })

        const { database } = this.input.source

        const dataset = BigQueryHelper.sanitize({ value: `${this.stamps.dataset.name}${database}` })

        const main = await BigQueryHelper.table({ client, dataset, table: this.table('main') })
        const temporary = await BigQueryHelper.table({ client, dataset, table: this.table('temporary') })

        return { client, dataset, table: { main, temporary } }

    }

    private table(type: 'main' | 'temporary') {

        const { collection } = this.input.source

        let name = BigQueryHelper.sanitize({ value: collection })

        if (type === 'temporary') {
            name = BigQueryHelper.sanitize({ value: `${name}_${this.input.transaction}_temp` })
        }

        return {
            name,
            fields: [
                { name: StampsHelper.DEFAULT_STAMP_ID, type: 'STRING', mode: 'REQUIRED' },
                { name: StampsHelper.DEFAULT_STAMP_INSERT, type: 'TIMESTAMP', mode: 'REQUIRED' },
                { name: 'data', type: 'JSON', mode: 'REQUIRED' },
                { name: 'hash', type: 'STRING', mode: 'REQUIRED' }
            ]
        }

    }

    private row(chunk: any, date: Date) {

        const data = JSON.stringify(this.fix(chunk))

        return {
            [StampsHelper.DEFAULT_STAMP_ID]: chunk[this.stamps.id].toString(),
            [StampsHelper.DEFAULT_STAMP_INSERT]: new BigQueryTimestamp(date),
            data,
            hash: createHash('md5').update(data).digest('hex')
        }

    }

    private fix(object: any): any {

        if (!ObjectHelper.has(object)) {
            return object
        }

        if (Array.isArray(object)) {
            return object.map(item => this.fix(item))
        }

        if (typeof object === 'object') {

            Object.keys(object).forEach(key => {

                if (key.trim() === '') {
                    const value = object[key]
                    delete object[key]
                    object['__empty__'] = this.fix(value)
                    return
                }

                object[key] = this.fix(object[key])

            })

            return object

        }

        return object

    }

    private async consolidate(target: ExportWorkerTarget) {

        this.logger.log(`consolidating temporary data to table "${target.table.main.metadata.id}"...`)

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

    }

}

type ExportWorkerStatisticsRemaining = { count: number }
type ExportWorkerStatisticsIngested = { count: number, bytes: number, percent: number }
type ExportWorkerStatisticsCurrent = { count: number, bytes: number }
type ExportWorkerStatisticsUpdateInput = { rows: any[] }

class ExportWorkerStatistics {

    private _remaining: ExportWorkerStatisticsRemaining
    private _ingested: ExportWorkerStatisticsIngested = { count: 0, bytes: 0, percent: 0 }
    private _current: ExportWorkerStatisticsCurrent = { count: 0, bytes: 0 }
    private _broken = false

    constructor(
        private readonly table: Table,
        _remaining: ExportWorkerStatisticsRemaining
    ) {
        this._remaining = _remaining
    }

    public get broken() { return this._broken }

    public simulate({ rows }: ExportWorkerStatisticsUpdateInput) {

        const __current = {
            count: rows.length,
            bytes: rows.map(sizeof).reduce((sum, value) => sum + value, 0)
        }

        const __remaining = {
            count: this._remaining.count - __current.count
        }

        const count = this._ingested.count + __current.count

        const __ingested = {
            count,
            bytes: this._ingested.bytes + __current.bytes,
            percent: (count / (__remaining.count + count)) * 100
        }

        // https://cloud.google.com/bigquery/quotas#streaming_inserts
        const broken = __ingested.bytes > bytes('17MB')

        return {
            current: __current,
            ingested: __ingested,
            remaining: __remaining,
            broken
        }

    }

    public update(input: ExportWorkerStatisticsUpdateInput) {
        const { current, ingested, remaining, broken } = this.simulate(input)
        this._current = current
        this._ingested = ingested
        this._remaining = remaining
        this._broken = broken
    }

    public toString() {
        return `${this._current.count.toLocaleString('pt-BR')} rows (${bytes(this._current.bytes)}) to bigquery temporary table "${this.table.metadata.id}" (${this._ingested.percent.toFixed(2)}%, ${this._ingested.count.toLocaleString('pt-BR')} rows, ${bytes(this._ingested.bytes)})`
    }

}