import * as Joi from 'joi'
import { MongoClient, type CountOptions, type Filter, type FindCursor, type FindOptions, type MongoClientOptions, type TransactionOptions } from 'mongodb'
import { type Model, type ClientSession, type FilterQuery, type ProjectionType, type QueryOptions } from 'mongoose'
import { InvalidParameterException } from '../exception'
import { ClassValidatorHelper, CollectionHelper, NestHelper, ObjectHelper, StringHelper } from '../helper'
import { TransactionalLoggerService } from '../logging'
import { TransactionHelper, type TransactionalContext } from '../transaction'
import { type MongoDBDocument } from './mongodb.entity'
import { SchemaFactory } from '@nestjs/mongoose'
import { type Type } from '@nestjs/common'

export interface ICollectionsFilter {
    ignoredCollections?: string[]
}

export const ICollectionsFilterSchema = Joi.object<ICollectionsFilter>().keys({
    ignoredCollections: Joi.array<string>().optional()
}).optional()

export interface IExternalMongoDB {
    client: MongoClient
    database: string
    collection: string
}

export const IExternalMongoDBSchema = Joi.object<IExternalMongoDB>().keys({
    client: Joi.any().required(),
    database: Joi.string().min(2).required(),
    collection: Joi.string().min(2).required()
})

export class MongoDBHelper {

    private constructor() { }

    public static getModelDefinitionsFrom(...targets: Type[]) {
        return targets.map(target => ({
            name: target.name,
            schema: SchemaFactory.createForClass(target)
        }))
    }

    public static async ping(url: string, options?: MongoClientOptions) {
        const client = await MongoDBHelper.connect(url)
        await client.close()
    }

    public static async connect(url: string, options?: MongoClientOptions) {
        if (StringHelper.isEmpty(url)) {
            throw new InvalidParameterException('uri', url)
        }
        const client = await MongoDBHelper.client(url, options)
        return await client.connect()
    }

    public static async client(url: string, options?: MongoClientOptions) {
        if (StringHelper.isEmpty(url)) {
            throw new InvalidParameterException('uri', url)
        }
        return new MongoClient(url, options)
    }

    public static async databases(connection: MongoClient) {
        if (ObjectHelper.isEmpty(connection)) {
            throw new InvalidParameterException('connection', connection)
        }
        const result = await connection.db().admin().listDatabases()
        return result.databases

    }

    public static async collections(connection: MongoClient, database: string, filter?: ICollectionsFilter) {

        if (ObjectHelper.isEmpty(connection)) {
            throw new InvalidParameterException('connection', connection)
        }

        if (ObjectHelper.isEmpty(database)) {
            throw new InvalidParameterException('database', database)
        }

        const result = await connection.db(database).collections()
        if (ObjectHelper.isEmpty(filter)) {
            return result
        }

        const { ignoredCollections } = filter as ICollectionsFilter
        if (CollectionHelper.isEmpty(ignoredCollections)) {
            return result
        }

        return result.filter(({ collectionName }) => !(ignoredCollections as string[]).includes(collectionName))

    }

    public static async get<T extends MongoDBDocument<T, K>, K extends keyof T, V extends IExternalMongoDB | Model<T>>(
        connection: V,
        key: V extends Model<T> ? FilterQuery<Required<Pick<T, K>>> : Filter<T>,
        projection?: V extends Model<T> ? ProjectionType<T> : Document,
        options?: V extends Model<T> ? QueryOptions<T> : FindOptions
    ): Promise<T | undefined> {

        if (ObjectHelper.isEmpty(connection)) {
            throw new InvalidParameterException('connection', connection)
        }

        if (ObjectHelper.isEmpty(key)) {
            throw new InvalidParameterException('key', key)
        }

        if (MongoDBHelper.isMongoose(connection)) {

            const _model = connection as Model<T>
            const _key = key as FilterQuery<Required<Pick<T, K>>>
            const _projection = projection as ProjectionType<T>
            const _options = options as QueryOptions<T>

            const result = await _model.findOne(_key, _projection, _options)

            return result?.toObject() as T | undefined
        }

        Joi.assert(connection, IExternalMongoDBSchema)

        const { client, database, collection } = connection as IExternalMongoDB

        const _key = key as Filter<T>
        const _projection = projection as Document
        const _options = options as FindOptions

        if (!ObjectHelper.isEmpty(_projection) && !ObjectHelper.isEmpty(options?.projection)) {
            _options.projection = {
                ..._projection,
                ...(_options.projection as Document)
            }
        }

        const result = await client.db(database).collection<T>(collection).findOne<T>(_key, _options)

        return result ?? undefined

    }

