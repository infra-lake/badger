import { InvalidParameterException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper, StringHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { BSONType } from 'mongodb'
import { Model, type ClientSession, type FilterQuery } from 'mongoose'
import { ExportStatus } from '../../export'
import { type IWorker } from '../../worker'
import {
    type Task4CountCreatedOrRunningInputDTO,
    type Task4CountPausedInputDTO,
    type Task4GetCreatedOrRunningInputDTO,
    type Task4IsAllTerminateOrErrordInputDTO,
    type Task4IsAllTerminatedInputDTO,
    type Task4IsOrGetRunningInputDTO,
    type Task4IsScaledKeyInputDTO,
    type Task4TerminateInputDTO,
    type TaskKey4GetDateOfLastTerminatedInputDTO,
    type TaskKey4RunInputDTO,
    type TaskKeyDTO,
    type TaskValue4ErrorInputDTO,
    type TaskValue4TerminateInputDTO
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

    public async next(context: TransactionalContext, dto: TaskKey4RunInputDTO) {
        const result = await this.runService.apply(context, dto)
        return result
    }

    public async scale(context: TransactionalContext) {
        await this.scaleService.apply(context)
    }

    public async terminate(context: TransactionalContext, dto: Task4TerminateInputDTO) {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        await ClassValidatorHelper.validate('dto', dto)

        const key: TaskKeyDTO = {
            transaction: dto.transaction,
            _export: dto._export,
            _collection: dto._collection
        }

        const value: TaskValue4TerminateInputDTO = {
            worker: dto.worker
        }

        await this.terminateService.apply(context, key, value)

    }

    public async error(context: TransactionalContext, key: TaskKeyDTO, value: TaskValue4ErrorInputDTO) {
        await this.errorService.apply(context, key, value)
    }

    public async getDateOfLastTerminated(context: TransactionalContext, key: TaskKey4GetDateOfLastTerminatedInputDTO, session?: ClientSession) {

        if (ObjectHelper.isEmpty(context)) { throw new InvalidParameterException('context', context) }

        await ClassValidatorHelper.validate('key', key)

        const aggregation = await this.model.aggregate([
            {
                $match: {
                    '_export.source.name': key.sourceName,
                    '_export.target.name': key.targetName,
                    '_export.database': key.database,
                    _collection: key._collection,
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

    public async isAllTerminated(dto: Task4IsAllTerminatedInputDTO) {

        await ClassValidatorHelper.validate('dto', dto)

        const result = !await MongoDBHelper.exists(
            this.model,
            {
                transaction: dto.transaction,
                _export: dto._export,
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

    public async listCreatedOrRunning(dto: Task4GetCreatedOrRunningInputDTO) {

        await ClassValidatorHelper.validate('dto', dto)

        const filter: FilterQuery<Partial<Task>> = {
            '_export.source.name': dto.sourceName,
            '_export.target.name': dto.targetName,
            '_export.database': dto.database,
            _collection: dto._collection
        }

        if (!StringHelper.isEmpty(dto.transaction)) {
            filter.transaction = dto.transaction
        }

        if (!StringHelper.isEmpty(dto.worker)) {
            filter.worker = dto.worker
        }

        filter.$or = [{ status: ExportStatus.CREATED }, { status: ExportStatus.PAUSED }]

        return await MongoDBHelper.list<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            filter
        )

    }

    public async countCreatedOrRunning(dto: Task4CountCreatedOrRunningInputDTO, session?: ClientSession) {

        await ClassValidatorHelper.validate('dto', dto)

        const filter: FilterQuery<Partial<Task>> = {
            '_export.source.name': dto.sourceName,
            '_export.target.name': dto.targetName,
            '_export.database': dto.database
        }

        if (!StringHelper.isEmpty(dto.transaction)) {
            filter.transaction = dto.transaction
        }

        if (!StringHelper.isEmpty(dto.worker)) {
            filter.worker = dto.worker
        }

        filter.$or = [{ status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING }]

        return await MongoDBHelper.count<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            filter,
            { session }
        )

    }

    public async countPaused(dto: Task4CountPausedInputDTO, session?: ClientSession) {

        await ClassValidatorHelper.validate('dto', dto)

        const filter: FilterQuery<Partial<Task>> = {
            '_export.source.name': dto.sourceName,
            '_export.target.name': dto.targetName,
            '_export.database': dto.database
        }

        if (!StringHelper.isEmpty(dto.transaction)) {
            filter.transaction = dto.transaction
        }

        filter.status = ExportStatus.PAUSED

        return await MongoDBHelper.count<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            filter,
            { session }
        )

    }

    public async isCreated(dto: TaskKeyDTO, session?: ClientSession) {

        await ClassValidatorHelper.validate('dto', dto)

        return await MongoDBHelper.exists<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            {
                transaction: dto.transaction,
                _export: dto._export,
                _collection: dto._collection,
                status: ExportStatus.CREATED,
                $or: [{ worker: { $exists: false } }, { worker: { $type: BSONType.null } }]
            },
            { session }
        )

    }

    public async isScaled(dto: Task4IsScaledKeyInputDTO, session?: ClientSession) {

        await ClassValidatorHelper.validate('dto', dto)

        return await MongoDBHelper.exists<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            {
                transaction: dto.transaction,
                '_export.source.name': dto.sourceName,
                '_export.target.name': dto.targetName,
                '_export.database': dto.database,
                _collection: dto._collection,
                worker: dto.worker,
                status: ExportStatus.CREATED
            },
            { session }
        )

    }

    public async listRunning(dto: Task4IsOrGetRunningInputDTO) {

        await ClassValidatorHelper.validate('dto', dto)

        const filter: FilterQuery<Partial<Task>> = {
            transaction: dto.transaction,
            _export: dto._export,
            _collection: dto._collection
        }

        if (!StringHelper.isEmpty(dto.worker)) {
            filter.worker = dto.worker
        }

        filter.status = ExportStatus.RUNNING

        const result = await MongoDBHelper.list<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            filter
        )

        return result

    }

}
