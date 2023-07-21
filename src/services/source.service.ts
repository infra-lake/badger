import { CountOptions, FindOptions, MongoClient } from 'mongodb'
import { BadRequestError } from '../exceptions/badrequest.error'
import { MongoDBDocument, MongoDBHelper } from '../helpers/mongodb.helper'
import { ObjectHelper } from '../helpers/object.helper'
import { Regex } from '../regex'
import { SettingsService } from './settings.service'
import { StringHelper } from '../helpers/string.helper'
import { ExportService } from './export.service'

export interface Source extends MongoDBDocument<Source, 'name'> {
    name: string
    url: string
}

export class SourceService {
    
    public static readonly COLLECTION = 'sources'

    public find(filter: Partial<Source>, options?: FindOptions<Source>) {
        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const result = MongoDBHelper.find({ client, database, collection: SourceService.COLLECTION, filter, options })
        return result
    }

    public async count(filter: Partial<Source>, options?: CountOptions) {
        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const result = MongoDBHelper.count({ client, database, collection: SourceService.COLLECTION, filter, options })
        return result
    }

    public async exists(filter: Partial<Source>, options?: CountOptions) {
        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const result = MongoDBHelper.exists({ client, database, collection: SourceService.COLLECTION, filter, options })
        return result
    }

    public async save(document: Source) {

        await this.validate(document)

        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const id = { name: document.name }

        await MongoDBHelper.save({ client, database, collection: SourceService.COLLECTION, id, document })

    }

    public async validate(document: Source) {

        if (!ObjectHelper.has(document)) {
            throw new BadRequestError('source is empty')
        }

        if (StringHelper.empty(document.name)) {
            throw new BadRequestError('source.name is empty')
        }

        if (StringHelper.empty(document.url)) {
            throw new BadRequestError('source.url is empty')
        }

        try {
            await new MongoClient(document.url).connect()
        } catch (error) {
            throw new BadRequestError(`does not possible to connect at mongodb with received url, error:`, error)
        }

    }

    public async delete({ name }: Pick<Source, 'name'>) {
        
        if (StringHelper.empty(name)) {
            throw new BadRequestError(`source.name is empty`)
        }

        const _export = Regex.inject(ExportService)
        const count = await _export.count({ source: { name } as any })
        if (count > 0) {
            throw new BadRequestError(`there are ${count} exports containing source "${name}"`)
        }

        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const id = { name }

        await MongoDBHelper.delete({ client, database, collection: SourceService.COLLECTION, id })

    }

}