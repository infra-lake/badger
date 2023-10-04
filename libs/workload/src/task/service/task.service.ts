import { InvalidParameterException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper, StringHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { BSONType, type TransactionOptions } from 'mongodb'
import { Model, type ClientSession, type FilterQuery } from 'mongoose'
import { ExportStatus } from '../../export'
import { type IWorker } from '../../worker'
import {
    type Task4TerminateInputDTO,
    type Task4CountCreatedOrRunningInputDTO,
    type Task4CountPausedInputDTO,
    type Task4GetCreatedOrRunningInputDTO,
    type Task4GetDateOfLastTerminatedInputDTO,
    type Task4IsAllTerminateOrErrordInputDTO,
    type Task4IsAllTerminatedInputDTO,
    type Task4IsCreatedInputDTO,
    type Task4ListRunningInputDTO,
    type Task4RunKeyInputDTO,
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
        @Inject(forwardRef(() => ErrorTaskStateService)) private readonly errorService: ErrorTaskStateService
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

    public async getDateOfLastTerminated(context: TransactionalContext, input: Task4GetDateOfLastTerminatedInputDTO, session?: ClientSession) {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        await ClassValidatorHelper.validate('input', input)

        const aggregation = await this.model.aggregate([
            {
                $match: {
                    '_export.source.name': input.source,
                    '_export.target.name': input.target,
                    '_export.database': input.database,
                    _collection: input._collection,
                    status: ExportStatus.TERMINATED
                }
            },
            {
                $group: {
                    _id: { _export: '$_export', _collection: '$_collection' },
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

        return result

    }

    public async isAllTerminated(input: Task4IsAllTerminatedInputDTO) {

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
            }
        )

        return result

    }

    public async isAllTerminatedOrError(dto: Task4IsAllTerminateOrErrordInputDTO) {

        await ClassValidatorHelper.validate('dto', dto)

        const result = !await MongoDBHelper.exists(
            this.model,
            {
                transaction: dto.transaction,
                _export: dto._export,
                $or: [
                    { status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING }, { status: ExportStatus.PAUSED }
                ]
            }
        )

        return result

    }

    public async listCreatedOrRunning(input: Task4GetCreatedOrRunningInputDTO) {

        await ClassValidatorHelper.validate('input', input)

        const filter: FilterQuery<Partial<Task>> = {
            '_export.source.name': input.source,
            '_export.target.name': input.target,
            '_export.database': input.database,
            _collection: input._collection
        }

        if (!StringHelper.isEmpty(input.transaction)) {
            filter.transaction = input.transaction
        }

        if (!StringHelper.isEmpty(input.worker)) {
            filter.worker = input.worker
        }

        filter.$or = [{ status: ExportStatus.CREATED }, { status: ExportStatus.PAUSED }]

        return await MongoDBHelper.list<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            filter
        )

    }

    public async countCreatedOrRunning(input: Task4CountCreatedOrRunningInputDTO, session?: ClientSession) {

        await ClassValidatorHelper.validate('input', input)

        const filter: FilterQuery<Partial<Task>> = {
            '_export.source.name': input.source,
            '_export.target.name': input.target,
            '_export.database': input.database
        }

        if (!StringHelper.isEmpty(input.transaction)) {
            filter.transaction = input.transaction
        }

        if (!StringHelper.isEmpty(input.worker)) {
            filter.worker = input.worker
        }

        filter.$or = [{ status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING }]

        return await MongoDBHelper.count<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            filter,
            { session }
        )

    }

    public async countPaused(input: Task4CountPausedInputDTO, session?: ClientSession) {

        await ClassValidatorHelper.validate('input', input)

        const filter: FilterQuery<Partial<Task>> = {
            '_export.source.name': input.source,
            '_export.target.name': input.target,
            '_export.database': input.database
        }

        if (!StringHelper.isEmpty(input.transaction)) {
            filter.transaction = input.transaction
        }

        filter.status = ExportStatus.PAUSED

        return await MongoDBHelper.count<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            filter,
            { session }
        )

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
