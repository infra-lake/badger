import { BigQuery } from '@google-cloud/bigquery'
import { BadRequestError } from '../exceptions/bad-request.error'
import { MongoDBDocument, MongoDBService, MongoDBValidationInput } from '../helpers/mongodb.helper'
import { ObjectHelper } from '../helpers/object.helper'
import { StringHelper } from '../helpers/string.helper'
import { SettingsService } from './settings.service'

export interface Target extends MongoDBDocument<Target, 'name'> {
    name: string
    credentials: any
}

export class TargetService extends MongoDBService<Target, 'name'> {

    protected get database() { return SettingsService.DATABASE }
    public get collection() { return 'targets' }

    protected async validate({ id, document, on }: MongoDBValidationInput<Target, 'name'>) {

        const { name } = id
        if (StringHelper.empty(name)) {
            throw new BadRequestError('target id is empty')
        }
        
        const { credentials } = document ?? {}
        if (!ObjectHelper.has(document) || !ObjectHelper.has(credentials)) {
            throw new BadRequestError('target credentials is empty')
        }

        await this.test({ credentials })

    }

    public async test({ credentials }: Pick<Target, 'credentials'>) {
        try {
            await new BigQuery({ credentials }).getDatasets({ maxResults: 1 })
        } catch (error) {
            throw new BadRequestError(`does not possible to connect at google big query with received credentials, error:`, error)
        }
    }

}