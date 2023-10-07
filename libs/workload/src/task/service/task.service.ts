import { InvalidParameterException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper, StringHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { BSONType } from 'mongodb'
import { Model, type ClientSession, type FilterQuery } from 'mongoose'
import { Export, ExportService, ExportStatus, type Export4FlatKeyDTO } from '../../export'
import { type IWorker } from '../../worker'
import {
    type TaskKeyDTO,
    type TaskWithWorkerDTO,
    type Task4FlatKeyDTO,
    type Task4FlatKeyWithOptionalTransactionDTO,
    type Task4ListInputDTO,
    type Task4RunKeyInputDTO
} from '../task.dto'
import { Task } from '../task.entity'
import {
    Task2TaskDTOConverterService,
    Task4FlatKeyDTO2FilterQueryTaskConverterService,
    Task4ListInputDTO2FilterQueryTaskConverterService,
    TaskKeyDTO2FilterQueryTaskConverterService
} from './converter'
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
        @Inject(forwardRef(() => ExportService)) private readonly exportService: ExportService,
        private readonly task2TaskDTOConverter: Task2TaskDTOConverterService,
        private readonly taskKeyDTO2FilterQueryConverter: TaskKeyDTO2FilterQueryTaskConverterService,
        private readonly task4FlatKeyDTO2FilterQueryConverter: Task4FlatKeyDTO2FilterQueryTaskConverterService,
        private readonly task4ListInputDTO2FilterQueryConverter: Task4ListInputDTO2FilterQueryTaskConverterService
    ) { }

    public async next(context: TransactionalContext, key: Task4RunKeyInputDTO) {
        const result = await this.runService.apply(context, key, undefined)
        return result
    }

    public async scale(context: TransactionalContext) {
        await this.scaleService.apply(context, undefined, undefined)
    }

    public async terminate(context: TransactionalContext, key: TaskWithWorkerDTO) {
        await this.terminateService.apply(context, key, undefined)
    }

    public async error(context: TransactionalContext, key: TaskWithWorkerDTO, value: Error) {
        await this.errorService.apply(context, key, value)
    }

    public async cleanup(context: TransactionalContext) {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        this.logger.log(TaskService.name, context, 'cleaning tasks')

        await this.model.deleteMany({})

        this.logger.log(TaskService.name, context, 'all tasks are cleaned')

    }

    public async list(context: TransactionalContext, input: Task4ListInputDTO) {

        try {
            await ClassValidatorHelper.validate('input', input)
        } catch (error) {
            throw new BadRequestException(error)
        }

        const filter: FilterQuery<Partial<Task>> = await this.task4ListInputDTO2FilterQueryConverter.convert(context, input)

        let _exports: Export[] = []

        if (!StringHelper.isEmpty(input.transaction) ||
            !StringHelper.isEmpty(input.source) ||
            !StringHelper.isEmpty(input.target) ||
            !StringHelper.isEmpty(input.database)) {

            _exports = await this.exportService.list(context, input, 'raw')

            if (CollectionHelper.isEmpty(_exports)) { return [] }

        }

        if (!CollectionHelper.isEmpty(_exports)) {
            filter.$or = _exports.map(_export => ({ _export }))
        }

        const result = await this.model.find(filter, undefined, { populate: '_export' })

        if (CollectionHelper.isEmpty(result)) {
            return []
        }

        const output = await Promise.all(
            result.map(
                async input => await this.task2TaskDTOConverter.convert(context, input)
            )
        )

        return output

    }

    public async listWithStatus<T extends 'dto' | 'raw'>(context: TransactionalContext, input: Task4FlatKeyDTO | Task4FlatKeyWithOptionalTransactionDTO | TaskKeyDTO | Task | TaskWithWorkerDTO, statuses: ExportStatus[], returns: T, session?: ClientSession) {

        await ClassValidatorHelper.validate('input', input)

        let filter: FilterQuery<Partial<Task>>

        if ('_export' in input) {

            filter = await this.taskKeyDTO2FilterQueryConverter.convert(context, input)

            filter.$or = [
                ...statuses.map(status => ({ status }))
            ]

        } else {

            filter = await this.task4FlatKeyDTO2FilterQueryConverter.convert(context, input)

            const _exports = await this.exportService.listWithStatus(context, input, statuses, 'raw', session)

            filter.$or = [
                // eslint-disable-next-line array-element-newline
                ...statuses.map(status => ({ status })),
                ..._exports.map(_export => ({ _export }))
            ]

        }

        const options = ObjectHelper.isEmpty(session)
            ? { populate: '_export' }
            : { populate: '_export', session }

        const result = await MongoDBHelper.list<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            filter,
            undefined,
            options
        )

        if (CollectionHelper.isEmpty(result)) {
            return []
        }

        if (returns === 'raw') {
            return result
        }

        const output = await Promise.all(
            result.map(
                async (model) => await this.task2TaskDTOConverter.convert(context, model)
            )
        )

        return output as any

    }

    public async existsWithStatus(context: TransactionalContext, input: TaskKeyDTO, statuses: ExportStatus[], session?: ClientSession) {

        await ClassValidatorHelper.validate('input', input)

        const filter = await this.taskKeyDTO2FilterQueryConverter.convert(context, input)

        filter.$or = statuses.map(status => ({ status }))

        const options = ObjectHelper.isEmpty(session) ? {} : { session }

        const output = await MongoDBHelper.exists<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            filter,
            options
        )

        return output

    }

    public async countWithStatus(context: TransactionalContext, input: Task4FlatKeyDTO | Task4FlatKeyWithOptionalTransactionDTO | Export4FlatKeyDTO | Export, statuses: ExportStatus[], session?: ClientSession) {

        await ClassValidatorHelper.validate('input', input)

        const filter =
            input instanceof Export
                ? {}
                : await this.task4FlatKeyDTO2FilterQueryConverter.convert(context, input)

        const _exports = await this.exportService.listWithStatus(context, input, statuses, 'raw', session)

        filter.$or = [
            // eslint-disable-next-line array-element-newline
            ...statuses.map(status => ({ status })),
            ..._exports.map(_export => ({ _export }))
        ]

        const options = ObjectHelper.isEmpty(session) ? {} : { session }

        const output = await MongoDBHelper.count<Task, 'transaction' | '_export' | '_collection', Model<Task>>(
            this.model,
            filter,
            options
        )

        return output

    }

    public async getDateOfLastTerminated(context: TransactionalContext, input: TaskKeyDTO, session?: ClientSession) {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        await ClassValidatorHelper.validate('input', input)

        const _exports = await this.exportService.list(context, input, 'raw')

        if (CollectionHelper.isEmpty(_exports)) {
            throw new InvalidParameterException('input', input)
        }

        const options = ObjectHelper.isEmpty(session) ? {} : { session }

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
        ], options)

        if (CollectionHelper.isEmpty(aggregation)) {
            return new Date(0)
        }

        const result = aggregation?.[0]?.value as Date ?? new Date(0)

        this.logger.debug?.(TaskService.name, context, 'date of last terminated task', { date: result })

        return result

    }

    public async listBusyWorkerNames(session?: ClientSession) {

        const options = ObjectHelper.isEmpty(session) ? {} : { session }

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
        ], options)

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

    public async isAllTerminated(input: Export, session?: ClientSession) {

        await ClassValidatorHelper.validate('input', input)

        const options = ObjectHelper.isEmpty(session) ? {} : { session }

        const result = !await MongoDBHelper.exists(
            this.model,
            {
                transaction: input.transaction,
                _export: input,
                $or: [
                    { status: ExportStatus.CREATED },
                    { status: ExportStatus.RUNNING },
                    { status: ExportStatus.PAUSED },
                    { status: ExportStatus.ERROR }
                ]
            },
            options
        )

        return result

    }

    public async isAllTerminatedOrError(input: Export, session?: ClientSession) {

        await ClassValidatorHelper.validate('input', input)

        const options = ObjectHelper.isEmpty(session) ? {} : { session }

        const result = !await MongoDBHelper.exists(
            this.model,
            {
                transaction: input.transaction,
                _export: input,
                $or: [
                    { status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING }, { status: ExportStatus.PAUSED }
                ]
            },
            options
        )

        return result

    }

}
