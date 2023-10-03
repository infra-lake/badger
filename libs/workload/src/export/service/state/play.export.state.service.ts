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
import { PlayTaskStateService } from '@badger/workload/task/service/state'

@Injectable()
export class PlayExportStateService extends StateService<ExportKeyDTO, undefined> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Export.name) private readonly model: Model<Export>,
        @Inject(forwardRef(() => ExportService)) private readonly service: ExportService,
        private readonly playTaskService: PlayTaskStateService
    ) { super(logger) }

    public async apply(context: TransactionalContext, key: ExportKeyDTO): Promise<void> {

        this.logger.log(PlayExportStateService.name, context, 'playing export', { key })

        const options: TransactionOptions = { writeConcern: { w: 'majority' } }

        await MongoDBHelper.withTransaction(this.model, async (session) => {

            await this.validate(context, key)

            await this.model.findOneAndUpdate(
                {
                    transaction: key.transaction,
                    source: key.source,
                    target: key.target,
                    database: key.database,
                    status: ExportStatus.PAUSED
                },
                { $set: { status: ExportStatus.CREATED } },
                { upsert: false, returnDocument: 'after', session }
            )

            await this.playTaskService.apply(context, key)

        }, options)

        this.logger.log(PlayExportStateService.name, context, 'export was played successfully', {
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

            const found = await this.service.getPaused(key)
            if (!CollectionHelper.isEmpty(found)) {
                throw new InvalidParameterException('export', found, 'could not play the export because it is not paused')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

}
