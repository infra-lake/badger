import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { RunExportStateService } from '@badger/workload/export/service/state'
import { WorkerService } from '@badger/workload/worker'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ExportStatus } from 'libs/workload/src/export'
import { type TransactionOptions } from 'mongodb'
import { Model, type ClientSession } from 'mongoose'
import { type Task4RunKeyInputDTO, type Task4RunOutputDTO } from '../../task.dto'
import { Task } from '../../task.entity'
import { TaskService } from '../task.service'

@Injectable()
export class RunTaskStateService extends StateService<Task4RunKeyInputDTO, undefined, Task4RunOutputDTO | undefined> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Task.name) private readonly model: Model<Task>,
        @Inject(forwardRef(() => TaskService)) private readonly service: TaskService,
        @Inject(forwardRef(() => RunExportStateService)) private readonly runExportService: RunExportStateService,
        private readonly workerService: WorkerService
    ) { super(logger) }

    public async apply(context: TransactionalContext, key: Task4RunKeyInputDTO) {

        const options: TransactionOptions = { writeConcern: { w: 'majority' } }

        const result = await MongoDBHelper.withTransaction(this.model, async (session) => {

            await this.validate(context, key, session)

            const result = await this.getNextTask(context, key, session) as Task4RunOutputDTO
            if (ObjectHelper.isEmpty(result)) { return undefined }

            await this.model.findOneAndUpdate(
                {
                    transaction: result.transaction,
                    _export: result._export,
                    _collection: result._collection,
                    worker: key.worker,
                    $or: [{ status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING }]
                },
                { $set: { status: ExportStatus.RUNNING } },
                { upsert: false, returnDocument: 'after', session }
            )

            await this.runExportService.apply(context, result._export)

            return result

        }, options)

        this.logger.debug?.(RunTaskStateService.name, context, 'tasks is running successfully')

        return result

    }

    private async getNextTask(context: TransactionalContext, key: Task4RunKeyInputDTO, session: ClientSession) {

        const result = await this.model.findOne(
            {
                worker: key.worker,
                $or: [{ status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING }]
            },
            undefined,
            { sort: { _id: 'asc' }, session }
        ).populate('_export') as Task4RunOutputDTO

        if (ObjectHelper.isEmpty(result)) {
            return undefined
        }

        this.logger.debug?.(RunTaskStateService.name, context, 'trying set task to running', {
            transaction: result.transaction,
            _export: {
                source: result._export.source.name,
                target: result._export.target.name,
                database: result._export.database
            },
            _collection: result._collection,
            worker: key.worker
        })

        return result

    }

    protected async validate(context: TransactionalContext, key: Task4RunKeyInputDTO, session?: ClientSession): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        if (ObjectHelper.isEmpty(session)) {
            throw new InvalidParameterException('session', session)
        }

        try {

            await ClassValidatorHelper.validate('key', key)

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

}
