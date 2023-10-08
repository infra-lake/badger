import { InvalidParameterException } from '@badger/common/exception'
import { ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { WithTransaction } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { CleanupTaskStateService } from '@badger/workload/task/service/state'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ClientSession, Model } from 'mongoose'
import { Export } from '../../export.entity'

@Injectable()
export class CleanupExportStateService extends StateService {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Export.name) private readonly model: Model<Export>,
        @Inject(forwardRef(() => CleanupTaskStateService)) private readonly cleanupTaskService: CleanupTaskStateService
    ) { super(logger) }

    @WithTransaction(Export.name)
    public async change(context: TransactionalContext, key?: undefined, value?: undefined, session?: ClientSession): Promise<void> {

        await this.validate(context, session)

        await this.model.deleteMany({}, { session })

        await this.cleanupTaskService.apply(context, undefined, undefined)

    }

    protected async validate(context: TransactionalContext, session?: ClientSession): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        if (ObjectHelper.isEmpty(session)) {
            throw new InvalidParameterException('session', session)
        }

    }

    protected async before() { }

    protected async after() { }

}
