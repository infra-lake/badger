import { MongoClient } from 'mongodb'
import { BadRequestError } from '../../../exceptions/bad-request.error'
import { InvalidParameterError } from '../../../exceptions/invalid-parameter.error'
import { UnsupportedOperationError } from '../../../exceptions/unsupported-operation.error'
import { ApplicationHelper, ApplicationMode } from '../../../helpers/application.helper'
import { ObjectHelper } from '../../../helpers/object.helper'
import { StampsHelper } from '../../../helpers/stamps.helper'
import { StringHelper } from '../../../helpers/string.helper'
import { Regex, TransactionalContext } from '../../../regex'
import { SettingsService } from '../../settings.service'
import { SourceService } from '../../source.service'
import { ExportTask, ExportTaskService } from './service'

export type ExportTaskCreateInput = {
    context: TransactionalContext
    id: Required<Pick<ExportTask, 'transaction' | 'source' | 'target' | 'database'>>
}

type ExportTaskCreateValidateInput = {
    context: TransactionalContext
    id: Required<Pick<ExportTask, 'transaction' | 'source' | 'target' | 'database' | 'collection'>>
}

export class ExportTaskCreateService {

    private get collection() {
        const client = Regex.inject(MongoClient)
        const service = Regex.inject(ExportTaskService)
        return client.db(SettingsService.DATABASE).collection(service.collection)
    }

    public async apply(input: ExportTaskCreateInput) {

        const { context, id } = input
        const { transaction, source, target, database } = id

        try {

            const service = Regex.inject(SourceService)
            const collections = await service.collections({ name: source, database })

            await Promise.all(collections.map(async ({ collection }) => {

                await this.validate({ context, id: { transaction, source, target, database, collection } })

                const status = 'created'

                const tasks = Regex.inject(ExportTaskService)

                context.logger.log(`setting status "${status}" to export task "${tasks.name({ source, target, database, collection })}"`)

                const result = await this.collection.findOneAndUpdate(
                    { source, target, database, collection, $or: [{ status: 'created' }, { status: 'running' }] },
                    { $setOnInsert: { transaction, source, target, database, collection, status, [StampsHelper.DEFAULT_STAMP_INSERT]: new Date() } },
                    { upsert: true, returnDocument: 'after' }
                )

                if (!result.ok) {
                    throw new Error(`does not possible set export task "${tasks.name({ source, target, database, collection })}" to status "${status}"`, result.lastErrorObject)
                }

                if (transaction !== result.value?.transaction) {
                    throw new Error(`there is another export task "${tasks.name({ source, target, database, collection })}" with "${status}" status, see transaction "${result.value?.transaction}"`)
                }

            }))

        } catch (error) {
            await this.collection.deleteMany({ transaction, source, target, database })
            throw error
        }

    }

    private async validate(input: ExportTaskCreateValidateInput) {

        if (![ApplicationMode.MANAGER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(ExportTaskCreateService.name)
        }

        if (!ObjectHelper.has(input)) { throw new InvalidParameterError('input') }

        const { context, id } = input

        if (!ObjectHelper.has(context)) { throw new InvalidParameterError('context') }
        if (!ObjectHelper.has(id)) { throw new InvalidParameterError('id') }

        const transaction = id?.transaction?.trim()
        const source = id?.source?.trim()
        const target = id?.target?.trim()
        const database = id?.database?.trim()
        const collection = id?.collection?.trim()

        if (StringHelper.empty(transaction)) { throw new BadRequestError('transaction is missing') }
        if (StringHelper.empty(source)) { throw new BadRequestError('source is empty') }
        if (StringHelper.empty(target)) { throw new BadRequestError('target is empty') }
        if (StringHelper.empty(database)) { throw new BadRequestError('database id is empty') }
        if (StringHelper.empty(collection)) { throw new BadRequestError('collection id is empty') }

        const tasks = Regex.inject(ExportTaskService)
        const exists = await tasks.exists({
            context,
            filter: {
                source, target, database, collection,
                $or: [{ status: 'created' }, { status: 'running' }]
            }
        })

        if (exists) { throw new InvalidParameterError('exports task already exists', tasks.name(id)) }

    }

}