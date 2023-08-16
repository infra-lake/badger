import { Filter, MongoClient } from 'mongodb'
import { BadRequestError } from '../../../exceptions/bad-request.error'
import { InvalidParameterError } from '../../../exceptions/invalid-parameter.error'
import { NotFoundError } from '../../../exceptions/not-found.error'
import { UnsupportedOperationError } from '../../../exceptions/unsupported-operation.error'
import { ApplicationHelper, ApplicationMode } from '../../../helpers/application.helper'
import { ObjectHelper } from '../../../helpers/object.helper'
import { StringHelper } from '../../../helpers/string.helper'
import { Regex, TransactionalContext } from '../../../regex'
import { Export, ExportService } from '../service'
import { SettingsService } from '../../settings.service'
import { ExportTask, ExportTaskService } from './service'
import { Source, SourceService } from '../../source.service'
import { DateHelper } from '../../../helpers/date.helper'

export type ExportTaskRetryInput = {
    context: TransactionalContext
    id: Required<Pick<ExportTask, 'transaction' | 'source' | 'target' | 'database'>>
    document: { force: boolean }
}

export class ExportTaskRetryService {

    private get collection() {
        const client = Regex.inject(MongoClient)
        const service = Regex.inject(ExportTaskService)
        return client.db(SettingsService.DATABASE).collection(service.collection)
    }

    public async apply(input: ExportTaskRetryInput) {

        await this.validate(input)

        const { context, id, document } = input
        const { transaction, source, target, database } = id
        const { force } = document

        const status = 'error'

        const exports = Regex.inject(ExportService)

        context.logger.log(`setting status "${status}" to export tasks of export "${exports.name(id)}"`)
        
        const filter = force
            ? {
                transaction, source, target, database,
                $or: [{ status: 'error' }, { status: 'stopped' }]
            }
            : { transaction, source, target, database, status }

        await this.collection.updateMany(
            filter,
            { $set: { status: 'created' , worker: null, error: null, updatedAt: new Date() } },
            { upsert: false }
        )

    }

    protected async validate(input: ExportTaskRetryInput) {

        if (![ApplicationMode.MANAGER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(ExportTaskRetryService.name)
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
        const force = document?.force

        if (StringHelper.empty(transaction)) { throw new BadRequestError('transaction is missing') }
        if (StringHelper.empty(source)) { throw new BadRequestError('source is empty') }
        if (StringHelper.empty(target)) { throw new BadRequestError('target is empty') }
        if (StringHelper.empty(database)) { throw new BadRequestError('database id is empty') }
        if (!ObjectHelper.has(force)) { throw new BadRequestError('force is empty') }

        const service = Regex.inject(SourceService)
        const found = await service.get({ id: { name: source } }) as Source
        if (!ObjectHelper.has(found)) { throw new NotFoundError('source') }

        const { url } = found
        if (!ObjectHelper.has(url)) { throw new NotFoundError('source.url') }

        try {
            await new MongoClient(url).connect()
        } catch (error) {
            throw new InvalidParameterError('source.url', 'unable to connect', error)
        }

        const tasks = Regex.inject(ExportTaskService)

        const $or: Filter<ExportTask>[] = force
            ? [{ status: 'error' }, { status: 'stopped' }]
            : [{ status: 'error' }]

        const exists = await tasks.exists({
            context,
            filter: { transaction, source, target, database, $or }
        })

        if (!exists) { throw new BadRequestError(`there is not export tasks to retry for export "${exports.name(id)}"`) }

    }

}