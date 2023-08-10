import { MongoClient } from 'mongodb'
import { BadRequestError } from '../../exceptions/bad-request.error'
import { InvalidParameterError } from '../../exceptions/invalid-parameter.error'
import { InvalidStateChangeError, InvalidStateChangeErrorInputStatus } from '../../exceptions/invalid-state-change.error'
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

export type ExportStartInput = {
    context: TransactionalContext
    id: Required<Pick<Export, 'transaction' | 'source' | 'target' | 'database'>>
}

export class ExportStartService {

    private get collection() {
        const client = Regex.inject(MongoClient)
        const service = Regex.inject(ExportService)
        return client.db(SettingsService.DATABASE).collection(service.collection)
    }

    public async apply(input: ExportStartInput) {

        await this.validate(input)

        const { context, id } = input
        const { transaction, source, target, database } = id

        const status = 'running'

        const exports = Regex.inject(ExportService)
        
        context.logger.log(`setting status "${status}" to export "${exports.name(id)}"`)

        const result = await this.collection.findOneAndUpdate(
            { transaction, source, target, database, status: 'created' },
            { $set: { status } },
            { upsert: false, returnDocument: 'after' }
        )

        if (!result.ok) {
            throw new Error(`does not possible set export "${exports.name(id)}" to status "${status}"`, result.lastErrorObject)
        }

    }

    public async validate(input: ExportStartInput) {

        if (![ApplicationMode.VOTER, ApplicationMode.WORKER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(ExportStartService.name)
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

        const service = Regex.inject(ExportService)
        const found3 = await service.get({ id: { transaction, source, target, database } }) as Export
        if (!ObjectHelper.has(found3)) { throw new NotFoundError('service') }
        const { status: old } = found3
        if (StringHelper.empty(old)) { throw new BadRequestError('service.status') }

        if (old === 'running') { return }

        const valids: Array<Export['status']> = ['created']
        if (!valids.includes(old)) {
            const type = ExportStartService.name
            const status: InvalidStateChangeErrorInputStatus = { old, new: 'running', valids }
            throw new InvalidStateChangeError({ type, on: 'start', status })
        }

    }


}