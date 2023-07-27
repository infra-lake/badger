import { CountOptions, Filter, FindOptions, MongoClient } from 'mongodb'
import { BadRequestError } from '../exceptions/badrequest.error'
import { MongoDBDocument, MongoDBHelper } from '../helpers/mongodb.helper'
import { ObjectHelper } from '../helpers/object.helper'
import { StringHelper } from '../helpers/string.helper'
import { Regex } from '../regex'
import { ExportSource, ExportTarget } from './export.service'
import { SettingsService } from './settings.service'

export interface Temp extends MongoDBDocument<Temp, 'transaction' | 'source' | 'target'> {
    transaction: string,
    source: ExportSource,
    target: ExportTarget,
    date: Date,
    count: number
}

export class TempService {

    public static readonly COLLECTION = 'temps'

    public find(filter?: Filter<Temp>, options?: FindOptions<Temp>) {
        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const result = MongoDBHelper.find({ client, database, collection: TempService.COLLECTION, filter, options })
        return result
    }

    public async exists(filter: Partial<Temp>, options?: CountOptions) {
        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const result = MongoDBHelper.exists({ client, database, collection: TempService.COLLECTION, filter, options })
        return result
    }

    public async save(document: Temp) {

        await this.validate(document)

        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const id = { transaction: document.transaction, source: document.source, target: document.target }

        await MongoDBHelper.save({ client, database, collection: TempService.COLLECTION, id, document })

    }

    public async validate(entity: Temp) {

        if (!ObjectHelper.has(entity)) {
            throw new BadRequestError('temp is empty')
        }

        if (StringHelper.empty(entity.transaction)) {
            throw new BadRequestError('temp.transaction is empty')
        }

        if (!ObjectHelper.has(entity.source)) {
            throw new BadRequestError('temp.source is empty')
        }

        if (StringHelper.empty(entity.source.name)) {
            throw new BadRequestError('temp.source.name is empty')
        }

        if (StringHelper.empty(entity.source.database)) {
            throw new BadRequestError('temp.source.database is empty')
        }

        if (StringHelper.empty(entity.source.collection)) {
            throw new BadRequestError('temp.source.collection is empty')
        }

        if (StringHelper.empty(entity.target.name)) {
            throw new BadRequestError('temp.target.name is empty')
        }

    }

    public async delete(document: Omit<Temp, 'date' | 'count'>) {

        this.validate(document as Temp)

        const { transaction, source, target } = document

        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)


        const id = { transaction, source, target }
        await MongoDBHelper.delete({ client, database, collection: TempService.COLLECTION, id })

    }

}