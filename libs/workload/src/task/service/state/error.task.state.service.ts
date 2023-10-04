import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { ExportStatus } from '@badger/workload/export'
import { ErrorExportStateService } from '@badger/workload/export/service/state'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type TransactionOptions } from 'mongodb'
import { Model } from 'mongoose'
import { type TaskValue4ErrorKeyInputDTO, type TaskValue4ErrorValueInputDTO } from '../../task.dto'
import { Task } from '../../task.entity'
import { TaskService } from '../task.service'

@Injectable()
export class ErrorTaskStateService extends StateService<TaskValue4ErrorKeyInputDTO, TaskValue4ErrorValueInputDTO> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Task.name) private readonly model: Model<Task>,
        @Inject(forwardRef(() => TaskService)) private readonly service: TaskService,
        @Inject(forwardRef(() => ErrorExportStateService)) private readonly errorExportService: ErrorExportStateService
    ) { super(logger) }

    public async apply(context: TransactionalContext, key: TaskValue4ErrorKeyInputDTO, value: TaskValue4ErrorValueInputDTO): Promise<void> {

        this.logger.debug?.(ErrorTaskStateService.name, context, 'registetring error on task', { _collection: key._collection, value })

        const options: TransactionOptions = { writeConcern: { w: 'majority' } }

        await MongoDBHelper.withTransaction(this.model, async (session) => {

            await this.validate(context, key, value)

            await this.model.findOneAndUpdate(
                {
                    transaction: key._collection,
                    _export: key._export,
                    _collection: key._collection,
                    worker: value.worker,
                    $or: [{ status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING }]
                },
                { $set: { status: ExportStatus.ERROR, error: value.error } },
                { upsert: false, returnDocument: 'after', session }
            )

            if (await this.service.isAllTerminatedOrError(key)) {
                await this.errorExportService.apply(context, key._export)
            }

        }, options)

        this.logger.debug?.(ErrorTaskStateService.name, context, 'tasks error successfully registered')

    }

    protected async validate(context: TransactionalContext, key: TaskValue4ErrorKeyInputDTO, value: TaskValue4ErrorValueInputDTO): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        try {

            await ClassValidatorHelper.validate('key', key)
            await ClassValidatorHelper.validate('value', value)

            const found = await this.getRunningFrom(key, value)
            if (CollectionHelper.isEmpty(found)) {
                throw new InvalidParameterException('task', found, 'error on task not to be registered because it is not running')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

    private async getRunningFrom(key: TaskValue4ErrorKeyInputDTO, value: TaskValue4ErrorValueInputDTO) {

        const { transaction, _export, _collection } = key
        const { worker } = value

        const found = await this.service.listRunning({ transaction, _export, _collection, worker })
        return found

    }

}
