import { InvalidParameterException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, DeserializationHelper, FileSystemHelper, ObjectHelper, StringHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper, type ICollectionsFilter, type IExternalMongoDB } from '@badger/common/mongodb'
import { StampsHelper, type StampsDTO } from '@badger/common/stamps'
import { TransactionHelper, type TransactionalContext } from '@badger/common/transaction'
import { type WindowDTO } from '@badger/common/window'
import { BigQueryTimestamp } from '@google-cloud/bigquery'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { createHash } from 'crypto'
import { type AggregateOptions, type Filter } from 'mongodb'
import { Model } from 'mongoose'
import { type Source4CountOrReadDocumentsDTO, type Source4DownloadDocumentsDTO, type Source4SearchDTO, type SourceDTO, type SourceDTO4SaveDTO, type SourceKeyDTO } from './source.dto'
import { Source } from './source.entity'

@Injectable()
export class SourceService {

    public constructor(
        private readonly logger: TransactionalLoggerService,
        @InjectModel(Source.name) private readonly model: Model<Source>
    ) { }

    public async save(context: TransactionalContext, dto: SourceDTO4SaveDTO) {

        if (ObjectHelper.isEmpty(context)) { throw new InvalidParameterException('context', context) }

        try {
            await ClassValidatorHelper.validate('dto', dto)
        } catch (error) {
            throw new BadRequestException(error)
        }

        const { name, url, filter } = dto

        try {
            await MongoDBHelper.ping(url)
        } catch (error) {
            throw new BadRequestException([
                'unable to connect to mongodb using the provided url', error.message
            ])
        }

        const value: Partial<Omit<Source, 'name'>> = { url }

        if (!ObjectHelper.isEmpty(filter) && !CollectionHelper.isEmpty(filter?.ignoredCollections)) {
            value.filter = filter
        }

        const found = await MongoDBHelper.get<Source, 'name', Model<Source>>(this.model, { name }, { stamps: 1 })
        value.stamps = StampsHelper.mergeOrDefault(value.stamps, found?.stamps)

        await MongoDBHelper.save<Source, 'name'>(context, this.model, { name }, value)

        return { transaction: TransactionHelper.getTransactionIDFrom(context) }

    }

    public async delete(context: TransactionalContext, dto: SourceKeyDTO) {

        if (ObjectHelper.isEmpty(context)) { throw new InvalidParameterException('context', context) }

        try {
            await ClassValidatorHelper.validate('dto', dto)
        } catch (error) {
            throw new BadRequestException(error)
        }

        await MongoDBHelper.delete<Source, 'name'>(context, this.model, dto)

        return { transaction: TransactionHelper.getTransactionIDFrom(context) }

    }

    public async get(key: SourceKeyDTO) {
        return await MongoDBHelper.get<Source, 'name', Model<Source>>(this.model, key)
    }

    public async list(filter: Source4SearchDTO) {
        return await MongoDBHelper.list<Source, 'name', Model<Source>>(this.model, filter)
    }

    public async getCollections(source: SourceKeyDTO, database: string, filter?: ICollectionsFilter) {
        const client = await this.connect(source)
        const result = await MongoDBHelper.collections(client, database, filter)
        return result.map(({ collectionName: _collection }) => _collection)
    }

    public async connect(dto: SourceKeyDTO | SourceDTO) {

        await ClassValidatorHelper.validate('dto', dto)

        let url: string

        if ('url' in dto && !StringHelper.isEmpty(dto.url)) {
            url = dto.url
        } else {
            const source = await MongoDBHelper.get(this.model, { name: dto.name }) as Source
            if (ObjectHelper.isEmpty(source)) {
                throw new InvalidParameterException('source', { name: dto.name })
            }
            url = source.url
        }

        const client = await MongoDBHelper.connect(url)
        if (ObjectHelper.isEmpty(client)) {
            throw new InvalidParameterException('dto', dto)
        }

        return client

    }

