import { CountOptions, Document, Filter, FindOptions, MongoClient, OptionalUnlessRequiredId, WithoutId } from 'mongodb'
import { BadRequestError } from '../exceptions/bad-request.error'
import { Regex, TransactionalContext } from '../regex'
import { ApplicationHelper } from './application.helper'
import { ObjectHelper } from './object.helper'
import { StampsHelper } from './stamps.helper'

export type MongoDBDatabasesInput = { client: MongoClient }
export type MongoDBCollectionsInput = { client: MongoClient, database: string }
export type MongoDBFindInput<T extends Document = Document> = { context?: TransactionalContext, client: MongoClient, database: string, collection: string, filter?: Filter<T>, options?: FindOptions<T> }
export type MongoDBGetInput<T extends MongoDBDocument<T, K>, K extends keyof T> = { context?: TransactionalContext, client: MongoClient, database: string, collection: string, id: Filter<T> }
export type MongoDBCountInput<T extends Document = Document> = { context?: TransactionalContext, client: MongoClient, database: string, collection: string, filter: Filter<T>, options?: CountOptions }
export type MongoDBExistsInput<T extends Document = Document> = MongoDBCountInput<T>
export type MongoDBValidationInput<T extends MongoDBDocument<T, K>, K extends keyof T> = { context?: TransactionalContext, id: Pick<T, K>, document?: Omit<T, K>, on: 'insert' | 'update' | 'delete' | string }
export type MongoDBValidation<T extends MongoDBDocument<T, K>, K extends keyof T> = (input: MongoDBValidationInput<T, K>) => Promise<void>
export type MongoDBSaveInput<T extends MongoDBDocument<T, K>, K extends keyof T> = { context?: TransactionalContext, client: MongoClient, database: string, collection: string, id: Filter<T>, document: Omit<T, K>, validate: MongoDBValidation<T, K> }
export type MongoDBLastInput = { client: MongoClient, database: string, collection: string, match: any, id: string, sortBy: any, output: string[] }
export type MongoDBDeleteInput<T extends MongoDBDocument<T, K>, K extends keyof T> = { context?: TransactionalContext, client: MongoClient, database: string, collection: string; id: Filter<T>, validate: MongoDBValidation<T, K> }

export interface MongoDBDocument<T extends MongoDBDocument<T, K>, K extends keyof T> extends Document { }

export abstract class MongoDBService<T extends MongoDBDocument<T, K>, K extends keyof T> {

    protected abstract get database(): string
    public abstract get collection(): string

    protected get client() { return Regex.inject(MongoClient) }
    protected get _database() { return this.client.db(this.database) }
    protected get _collection() { return this._database.collection<T>(this.collection) }

    protected get helper() {

        const client = this.client
        const database = this.database

        return {

            async collections() { return await MongoDBHelper.collections({ client, database }) },

            async get<T extends MongoDBDocument<T, K>, K extends keyof T>({ context, collection, id }: Omit<MongoDBGetInput<T, K>, 'client' | 'database'>): Promise<T | undefined> {
                return await MongoDBHelper.get<T, K>({ context, client, database, collection, id })
            },

            find<T extends Document = Document>({ context, collection, filter, options }: Omit<MongoDBFindInput<T>, 'client' | 'database'>) {
                return MongoDBHelper.find<T>({ context, client, database, collection, filter, options })
            },

            async count<T extends Document = Document>({ context, collection, filter, options }: Omit<MongoDBCountInput<T>, 'client' | 'database'>) {
                return await MongoDBHelper.count<T>({ context, client, database, collection, filter, options })
            },

            async exists<T extends Document = Document>({ context, collection, filter, options }: Omit<MongoDBExistsInput<T>, 'client' | 'database'>) {
                return await MongoDBHelper.exists<T>({ context, client, database, collection, filter, options })
            },

            async save<T extends MongoDBDocument<T, K>, K extends keyof T>({ context, collection, id, document, validate }: Omit<MongoDBSaveInput<T, K>, 'client' | 'database'>) {
                return await MongoDBHelper.save<T, K>({ context, client, database, collection, id, document, validate })
            },

            async delete<T extends MongoDBDocument<T, K>, K extends keyof T>({ context, collection, id, validate }: Omit<MongoDBDeleteInput<T, K>, 'client' | 'database'>) {
                return await MongoDBHelper.delete<T, K>({ context, client, database, collection, id, validate })
            }

        }

    }

    protected abstract validate(input: MongoDBValidationInput<T, K>): Promise<void>