    public static async list<T extends MongoDBDocument<T, K>, K extends keyof T, V extends IExternalMongoDB | Model<T>>(
        connection: V,
        filter?: V extends Model<T> ? FilterQuery<Partial<T>> : Filter<T>,
        projection?: V extends Model<T> ? ProjectionType<T> : Document,
        options?: V extends Model<T> ? QueryOptions<T> : FindOptions
    ): Promise<V extends Model<T> ? T[] : FindCursor<T>> {

        if (ObjectHelper.isEmpty(connection)) {
            throw new InvalidParameterException('connection', connection)
        }

        if (MongoDBHelper.isMongoose(connection)) {

            const _model = connection as Model<T>
            const _filter = filter as FilterQuery<Required<Pick<T, K>>>
            const _projection = projection as ProjectionType<T>
            const _options = options as QueryOptions<T>

            const documents = await _model.find(_filter, _projection, _options).exec()
            const result = documents.map(document => document.toObject())

            return (result ?? []) as any

        }

        Joi.assert(connection, IExternalMongoDBSchema)

        const { client, database, collection } = connection as IExternalMongoDB

        const _filter = filter as Filter<T>
        const _projection = projection as Document
        const _options = options as FindOptions

        if (!ObjectHelper.isEmpty(_projection) && !ObjectHelper.isEmpty(options?.projection)) {
            _options.projection = {
                ..._projection,
                ...(_options.projection as Document)
            }
        }

        const result = client.db(database).collection<T>(collection).find(_filter, _options)

        if (!ObjectHelper.isNullOrUndefined(_options?.sort)) {
            return result.allowDiskUse() as any
        }

        return result as any

    }

    public static async count<T extends MongoDBDocument<T, K>, K extends keyof T, V extends IExternalMongoDB | Model<T>>(
        connection: V,
        filter?: V extends Model<T> ? FilterQuery<Partial<T>> : Filter<T>,
        options?: V extends Model<T> ? QueryOptions<T> : CountOptions
    ): Promise<number> {

        if (ObjectHelper.isEmpty(connection)) {
            throw new InvalidParameterException('connection', connection)
        }

        if (MongoDBHelper.isMongoose(connection)) {

            const _model = connection as Model<T>
            const _filter = filter as FilterQuery<Required<Pick<T, K>>>
            const _options = options as QueryOptions<T>

            const result = await _model.countDocuments(_filter, _options).exec()

            return result

        }

        Joi.assert(connection, IExternalMongoDBSchema)

        const { client, database, collection } = connection as IExternalMongoDB

        const _filter = filter as Filter<T>
        const _options = options as CountOptions

        const result = await client.db(database).collection<T>(collection).countDocuments(_filter, _options)

        return result

    }

    public static async exists<T extends MongoDBDocument<T, K>, K extends keyof T, V extends IExternalMongoDB | Model<T>>(
        connection: V,
        filter?: V extends Model<T> ? FilterQuery<Partial<T>> : Filter<T>,
        options?: V extends Model<T> ? QueryOptions<T> : CountOptions
    ) {

        if (ObjectHelper.isEmpty(connection)) {
            throw new InvalidParameterException('connection', connection)
        }

        const count = await MongoDBHelper.count(connection, filter, options)
        const result = count > 0
        return result
    }

    public static async withTransaction<T extends MongoDBDocument<T, K>, K extends keyof T, N>(
        connection: Model<T>,
        callback: (session: ClientSession) => Promise<N>,
        options?: TransactionOptions
    ): Promise<N> {

        if (ObjectHelper.isEmpty(connection)) {
            throw new InvalidParameterException('connection', connection)
        }

        if (ObjectHelper.isNullOrUndefined(callback)) {
            throw new InvalidParameterException('callback', callback)
        }

        const session = await connection.startSession()

        let result

        await session.withTransaction(async (session) => {
            result = await callback(session)
        }, options)

        return result as N

    }

    public static async save<T extends MongoDBDocument<T, K>, K extends keyof T>(
        context: TransactionalContext,
        connection: Model<T>,
        key: FilterQuery<Required<Pick<T, K>>>,
        value: Partial<Omit<T, K>>,
        options?: TransactionOptions
    ) {

        if (ObjectHelper.isEmpty(context)) { throw new InvalidParameterException('context', context) }
        if (ObjectHelper.isEmpty(connection)) { throw new InvalidParameterException('connection', connection) }
        if (ObjectHelper.isEmpty(key)) { throw new InvalidParameterException('key', key) }
        if (ObjectHelper.isNullOrUndefined(value)) { throw new InvalidParameterException('value', value) }

        return await MongoDBHelper.withTransaction<T, K, T>(connection, async () => {

            const exists = await MongoDBHelper.exists(connection, key)

            const result = exists
                ? await MongoDBHelper.update(context, connection, key, value)
                : await MongoDBHelper.create(context, connection, key, value)

            return result

        }, options)

    }

