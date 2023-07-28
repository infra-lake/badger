import { BigQuery, Dataset, TableSchema } from "@google-cloud/bigquery";
import { ObjectHelper } from "./object.helper";
import { ThreadHelper } from "./thread.helper";

export type DatasetInput = { client: BigQuery, name: string, create: boolean }
export type TableInput = { client: BigQuery, dataset: string, table: TableSchema & { name: string }, create: boolean }
export type SanitizeInput = { value: string }

export class BigQueryHelper {

    public static async dataset({ client, name, create }: DatasetInput) {

        const result = client.dataset(name)

        let exists = false

        try {
            exists = (await result.exists())[0]
        } catch (error) { }

        if (!exists) {
            if (create) {
                await result.create()
            } else {
                return undefined
            }
        }

        if (create) {
            let _exists = false
            while (!_exists) {
                try {
                    await ThreadHelper.sleep(100)
                    _exists = (await client.dataset(name).exists())[0]
                } catch (error) { }
            }
        }

        return result

    }

    public static async table({ client, dataset: _dataset, table, create }: TableInput) {

        const __dataset = await BigQueryHelper.dataset({ client, name: _dataset, create })

        if (!ObjectHelper.has(__dataset) && !create) {
            return undefined
        }

        const result = (__dataset as Dataset).table(table.name)

        let exists = false

        try {
            exists = (await result.exists())[0]
        } catch (error) { }
        
        if (!exists) {

            if (create) {
                await result.create({ schema: table.fields })
            } else {
                return undefined
            }

        }

        if (create) {
            let _exists = false
            while (!_exists) {
                try {
                    await ThreadHelper.sleep(100)
                    _exists = (await (__dataset as Dataset).table(table.name).exists())[0]
                } catch (error) { }
            }
        }

        return result

    }

    public static sanitize({ value }: SanitizeInput) {
        const result = value.trim().replace(/\-/g, '_').replace(/\s/g, '_').replace(/\./g, '_')
        return result
    }

}