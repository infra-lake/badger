import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { RetryTaskStateService } from '@badger/workload/task/service/state'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type TransactionOptions } from 'mongodb'
import { Model } from 'mongoose'
import { type Export4RetryInputDTO } from '../../export.dto'
import { Export, ExportStatus } from '../../export.entity'
import { ExportService } from '../export.service'

@Injectable()
export class RetryExportStateService extends StateService<Export4RetryInputDTO, undefined> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Export.name) private readonly model: Model<Export>,
        @Inject(forwardRef(() => ExportService)) private readonly service: ExportService,
        @Inject(forwardRef(() => RetryTaskStateService)) private readonly retryTaskService: RetryTaskStateService
    ) { super(logger) }

    public async apply(context: TransactionalContext, key: Export4RetryInputDTO): Promise<void> {

        this.logger.log(RetryExportStateService.name, context, 'retrying export', { key })

        const options: TransactionOptions = { writeConcern: { w: 'majority' } }

        await MongoDBHelper.withTransaction(this.model, async (session) => {

            await this.validate(context, key)

            await this.model.findOneAndUpdate(
                {
                    transaction: key.transaction,
                    'source.name': key.source,
                    'target.name': key.target,
                    database: key.database,
                    status: ExportStatus.ERROR
                },
                { $set: { status: ExportStatus.CREATED } },
                { upsert: false, returnDocument: 'after', session }
            )

            await this.retryTaskService.apply(context, key)

        }, options)

        this.logger.log(RetryExportStateService.name, context, 'export was recreated successfully', {
            transaction: key.transaction,
            source: key.source,
            target: key.target,
            database: key.database
        })

    }

    protected async validate(context: TransactionalContext, key: Export4RetryInputDTO): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        try {

            await ClassValidatorHelper.validate('key', key)

            const found = await this.service.getError(key)
            if (!CollectionHelper.isEmpty(found)) {
                throw new InvalidParameterException('export', found, 'could not retry the export because it is not terminated with error')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

}
