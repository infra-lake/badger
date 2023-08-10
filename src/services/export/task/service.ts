import { UnsupportedOperationError } from "../../../exceptions/unsupported-operation.error"
import { ApplicationHelper, ApplicationMode } from "../../../helpers/application.helper"
import { MongoDBDocument, MongoDBService, MongoDBValidationInput } from "../../../helpers/mongodb.helper"
import { StampsHelper } from "../../../helpers/stamps.helper"
import { StringHelper } from "../../../helpers/string.helper"
import { ThreadHelper } from "../../../helpers/thread.helper"
import { Regex, TransactionalContext } from "../../../regex"
import { BatchIncomingMessage } from "../../../regex/batch"
import { SettingsService } from "../../settings.service"
import { SourceOutput, SourceService } from "../../source.service"
import { TargetOutput, TargetService } from "../../target.service"
import { Worker } from "../../worker.service"
import { Export } from "../service"
import { ExportTaskErrorService } from "./error.service"
import { ExportTaskFinishService } from "./finish.service"

export interface ExportTask extends MongoDBDocument<ExportTask, 'transaction' | 'source' | 'target' | 'database' | 'collection'> {
    transaction: Export['transaction']
    source: Export['source']
    target: Export['target']
    database: string
    collection: string
    status: Export['status']
    worker?: Worker['name']
    date?: Date
    error?: any
    count?: number
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

}


