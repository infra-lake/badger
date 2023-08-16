import { UnsupportedOperationError } from "../../../exceptions/unsupported-operation.error"
import { ApplicationHelper, ApplicationMode } from "../../../helpers/application.helper"
import { MongoDBDocument, MongoDBService, MongoDBValidationInput } from "../../../helpers/mongodb.helper"
import { StringHelper } from "../../../helpers/string.helper"
import { Window } from "../../../helpers/window.helper"
import { Worker } from "../../../helpers/worker.helper"
import { TransactionalContext } from "../../../regex"
import { SettingsService } from "../../settings.service"
import { Export } from "../service"

export interface ExportTask extends MongoDBDocument<ExportTask, 'transaction' | 'source' | 'target' | 'database' | 'collection'> {
    transaction: Export['transaction']
    source: Export['source']
    target: Export['target']
    database: string
    collection: string
    status: Export['status']
    worker?: Worker['name']
    error?: any
    count?: number
    window?: Window
}

export type ExportTaskFromOutput = Pick<ExportTaskStateChangeInput, 'id'>
export type ExportTaskStateChangeInput = Pick<MongoDBValidationInput<ExportTask, 'transaction' | 'source' | 'target' | 'database' | 'collection'>, 'id' | 'document'> & { context: TransactionalContext }
export type ExportTaskStateChangeStopInput = Omit<ExportTaskStateChangeInput, 'id'> & { id: Pick<ExportTask, 'transaction' | 'source' | 'target' | 'database'> }
export type ExportTaskStateChangeRetryInput = Omit<ExportTaskStateChangeInput, 'id' | 'document'> & { id: Pick<ExportTask, 'transaction' | 'source' | 'target' | 'database'> }

export class ExportTaskService extends MongoDBService<ExportTask, 'transaction' | 'source' | 'target' | 'database' | 'collection'> {

    protected get database() { return SettingsService.DATABASE }
    public get collection() { return 'tasks' }

    protected async validate({ on }: MongoDBValidationInput<ExportTask, 'transaction' | 'source' | 'target' | 'database' | 'collection'>) {
        if (['insert'].includes(on)) { throw new UnsupportedOperationError(on) }
        if (![ApplicationMode.WORKER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            if (on === 'update') { throw new UnsupportedOperationError(on) }
        }
    }

    public name({ source, target, database, collection }: Pick<ExportTask, 'source' | 'target' | 'database' | 'collection'>) {
        return `${source}.${target}.${database}.${collection}`
    }

    public async busy() {

        const aggregation = await this._collection.aggregate([
            { $match: { status: 'running' } },
            { $group: { _id: { worker: '$worker' }, count: { $count: {} } } }
        ]).toArray()

        const result =
            aggregation
                .map(({ _id, _ }) => _id)
                .map(({ worker }) => worker)
                .filter(worker => !StringHelper.empty(worker))
                .map(name => ({ name } as Pick<Worker, 'name'>))

        return result

    }

    public async cleanup() {
        await this._collection.deleteMany({})
    }

    public async last({ source, target, database, collection }: Pick<ExportTask, 'source' | 'target' | 'database' | 'collection'>): Promise<Date> {

        const cursor = this._collection.aggregate([
            { $match: { source, target, database, collection, status: 'terminated' } },
            {
                $group: {
                    _id: { source: "$source", target: "$target", database: "$database", collection: "$collection" },
                    value: { $max: "$window.end" }
                }
            }
        ])

        if (await cursor.hasNext()) {
            const { value } = await cursor.next() as any;
            return value ?? new Date(0)
        }

        return new Date(0)

    }

}


