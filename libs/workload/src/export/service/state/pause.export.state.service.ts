import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { WithTransaction } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { PauseTaskStateService } from '@badger/workload/task/service/state'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ClientSession, Model } from 'mongoose'
import { type Export4FlatKeyDTO } from '../../export.dto'
import { Export, ExportStatus } from '../../export.entity'
import { ExportService } from '../export.service'

@Injectable()
export class PauseExportStateService extends StateService<Export4FlatKeyDTO> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Export.name) private readonly model: Model<Export>,
        @Inject(forwardRef(() => ExportService)) private readonly service: ExportService,
        @Inject(forwardRef(() => PauseTaskStateService)) private readonly pauseTask: PauseTaskStateService
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
                $or: [{ status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING }]
            },
            { $set: { status: ExportStatus.PAUSED } },
            { upsert: false, returnDocument: 'after', session }
        ) as Export

        await this.pauseTask.apply(context, _export, undefined)

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

            const found = await this.service.listWithStatus(context, key, [ExportStatus.CREATED, ExportStatus.RUNNING], 'dto')
            if (CollectionHelper.isEmpty(found)) {
                throw new InvalidParameterException('export', found, 'does not possible to pause export because it is not created or running')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

    protected async before(context: TransactionalContext, { transaction, source, target, database }: Export4FlatKeyDTO) {
        this.logger.log(PauseExportStateService.name, context, 'key', { transaction, source, target, database })
    }

    protected async after() { }

}