    public async downloadDocuments(context: TransactionalContext, dto: Source4DownloadDocumentsDTO) {

        if (ObjectHelper.isEmpty(context)) { throw new InvalidParameterException('context', context) }

        await ClassValidatorHelper.validate('dto', dto)

        const count = await this.countDocuments(context, dto)
        if (count <= 0) {
            return count
        }

        const fileDescriptor = FileSystemHelper.openFileForAppendData(context, dto.tempDir, dto.tempFile, true)

        try {

            let appends = 0

            const cursor = await this.readDocuments(dto)

            while (await cursor.hasNext()) {

                const chunk = await cursor.next()

                if (ObjectHelper.isEmpty(chunk)) { continue }

                const row = this.createRow(chunk, dto.date)

                FileSystemHelper.appendRowOnFile(context, fileDescriptor, row)

                this.logStatistics(context, fileDescriptor, count, ++appends)

            }

            await cursor.close()

        } finally {
            FileSystemHelper.closeFileForAppendData(context, fileDescriptor)
        }

        return count

    }

    private async countDocuments(context: TransactionalContext, dto: Source4CountOrReadDocumentsDTO) {

        await ClassValidatorHelper.validate('dto', dto)

        const { stamps, database, _collection, window } = dto

        const filter = this.getFilterFrom(window, stamps)

        const client = await this.connect(dto)

        const connection: IExternalMongoDB = { client, database, collection: _collection }

        const result = await MongoDBHelper.count(connection, filter)

        this.logger.debug?.(SourceService.name, context, 'documents found', { result })

        return result

    }

    private async readDocuments(dto: Source4CountOrReadDocumentsDTO) {

        await ClassValidatorHelper.validate('dto', dto)

        const { stamps, database, _collection, window } = dto

        const filter = this.getFilterFrom(window, stamps)

        const client = await this.connect(dto)

        const options: AggregateOptions = { allowDiskUse: true }
        return client.db(database).collection(_collection).aggregate([
            { $addFields: { temporary: 1, [StampsHelper.DEFAULT_STAMP_UPDATE]: filter.$expr.$and[0].$gt[0] } },
            { $addFields: { match: filter.$expr } },
            { $project: { temporary: 0 } },
            { $match: { match: true } },
            { $project: { match: 0 } },
            { $sort: { [StampsHelper.DEFAULT_STAMP_UPDATE]: 1 } }
        ], options)

    }

    private getFilterFrom(window: WindowDTO, stamps: StampsDTO): Filter<any> {

        const date = {
            $ifNull: [
                `$${stamps.update}`,
                `$${StampsHelper.DEFAULT_STAMP_UPDATE}`,
                '$updatedAt',
                '$updated_at',
                '$updatedat',
                `$${stamps.insert}`,
                `$${StampsHelper.DEFAULT_STAMP_INSERT}`,
                '$createdAt',
                '$created_at',
                '$createdat',
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
                    // eslint-disable-next-line array-element-newline
                    { $gt: [date, window.begin] },
                    { $lte: [date, window.end] }
                ]
            }
        }

    }

    private createRow(chunk: any, date: Date) {

        const data = DeserializationHelper.fix(chunk)

        return {
            [StampsHelper.DEFAULT_STAMP_ID]: chunk[StampsHelper.DEFAULT_STAMP_ID].toString(),
            [StampsHelper.DEFAULT_STAMP_INSERT]: new BigQueryTimestamp(date).value,
            data,
            hash: createHash('md5').update(JSON.stringify(data)).digest('hex')
        }

    }

    private logStatistics(context: TransactionalContext, fileDescriptor: number, count: number, appends: number) {
        const statistics = {
            count: appends,
            total: count.toLocaleString('pt-BR'),
            percent: ((appends / count) * 100).toFixed(2),
            size: FileSystemHelper.getFileSizeFrom(fileDescriptor)
        }

        this.logger.log(SourceService.name, context, `append statistics: ${statistics.count} of ${statistics.total} rows, ${statistics.percent} %, ${statistics.size})`)
    }

}
