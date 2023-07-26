import { BigQuery, Dataset, TableSchema } from "@google-cloud/bigquery";
import { ObjectHelper } from "./object.helper";

export type DatasetInput = { client: BigQuery, name: string, create: boolean }
export type TableInput = { client: BigQuery, dataset: string, table: TableSchema & { name: string }, create: boolean }
export type SanitizeInput = { value: string }

export class BigQueryHelper {

    public static async dataset({ client, name, create }: DatasetInput) {

        const result = client.dataset(name)

        const [exists] = await result.exists()
        if (!exists) {
            if (create) {
                await result.create()
            } else {
                return undefined
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

        const [exists] = await result.exists()
        if (!exists) {

            if (create) {
                await result.create({ schema: table.fields })
            } else {
                return undefined
            }

        }

        return result

    }

    public static sanitize({ value }: SanitizeInput) {
        const result = value.trim().replace(/\-/g, '_').replace(/\s/g, '_').replace(/\./g, '_')
        return result
    }

}