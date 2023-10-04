import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type TransactionOptions } from 'mongodb'
import { Model } from 'mongoose'
import { type Export4TerminateKeyInputDTO } from '../../export.dto'
import { Export, ExportStatus } from '../../export.entity'
import { ExportService } from '../export.service'

@Injectable()
export class TerminateExportStateService extends StateService<Export4TerminateKeyInputDTO, undefined> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Export.name) private readonly model: Model<Export>,
        @Inject(forwardRef(() => ExportService)) private readonly service: ExportService
    ) { super(logger) }

    public async apply(context: TransactionalContext, key: Export4TerminateKeyInputDTO): Promise<void> {

        this.logger.log(TerminateExportStateService.name, context, 'terminating export', { key })

        const options: TransactionOptions = { writeConcern: { w: 'majority' } }

        await MongoDBHelper.withTransaction(this.model, async (session) => {

            await this.validate(context, key)

            await this.model.findOneAndUpdate(
                {
                    transaction: key.transaction,
                    source: key.source,
                    target: key.target,
                    database: key.database,
                    status: ExportStatus.RUNNING
                },
                { $set: { status: ExportStatus.TERMINATED } },
                { upsert: false, returnDocument: 'after', session }
            )

        }, options)

        this.logger.log(TerminateExportStateService.name, context, 'export is terminated successfully', {
            transaction: key.transaction,
            source: key.source.name,
            target: key.target.name,
            database: key.database
        })

    }

    protected async validate(context: TransactionalContext, key: Export4TerminateKeyInputDTO): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        try {

            await ClassValidatorHelper.validate('key', key)

            const found = await this.service.getRunning(key)
            if (!CollectionHelper.isEmpty(found)) {
                throw new InvalidParameterException('export', found, 'does not possible terminate export because export is not running state')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

}
