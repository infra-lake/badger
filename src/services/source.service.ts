import { MongoClient } from 'mongodb'
import { BadRequestError } from '../exceptions/bad-request.error'
import { MongoDBDocument, MongoDBHelper, MongoDBService, MongoDBValidationInput } from '../helpers/mongodb.helper'
import { StringHelper } from '../helpers/string.helper'
import { Export } from './export.service'
import { SettingsService } from './settings.service'

export interface Source extends MongoDBDocument<Source, 'name'> {
    name: string
    url: string
}

export type SourceCollectionsInput = Pick<Source, 'name'> & { database: Export['database'] }

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

}