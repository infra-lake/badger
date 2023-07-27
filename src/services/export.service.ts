import { BigQuery } from '@google-cloud/bigquery'
import bytes from 'bytes'
import { CountOptions, Document, Filter, FindOptions, MongoClient } from 'mongodb'
import { BadRequestError } from '../exceptions/badrequest.error'
import { BigQueryHelper } from '../helpers/bigquery.helper'
import { EnvironmentHelper } from '../helpers/environment.helper'
import { MongoDBDocument, MongoDBHelper } from '../helpers/mongodb.helper'
import { ObjectHelper } from '../helpers/object.helper'
import { RabbitMQHelper } from '../helpers/rabbitmq.helper'
import { Stamps, StampsHelper } from '../helpers/stamps.helper'
import { StringHelper } from '../helpers/string.helper'
import { Window } from '../helpers/window.helper'
import { Logger, Regex, TransactionalContext } from '../regex'
import { Ingested, IngestedService } from './ingested.service'
import { SettingsService } from './settings.service'
import { Source, SourceService } from './source.service'
import { Target, TargetService } from './target.service'

export interface ExportSource {
    name: Source['name']
    database: string
    collection: string
}

export interface ExportTarget {
    name: Target['name']
}

export interface ExportSettings {
    attempts: number
    limit: number
    stamps: Stamps
}

export interface Export extends MongoDBDocument<Export, 'transaction' | 'source' | 'target'> {
    transaction: string
    source: ExportSource
    target: ExportTarget
    settings: ExportSettings
    window: Window
    status: 'pending' | 'success' | 'error'
    error?: { message: string, cause: any }
}

export type Export4Create = Pick<Export, 'transaction' | 'source' | 'target' | 'settings' | 'window'>
export type Export4Update = Pick<Export, 'status' | 'error'>

export type ExportServiceCleanupInput = Pick<Export, 'target'> & { logger: Logger }
export type ExportServiceDatasetInput = Pick<ExportSource, 'database'> & { prefix: string }
export type ExportServiceTableInput = { client: BigQuery, transaction: Export['transaction'], source: Pick<ExportSource, 'database' | 'collection'>, prefix: string, type: 'main' | 'temporary', create: boolean }
export type ExportServiceSettings = Pick<ExportSettings, 'attempts'| 'limit'>
export type ExportServiceLimits = { count: number, bytes: number }

export class ExportService {

    public static readonly COLLECTION = 'exports'

    private _settings?: ExportServiceSettings
    public settings(input?: Export4Create) {

        if (!ObjectHelper.has(this._settings)) {
            const attempts = parseInt(EnvironmentHelper.get('DEFAULT_EXPORT_SETTING_ATTEMPS', '3'))
            const limit = parseInt(EnvironmentHelper.get('DEFAULT_EXPORT_SETTING_LIMIT', '1000'))
            this._settings = { attempts, limit }
        }
        
        const attempts = input?.settings?.attempts ?? this._settings?.attempts as number
        const limit = input?.settings?.limit ?? this._settings?.limit as number

        const stamps = StampsHelper.extract(input?.settings, 'stamps')
        
        const result: ExportSettings = { attempts, limit, stamps }
        
        return result

    }

    private _limits?: ExportServiceLimits
    public limits() {
        if (!ObjectHelper.has(this._limits)) {
            const count = parseInt(EnvironmentHelper.get('EXPORT_LIMIT_COUNT', '500'))
            const _bytes = bytes(EnvironmentHelper.get('EXPORT_LIMIT_BYTES', '15MB'))
            this._limits = { count, bytes: _bytes }
        }
        return this._limits as ExportServiceLimits
    }

    public find(filter: Filter<Export>, options?: FindOptions<Export>) {
        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const result = MongoDBHelper.find({ client, database, collection: ExportService.COLLECTION, filter, options })
        return result
    }

    public async get({ transaction, source, target }: Pick<Export, 'transaction' | 'source' | 'target'>) {

        const cursor = this.find({ transaction, source, target })

        if (await cursor.hasNext()) {
            return await cursor.next() as Export
        }

        return undefined

    }

    public async count(filter: Partial<Export>, options?: CountOptions) {
        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const result = MongoDBHelper.count({ client, database, collection: ExportService.COLLECTION, filter, options })
        return result
    }

    public async exists(filter: Partial<Export>, options?: CountOptions) {
        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const result = MongoDBHelper.exists({ client, database, collection: ExportService.COLLECTION, filter, options })
        return result
    }

