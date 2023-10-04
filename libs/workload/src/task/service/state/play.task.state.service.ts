import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { ExportStatus, type Export4PlayInputDTO } from '@badger/workload/export'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type TransactionOptions } from 'mongodb'
import { Model, type ClientSession } from 'mongoose'
import { Task } from '../../task.entity'
import { TaskService } from '../task.service'

@Injectable()
export class PlayTaskStateService extends StateService<Export4PlayInputDTO, undefined> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Task.name) private readonly model: Model<Task>,
        @Inject(forwardRef(() => TaskService)) private readonly service: TaskService
    ) { super(logger) }

    public async apply(context: TransactionalContext, key: Export4PlayInputDTO): Promise<void> {

        this.logger.debug?.(PlayTaskStateService.name, context, 'unpausing tasks')

        const options: TransactionOptions = { writeConcern: { w: 'majority' } }

        await MongoDBHelper.withTransaction(this.model, async (session) => {

            await this.validate(context, key, session)

            await this.model.updateMany(
                {
                    transaction: key.transaction,
                    '_export.transaction': key.transaction,
                    '_export.source.name': key.source,
                    '_export.target.name': key.target,
                    '_export.database': key.database,
                    status: ExportStatus.PAUSED
                },
                { $set: { status: ExportStatus.CREATED, worker: null, error: null } },
                { upsert: false, session }
            )

        }, options)

        this.logger.debug?.(PlayTaskStateService.name, context, 'tasks successfully unpaused')

    }

    protected async validate(context: TransactionalContext, key: Export4PlayInputDTO, session?: ClientSession): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        try {

            await ClassValidatorHelper.validate('key', key)

            const count = await this.service.countPaused(key, session)
            if (count <= 0) {
                throw new InvalidParameterException('key', key, 'there aren\'t paused tasks')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

}
