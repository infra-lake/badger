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

export type ExportTaskPlayInput = {
    context: TransactionalContext
    id: Required<Pick<ExportTask, 'transaction' | 'source' | 'target' | 'database'>>
}

export class ExportTaskPlayService {

    private get collection() {
        const client = Regex.inject(MongoClient)
        const service = Regex.inject(ExportTaskService)
        return client.db(SettingsService.DATABASE).collection(service.collection)
    }

    public async apply(input: ExportTaskPlayInput) {

        await this.validate(input)

        const { context, id } = input
        const { transaction, source, target, database } = id

        const status = 'stopped'

        const exports = Regex.inject(ExportService)

        context.logger.log(`setting status "${status}" to export tasks of export "${exports.name(id)}"`)
        
        await this.collection.updateMany(
            { transaction, source, target, database, status },
            { $set: { status: 'created', worker: null, date: null, error: null } },
            { upsert: false }
        )

    }

    protected async validate(input: ExportTaskPlayInput) {

        if (![ApplicationMode.MANAGER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(ExportTaskPlayService.name)
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

        const exists = await tasks.exists({
            context,
            filter: { transaction, source, target, database, status: 'stopped' }
        })

        if (!exists) { throw new BadRequestError(`there is not export tasks to play for export "${exports.name(id)}"`) }

    }

}