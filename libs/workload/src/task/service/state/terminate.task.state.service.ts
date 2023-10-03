import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type TransactionOptions } from 'mongodb'
import { Model } from 'mongoose'
import { Task, TaskService, type TaskKeyDTO, type TaskValue4TerminateInputDTO } from '../..'
import { ExportStatus } from 'libs/workload/src/export'
import { ErrorExportStateService, TerminateExportStateService } from '@badger/workload/export/service/state'

@Injectable()
export class TerminateTaskStateService extends StateService<TaskKeyDTO, TaskValue4TerminateInputDTO> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Task.name) private readonly model: Model<Task>,
        @Inject(forwardRef(() => TaskService)) private readonly service: TaskService,
        @Inject(forwardRef(() => TerminateExportStateService)) private readonly terminateExportService: TerminateExportStateService,
        @Inject(forwardRef(() => ErrorExportStateService)) private readonly errorExportService: ErrorExportStateService
    ) { super(logger) }

    public async apply(context: TransactionalContext, key: TaskKeyDTO, value: TaskValue4TerminateInputDTO): Promise<void> {

        this.logger.debug?.(TerminateTaskStateService.name, context, 'terminating task', {
            transaction: key.transaction,
            _export: {
                source: key._export.source.name,
                target: key._export.target.name,
                database: key._export.database
            },
            _collection: key._collection,
            worker: value.worker
        })

        const options: TransactionOptions = { writeConcern: { w: 'majority' } }

        await MongoDBHelper.withTransaction(this.model, async (session) => {

            await this.validate(context, key, value)

            await this.model.findOneAndUpdate(
                {
                    transaction: key.transaction,
                    _export: key._export,
                    _collection: key._collection,
                    worker: value.worker,
                    status: ExportStatus.RUNNING
                },
                { $set: { status: ExportStatus.TERMINATED } },
                { upsert: false, returnDocument: 'after', session }
            )

            if (await this.service.isAllTerminated(key)) {
                await this.terminateExportService.apply(context, key._export)
            } else if (await this.service.isAllTerminatedOrError(key)) {
                await this.errorExportService.apply(context, key._export)
            }

        }, options)

        this.logger.debug?.(TerminateTaskStateService.name, context, 'tasks successfully terminated')

    }

    protected async validate(context: TransactionalContext, key: TaskKeyDTO, value: TaskValue4TerminateInputDTO): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        try {

            await ClassValidatorHelper.validate('key', key)
            await ClassValidatorHelper.validate('value', value)

            const found = await this.getRunningFrom(key, value)
            if (CollectionHelper.isEmpty(found)) {
                throw new InvalidParameterException('task', found, 'task not to be terminated because it is not running')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

    private async getRunningFrom(key: TaskKeyDTO, value: TaskValue4TerminateInputDTO) {

        const { transaction, _export, _collection } = key
        const { worker } = value

        const found = await this.service.listRunning({ transaction, _export, _collection, worker })

        return found

    }

}
