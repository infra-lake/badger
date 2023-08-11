import { BigQuery, Table } from '@google-cloud/bigquery'
import { BadRequestError } from '../exceptions/bad-request.error'
import { BigQueryHelper } from '../helpers/bigquery.helper'
import { MongoDBDocument, MongoDBService, MongoDBValidationInput } from '../helpers/mongodb.helper'
import { ObjectHelper } from '../helpers/object.helper'
import { StampsHelper } from '../helpers/stamps.helper'
import { StringHelper } from '../helpers/string.helper'
import { Regex } from '../regex'
import { BatchIncomingMessage } from '../regex/batch'
import { Export } from './export/service'
import { ExportTask } from './export/task/service'
import { SettingsService } from './settings.service'

export interface Target extends MongoDBDocument<Target, 'name'> {
    name: string
    credentials: any
}

export type TargetInput = { context: BatchIncomingMessage, task: ExportTask }
export type TargetOutput = {
    name: Export['target']
    client: BigQuery
    dataset: string
    table: { main: Table, temporary: Table }
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

    public async target({ context, task }: TargetInput): Promise<TargetOutput> {

        const { transaction, target, database, collection } = task

        const dataset = this.dataset({ database: task.database })
        
        context.logger.debug('connecting to Big Query...')
        const service = Regex.inject(TargetService)
        const { credentials } = await service.get({ context, id: { name: target } }) as Target
        const client = new BigQuery({ credentials })
        context.logger.debug('connected to Big Query successfully!!!')
        
        context.logger.debug('creating Big Query Tables and Dataset...')
        const main = await this.table({ client, transaction, database, collection, type: 'main', create: true }) as Table
        const temporary = await this.table({ client, transaction, database, collection, type: 'temporary', create: true }) as Table
        context.logger.debug('Big Query Tables was created successfully!!!')
        
        return { name: target, client, dataset, table: { main, temporary } }

    }

    public dataset({ database }: Pick<ExportTask, 'database'>) {
        const result = BigQueryHelper.sanitize({ value: `${StampsHelper.DEFAULT_STAMP_DATASET_NAME_PREFIX}${database}` })
        return result
    }

    public async table({ client, transaction, database, collection, type, create }: { client: BigQuery, transaction: string, database: string, collection: string, type: 'main' | 'temporary', create: boolean }) {

        let name = BigQueryHelper.sanitize({ value: collection })

        if (type === 'temporary') {
            name = BigQueryHelper.sanitize({ value: `${name}_${transaction}_temp` })
        }

        const schema = {
            sourceFormat: 'NEWLINE_DELIMITED_JSON',
            name,
            fields: [
                { name: StampsHelper.DEFAULT_STAMP_ID, type: 'STRING', mode: 'REQUIRED' },
                { name: StampsHelper.DEFAULT_STAMP_INSERT, type: 'TIMESTAMP', mode: 'REQUIRED' },
                { name: 'data', type: 'JSON', mode: 'REQUIRED' },
                { name: 'hash', type: 'STRING', mode: 'REQUIRED' }
            ]
        }

        const dataset = this.dataset({ database })

        const result = await BigQueryHelper.table({ client, dataset, table: schema, create })

        return result

    }
    
}