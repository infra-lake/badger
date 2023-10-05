import { BigQuery, type Dataset, type Table, type TableSchema } from '@google-cloud/bigquery'
import { InvalidParameterException } from '../exception'
import { NestHelper, ObjectHelper, StringHelper, ThreadHelper } from '../helper'
import { TransactionalLoggerService } from '../logging'
import { type TransactionalContext } from '../transaction'

export type BigQueryHelperTableGetTableInput = TableSchema & { name: string, recreate: boolean | undefined }

export class BigQueryHelper {

    private constructor() { }

    public static async ping(credentials: any) {
        const client = BigQueryHelper.client(credentials)
        await client.getDatasets({ maxResults: 1 })
    }

    public static client(credentials: any) {
        if (ObjectHelper.isEmpty(credentials)) {
            throw new InvalidParameterException('credentials', credentials)
        }
        return new BigQuery({ credentials })
    }

    public static sanitize(name: string) {

        if (StringHelper.isEmpty(name)) {
            throw new InvalidParameterException('name', name)
        }

        const result = name
            .trim()
            .replace(/-/g, '_')
            .replace(/\s/g, '_')
            .replace(/\./g, '_')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s/g, '')
            .toLocaleLowerCase()
            .trim()

        return result

    }

    public static async getOrCreateDataSet(context: TransactionalContext, client: BigQuery, datasetName: string): Promise<Dataset> {

        if (ObjectHelper.isEmpty(context)) { throw new InvalidParameterException('context', context) }
        if (ObjectHelper.isEmpty(client)) { throw new InvalidParameterException('client', client) }
        if (StringHelper.isEmpty(datasetName)) { throw new InvalidParameterException('datasetName', datasetName) }

        const logger = NestHelper.get(TransactionalLoggerService)

        logger.debug?.(BigQueryHelper.name, context, 'checking if dataset exists on bigquery', { name: datasetName })
        const result = client.dataset(datasetName)

        let exists = false

        try {
            exists = (await result.exists())[0]
        } catch (error) {
            logger.error(BigQueryHelper.name, context, 'error', error)
            exists = false
        }

        if (!exists) {
            logger.debug?.(BigQueryHelper.name, context, 'dataset does not exists on bigquery, creating it')
            try { await result.create() } catch (error) { logger.error(BigQueryHelper.name, context, 'error', error) }
            await ThreadHelper.sleep(1000)
            return await BigQueryHelper.getOrCreateDataSet(context, client, datasetName)
        }

        if (exists) {
            logger.debug?.(BigQueryHelper.name, context, 'dataset already exists on bigquery')
        }

        return result

    }

    public static async dropTable(context: TransactionalContext, client: BigQuery, datasetName: string, table: Pick<BigQueryHelperTableGetTableInput, 'name'>): Promise<void> {

        if (ObjectHelper.isEmpty(context)) { throw new InvalidParameterException('context', context) }
        if (ObjectHelper.isEmpty(client)) { throw new InvalidParameterException('client', client) }
        if (StringHelper.isEmpty(datasetName)) { throw new InvalidParameterException('datasetName', datasetName) }
        if (ObjectHelper.isEmpty(table)) { throw new InvalidParameterException('table', table) }
        if (StringHelper.isEmpty(table.name)) { throw new InvalidParameterException('table.name', table.name) }

        const logger = NestHelper.get(TransactionalLoggerService)

        const dataset = await BigQueryHelper.getOrCreateDataSet(context, client, datasetName)

        logger.debug?.(BigQueryHelper.name, context, 'checking if table exists on bigquery', { dataset, table })
        const result = dataset.table(table.name)

        let exists = false

        try {
            exists = (await result.exists())[0]
        } catch (error) {
            logger.error(BigQueryHelper.name, context, 'error', error)
            exists = false
        }

        if (!exists) {
            logger.debug?.(BigQueryHelper.name, context, 'table does not exists on bigquery')
            return
        }

        logger.debug?.(BigQueryHelper.name, context, 'dropping table on bigquery')

        await result.delete({ ignoreNotFound: true })

    }

    public static async getOrCreateTable(context: TransactionalContext, client: BigQuery, datasetName: string, table: BigQueryHelperTableGetTableInput): Promise<Table> {

        if (ObjectHelper.isEmpty(context)) { throw new InvalidParameterException('context', context) }
        if (ObjectHelper.isEmpty(client)) { throw new InvalidParameterException('client', client) }
        if (StringHelper.isEmpty(datasetName)) { throw new InvalidParameterException('datasetName', datasetName) }
        if (ObjectHelper.isEmpty(table)) { throw new InvalidParameterException('table', table) }
        if (StringHelper.isEmpty(table.name)) { throw new InvalidParameterException('table.name', table.name) }

        const logger = NestHelper.get(TransactionalLoggerService)

        const dataset = await BigQueryHelper.getOrCreateDataSet(context, client, datasetName)

        logger.debug?.(BigQueryHelper.name, context, 'checking if table exists on bigquery', { dataset, table })
        const result = (dataset).table(table.name)

        let exists = false

        try {
            exists = (await result.exists())[0]
        } catch (error) {
            logger.error(BigQueryHelper.name, context, 'error', error)
            exists = false
        }

        if (!exists) {
            logger.debug?.(BigQueryHelper.name, context, 'table does not exists on bigquery, creating it')
            try { await result.create({ schema: table.fields }) } catch (error) { logger.error(BigQueryHelper.name, context, 'error', error) }
            await ThreadHelper.sleep(1000)
            return await BigQueryHelper.getOrCreateTable(context, client, datasetName, table)
        }

        if (exists) {
            logger.debug?.(BigQueryHelper.name, context, 'table already  exists on bigquery')
            if (table.recreate ?? false) {
                logger.debug?.(BigQueryHelper.name, context, 'recreating table on bigquery')
                await BigQueryHelper.dropTable(context, client, datasetName, table)
                await ThreadHelper.sleep(1000)
                table.recreate = false
                return await BigQueryHelper.getOrCreateTable(context, client, datasetName, table)
            }
        }

        return result

    }

}
