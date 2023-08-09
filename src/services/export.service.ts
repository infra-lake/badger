import { Filter } from 'mongodb'
import { BadRequestError } from '../exceptions/bad-request.error'
import { InvalidStateChangeError } from '../exceptions/invalid-state-change.error'
import { NotFoundError } from '../exceptions/not-found.error'
import { UnsupportedOperationError } from '../exceptions/unsupported-operation.error'
import { ApplicationHelper, ApplicationMode } from '../helpers/application.helper'
import { MongoDBDocument, MongoDBGetInput, MongoDBService, MongoDBValidationInput } from '../helpers/mongodb.helper'
import { ObjectHelper } from '../helpers/object.helper'
import { Stamps, StampsHelper } from '../helpers/stamps.helper'
import { StringHelper } from '../helpers/string.helper'
import { Window } from '../helpers/window.helper'
import { Regex, TransactionalContext } from '../regex'
import { ExportTaskService } from './export.task.service'
import { SettingsService } from './settings.service'
import { Source, SourceService } from './source.service'
import { Target, TargetService } from './target.service'

export interface Export extends MongoDBDocument<Export, 'transaction' | 'source' | 'target' | 'database'> {
    transaction: string
    source: Source['name']
    target: Target['name']
    database: string
    status: 'created' | 'running' | 'terminated' | 'stopped' | 'error'
}

export type ExportStateChangeInput = Pick<MongoDBValidationInput<Export, 'transaction' | 'source' | 'target' | 'database'>, 'id'> & { context: TransactionalContext }

export class ExportService extends MongoDBService<Export, 'transaction' | 'source' | 'target' | 'database'> {

    protected get database() { return SettingsService.DATABASE }
    public get collection() { return 'exports' }

    public async check({ context, id }: Pick<MongoDBGetInput<Export, 'transaction' | 'source' | 'target' | 'database'>, 'context' | 'id'>) {

        if (![ApplicationMode.MANAGER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${ExportService.name}.check()`)
        }

        const document = await this.get({ context, id }) as Export

        if (!ObjectHelper.has(document)) {
            throw new NotFoundError('export')
        }

        const { status } = document

        return { status }

    }

    public async create({ context, id }: ExportStateChangeInput) {

        if (![ApplicationMode.MANAGER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${ExportService.name}.create()`)
        }

        context?.logger.log('creating export...')

        await this.validate({ id, on: 'create' })

        const { transaction, source, target, database } = id

        const result = await this._collection.findOneAndUpdate(
            { source, target, database, $or: [{ status: 'created' }, { status: 'running' }] },
            { $setOnInsert: { transaction, source, target, database, status: 'created' } },
            { upsert: true, returnDocument: 'after' }
        )

        if (!result.ok) {
            throw new Error('error when try to create export', result.lastErrorObject)
        }

        if (transaction !== result.value?.transaction) {
            throw new Error(`there is another export created, see transaction "${result.value?.transaction}"`)
        }

        try {
            const service = Regex.inject(ExportTaskService)
            const tasks = await service.from(id)
            await Promise.all(tasks.map(async ({ id }) => await service.create({ context, id })))
        } catch (error) {
            await this._collection.deleteOne({ transaction, source, target, database })
            throw error
        }

        context?.logger.log('export created now')

    }

    public async start({ context, id }: ExportStateChangeInput) {

        if (![ApplicationMode.VOTER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${ExportService.name}.start()`)
        }

        context?.logger.log('changing state of export to running...')

        await this.validate({ id, on: 'start' })

        const { transaction, source, target, database } = id

        const result = await this._collection.findOneAndUpdate(
            { transaction, source, target, database, status: 'created' },
            { $set: { status: 'running' } },
            { upsert: false, returnDocument: 'after' }
        )

        if (!result.ok) {
            throw new Error('error when try to run export', result.lastErrorObject)
        }

        if (!ObjectHelper.has(result.value)) {
            throw new Error('does not possible update export to runnig because export is not found')
        }

        if (((result.value?.status as Export['status']) !== 'running')) {
            throw new Error('does not possible update export to runnig')
        }

        context?.logger.log('state of export is running now')

    }

    public async finish({ context, id }: ExportStateChangeInput) {

        if (![ApplicationMode.VOTER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${ExportService.name}.finish()`)
        }

        context?.logger.log('changing state of export to terminating...')

        await this.validate({ id, on: 'finish' })

        const { transaction, source, target, database } = id

        const result = await this._collection.findOneAndUpdate(
            { transaction, source, target, database, status: 'running' },
            { $set: { status: 'terminated' } },
            { upsert: false, returnDocument: 'after' }
        )

        if (!result.ok) {
            throw new Error('error when try to terminate export', result.lastErrorObject)
        }

        if (!ObjectHelper.has(result.value)) {
            throw new Error('does not possible update export to terminated because export is not found')
        }

        if (((result.value?.status as Export['status']) !== 'terminated')) {
            throw new Error('does not possible update export to terminated')
        }

        context?.logger.log('state of export is terminated now')

    }