    public async create(input: Export4Create) {

        await this.validate(input);

        input.settings = this.settings(input)
        input.window = await this.window(input);

        (input as Export).status = 'pending'

        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const id = { transaction: input.transaction, source: input.source, target: input.target }

        await MongoDBHelper.save({
            client,
            database,
            collection: ExportService.COLLECTION,
            id,
            document: input as Export
        })

        const queue = `export:${id.source.name}:${id.source.database}:${id.source.collection}:${id.target.name}`

        await RabbitMQHelper.assert({
            kind: 'queue',
            name: queue,
            options: { durable: true }
        })

        await RabbitMQHelper.produce({
            queue,
            content: JSON.stringify({ transaction: id.transaction }),
            options: {
                correlationId: id.transaction
            }
        })

        return input.transaction

    }

    private async window(input: Export4Create) {
        const begin = input.window?.begin ?? await this.last(input)
        const end = input.window?.end ?? new Date();
        return { begin, end }
    }

    public async update(context: TransactionalContext, { transaction, source, target }: Pick<Export, 'transaction' | 'source' | 'target'>, { status, error }: Export4Update) {

        const { logger } = context

        const document = await this.get({ transaction, source, target }) as Export

        document.status = status
        document.error = error

        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)

        const id = { transaction, source, target }

        await MongoDBHelper.save({
            client,
            database,
            collection: ExportService.COLLECTION,
            id,
            document
        })

