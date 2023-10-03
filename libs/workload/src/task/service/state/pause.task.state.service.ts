import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { ExportStatus, type ExportKeyDTO } from '@badger/workload/export'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type TransactionOptions } from 'mongodb'
import { type ClientSession, Model } from 'mongoose'
import { Task, Task4CountCreatedOrRunningInputDTO, TaskService } from '../..'

@Injectable()
export class PauseTaskStateService extends StateService<ExportKeyDTO, undefined> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Task.name) private readonly model: Model<Task>,
        private readonly service: TaskService
    ) { super(logger) }

    public async apply(context: TransactionalContext, key: ExportKeyDTO): Promise<void> {

        this.logger.debug?.(PauseTaskStateService.name, context, 'pausing tasks')

        const options: TransactionOptions = { writeConcern: { w: 'majority' } }

        await MongoDBHelper.withTransaction(this.model, async (session) => {

            await this.validate(context, key, session)

            await this.model.updateMany(
                {
                    transaction: key.transaction,
                    _export: key,
                    $or: [{ status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING }]
                },
                { $set: { status: ExportStatus.PAUSED } },
                { upsert: false, session }
            )

        }, options)

        this.logger.debug?.(PauseTaskStateService.name, context, 'tasks successfully paused')

    }

    protected async validate(context: TransactionalContext, key: ExportKeyDTO, session?: ClientSession): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        if (ObjectHelper.isEmpty(session)) {
            throw new InvalidParameterException('session', session)
        }

        try {

            await ClassValidatorHelper.validate('key', key)

            const count = await this.countCreatedOrRunning(key, session)
            if (count <= 0) {
                throw new InvalidParameterException('key', key, 'there aren\'t tasks to be paused')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

    private async countCreatedOrRunning(key: ExportKeyDTO, session?: ClientSession) {

        const dto = new Task4CountCreatedOrRunningInputDTO()
        dto.transaction = key.transaction
        dto.sourceName = key.source.name
        dto.targetName = key.target.name
        dto.database = key.database

        return await this.service.countCreatedOrRunning(dto, session)

    }

}
