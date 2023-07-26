import { CountOptions, Filter, FindOptions, MongoClient } from 'mongodb'
import { BadRequestError } from '../exceptions/badrequest.error'
import { MongoDBDocument, MongoDBHelper } from '../helpers/mongodb.helper'
import { ObjectHelper } from '../helpers/object.helper'
import { StringHelper } from '../helpers/string.helper'
import { Regex } from '../regex'
import { ExportSource, ExportTarget } from './export.service'
import { SettingsService } from './settings.service'

export interface Ingested extends MongoDBDocument<Ingested, 'transaction' | 'source' | 'target'> {
    transaction: string,
    source: ExportSource,
    target: ExportTarget,
    hashs: Array<string>
}

export class IngestedService {

    public static readonly COLLECTION = 'ingesteds'

    public find(filter?: Filter<Ingested>, options?: FindOptions<Ingested>) {
        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const result = MongoDBHelper.find({ client, database, collection: IngestedService.COLLECTION, filter, options })
        return result
    }

    public async exists(filter: Partial<Ingested>, options?: CountOptions) {
        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const result = MongoDBHelper.exists({ client, database, collection: IngestedService.COLLECTION, filter, options })
        return result
    }

    public async save(document: Ingested) {

        await this.validate(document)

        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const id = { transaction: document.transaction, source: document.source, target: document.target }

        await MongoDBHelper.save({ client, database, collection: IngestedService.COLLECTION, id, document })

    }

    public async validate(entity: Ingested) {

        if (!ObjectHelper.has(entity)) {
            throw new BadRequestError('ingested is empty')
        }

        if (StringHelper.empty(entity.transaction)) {
            throw new BadRequestError('ingested.transaction is empty')
        }

        if (!ObjectHelper.has(entity.source)) {
            throw new BadRequestError('ingested.source is empty')
        }

        if (StringHelper.empty(entity.source.name)) {
            throw new BadRequestError('ingested.source.name is empty')
        }

        if (StringHelper.empty(entity.source.database)) {
            throw new BadRequestError('ingested.source.database is empty')
        }

        if (StringHelper.empty(entity.source.collection)) {
            throw new BadRequestError('ingested.source.collection is empty')
        }

        if (StringHelper.empty(entity.target.name)) {
            throw new BadRequestError('ingested.target.name is empty')
        }

    }

    public async delete(document: Omit<Ingested, 'hashs'>) {

        this.validate(document as Ingested)

        const { transaction, source, target } = document

        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)


        const id = { transaction, source, target }
        await MongoDBHelper.delete({ client, database, collection: IngestedService.COLLECTION, id })

    }

}