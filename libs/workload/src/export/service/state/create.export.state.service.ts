import { BigQueryHelper } from '@badger/common/bigquery'
import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { TransactionHelper, type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { SourceService, type Source } from '@badger/source'
import { TargetService, type Target } from '@badger/target'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type TransactionOptions } from 'mongodb'
import { Model } from 'mongoose'
import { type Export4CreateDTO } from '../../export.dto'
import { Export, ExportStatus } from '../../export.entity'
import { ExportService } from '../export.service'
import { CreateTaskStateService } from '@badger/workload/task/service/state'

@Injectable()
export class CreateExportStateService extends StateService<Export4CreateDTO, undefined> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Export.name) private readonly model: Model<Export>,
        @Inject(forwardRef(() => ExportService)) private readonly service: ExportService,
        private readonly sourceService: SourceService,
        private readonly targetService: TargetService,
        private readonly createTaskService: CreateTaskStateService
    ) { super(logger) }

    public async apply(context: TransactionalContext, key: Export4CreateDTO): Promise<void> {

        this.logger.log(CreateExportStateService.name, context, 'creating export', { key })

        const options: TransactionOptions = { writeConcern: { w: 'majority' } }

        await MongoDBHelper.withTransaction(this.model, async (session) => {

            await this.validate(context, key)

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

            await this.createTaskService.apply(context, { transaction, _export })

        }, options)

        this.logger.log(CreateExportStateService.name, context, 'export successfully created', {
            transaction: TransactionHelper.getTransactionIDFrom(context),
            source: key.source,
            target: key.target,
            database: key.database
        })

    }

    protected async validate(context: TransactionalContext, key: Export4CreateDTO): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        try {

            await ClassValidatorHelper.validate('key', key)

            const source = await this.getValidSource(context, key) as Source
            const target = await this.getValidTarget(context, key) as Target

            const found = await this.service.getCreatedOrRunning({ source, target, database: key.database })
            if (!CollectionHelper.isEmpty(found)) {
                throw new InvalidParameterException('export', found, 'does not possible create export because there is another export with created or running state')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

    private async getValidSource(context: TransactionalContext, key: Export4CreateDTO) {
        const source = await this.sourceService.get({ name: key?.source })
        if (ObjectHelper.isEmpty(source)) { throw new InvalidParameterException('source', key?.source) }
        if (ObjectHelper.isEmpty(source?.url)) { throw new InvalidParameterException('source.url', source?.url) }
        try {
            await MongoDBHelper.ping(source?.url as string)
            return source
        } catch (error) {
            this.logger.error(ExportService.name, context, 'does not possible to ping source mongodb', error, source)
            throw new InvalidParameterException('source.url', source?.url)
        }
    }

    private async getValidTarget(context: TransactionalContext, key: Export4CreateDTO) {
        const target = await this.targetService.get({ name: key?.target })
        if (ObjectHelper.isEmpty(target)) { throw new InvalidParameterException('target', key?.target) }
        if (ObjectHelper.isEmpty(target?.credentials)) { throw new InvalidParameterException('target.credentials', target?.credentials) }
        try {
            await BigQueryHelper.ping(target?.credentials)
            return target
        } catch (error) {
            this.logger.error(ExportService.name, context, 'does not possible to ping target bigquery', error, target)
            throw new InvalidParameterException('target.credentials', target?.credentials)
        }
    }
}
