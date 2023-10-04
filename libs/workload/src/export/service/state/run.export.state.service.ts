import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type TransactionOptions } from 'mongodb'
import { Model, type ClientSession } from 'mongoose'
import { type Export4RunKeyInputDTO } from '../../export.dto'
import { Export, ExportStatus } from '../../export.entity'
import { ExportService } from '../export.service'

@Injectable()
export class RunExportStateService extends StateService<Export4RunKeyInputDTO, undefined> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Export.name) private readonly model: Model<Export>,
        @Inject(forwardRef(() => ExportService)) private readonly service: ExportService
    ) { super(logger) }

    public async apply(context: TransactionalContext, key: Export4RunKeyInputDTO): Promise<void> {

        this.logger.log(RunExportStateService.name, context, 'running export', {
            transaction: key.transaction,
            source: key.source.name,
            target: key.target.name,
            database: key.database
        })

        const options: TransactionOptions = { writeConcern: { w: 'majority' } }

        await MongoDBHelper.withTransaction(this.model, async (session) => {

            await this.validate(context, key, session)

            await this.model.findOneAndUpdate(
                {
                    transaction: key.transaction,
                    source: key.source,
                    target: key.target,
                    database: key.database,
                    status: ExportStatus.CREATED
                },
                { $set: { status: ExportStatus.RUNNING } },
                { upsert: false, returnDocument: 'after', session }
            )

        }, options)

        this.logger.log(RunExportStateService.name, context, 'export is set to running')

    }

    protected async validate(context: TransactionalContext, key: Export4RunKeyInputDTO, session?: ClientSession): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        if (ObjectHelper.isEmpty(session)) {
            throw new InvalidParameterException('session', session)
        }

        try {

            await ClassValidatorHelper.validate('key', key)

            if (await this.service.isRunning(key, session)) {
                return
            }

            if (!await this.service.isCreated(key, session)) {
                throw new InvalidParameterException('export', key, 'does not possible to run export because it is not created')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

}
