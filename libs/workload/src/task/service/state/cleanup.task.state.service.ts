import { InvalidParameterException } from '@badger/common/exception'
import { ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { WithTransaction } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, type ClientSession } from 'mongoose'
import { Task } from '../../task.entity'

@Injectable()
export class CleanupTaskStateService extends StateService {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Task.name) private readonly model: Model<Task>
    ) { super(logger) }

    @WithTransaction(Task.name)
    public async change(context: TransactionalContext, _key?: undefined, _value?: undefined, session?: ClientSession): Promise<void> {

        await this.validate(context)

        await this.model.deleteMany({}, { session })

    }

    protected async validate(context: TransactionalContext): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

    }

    protected async before() { }

    protected async after() { }

}
