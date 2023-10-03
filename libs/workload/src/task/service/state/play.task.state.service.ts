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
import { Task, Task4CountPausedInputDTO, TaskService } from '../..'

@Injectable()
export class PlayTaskStateService extends StateService<ExportKeyDTO, undefined> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Task.name) private readonly model: Model<Task>,
        private readonly service: TaskService
    ) { super(logger) }

    public async apply(context: TransactionalContext, key: ExportKeyDTO): Promise<void> {

        this.logger.debug?.(PlayTaskStateService.name, context, 'unpausing tasks')

        const options: TransactionOptions = { writeConcern: { w: 'majority' } }

        await MongoDBHelper.withTransaction(this.model, async (session) => {

            await this.validate(context, key, session)

            await this.model.updateMany(
                {
                    transaction: key.transaction,
                    _export: key,
                    status: ExportStatus.PAUSED
                },
                { $set: { status: ExportStatus.CREATED, worker: null, error: null } },
                { upsert: false, session }
            )

        }, options)

        this.logger.debug?.(PlayTaskStateService.name, context, 'tasks successfully unpaused')

    }

    protected async validate(context: TransactionalContext, key: ExportKeyDTO, session?: ClientSession): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        try {

            await ClassValidatorHelper.validate('key', key)

            const count = await this.countPaused(key, session)
            if (count <= 0) {
                throw new InvalidParameterException('key', key, 'there aren\'t paused tasks')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

    private async countPaused(key: ExportKeyDTO, session?: ClientSession) {

        const dto = new Task4CountPausedInputDTO()
        dto.transaction = key.transaction
        dto.sourceName = key.source.name
        dto.targetName = key.target.name
        dto.database = key.database

        return await this.service.countPaused(dto, session)

    }

}
