import { InvalidParameterException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper, StringHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { SourceDTO } from '@badger/source'
import { TargetDTO } from '@badger/target'
import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { BSONType, type TransactionOptions } from 'mongodb'
import { Model, type ClientSession, type FilterQuery } from 'mongoose'
import { type Export, ExportDTO, ExportService, ExportStatus } from '../../export'
import { type IWorker } from '../../worker'
import {
    TaskDTO,
    type Task4CountCreatedOrRunningInputDTO,
    type Task4CountErrorInputDTO,
    type Task4CountPausedInputDTO,
    type Task4GetCreatedRunningOrPausedInputDTO,
    type Task4GetDateOfLastTerminatedInputDTO,
    type Task4IsAllTerminateOrErrordInputDTO,
    type Task4IsAllTerminatedInputDTO,
    type Task4IsCreatedInputDTO,
    type Task4ListInputDTO,
    type Task4ListRunningInputDTO,
    type Task4RunKeyInputDTO,
    type Task4TerminateInputDTO,
    type Task4TerminateKeyInputDTO,
    type Task4TerminateValueInputDTO,
    type TaskValue4ErrorKeyInputDTO,
    type TaskValue4ErrorValueInputDTO
} from '../task.dto'
import { Task } from '../task.entity'
import { ErrorTaskStateService, RunTaskStateService, ScaleTaskStateService, TerminateTaskStateService } from './state'

@Injectable()
export class TaskService {

    public constructor(
        private readonly logger: TransactionalLoggerService,
        @InjectModel(Task.name) private readonly model: Model<Task>,
        @Inject(forwardRef(() => RunTaskStateService)) private readonly runService: RunTaskStateService,
        @Inject(forwardRef(() => ScaleTaskStateService)) private readonly scaleService: ScaleTaskStateService,
        @Inject(forwardRef(() => TerminateTaskStateService)) private readonly terminateService: TerminateTaskStateService,
        @Inject(forwardRef(() => ErrorTaskStateService)) private readonly errorService: ErrorTaskStateService,
        @Inject(forwardRef(() => ExportService)) private readonly exportService: ExportService
    ) { }

    public async next(context: TransactionalContext, key: Task4RunKeyInputDTO) {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        await ClassValidatorHelper.validate('key', key)

        const result = await this.runService.apply(context, key)

        return result

    }

    public async scale(context: TransactionalContext) {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        await this.scaleService.apply(context)

    }

    public async terminate(context: TransactionalContext, input: Task4TerminateInputDTO) {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        await ClassValidatorHelper.validate('input', input)

        const key: Task4TerminateKeyInputDTO = {
            transaction: input.transaction,
            _export: input._export,
            _collection: input._collection
        }

        const value: Task4TerminateValueInputDTO = {
            worker: input.worker
        }

        await this.terminateService.apply(context, key, value)

    }

    public async error(context: TransactionalContext, key: TaskValue4ErrorKeyInputDTO, value: TaskValue4ErrorValueInputDTO) {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        await ClassValidatorHelper.validate('key', key)
        await ClassValidatorHelper.validate('value', value)

        await this.errorService.apply(context, key, value)

    }

    public async cleanup(context: TransactionalContext) {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        this.logger.log(TaskService.name, context, 'cleaning tasks')

        const options: TransactionOptions = { writeConcern: { w: 'majority' } }

        await MongoDBHelper.withTransaction(this.model, async (session) => {
            await this.model.deleteMany({}, { session })
        }, options)

        this.logger.log(TaskService.name, context, 'all tasks are cleaned')

    }

    public async list(input: Task4ListInputDTO) {

        try {
            await ClassValidatorHelper.validate('input', input)
        } catch (error) {
            throw new BadRequestException(error)
        }

        const filter: FilterQuery<Partial<Task>> = {}

        let _exports: Export[] = []

        if (!StringHelper.isEmpty(input.transaction) ||
            !StringHelper.isEmpty(input.source) ||
            !StringHelper.isEmpty(input.target) ||
            !StringHelper.isEmpty(input.database)) {

            _exports = await this.exportService.list(input, 'raw')

            if (CollectionHelper.isEmpty(_exports)) { return [] }

        }

        if (!CollectionHelper.isEmpty(_exports)) {
            filter.$or = _exports.map(_export => ({ _export }))
        }

        if (!StringHelper.isEmpty(input.transaction)) {
            filter.transaction = input.transaction
        }

        if (!StringHelper.isEmpty(input._collection)) {
            filter._collection = input._collection
        }

        if (!StringHelper.isEmpty(input.status)) {
            filter.status = input.status
        }

        if (!StringHelper.isEmpty(input.worker)) {
            filter.worker = input.worker
        }

        const result = await this.model.find(filter, undefined, { populate: '_export' })

        const output = (result ?? []).map(({ transaction, _export, _collection, status, worker, error, count, window }) => {

            const dto = new TaskDTO()
            dto.transaction = transaction

            dto._export = new ExportDTO()

            dto._export.transaction = _export.transaction

            dto._export.source = new SourceDTO()
            dto._export.source.name = _export.source.name
            dto._export.source.url = _export.source.url
            dto._export.source.filter = _export.source.filter
            dto._export.source.stamps = _export.source.stamps

            dto._export.target = new TargetDTO()
            dto._export.target.name = _export.target.name
            dto._export.target.credentials = _export.target.credentials

            dto._export.database = _export.database

            dto._collection = _collection
            dto.status = status

            dto.worker = worker
            dto.error = error
            dto.count = count
            dto.window = window

            return dto

        })

        return output

    }

    public async getDateOfLastTerminated(context: TransactionalContext, input: Task4GetDateOfLastTerminatedInputDTO, session?: ClientSession) {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        await ClassValidatorHelper.validate('input', input)

        const _exports = await this.exportService.list(input, 'raw')

        if (CollectionHelper.isEmpty(_exports)) {
            throw new InvalidParameterException('input', input)
        }

        const aggregation = await this.model.aggregate([
            {
                $match: {
                    $or: _exports.map(_export => ({ _export: _export._id })),
                    _collection: input._collection,
                    status: ExportStatus.TERMINATED
                }
            },
            {
                $group: {
                    _id: { _collection: '$_collection' },
                    value: { $max: '$window.end' }
                }
            }
        ], { session })

        if (CollectionHelper.isEmpty(aggregation)) {
            return new Date(0)
        }

        const result = aggregation?.[0]?.value as Date ?? new Date(0)

        this.logger.debug?.(TaskService.name, context, 'date of last terminated task', { date: result })

        return result

    }

    public async listBusyWorkerNames(session?: ClientSession) {

        const aggregation = await this.model.aggregate([
            {
                $match: {
                    $or: [
                        // eslint-disable-next-line array-element-newline
                        { status: ExportStatus.RUNNING },
                        { status: ExportStatus.CREATED }]
                }
            },
            {
                $group: {
                    _id: { worker: '$worker' },
                    count: { $count: {} }
                }
            }
        ], { session })

        const result =
            aggregation
                .map(({ _id, _ }) => _id)
                .map(({ worker }) => worker)
                .filter(worker => !StringHelper.isEmpty(worker))
                .map((name: IWorker['name']) => ({ name }))

        return result

    }

    public async getNextCreated(session?: ClientSession) {

        const result = await this.model.findOne(
            {
                status: ExportStatus.CREATED,
                $or: [{ worker: { $exists: false } }, { worker: { $type: BSONType.null } }]
            },
            undefined,
            { sort: { _id: 'asc' }, session } // TODO: ordenar por createdAt quando usar o stamps
        ).populate('_export')

        if (ObjectHelper.isEmpty(result)) {
            return undefined
        }

        return result as Task

    }

    public async isAllTerminated(input: Task4IsAllTerminatedInputDTO, session?: ClientSession) {

        await ClassValidatorHelper.validate('input', input)

        const result = !await MongoDBHelper.exists(
            this.model,
            {
                transaction: input.transaction,
                _export: input._export,
                $or: [
                    { status: ExportStatus.CREATED },
                    { status: ExportStatus.RUNNING },
                    { status: ExportStatus.PAUSED },
                    { status: ExportStatus.ERROR }
                ]
            },
            { session }
        )

        return result

    }

    public async isAllTerminatedOrError(dto: Task4IsAllTerminateOrErrordInputDTO, session?: ClientSession) {

        await ClassValidatorHelper.validate('dto', dto)

        const result = !await MongoDBHelper.exists(
            this.model,
            {
                transaction: dto.transaction,
                _export: dto._export,
                $or: [
                    { status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING }, { status: ExportStatus.PAUSED }
                ]
            },
            { session }
        )

        return result

    }

    public async listCreatedRunningOrPaused(input: Task4GetCreatedRunningOrPausedInputDTO) {

        await ClassValidatorHelper.validate('input', input)

        const _exports = await this.exportService.listCreatedRunningOrPaused(input)

        const filter: FilterQuery<Partial<Task>> = {
            _collection: input._collection
        }

        if (!StringHelper.isEmpty(input.transaction)) {
            filter.transaction = input.transaction
        }

        if (!StringHelper.isEmpty(input.worker)) {
            filter.worker = input.worker
        }

        filter.$or = [
            { status: ExportStatus.CREATED },
            { status: ExportStatus.RUNNING },
            { status: ExportStatus.PAUSED },
            ..._exports.map(_export => ({ _export }))
        ]

        return await MongoDBHelper.list<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            filter
        )

    }

    public async countCreatedOrRunning(input: Task4CountCreatedOrRunningInputDTO, session?: ClientSession) {

        await ClassValidatorHelper.validate('input', input)

        const _exports = await this.exportService.listCreatedOrRunning(input)

        const filter: FilterQuery<Partial<Task>> = {}

        if (!StringHelper.isEmpty(input.transaction)) {
            filter.transaction = input.transaction
        }

        if (!StringHelper.isEmpty(input.worker)) {
            filter.worker = input.worker
        }

        filter.$or = [
            // eslint-disable-next-line array-element-newline
            { status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING },
            ..._exports.map(_export => ({ _export }))
        ]

        return await MongoDBHelper.count<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            filter,
            { session }
        )

    }

    public async countPaused(input: Task4CountPausedInputDTO, session?: ClientSession) {

        await ClassValidatorHelper.validate('input', input)

        const _exports = await this.exportService.listPaused(input)

        const filter: FilterQuery<Partial<Task>> = {}

        if (!StringHelper.isEmpty(input.transaction)) {
            filter.transaction = input.transaction
        }

        filter.$or = [
            // eslint-disable-next-line array-element-newline
            { status: ExportStatus.PAUSED },
            ..._exports.map(_export => ({ _export }))
        ]

        return await MongoDBHelper.count<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            filter,
            { session }
        )

    }

    public async countError(input: Task4CountErrorInputDTO, session?: ClientSession) {

        await ClassValidatorHelper.validate('input', input)

        const filter: FilterQuery<Partial<Task>> = {
            _export: input._export
        }

        if (!StringHelper.isEmpty(input.transaction)) {
            filter.transaction = input.transaction
        }

        filter.status = ExportStatus.ERROR

        const result = await MongoDBHelper.count<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            filter,
            { session }
        )

        return result

    }

    public async isCreated(input: Task4IsCreatedInputDTO, session?: ClientSession) {

        await ClassValidatorHelper.validate('dto', input)

        return await MongoDBHelper.exists<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            {
                transaction: input.transaction,
                _export: input._export,
                _collection: input._collection,
                status: ExportStatus.CREATED,
                $or: [{ worker: { $exists: false } }, { worker: { $type: BSONType.null } }]
            },
            { session }
        )

    }

    public async listRunning(input: Task4ListRunningInputDTO) {

        await ClassValidatorHelper.validate('input', input)

        const filter: FilterQuery<Partial<Task>> = {
            transaction: input.transaction,
            _export: input._export,
            _collection: input._collection
        }

        if (!StringHelper.isEmpty(input.worker)) {
            filter.worker = input.worker
        }

        filter.status = ExportStatus.RUNNING

        const result = await MongoDBHelper.list<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            filter
        )

        return result

    }

}