    public async stop({ context, id }: ExportStateChangeInput) {

        if (![ApplicationMode.MANAGER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${ExportService.name}.stop()`)
        }

        context?.logger.log('changing state of export to stop...')

        await this.validate({ id, on: 'stop' })

        const { transaction, source, target, database } = id

        const result = await this._collection.findOneAndUpdate(
            { transaction, source, target, database, $or: [{ status: 'created' }, { status: 'running' }] },
            { $set: { status: 'stopped' } },
            { upsert: false, returnDocument: 'after' }
        )

        if (!result.ok) {
            throw new Error('error when try to stop export', result.lastErrorObject)
        }

        if (!ObjectHelper.has(result.value)) {
            throw new Error('does not possible update export to stop because export is not found')
        }

        if (((result.value?.status as Export['status']) !== 'stopped')) {
            throw new Error('does not possible update export to stop')
        }

        const tasks = Regex.inject(ExportTaskService)
        await tasks.stop({ context, id, document: { date: new Date() } })

        context?.logger.log('state of export is stopped now')

    }

    public async error({ context, id }: ExportStateChangeInput) {

        if (![ApplicationMode.VOTER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${ExportService.name}.error()`)
        }

        context?.logger.log('changing state of export to error...')

        await this.validate({ id, on: 'error' })

        const { transaction, source, target, database } = id

        const result = await this._collection.findOneAndUpdate(
            { transaction, source, target, database, $or: [{ status: 'created' }, { status: 'running' }] },
            { $set: { status: 'error' } },
            { upsert: false, returnDocument: 'after' }
        )

        if (!result.ok) {
            throw new Error('error when try to set error on export', result.lastErrorObject)
        }

        if (!ObjectHelper.has(result.value)) {
            throw new Error('does not possible update export to error because export is not found')
        }

        if (((result.value?.status as Export['status']) !== 'error')) {
            throw new Error('does not possible update export to error')
        }

        context?.logger.log('state of export is error now')

    }

    public async retry({ context, id }: ExportStateChangeInput) {

        if (![ApplicationMode.MANAGER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${ExportService.name}.retry()`)
        }

        context?.logger.log('changing state of export to created...')

        await this.validate({ id, on: 'retry' })

        const { transaction, source, target, database } = id

        const service = Regex.inject(ExportTaskService)
        await service.retry({ context, id: { transaction, source, target, database } })

        const result = await this._collection.findOneAndUpdate(
            { transaction, source, target, database, status: 'error' },
            { $set: { status: 'created' } },
            { upsert: false, returnDocument: 'after' }
        )

        if (!result.ok) {
            throw new Error('error when try to set created on export', result.lastErrorObject)
        }

        if (!ObjectHelper.has(result.value)) {
            throw new Error('does not possible update export to created because export is not found')
        }

        if (((result.value?.status as Export['status']) !== 'created')) {
            throw new Error('does not possible update export to created')
        }

        context?.logger.log('state of export is created now')

    }

    public async validate({ id, on }: MongoDBValidationInput<Export, 'transaction' | 'source' | 'target' | 'database'>) {

        const type = ExportTaskService.name

        if (on === 'insert' || on === 'update') {
            throw new UnsupportedOperationError(`${ExportService.name}.save()`)
        }

        if (on === 'delete') {
            throw new UnsupportedOperationError(`${ExportService.name}.delete()`)
        }

        if (StringHelper.empty(id.transaction)) { throw new BadRequestError('transaction is missing') }

        const { transaction, source, target, database } = id

        if (['create', 'retry'].includes(on)) {

            const _source = Regex.inject(SourceService)
            const __source = await _source.get({ id: { name: source } })
            const { url = '' } = __source ?? {}
            await _source.test({ url })

            const _target = Regex.inject(TargetService)
            const __target = await _target.get({ id: { name: target } })
            const { credentials } = __target ?? {}
            await _target.test({ credentials })

        }

        if (['start', 'finish', 'stop', 'error'].includes(on)) {

            const found = await this.get({ id: { transaction, source, target, database } }) as Export
            const { status: old } = found ?? {}

            if (!ObjectHelper.has(old)) {
                throw new NotFoundError('export')
            }

            if (on === 'start' && old !== 'created') {
                throw new InvalidStateChangeError({ type, on, status: { old, new: 'running', valids: ['created'] } })
            }

            if (on === 'finish' && old !== 'running') {
                throw new InvalidStateChangeError({ type, on, status: { old, new: 'terminated', valids: ['running'] } })
            }

            if (['stop', 'error'].includes(on) && !['created', 'running'].includes(old as string)) {
                const status: Export['status'] = on === 'stop' ? 'stopped' : 'error'
                throw new InvalidStateChangeError({ type, on, status: { old, new: status, valids: ['created', 'running'] } })
            }

        }

    }

    public static filter(window: Window, stamps: Stamps = StampsHelper.extract()): Filter<Document> {

        const date = {
            $ifNull: [
                `$${stamps.update}`,
                `$${StampsHelper.DEFAULT_STAMP_UPDATE}`,
                '$updatedAt',
                '$updated_at',
                `$${stamps.insert}`,
                `$${StampsHelper.DEFAULT_STAMP_INSERT}`,
                '$createdAt',
                '$created_at',
                {
                    $convert: {
                        input: `$${stamps.id}`,
                        to: 'date',
                        onError: window.end,
                        onNull: window.end
                    }
                }
            ]
        }

        return {
            $expr: {
                $and: [
                    { $gt: [date, window.begin] },
                    { $lte: [date, window.end] }
                ]
            }
        }

    }


}