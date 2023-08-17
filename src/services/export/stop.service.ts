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
import { Export, ExportService } from './service'
import { ExportTaskStopService } from './task/stop.service'
import { StampsHelper } from '../../helpers/stamps.helper'

export type ExportStopInput = {
    context: TransactionalContext
    id: Required<Pick<Export, 'transaction' | 'source' | 'target' | 'database'>>
}

export class ExportStopService {

    private get collection() {
        const client = Regex.inject(MongoClient)
        const service = Regex.inject(ExportService)
        return client.db(SettingsService.DATABASE).collection(service.collection)
    }

    public async apply(input: ExportStopInput) {

        await this.validate(input)

        const { context, id } = input
        const { transaction, source, target, database } = id

        const stop = Regex.inject(ExportTaskStopService)
        await stop.apply({
            context,
            id: { transaction, source, target, database }
        })

        const status = 'stopped'

        const exports = Regex.inject(ExportService)
        
        context.logger.log(`setting status "${status}" to export "${exports.name(id)}"`)
        
        const result = await this.collection.findOneAndUpdate(
            {
                transaction, source, target, database,
                $or: [{ status: 'created' }, { status: 'running' }]
            },
            { $set: { status, [StampsHelper.DEFAULT_STAMP_UPDATE]: new Date() } },
            { upsert: false, returnDocument: 'after' }
        )

        if (!result.ok) {
            throw new Error(`does not possible set export "${exports.name(id)}" to status "${status}"`, result.lastErrorObject)
        }

    }

    public async validate(input: ExportStopInput) {

        if (![ApplicationMode.MANAGER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(ExportStopService.name)
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

        const service = Regex.inject(ExportService)
        const found = await service.get({ id: { transaction, source, target, database } }) as Export
        if (!ObjectHelper.has(found)) { throw new NotFoundError('service') }
        const { status: old } = found
        if (StringHelper.empty(old)) { throw new BadRequestError('service.status') }

        if (old === 'stopped') { return }

        const valids: Array<Export['status']> = ['created', 'running']
        if (!valids.includes(old)) {
            const type = ExportStopService.name
            const status: InvalidStateChangeErrorInputStatus = { old, new: 'stopped', valids }
            throw new InvalidStateChangeError({ type, on: 'stop', status })
        }

    }


}