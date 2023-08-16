import { AggregateOptions, AggregationCursor, MongoClient } from 'mongodb'
import { BadRequestError } from '../exceptions/bad-request.error'
import { MongoDBDocument, MongoDBHelper, MongoDBService, MongoDBValidationInput } from '../helpers/mongodb.helper'
import { StringHelper } from '../helpers/string.helper'
import { Export, ExportService } from './export/service'
import { SettingsService } from './settings.service'
import { BatchIncomingMessage } from '../regex/batch'
import { ExportTask, ExportTaskService } from './export/task/service'
import { Regex } from '../regex'
import { StampsHelper } from '../helpers/stamps.helper'

export interface Source extends MongoDBDocument<Source, 'name'> {
    name: string
    url: string
}

export type SourceCollectionsInput = Pick<Source, 'name'> & { database: Export['database'] }

export type SourceInput = { context: BatchIncomingMessage, task: ExportTask }
export type SourceOutput = {
    name: string
    count: () => Promise<number>
    find: () => AggregationCursor<Source>
}

export class SourceService extends MongoDBService<Source, 'name'> {

    protected get database() { return SettingsService.DATABASE }
    public get collection() { return 'sources' }

    protected async validate({ id, document, on }: MongoDBValidationInput<Source, 'name'>) {

        const { name } = id
        if (StringHelper.empty(name)) {
            throw new BadRequestError('source id is empty')
        }

        const { url } = document ?? {}
        if (StringHelper.empty(url)) {
            throw new BadRequestError('source is empty')
        }

        await this.test({ url })

    }

    public async test({ url }: Pick<Source, 'url'>) {
        try {
            await new MongoClient(url as string).connect()
        } catch (error) {
            throw new BadRequestError(`does not possible to connect at mongodb with received url, error:`, error)
        }
    }

    public async collections({ name, database }: SourceCollectionsInput) {

        const { url } = await this.get({ id: { name } }) as Source

        const client = new MongoClient(url)

        const result = await MongoDBHelper.collections({ client, database })

        return result.map(({ collectionName: collection }) => ({ collection }))

    }

    public async connect({ name }: Pick<Source, 'name'>) {
        const { url } = await this.get({ id: { name } }) as Source
        const client = new MongoClient(url)
        return client
    }

    public async source({ context, task }: SourceInput): Promise<SourceOutput> {

        const { transaction, source, target, database, collection, status, worker } = task

        const sources = Regex.inject(SourceService)
        
        context.logger.debug('connecting to source ', source, '...')
        const client = await sources.connect({ name: source })
        context.logger.debug('connected to source', source, 'successfully !!!')
        
        context.logger.debug('defining window range...')

        const tasks = Regex.inject(ExportTaskService)
        const begin = await tasks.last({ source, target, database, collection })
        const end = context.date        
        const window = { begin, end }
        await tasks.save({ 
            context, 
            id: { transaction, source, target, database, collection }, 
            document: { window } 
        })

        context.logger.debug('window range defined:', window)
        
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

}