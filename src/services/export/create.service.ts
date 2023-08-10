import { MongoClient } from 'mongodb'
import { BadRequestError } from '../../exceptions/bad-request.error'
import { InvalidParameterError } from '../../exceptions/invalid-parameter.error'
import { NotFoundError } from '../../exceptions/not-found.error'
import { UnsupportedOperationError } from '../../exceptions/unsupported-operation.error'
import { ApplicationHelper, ApplicationMode } from '../../helpers/application.helper'
import { ObjectHelper } from '../../helpers/object.helper'
import { StringHelper } from '../../helpers/string.helper'
import { Regex, TransactionalContext } from '../../regex'
import { SettingsService } from '../settings.service'
import { Source, SourceService } from '../source.service'
import { Target, TargetService } from '../target.service'
import { Export, ExportService } from './service'
import { ExportTaskCreateService } from './task/create.service'

export type ExportCreateInput = {
    context: TransactionalContext
    id: Required<Pick<Export, 'transaction' | 'source' | 'target' | 'database'>>
}

export class ExportCreateService {

    private get collection() {
        const client = Regex.inject(MongoClient)
        const service = Regex.inject(ExportService)
        return client.db(SettingsService.DATABASE).collection(service.collection)
    }

    public async apply(input: ExportCreateInput) {

        await this.validate(input)

        const { context, id } = input
        const { transaction, source, target, database } = id

        const status = 'created'

        const exports = Regex.inject(ExportService)
        
        context.logger.log(`setting status "${status}" to export "${exports.name(id)}"`)

        const result = await this.collection.findOneAndUpdate(
            { source, target, database, $or: [{ status: 'created' }, { status: 'running' }] },
            { $setOnInsert: { transaction, source, target, database, status } },
            { upsert: true, returnDocument: 'after' }
        )

        if (!result.ok) {
            throw new Error(`does not possible set export "${exports.name(id)}" to status "${status}"`, result.lastErrorObject)
        }

        if (transaction !== result.value?.transaction) {
            throw new Error(`there is another export "${exports.name(id)}" with "${status}" status, see transaction "${result.value?.transaction}"`)
        }

        try {

            const create = Regex.inject(ExportTaskCreateService)

            await create.apply({ context, id: { transaction, source, target, database } })

        } catch (error) {
            await this.collection.deleteOne({ transaction, source, target, database })
            throw error
        }

    }

    public async validate(input: ExportCreateInput) {

        if (![ApplicationMode.MANAGER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(ExportCreateService.name)
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

        const sources = Regex.inject(SourceService)
        const found1 = await sources.get({ id: { name: source } }) as Source
        if (!ObjectHelper.has(found1)) { throw new NotFoundError('source') }
        const { url } = found1
        if (!ObjectHelper.has(url)) { throw new NotFoundError('source.url') }
        await sources.test({ url })

        const targets = Regex.inject(TargetService)
        const found2 = await targets.get({ id: { name: target } }) as Target
        if (!ObjectHelper.has(found2)) { throw new NotFoundError('target') }
        const { credentials } = found2
        if (!ObjectHelper.has(url)) { throw new NotFoundError('target.credentials') }
        await targets.test({ credentials })

        const exports = Regex.inject(ExportService)
        const exists = await exports.exists({
            context,
            filter: {
                source, target, database,
                $or: [{ status: 'created' }, { status: 'running' }]
            }
        })
        
        if (exists) {
            throw new InvalidParameterError('exports already exists', exports.name(id))
        }

    }


}