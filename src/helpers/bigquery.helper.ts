import { BigQuery, Dataset, Table, TableSchema } from '@google-cloud/bigquery';
import { ObjectHelper } from './object.helper';
import { ThreadHelper } from './thread.helper';

export type DatasetInput = { client: BigQuery, name: string, create: boolean }
export type TableInput = { client: BigQuery, dataset: string, table: TableSchema & { name: string }, create: boolean }
export type SanitizeInput = { value: string }

export class BigQueryHelper {

    public static async dataset({ client, name, create }: DatasetInput): Promise<Dataset | undefined> {

        const result = client.dataset(name)

        let exists = false

        try {
            exists = (await result.exists())[0]
        } catch (error) {
            exists = false
        }

        if (!exists && create) {
            try { await result.create() } catch (error) { }
            ThreadHelper.sleep(1000)
            return await BigQueryHelper.dataset({ client, name, create })
        } else if (!exists) {
            return undefined
        }

        return result

    }

    public static async table({ client, dataset: _dataset, table, create }: TableInput): Promise<Table | undefined> {

        const dataset = await BigQueryHelper.dataset({ client, name: _dataset, create })

        if (!ObjectHelper.has(dataset) && !create) {
            return undefined
        }

        const result = (dataset as Dataset).table(table.name)

        let exists = false

        try {
            exists = (await result.exists())[0]
        } catch (error) {
            exists = false
        }

        if (!exists && create) {
            try { await result.create({ schema: table.fields }) } catch (error) { }
            ThreadHelper.sleep(1000)
            return await BigQueryHelper.table({ client, dataset: _dataset, table, create })

        } else if (!exists) {
            return undefined
        }

        return result

    }

    public static sanitize({ value }: SanitizeInput) {
        const result = value.trim().replace(/\-/g, '_').replace(/\s/g, '_').replace(/\./g, '_')
        return result
    }

}