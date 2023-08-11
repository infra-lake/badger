import { BigQuery, Dataset, Table, TableSchema } from '@google-cloud/bigquery';
import { TransactionalContext } from '../regex';
import { ObjectHelper } from './object.helper';
import { ThreadHelper } from './thread.helper';

export type DatasetInput = { context: TransactionalContext, client: BigQuery, name: string, create: boolean }
export type TableInput = { context: TransactionalContext, client: BigQuery, dataset: string, table: TableSchema & { name: string }, create: boolean }
export type SanitizeInput = { value: string }

export class BigQueryHelper {

    public static async dataset({ context, client, name, create }: DatasetInput): Promise<Dataset | undefined> {

        context.logger.debug('checking if dataset', name, 'exists on bigquery...')
        const result = client.dataset(name)

        let exists = false

        try {
            exists = (await result.exists())[0]
        } catch (error) {
            context.logger.error('error', error)
            exists = false
        }

        if (!exists && create) {
            context.logger.debug('dataset', name, 'not exists on bigquery, creating dataset...')
            try { await result.create() } 
            catch (error) { context.logger.error('error', error) }
            ThreadHelper.sleep(1000)
            return await BigQueryHelper.dataset({ context, client, name, create })
        } else if (!exists) {
            context.logger.debug('dataset', name, 'not exists on bigquery')
            return undefined
        }

        if(exists) {
            context.logger.debug('dataset', name, 'already not exists on bigquery')
        }

        return result

    }

    public static async table({ context, client, dataset: _dataset, table, create }: TableInput): Promise<Table | undefined> {

        const dataset = await BigQueryHelper.dataset({ context, client, name: _dataset, create })

        if (!ObjectHelper.has(dataset) && !create) {
            return undefined
        }

        context.logger.debug('checking if table', table, 'on dataset', _dataset, 'exists on bigquery...')
        const result = (dataset as Dataset).table(table.name)

        let exists = false

        try {
            exists = (await result.exists())[0]
        } catch (error) {
            context.logger.error('error', error)
            exists = false
        }

        if (!exists && create) {
            context.logger.debug('table', table, 'on dataset', _dataset, 'not exists on bigquery, creating table...')
            try { await result.create({ schema: table.fields }) } 
            catch (error) { context.logger.error('error', error) }
            ThreadHelper.sleep(1000)
            return await BigQueryHelper.table({ context, client, dataset: _dataset, table, create })

        } if (!exists) {
            context.logger.debug('table', table, 'on dataset', _dataset, 'not exists on bigquery')
            return undefined
        }

        if(exists) {
            context.logger.debug('table', table, 'on dataset', _dataset, 'already not exists on bigquery')
        }

        return result

    }

    public static sanitize({ value }: SanitizeInput) {
        const result = value
            .trim()
            .replace(/\-/g, '_')
            .replace(/\s/g, '_')
            .replace(/\./g, '_')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s/g,'')
            .toLocaleLowerCase()
            .trim()
        return result
    }

}