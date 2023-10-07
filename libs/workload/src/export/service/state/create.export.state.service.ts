import { BigQueryHelper } from '@badger/common/bigquery'
import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper, WithTransaction } from '@badger/common/mongodb'
import { TransactionHelper, type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { SourceService } from '@badger/source'
import { TargetService } from '@badger/target'
import { CreateTaskStateService } from '@badger/workload/task/service/state'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ClientSession, Model } from 'mongoose'
import { type Export4FlatKeyWithoutTransactionDTO } from '../../export.dto'
import { Export, ExportStatus } from '../../export.entity'
import { ExportService } from '../export.service'

@Injectable()
export class CreateExportStateService extends StateService<Export4FlatKeyWithoutTransactionDTO> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Export.name) private readonly model: Model<Export>,
        @Inject(forwardRef(() => ExportService)) private readonly service: ExportService,
        private readonly sourceService: SourceService,
        private readonly targetService: TargetService,
        private readonly createTaskService: CreateTaskStateService
    ) { super(logger) }

    @WithTransaction(Export.name)
    public async change(context: TransactionalContext, key: Export4FlatKeyWithoutTransactionDTO, value?: undefined, session?: ClientSession): Promise<void> {

        await this.validate(context, key, undefined, session)

        const transaction = TransactionHelper.getTransactionIDFrom(context)

        const source = await this.sourceService.get({ name: key.source })
        const target = await this.targetService.get({ name: key.target })

        const _export = await this.model.findOneAndUpdate(
            {
                source,
                target,
                database: key.database,
                $or: [{ status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING }]
            },
            { $setOnInsert: { transaction, source, target, database: key.database, status: ExportStatus.CREATED } },
            { upsert: true, returnDocument: 'after', session }
        )

        await this.createTaskService.apply(context, _export, undefined)

    }

    protected async validate(context: TransactionalContext, key: Export4FlatKeyWithoutTransactionDTO, value?: undefined, session?: ClientSession): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        if (ObjectHelper.isEmpty(session)) {
            throw new InvalidParameterException('session', session)
        }

        try {

            await ClassValidatorHelper.validate('key', key)

            await this.pingSource(context, key)

            await this.pingTarget(context, key)

            const found = await this.service.listWithStatus(context, key, [ExportStatus.RUNNING, ExportStatus.PAUSED], 'dto')
            if (!CollectionHelper.isEmpty(found)) {
                throw new InvalidParameterException('export', found, 'does not possible create export because there is another export with created or running state')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

    private async pingSource(context: TransactionalContext, key: Export4FlatKeyWithoutTransactionDTO) {
        const source = await this.sourceService.get({ name: key?.source })
        if (ObjectHelper.isEmpty(source)) { throw new InvalidParameterException('source', key?.source) }
        if (ObjectHelper.isEmpty(source?.url)) { throw new InvalidParameterException('source.url', source?.url) }
        try {
            await MongoDBHelper.ping(source?.url as string)
        } catch (error) {
            this.logger.error(ExportService.name, context, 'does not possible to ping source mongodb', error, source)
            throw new InvalidParameterException('source.url', source?.url)
        }
    }

    private async pingTarget(context: TransactionalContext, key: Export4FlatKeyWithoutTransactionDTO) {
        const target = await this.targetService.get({ name: key?.target })
        if (ObjectHelper.isEmpty(target)) { throw new InvalidParameterException('target', key?.target) }
        if (ObjectHelper.isEmpty(target?.credentials)) { throw new InvalidParameterException('target.credentials', target?.credentials) }
        try {
            await BigQueryHelper.ping(target?.credentials)
        } catch (error) {
            this.logger.error(ExportService.name, context, 'does not possible to ping target bigquery', error, target)
            throw new InvalidParameterException('target.credentials', target?.credentials)
        }
    }

    protected async before(context: TransactionalContext, { source, target, database }: Export4FlatKeyWithoutTransactionDTO) {
        const transaction = TransactionHelper.getTransactionIDFrom(context)
        this.logger.log(CreateExportStateService.name, context, 'key', { transaction, source, target, database })
    }

    protected async after() { }

}
