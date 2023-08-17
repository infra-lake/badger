import { MongoClient } from 'mongodb'
import { BadRequestError } from '../../../exceptions/bad-request.error'
import { InvalidParameterError } from '../../../exceptions/invalid-parameter.error'
import { InvalidStateChangeError, InvalidStateChangeErrorInputStatus } from '../../../exceptions/invalid-state-change.error'
import { NotFoundError } from '../../../exceptions/not-found.error'
import { UnsupportedOperationError } from '../../../exceptions/unsupported-operation.error'
import { ApplicationHelper, ApplicationMode } from '../../../helpers/application.helper'
import { DateHelper } from '../../../helpers/date.helper'
import { ObjectHelper } from '../../../helpers/object.helper'
import { StringHelper } from '../../../helpers/string.helper'
import { Regex, TransactionalContext } from '../../../regex'
import { SettingsService } from '../../settings.service'
import { Export } from '../service'
import { ExportTask, ExportTaskService } from './service'
import { StampsHelper } from '../../../helpers/stamps.helper'

export type ExportTaskErrorInput = {
    context: TransactionalContext
    id: Required<Pick<ExportTask, 'transaction' | 'source' | 'target' | 'database' | 'collection'>>
    document: Required<Pick<ExportTask, 'worker' | 'error'>>
}

export class ExportTaskErrorService {

    private get collection() {
        const client = Regex.inject(MongoClient)
        const service = Regex.inject(ExportTaskService)
        return client.db(SettingsService.DATABASE).collection(service.collection)
    }

    public async apply(input: ExportTaskErrorInput) {

        await this.validate(input)

        const { context, id, document } = input
        const { transaction, source, target, database, collection } = id
        const { worker, error } = document

        const status = 'error'

        const tasks = Regex.inject(ExportTaskService)

        context.logger.log(`setting status "${status}" to export task "${tasks.name(id)}"`)

        const result = await this.collection.findOneAndUpdate(
            { transaction, source, target, database, collection, worker, $or: [{ status: 'created' }, { status: 'running' }] },
            { $set: { status, error, [StampsHelper.DEFAULT_STAMP_UPDATE]: new Date() } },
            { upsert: false, returnDocument: 'after' }
        )

        if (!result.ok) {
            throw new Error(`does not possible set export "${tasks.name(id)}" to status "${status}"`, result.lastErrorObject)
        }

    }

    protected async validate(input: ExportTaskErrorInput) {

        if (![ApplicationMode.WORKER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(ExportTaskErrorService.name)
        }

        if (!ObjectHelper.has(input)) { throw new InvalidParameterError('input') }

        const { context, id, document } = input

        if (!ObjectHelper.has(context)) { throw new InvalidParameterError('context') }
        if (!ObjectHelper.has(id)) { throw new InvalidParameterError('id') }
        if (!ObjectHelper.has(document)) { throw new InvalidParameterError('document') }

        const transaction = id?.transaction?.trim()
        const source = id?.source?.trim()
        const target = id?.target?.trim()
        const database = id?.database?.trim()
        const collection = id?.collection?.trim()
        const worker = document?.worker?.trim()
        const error = document?.error

        if (StringHelper.empty(transaction)) { throw new BadRequestError('transaction is missing') }
        if (StringHelper.empty(source)) { throw new BadRequestError('source is empty') }
        if (StringHelper.empty(target)) { throw new BadRequestError('target is empty') }
        if (StringHelper.empty(database)) { throw new BadRequestError('database is empty') }
        if (StringHelper.empty(collection)) { throw new BadRequestError('collection is empty') }
        if (StringHelper.empty(worker)) { throw new BadRequestError('worker is empty') }
        if (!ObjectHelper.has(error)) { throw new InvalidParameterError('error') }

        const tasks = Regex.inject(ExportTaskService)
        const old = await tasks.get({ context, id }) as ExportTask

        if (!ObjectHelper.has(old)) { throw new NotFoundError('task', JSON.stringify(id)) }
        if (!ObjectHelper.has(old.status)) { throw new NotFoundError('task.status', JSON.stringify(id)) }

        const valids: Array<Export['status']> = ['created', 'running']
        if (!valids.includes(old.status)) {
            const type = ExportTaskErrorService.name
            const status: InvalidStateChangeErrorInputStatus = { old: old.status, new: 'error', valids }
            throw new InvalidStateChangeError({ type, on: 'error', status })
        }

        const exists = await tasks.exists({
            context,
            filter: { transaction, source, target, database, collection, worker, status: 'error' }
        })

        if (exists) { throw new BadRequestError(`the export task "${tasks.name(id)}" are already registered with status "${old.status}" on worker "${worker}"`) }

    }

}