    public static async create<T extends MongoDBDocument<T, K>, K extends keyof T>(
        context: TransactionalContext,
        connection: Model<T>,
        key: FilterQuery<Required<Pick<T, K>>>,
        value: Partial<Omit<T, K>>
    ) {

        const logger = NestHelper.get(TransactionalLoggerService)

        if (ObjectHelper.isEmpty(context)) { throw new InvalidParameterException('context', context) }
        if (ObjectHelper.isEmpty(connection)) { throw new InvalidParameterException('connection', connection) }
        if (ObjectHelper.isEmpty(key)) { throw new InvalidParameterException('key', key) }
        if (ObjectHelper.isNullOrUndefined(value)) { throw new InvalidParameterException('value', value) }

        await ClassValidatorHelper.validate('key', key)
        await ClassValidatorHelper.validate('value', value)

        if (await MongoDBHelper.exists(connection, key)) {
            throw new InvalidParameterException('key', key)
        }

        Object.keys(key).forEach(field => {
            value[field] = key[field]
        });

        (value as any).transaction = TransactionHelper.getTransactionIDFrom(context)

        const entity = new connection(value)

        const result = await entity.save()

        logger.debug?.(MongoDBHelper.name, context, 'inserted on database', {
            database: connection.db.name,
            collection: connection.collection.name,
            model: connection.modelName,
            identification: key,
            new: value
        })

        return result.toObject() as T

    }

    public static async update<T extends MongoDBDocument<T, K>, K extends keyof T>(
        context: TransactionalContext,
        connection: Model<T>,
        key: FilterQuery<Required<Pick<T, K>>>,
        value: Partial<Omit<T, K>>
    ) {

        const logger = NestHelper.get(TransactionalLoggerService)

        if (ObjectHelper.isEmpty(context)) { throw new InvalidParameterException('context', context) }
        if (ObjectHelper.isEmpty(connection)) { throw new InvalidParameterException('connection', connection) }
        if (ObjectHelper.isEmpty(key)) { throw new InvalidParameterException('key', key) }
        if (ObjectHelper.isNullOrUndefined(value)) { throw new InvalidParameterException('value', value) }

        await ClassValidatorHelper.validate('key', key)
        await ClassValidatorHelper.validate('value', value)

        const dto = await MongoDBHelper.get(connection, key)

        if (ObjectHelper.isNullOrUndefined(dto)) {
            throw new InvalidParameterException('key', key)
        }

        await connection.updateOne(key, value)

        logger.debug?.(MongoDBHelper.name, context, 'updated on database', {
            database: connection.db.name,
            collection: connection.collection.name,
            model: connection.modelName,
            identification: key,
            old: dto,
            new: value
        })

        return await MongoDBHelper.get(connection, key) as T

    }

    public async delete<T extends MongoDBDocument<T, K>, K extends keyof T>(
        context: TransactionalContext,
        connection: Model<T>,
        key: FilterQuery<Required<Pick<T, K>>>
    ): Promise<void> {

        const logger = NestHelper.get(TransactionalLoggerService)

        if (ObjectHelper.isEmpty(context)) { throw new InvalidParameterException('context', context) }
        if (ObjectHelper.isEmpty(connection)) { throw new InvalidParameterException('connection', connection) }
        if (ObjectHelper.isEmpty(key)) { throw new InvalidParameterException('key', key) }

        const dto = await MongoDBHelper.get(connection, key)

        if (ObjectHelper.isNullOrUndefined(dto)) {
            throw new InvalidParameterException('key', key)
        }

        const { deletedCount } = await connection.deleteOne(key)

        if (deletedCount <= 0) {
            throw new InvalidParameterException('key', key)
        }

        logger.debug?.(MongoDBHelper.name, context, 'deleted on database', {
            database: connection.db.name,
            collection: connection.collection.name,
            model: connection.modelName,
            identification: key,
            old: dto
        })

    }

    private static isMongoose<T extends MongoDBDocument<T, K>, K extends keyof T, V extends IExternalMongoDB | Model<T>>(connection: V) {
        return 'base' in connection && connection.base.constructor.name === 'Mongoose'
    }

}
