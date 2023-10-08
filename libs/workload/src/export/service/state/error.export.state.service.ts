import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { WithTransaction } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ClientSession, Model } from 'mongoose'
import { Export, ExportStatus } from '../../export.entity'
import { ExportService } from '../export.service'

@Injectable()
export class ErrorExportStateService extends StateService<Export> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Export.name) private readonly model: Model<Export>,
        @Inject(forwardRef(() => ExportService)) private readonly service: ExportService
    ) { super(logger) }

    @WithTransaction(Export.name)
    public async change(context: TransactionalContext, key: Export, value?: undefined, session?: ClientSession): Promise<void> {

        await this.validate(context, key, session)

        await this.model.findOneAndUpdate(
            {
                transaction: key.transaction,
                source: key.source,
                target: key.target,
                database: key.database,
                $or: [{ status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING }]
            },
            { $set: { status: ExportStatus.ERROR } },
            { upsert: false, returnDocument: 'after', session }
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

            const found = await this.service.listWithStatus(context, key, [ExportStatus.RUNNING], 'dto')
            if (CollectionHelper.isEmpty(found)) {
                throw new InvalidParameterException('export', found, 'does not possible register error on export because export is not running state')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

    protected async before(context: TransactionalContext, { transaction, source, target, database }: Export) {
        this.logger.log(ErrorExportStateService.name, context, 'key', {
            transaction,
            source: source.name,
            target: target.name,
            database
        })
    }

    protected async after() { }

}
