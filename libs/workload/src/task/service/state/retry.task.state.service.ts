import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { ExportStatus, type Export4RetryInputDTO, ExportService } from '@badger/workload/export'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type TransactionOptions } from 'mongodb'
import { Model } from 'mongoose'
import { Task } from '../../task.entity'
import { TaskService } from '../task.service'
import { Task4CountErrorInputDTO } from '../../task.dto'

@Injectable()
export class RetryTaskStateService extends StateService<Export4RetryInputDTO, undefined> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Task.name) private readonly model: Model<Task>,
        @Inject(forwardRef(() => TaskService)) private readonly service: TaskService,
        @Inject(forwardRef(() => ExportService)) private readonly exportService: ExportService
    ) { super(logger) }

    public async apply(context: TransactionalContext, key: Export4RetryInputDTO): Promise<void> {

        this.logger.debug?.(RetryTaskStateService.name, context, 'retrying tasks')

        const options: TransactionOptions = { writeConcern: { w: 'majority' } }

        await MongoDBHelper.withTransaction(this.model, async (session) => {

            await this.validate(context, key)

            const _export = await this.exportService.get(key)

            await this.model.updateMany(
                {
                    transaction: key.transaction,
                    _export,
                    status: ExportStatus.ERROR
                },
                { $set: { status: ExportStatus.CREATED, worker: null, error: null } },
                { upsert: false, session }
            )

        }, options)

        this.logger.debug?.(RetryTaskStateService.name, context, 'tasks successfully recreated')

    }

    protected async validate(context: TransactionalContext, key: Export4RetryInputDTO): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        try {

            await ClassValidatorHelper.validate('key', key)

            const count = await this.countError(key)
            if (count <= 0) {
                throw new InvalidParameterException('key', key, 'there aren\'t error tasks')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

    public async countError(key: Export4RetryInputDTO) {

        const dto = new Task4CountErrorInputDTO()
        dto.transaction = key.transaction
        dto._export = await this.exportService.get(key)

        const count = await this.service.countError(dto)

        return count

    }

}
