import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { WorkerHelper, WorkerService, WorkerStatus, type IWorker } from '@badger/workload/worker'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ExportStatus } from 'libs/workload/src/export'
import { BSONType, type TransactionOptions } from 'mongodb'
import { Model, type ClientSession } from 'mongoose'
import { type Task4IsCreatedInputDTO, type Task4ScaleKeyInputDTO, type Task4ScaleValueInputDTO } from '../../task.dto'
import { Task } from '../../task.entity'
import { TaskService } from '../task.service'

@Injectable()
export class ScaleTaskStateService extends StateService<Task4ScaleKeyInputDTO | undefined, Task4ScaleValueInputDTO | undefined> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Task.name) private readonly model: Model<Task>,
        @Inject(forwardRef(() => TaskService)) private readonly service: TaskService,
        private readonly workerService: WorkerService
    ) { super(logger) }

    public async apply(context: TransactionalContext): Promise<void> {

        const options: TransactionOptions = { writeConcern: { w: 'majority' } }

        await MongoDBHelper.withTransaction(this.model, async (session) => {

            await this.validate(context)

            const workers = await this.getFreeWorkers(context, session)
            if (CollectionHelper.isEmpty(workers)) { return }

            const key = await this.service.getNextCreated(session) as Task
            if (ObjectHelper.isEmpty(key)) { return }

            const value = { worker: WorkerHelper.sortOne(context, workers as IWorker[]).name }

            this.logger.debug?.(ScaleTaskStateService.name, context, 'trying to scale task', {
                transaction: key.transaction,
                _export: key._export._id,
                _collection: key._collection,
                worker: value.worker
            })

            await this.validate(context, key, value, session)

            const begin = await this.getDateOfLastTerminated(context, key, session)
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

        }, options)

        this.logger.debug?.(ScaleTaskStateService.name, context, 'tasks scaled successfully')

    }

    private async getFreeWorkers(context: TransactionalContext, session: ClientSession) {

        const workers = await this.workerService.list(context, { status: WorkerStatus.FREE }, session)

        if (CollectionHelper.isEmpty(workers)) { return }

        this.logger.debug?.(ScaleTaskStateService.name, context, 'free workers', { workers })

        return workers

    }

    private async getDateOfLastTerminated(context: TransactionalContext, key: Task4ScaleKeyInputDTO, session: ClientSession) {
        return await this.service.getDateOfLastTerminated(context, {
            source: key._export.source.name,
            target: key._export.target.name,
            database: key._export.database,
            _collection: key._collection
        }, session)
    }

    protected async validate(context: TransactionalContext, key?: Task4ScaleKeyInputDTO, value?: Task4ScaleValueInputDTO, session?: ClientSession): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        if (ObjectHelper.isEmpty(key) && ObjectHelper.isEmpty(value) && ObjectHelper.isEmpty(session)) { return }

        try {

            await ClassValidatorHelper.validate('key', key as any)
            await ClassValidatorHelper.validate('value', value as any)
            if (ObjectHelper.isEmpty(session)) {
                throw new InvalidParameterException('session', session)
            }

            if (!await MongoDBHelper.exists(this.model, key, { session })) {
                throw new InvalidParameterException('key', key, 'task does not exists')
            }

            if (!await this.service.isCreated(key as any as Task4IsCreatedInputDTO, session)) {
                throw new InvalidParameterException('key', key, 'task is not created')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

}
