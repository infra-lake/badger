import { MongoClient } from 'mongodb'
import { BadRequestError } from '../../../exceptions/bad-request.error'
import { InvalidParameterError } from '../../../exceptions/invalid-parameter.error'
import { UnsupportedOperationError } from '../../../exceptions/unsupported-operation.error'
import { ApplicationHelper, ApplicationMode } from '../../../helpers/application.helper'
import { DateHelper } from '../../../helpers/date.helper'
import { ObjectHelper } from '../../../helpers/object.helper'
import { StringHelper } from '../../../helpers/string.helper'
import { Regex, TransactionalContext } from '../../../regex'
import { SettingsService } from '../../settings.service'
import { ExportService } from '../service'
import { ExportTask, ExportTaskService } from './service'

export type ExportTaskStopInput = {
    context: TransactionalContext
    id: Required<Pick<ExportTask, 'transaction' | 'source' | 'target' | 'database'>>
}

export class ExportTaskStopService {

    private get collection() {
        const client = Regex.inject(MongoClient)
        const service = Regex.inject(ExportTaskService)
        return client.db(SettingsService.DATABASE).collection(service.collection)
    }

    public async apply(input: ExportTaskStopInput) {

        await this.validate(input)

        const { context, id } = input
        const { transaction, source, target, database } = id

        const status = 'stopped'

        const exports = Regex.inject(ExportService)

        context.logger.log(`setting status "${status}" to export tasks of export "${exports.name(id)}"`)

        await this.collection.updateMany(
            {
                transaction, source, target, database,
                $or: [{ status: 'created' }, { status: 'running' }]
            },
            { $set: { status, updatedAt: new Date() } },
            { upsert: false }
        )

    }

    protected async validate(input: ExportTaskStopInput) {

        if (![ApplicationMode.MANAGER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(ExportTaskStopService.name)
        }

        if (!ObjectHelper.has(input)) { throw new InvalidParameterError('input') }

        const { context, id } = input

        if (!ObjectHelper.has(context)) { throw new InvalidParameterError('context') }
        if (!ObjectHelper.has(id)) { throw new InvalidParameterError('id') }

        const transaction = id?.transaction?.trim()
        const source = id?.source?.trim()
        const target = id?.target?.trim()
        const database = id?.database?.trim()

        if (StringHelper.empty(transaction)) { throw new BadRequestError('transaction is missing') }
        if (StringHelper.empty(source)) { throw new BadRequestError('source is empty') }
        if (StringHelper.empty(target)) { throw new BadRequestError('target is empty') }
        if (StringHelper.empty(database)) { throw new BadRequestError('database id is empty') }

        const tasks = Regex.inject(ExportTaskService)
        const exists = await tasks.exists({
            context,
            filter: {
                transaction, source, target, database,
                $or: [{ status: 'created' }, { status: 'running' }]
            }
        })

        if (!exists) {
            const exports = Regex.inject(ExportService)
            throw new BadRequestError(`the export task "${exports.name(id)}" are already registered with status "stopped"`)
        }

    }

}