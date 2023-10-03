import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type TransactionOptions } from 'mongodb'
import { Model } from 'mongoose'
import { type ExportKeyDTO } from '../../export.dto'
import { Export, ExportStatus } from '../../export.entity'
import { ExportService } from '../export.service'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper } from '@badger/common/helper'
import { PauseTaskStateService } from '@badger/workload/task/service/state'

@Injectable()
export class PauseExportStateService extends StateService<ExportKeyDTO, undefined> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Export.name) private readonly model: Model<Export>,
        @Inject(forwardRef(() => ExportService)) private readonly service: ExportService,
        private readonly pauseTask: PauseTaskStateService
    ) { super(logger) }

    public async apply(context: TransactionalContext, key: ExportKeyDTO): Promise<void> {

        this.logger.log(PauseExportStateService.name, context, 'pausing export', { key })

        const options: TransactionOptions = { writeConcern: { w: 'majority' } }

        await MongoDBHelper.withTransaction(this.model, async (session) => {

            await this.validate(context, key)

            await this.model.findOneAndUpdate(
                {
                    transaction: key.transaction,
                    source: key.source,
                    target: key.target,
                    database: key.database,
                    $or: [{ status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING }]
                },
                { $set: { status: ExportStatus.PAUSED } },
                { upsert: false, returnDocument: 'after', session }
            )

            await this.pauseTask.apply(context, key)

        }, options)

        this.logger.log(PauseExportStateService.name, context, 'export is paused successfully', {
            transaction: key.transaction,
            source: key.source.name,
            target: key.target.name,
            database: key.database
        })

    }

    protected async validate(context: TransactionalContext, key: ExportKeyDTO): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        try {

            await ClassValidatorHelper.validate('key', key)

            const found = await this.service.getCreatedOrRunning(key)
            if (!CollectionHelper.isEmpty(found)) {
                throw new InvalidParameterException('export', found, 'does not possible to pause export because it is not created or running')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

}