    public async get({ context, id }: Pick<MongoDBGetInput<T, K>, 'context' | 'id'>) {
        return await MongoDBHelper.get<T, K>({ context, client: this.client, database: this.database, collection: this.collection, id })
    }

    public find({ context, filter, options }: Pick<MongoDBFindInput<T>, 'context' | 'filter' | 'options'>) {
        return MongoDBHelper.find({ context, client: this.client, database: this.database, collection: this.collection, filter, options })
    }

    public async count({ context, filter, options }: Pick<MongoDBCountInput<T>, 'context' | 'filter' | 'options'>) {
        return await MongoDBHelper.count({ context, client: this.client, database: this.database, collection: this.collection, filter, options })
    }

    public async exists({ context, filter, options }: Pick<MongoDBExistsInput<T>, 'context' | 'filter' | 'options'>) {
        return await MongoDBHelper.exists({ context, client: this.client, database: this.database, collection: this.collection, filter, options })
    }

    public async save({ context, id, document }: Pick<MongoDBSaveInput<T, K>, 'context' | 'id' | 'document'>) {
        return await MongoDBHelper.save({ context, client: this.client, database: this.database, collection: this.collection, id, document, validate: this.validate.bind(this) })
    }

    public async delete({ context, id }: Pick<MongoDBDeleteInput<T, K>, 'context' | 'id'>) {
        return await MongoDBHelper.delete({ context, client: this.client, database: this.database, collection: this.collection, id, validate: this.validate.bind(this) })

    }

}

export class MongoDBHelper {

    private constructor() { }

    public static async databases({ client }: MongoDBDatabasesInput) {
        const result = await client.db().admin().listDatabases()
        return result.databases
    }

    public static async collections({ client, database }: MongoDBCollectionsInput) {
        const result = await client.db(database).collections()
        return result.filter(({ collectionName }) => !ApplicationHelper.IGNORE.COLLECTIONS.includes(collectionName))
    }

    public static async get<T extends MongoDBDocument<T, K>, K extends keyof T>({ client, database, collection, id }: MongoDBGetInput<T, K>): Promise<T | undefined> {
        const result = await client.db(database).collection<T>(collection).findOne<T>(id)
        return result ?? undefined
    }

    public static find<T extends Document = Document>({ client, database, collection, filter, options }: MongoDBFindInput<T>) {
        const result = client.db(database).collection<T>(collection).find(filter as any, options)
        if (ObjectHelper.has(options?.sort)) {
            return result.allowDiskUse()
        }
        return result
    }

    public static async count<T extends Document = Document>({ client, database, collection, filter, options }: MongoDBCountInput<T>) {
        const result = await client.db(database).collection<T>(collection).countDocuments(filter, options)
        return result
    }

    public static async exists<T extends Document = Document>(input: MongoDBExistsInput<T>) {
        const count = await MongoDBHelper.count(input)
        const result = count > 0
        return result
    }

    public static async save<T extends MongoDBDocument<T, K>, K extends keyof T>({ context, client, database, collection, id, document, validate }: MongoDBSaveInput<T, K>) {
        if (await MongoDBHelper.exists({ client, database, collection, filter: id as any })) {
            await validate({ id: id as Pick<T, K>, document, on: 'update' })
            const found = await MongoDBHelper.get({ context, client, database, collection, id })
            const updated = { ...found, ...document, ...id, [StampsHelper.DEFAULT_STAMP_UPDATE]: new Date() } as WithoutId<T>
            delete updated['_id']
            await client.db(database).collection<T>(collection).findOneAndReplace(id, updated, { upsert: true })
            return
        }
        await validate({ id: id as Pick<T, K>, document, on: 'insert' })
        await client.db(database).collection<T>(collection).insertOne({ ...document, ...id, [StampsHelper.DEFAULT_STAMP_INSERT]: new Date() } as any as OptionalUnlessRequiredId<T>)
    }

    public static async delete<T extends MongoDBDocument<T, K>, K extends keyof T>({ client, database, collection, id, validate }: MongoDBDeleteInput<T, K>) {
        if (!ObjectHelper.has(id)) { throw new BadRequestError('id is empty') }
        const document = await this.get<T, K>({ client, database, collection, id }) as T
        await validate({ id: id as Pick<T, K>, document, on: 'delete' })
        if (!ObjectHelper.has(document)) { throw new BadRequestError(`document no found for id: ${JSON.stringify(id)}`) }
        await client.db(database).collection<T>(collection).deleteOne(id)
    }

}