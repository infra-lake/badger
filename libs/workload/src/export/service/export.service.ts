import { ClassValidatorHelper, ObjectHelper, StringHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { TransactionHelper, type TransactionalContext } from '@badger/common/transaction'
import { SourceDTO } from '@badger/source'
import { TargetDTO } from '@badger/target'
import { TaskService } from '@badger/workload/task'
import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type TransactionOptions } from 'mongodb'
import { Model, type ClientSession, type FilterQuery } from 'mongoose'
import {
    Export4CheckOutputDTO,
    ExportDTO,
    type Export4CheckInputDTO,
    type Export4CreateKeyInputDTO,
    type Export4GetCreatedOrRunningInputDTO,
    type Export4GetPausedInputDTO,
    type Export4GetRunningInputDTO,
    type Export4IsCreatedInputDTO,
    type Export4IsRunningInputDTO,
    type Export4ListInputhDTO,
    type Export4PauseInputDTO,
    type Export4PlayInputDTO
} from '../export.dto'
import { Export, ExportStatus } from '../export.entity'
import { CreateExportStateService, PauseExportStateService, PlayExportStateService } from './state'
import { InvalidParameterException } from '@badger/common/exception'

@Injectable()
export class ExportService {

    public constructor(
        private readonly logger: TransactionalLoggerService,
        @InjectModel(Export.name) private readonly model: Model<Export>,
        @Inject(forwardRef(() => CreateExportStateService)) private readonly createService: CreateExportStateService,
        @Inject(forwardRef(() => PauseExportStateService)) private readonly pauseService: PauseExportStateService,
        @Inject(forwardRef(() => PlayExportStateService)) private readonly playService: PlayExportStateService,
        private readonly taskService: TaskService
    ) { }

    public async create(context: TransactionalContext, key: Export4CreateKeyInputDTO) {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        await ClassValidatorHelper.validate('key', key)

        await this.createService.apply(context, key)

        return { transaction: TransactionHelper.getTransactionIDFrom(context) }

    }

    public async play(context: TransactionalContext, key: Export4PlayInputDTO) {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        await ClassValidatorHelper.validate('key', key)

        await this.playService.apply(context, key)

        return { transaction: TransactionHelper.getTransactionIDFrom(context) }

    }

    public async pause(context: TransactionalContext, key: Export4PauseInputDTO) {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        await ClassValidatorHelper.validate('key', key)

        await this.pauseService.apply(context, key)

        return { transaction: TransactionHelper.getTransactionIDFrom(context) }

    }

    public async cleanup(context: TransactionalContext) {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        this.logger.log(ExportService.name, context, 'cleaning exports')

        const options: TransactionOptions = { writeConcern: { w: 'majority' } }

        await MongoDBHelper.withTransaction(this.model, async (session) => {

            await this.model.deleteMany({}, { session })

            await this.taskService.cleanup(context)

        }, options)

        this.logger.log(ExportService.name, context, 'all exports are cleaned')

        return { transaction: TransactionHelper.getTransactionIDFrom(context) }

    }

    public async list(input: Export4ListInputhDTO) {

        try {
            await ClassValidatorHelper.validate('input', input)
        } catch (error) {
            throw new BadRequestException(error)
        }

        const filter: FilterQuery<Partial<Export>> = {}

        if (!StringHelper.isEmpty(input.transaction)) {
            filter.transaction = input.transaction
        }

        if (!StringHelper.isEmpty(input.source)) {
            filter['source.name'] = input.source
        }

        if (!StringHelper.isEmpty(input.target)) {
            filter['target.name'] = input.target
        }

        if (!StringHelper.isEmpty(input.database)) {
            filter.database = input.database
        }

        if (!StringHelper.isEmpty(input.status)) {
            filter.status = input.status
        }

        const result = await MongoDBHelper.list<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(this.model, filter)

        const output = (result ?? []).map(({ transaction, source, target, database, status }) => {

            const dto = new ExportDTO()

            dto.transaction = transaction

            dto.source = new SourceDTO()
            dto.source.name = source.name
            dto.source.url = source.url
            dto.source.filter = source.filter
            dto.source.stamps = source.stamps

            dto.target = new TargetDTO()
            dto.target.name = target.name
            dto.target.credentials = target.credentials

            dto.database = database
            dto.status = status

            return dto

        })

        return output

    }

    public async check(input: Export4CheckInputDTO) {

        try {
            await ClassValidatorHelper.validate('input', input)
        } catch (error) {
            throw new BadRequestException(error)
        }

        const result = await MongoDBHelper.get<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(this.model, {
            transaction: input.transaction,
            'source.name': input.source,
            'target.name': input.target,
            database: input.database
        }, { status: 1 })

        if (ObjectHelper.isEmpty(result)) {
            return undefined
        }

        const output = new Export4CheckOutputDTO()
        output.status = result?.status as ExportStatus

        return output

    }

    public async isCreated(input: Export4IsCreatedInputDTO, session?: ClientSession) {
        await ClassValidatorHelper.validate('input', input)
        return await MongoDBHelper.exists<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(
            this.model,
            {
                transaction: input.transaction,
                source: input.source,
                target: input.target,
                database: input.database,
                status: ExportStatus.CREATED
            },
            { session }
        )
    }

    public async getCreatedOrRunning(input: Export4GetCreatedOrRunningInputDTO) {
        await ClassValidatorHelper.validate('input', input)
        return await MongoDBHelper.list<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(
            this.model,
            {
                'source.name': input.source,
                'target.name': input.target,
                database: input.database,
                $or: [{ status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING }]
            }
        )
    }

    public async isRunning(input: Export4IsRunningInputDTO, session?: ClientSession) {
        await ClassValidatorHelper.validate('input', input)
        return await MongoDBHelper.exists<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(
            this.model,
            {
                transaction: input.transaction,
                source: input.source,
                target: input.target,
                database: input.database,
                status: ExportStatus.RUNNING
            },
            { session }
        )
    }

    public async getRunning(input: Export4GetRunningInputDTO) {
        await ClassValidatorHelper.validate('input', input)
        return await MongoDBHelper.list<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(
            this.model,
            {
                transaction: input.transaction,
                source: input.source,
                target: input.target,
                database: input.database,
                status: ExportStatus.RUNNING
            }
        )
    }

    public async getPaused(input: Export4GetPausedInputDTO) {
        await ClassValidatorHelper.validate('input', input)
        return await MongoDBHelper.list<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(
            this.model,
            {
                transaction: input.transaction,
                'source.name': input.source,
                'target.name': input.target,
                database: input.database,
                status: ExportStatus.PAUSED
            }
        )
    }

}
