import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { WithTransaction } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { UnpauseTaskStateService } from '@badger/workload/task/service/state'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ClientSession, Model } from 'mongoose'
import { type Export4FlatKeyDTO } from '../../export.dto'
import { Export, ExportStatus } from '../../export.entity'
import { ExportService } from '../export.service'

@Injectable()
export class UnpauseExportStateService extends StateService<Export4FlatKeyDTO> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Export.name) private readonly model: Model<Export>,
        @Inject(forwardRef(() => ExportService)) private readonly service: ExportService,
        @Inject(forwardRef(() => UnpauseTaskStateService)) private readonly unpauseTaskService: UnpauseTaskStateService
    ) { super(logger) }

    @WithTransaction(Export.name)
    public async change(context: TransactionalContext, key: Export4FlatKeyDTO, value?: undefined, session?: ClientSession): Promise<void> {

        await this.validate(context, key, session)

        const _export = await this.model.findOneAndUpdate(
            {
                transaction: key.transaction,
                'source.name': key.source,
                'target.name': key.target,
                database: key.database,
                status: ExportStatus.PAUSED
            },
            { $set: { status: ExportStatus.CREATED } },
            { upsert: false, returnDocument: 'after', session }
        ) as Export

        await this.unpauseTaskService.apply(context, _export, undefined)

    }

    protected async validate(context: TransactionalContext, key: Export4FlatKeyDTO, session?: ClientSession): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        if (ObjectHelper.isEmpty(session)) {
            throw new InvalidParameterException('session', session)
        }

        try {

            await ClassValidatorHelper.validate('key', key)

            const found = await this.service.listWithStatus(context, key, [ExportStatus.PAUSED], 'dto')
            if (!CollectionHelper.isEmpty(found)) {
                throw new InvalidParameterException('export', found, 'could not play the export because it is not paused')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

    protected async before(context: TransactionalContext, { transaction, source, target, database }: Export4FlatKeyDTO) {
        this.logger.log(UnpauseExportStateService.name, context, 'key', { transaction, source, target, database })
    }

    protected async after() { }

}
