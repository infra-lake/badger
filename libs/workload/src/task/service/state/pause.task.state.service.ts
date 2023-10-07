import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { WithTransaction } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { Export, ExportStatus } from '@badger/workload/export'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, type ClientSession } from 'mongoose'
import { Task } from '../../task.entity'
import { TaskService } from '../task.service'

@Injectable()
export class PauseTaskStateService extends StateService<Export> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Task.name) private readonly model: Model<Task>,
        @Inject(forwardRef(() => TaskService)) private readonly service: TaskService
    ) { super(logger) }

    @WithTransaction(Task.name)
    public async change(context: TransactionalContext, key: Export, value: undefined, session?: ClientSession): Promise<void> {

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

    }

    protected async validate(context: TransactionalContext, key: Export, session?: ClientSession): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        if (ObjectHelper.isEmpty(session)) {
            throw new InvalidParameterException('session', session)
        }

        try {

            await ClassValidatorHelper.validate('key', key)

            const count = await this.service.countWithStatus(context, key, [ExportStatus.CREATED, ExportStatus.RUNNING], session)
            if (count <= 0) {
                throw new InvalidParameterException('key', key, 'there aren\'t tasks to be paused')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

    protected async before() { }

    protected async after() { }

}
