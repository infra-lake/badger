import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { WithTransaction } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { WorkerHelper, WorkerService, WorkerStatus, type IWorker } from '@badger/workload/worker'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ExportStatus } from 'libs/workload/src/export'
import { BSONType } from 'mongodb'
import { Model, type ClientSession } from 'mongoose'
import { type Task4ScaleValueInputDTO } from '../../task.dto'
import { Task } from '../../task.entity'
import { TaskService } from '../task.service'

@Injectable()
export class ScaleTaskStateService extends StateService<Task | undefined, Task4ScaleValueInputDTO | undefined> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Task.name) private readonly model: Model<Task>,
        @Inject(forwardRef(() => TaskService)) private readonly service: TaskService,
        private readonly workerService: WorkerService
    ) { super(logger) }

    @WithTransaction(Task.name)
    public async change(context: TransactionalContext, _key?: undefined, _value?: undefined, session?: ClientSession): Promise<void> {

        await this.validate(context, undefined, undefined, session)

        const workers = await this.getFreeWorkers(context, session)
        if (CollectionHelper.isEmpty(workers)) { return }

        const key = await this.service.getNextCreated(session) as Task
        if (ObjectHelper.isEmpty(key)) { return }

        const value = { worker: WorkerHelper.sortOne(context, workers as IWorker[]).name }

        this.logger.debug?.(ScaleTaskStateService.name, context, 'trying to scale task', {
            transaction: key.transaction,
            source: key._export.source.name,
            target: key._export.target.name,
            database: key._export.database,
            _collection: key._collection,
            worker: key.worker
        })

        await this.validate(context, key, value, session)

        const begin = await this.service.getDateOfLastTerminated(context, key, session)
        const end = new Date()

        await this.model.findOneAndUpdate(
            {
                transaction: key.transaction,
                _export: key._export,
                _collection: key._collection,
                status: ExportStatus.CREATED,
                $or: [{ worker: { $exists: false } }, { worker: { $type: BSONType.null } }]
            },
            {
                $set: {
                    worker: value.worker,
                    window: { begin, end }
                }
            },
            { upsert: false, returnDocument: 'after', session }
        )

        this.logger.debug?.(ScaleTaskStateService.name, context, 'task scaled successfully')

    }

    private async getFreeWorkers(context: TransactionalContext, session?: ClientSession) {

        const workers = await this.workerService.list(context, { status: WorkerStatus.FREE }, session)

        if (CollectionHelper.isEmpty(workers)) { return }

        this.logger.debug?.(ScaleTaskStateService.name, context, 'free workers', { workers })

        return workers

    }

    protected async validate(context: TransactionalContext, key?: Task, value?: Task4ScaleValueInputDTO, session?: ClientSession): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        if (ObjectHelper.isEmpty(session)) {
            throw new InvalidParameterException('session', session)
        }

        if (ObjectHelper.isEmpty(key) && ObjectHelper.isEmpty(value)) { return }

        try {

            await ClassValidatorHelper.validate('key', key as Task)
            await ClassValidatorHelper.validate('value', value as Task)

            if (ObjectHelper.isEmpty(session)) {
                throw new InvalidParameterException('session', session)
            }

            if (!await this.service.existsWithStatus(context, key as Task, [ExportStatus.CREATED], session)) {
                throw new InvalidParameterException('key', key, 'task is not created')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

    protected async before() { }

    protected async after() { }

}