        await this.cleanup({ logger: logger, target })

    }

    public static filter(stamps: Stamps, window: Window): Document {

        const date = {
            $ifNull: [
                `$${stamps.update}`,
                `$${StampsHelper.DEFAULT_STAMP_UPDATE}`,
                '$updatedAt',
                '$updated_at',
                `$${stamps.insert}`,
                `$${StampsHelper.DEFAULT_STAMP_INSERT}`,
                '$createdAt',
                '$created_at',
                {
                    $convert: {
                        input: `$${stamps.id}`,
                        to: 'date',
                        onError: window.end,
                        onNull: window.end
                    }
                }
            ]
        }

        return {
            $expr: {
                $and: [
                    { $gt: [date, window.begin] },
                    { $lte: [date, window.end] }
                ]
            }
        }

    }

    private async last({ source, target }: Pick<Export4Create, 'source' | 'target'>): Promise<Date> {

        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)

        const cursor = client.db(database).collection(ExportService.COLLECTION).aggregate([
            { $match: { source, target, status: 'success' } },
            {
                $group: {
                    _id: { source: "$source", target: "$target" },
                    value: { $max: "$window.end" }
                }
            }
        ])

        if (await cursor.hasNext()) {
            const { value } = await cursor.next() as any;
            return value
        }

        return new Date(0)

    }

    public async validate(document: Export4Create) {

        if (!ObjectHelper.has(document)) {
            throw new BadRequestError('export is empty')
        }

        if (!ObjectHelper.has(document.source)) {
            throw new BadRequestError('export.source is empty')
        }

        if (!ObjectHelper.has(document.source.name)) {
            throw new BadRequestError('export.source.name is empty')
        }

        const source = await Regex.inject(SourceService).get({ name: document.source.name })
        if (!ObjectHelper.has(source)) {
            throw new BadRequestError('export.source.name is invalid or does not exists')
        }

        let client = undefined

        try {
            client = new MongoClient(source?.url as string)
        } catch (error) {
            throw new BadRequestError(`export.source.name is invalid:`, error)
        }

        if (!ObjectHelper.has(document.source.database)) {
            throw new BadRequestError('export.source.database is empty')
        }

        const databases = await MongoDBHelper.databases({ client })
        if (!databases.map(({ name }) => name).includes(document.source.database)) {
            throw new BadRequestError('export.source.database is invalid or does not exists')
        }

        if (!ObjectHelper.has(document.source.collection)) {
            throw new BadRequestError('export.source.collection is empty')
        }

        const collections = await MongoDBHelper.collections({ client, database: document.source.database })
        if (!collections.map(({ collectionName: name }) => name).includes(document.source.collection)) {
            throw new BadRequestError('export.source.collection is invalid or does not exists')
        }

        if (!ObjectHelper.has(document.target)) {
            throw new BadRequestError('export.target is empty')
        }

        if (!ObjectHelper.has(document.target.name)) {
            throw new BadRequestError('export.target.name is empty')
        }

        const target = await Regex.inject(TargetService).get({ name: document.target.name })
        if (!ObjectHelper.has(source)) {
            throw new BadRequestError('export.target.name is invalid or does not exists')
        }

        try {
            await new BigQuery({ credentials: target?.credentials }).getDatasets({ maxResults: 1 })
        } catch (error) {
            throw new BadRequestError(`export.target.name is invalid:`, error)
        }

        if (ObjectHelper.has(document.settings)) {

            const _limits = this.limits()
            if (ObjectHelper.has(document.settings.limit) && document.settings.limit > _limits.count) {
                throw new BadRequestError('export.settings.limit must not be more than', _limits.count)
            }

            if (ObjectHelper.has(document.settings.attempts) && document.settings.attempts < 0) {
                throw new BadRequestError('export.settings.attempts is invalid')
            }

            if (ObjectHelper.has(document.settings.stamps)) {

                if (ObjectHelper.has(document.settings.stamps.id) && document.settings.stamps.id.trim.length < 1) {
                    throw new BadRequestError('export.settings.stamps.id is invalid')
                }

                if (ObjectHelper.has(document.settings.stamps.insert) && document.settings.stamps.insert.trim.length < 1) {
                    throw new BadRequestError('export.settings.stamps.insert is invalid')
                }

                if (ObjectHelper.has(document.settings.stamps.update) && document.settings.stamps.update.trim.length < 1) {
                    throw new BadRequestError('export.settings.stamps.update is invalid')
                }

            }

        }

    }

    public async delete({ transaction, source, target }: Pick<Export, 'transaction' | 'source' | 'target'>) {

        if (StringHelper.empty(transaction)) {
            throw new BadRequestError(`export.transaction is empty`)
        }

        if (!ObjectHelper.has(source)) {
            throw new BadRequestError(`export.source is empty`)
        }

        if (StringHelper.empty(source.name)) {
            throw new BadRequestError(`export.source.name is empty`)
        }

        if (!ObjectHelper.has(target)) {
            throw new BadRequestError(`export.target is empty`)
        }

        if (StringHelper.empty(target.name)) {
            throw new BadRequestError(`export.target.name is empty`)
        }

        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const id = { transaction, source: { name: source.name }, target: { name: target.name } }

        await MongoDBHelper.delete({ client, database, collection: ExportService.COLLECTION, id })

    }

    public async bigquery({ name }: Pick<ExportTarget, 'name'>) {
        const service = Regex.inject(TargetService)
        const { credentials } = await service.find({ name }).next() as Target
        const client = new BigQuery({ credentials })
        return client
    }

    public dataset({ prefix, database }: ExportServiceDatasetInput) {
        const result = BigQueryHelper.sanitize({ value: `${prefix}${database}` })
        return result
    }

    public async table({ client, transaction, source, prefix, type, create }: ExportServiceTableInput) {

        const { database, collection } = source

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

        const service = Regex.inject(ExportService)

        const dataset = service.dataset({ prefix, database })

        const result = await BigQueryHelper.table({ client, dataset, table: schema, create })

        return result

    }

    private async cleanup({ logger, target: _target }: ExportServiceCleanupInput) {

        const _export = Regex.inject(ExportService)
        const ingested = Regex.inject(IngestedService)

        const _client = await this.bigquery(_target)

        const prefixes = [StampsHelper.DEFAULT_STAMP_DATASET_NAME_PREFIX]

        const exports = _export.find({ status: 'success' })
        while (await exports.hasNext()) {

            const { transaction, source, target, settings } = await exports.next() as Export
            const prefix = settings.stamps.dataset.name

            if (!prefixes.includes(prefix)) {
                prefixes.push(prefix)
            }

            const database = source.database

            const id = { transaction, source, target }

            if (await ingested.exists(id)) {

                try {

                    await ingested.delete(id)

                } catch (error) {
                    logger.error(`does not possible delete temp collection for export (transaction: "${transaction}", source: ${JSON.stringify(source)} , target: ${JSON.stringify(target)}):`, error)
                }

            }

            const dataset = this.dataset({ prefix, database })

            try {

                const client =
                    target.name === target.name
                        ? _client
                        : await this.bigquery(target)

                const temporary = await this.table({ client, transaction, source, prefix, type: 'temporary', create: false })
                await temporary?.delete({ ignoreNotFound: true })

            } catch (error) {
                logger.error(`does not possible delete temporary bigquery table "${dataset}" for export (transaction: "${transaction}", source: ${JSON.stringify(source)} , target: ${JSON.stringify(target)}):`, error)
            }

        }

        const ingests = ingested.find({}, { projection: { transaction: 1, source: 1, target: 1 } })
        while (await ingests.hasNext()) {

            const { transaction, source, target } = await ingests.next() as Ingested
            const id = { transaction, source, target }
            const database = source.database

            await Promise.all(prefixes.map(async (prefix) => {

                const dataset = this.dataset({ prefix, database })

                if (!await _export.exists(id)) {

                    try {

                        await ingested.delete(id)

                        const temporary = await this.table({ client: _client, transaction, source, prefix, type: 'temporary', create: false })
                        await temporary?.delete({ ignoreNotFound: true })

                    } catch (error) {
                        logger.error(`does not possible delete temporary orphan bigquery table "${dataset}":`, error)
                    }

                }

            }))

        }

    }

}