import { CollectionHelper, ObjectHelper } from '@badger/common/helper'
import { MongoDBHelper } from '@badger/common/mongodb'
import { TransactionHelper, type TransactionalContext } from '@badger/common/transaction'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, type ClientSession, type FilterQuery } from 'mongoose'
import {
    type Export4ListInputDTO,
    type Export4FlatKeyDTO,
    type Export4FlatKeyWithOptionalTransactionDTO,
    type Export4FlatKeyWithoutTransactionDTO,
    type ExportDTO
} from '../export.dto'
import { Export, type ExportStatus } from '../export.entity'
import {
    Export2Export4CheckOutputDTOConverterService,
    Export2ExportDTOConverterService,
    Export2FilterQueryExportConverterService,
    Export4FlatKeyDTO2FilterQueryExportConverterService,
    Export4ListInputDTO2FilterQueryExportConverterService,
    TaskKeyDTO2FilterQueryExportConverterService
} from './converter'
import { CleanupExportStateService, CreateExportStateService, PauseExportStateService, RetryExportStateService, UnpauseExportStateService } from './state'
import { type TaskKeyDTO } from '@badger/workload/task'

@Injectable()
export class ExportService {

    public constructor(
        @InjectModel(Export.name) private readonly model: Model<Export>,
        @Inject(forwardRef(() => CreateExportStateService)) private readonly createState: CreateExportStateService,
        @Inject(forwardRef(() => PauseExportStateService)) private readonly pauseState: PauseExportStateService,
        @Inject(forwardRef(() => UnpauseExportStateService)) private readonly unpauseState: UnpauseExportStateService,
        @Inject(forwardRef(() => RetryExportStateService)) private readonly retryState: RetryExportStateService,
        @Inject(forwardRef(() => CleanupExportStateService)) private readonly cleanupState: CleanupExportStateService,
        private readonly export2ExportDTOConverter: Export2ExportDTOConverterService,
        private readonly export2FilterQueryConverter: Export2FilterQueryExportConverterService,
        private readonly taskKeyDTO2FilterQueryConverter: TaskKeyDTO2FilterQueryExportConverterService,
        private readonly export2Export4CheckOutputDTOConverter: Export2Export4CheckOutputDTOConverterService,
        private readonly export4FlatKeyDTO2FilterQueryConverter: Export4FlatKeyDTO2FilterQueryExportConverterService,
        private readonly export4ListInputDTO2FilterQueryConverter: Export4ListInputDTO2FilterQueryExportConverterService
    ) { }

    public async create(context: TransactionalContext, key: Export4FlatKeyWithoutTransactionDTO) {
        await this.createState.apply(context, key, undefined)
        return { transaction: TransactionHelper.getTransactionIDFrom(context) }
    }

    public async pause(context: TransactionalContext, key: Export4FlatKeyDTO) {
        await this.pauseState.apply(context, key, undefined)
        return { transaction: TransactionHelper.getTransactionIDFrom(context) }
    }

    public async unpause(context: TransactionalContext, key: Export4FlatKeyDTO) {
        await this.unpauseState.apply(context, key, undefined)
        return { transaction: TransactionHelper.getTransactionIDFrom(context) }
    }

    public async retry(context: TransactionalContext, key: Export4FlatKeyDTO) {
        await this.retryState.apply(context, key, undefined)
        return { transaction: TransactionHelper.getTransactionIDFrom(context) }
    }

    public async cleanup(context: TransactionalContext) {
        await this.cleanupState.apply(context, undefined, undefined)
        return { transaction: TransactionHelper.getTransactionIDFrom(context) }
    }

    public async get<T extends 'dto' | 'raw'>(context: TransactionalContext, input: Export4FlatKeyDTO, returns: T, session?: ClientSession): Promise<T extends 'dto' ? ExportDTO[] : Export[]> {

        const filter = await this.export4FlatKeyDTO2FilterQueryConverter.convert(context, input)

        const options = ObjectHelper.isEmpty(session) ? {} : { session }

        const result = await MongoDBHelper.get<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(this.model, filter, options) as Export

        if (returns === 'raw') {
            return result as any
        }

        return this.export2ExportDTOConverter.convert(context, result) as any

    }

    public async check(context: TransactionalContext, input: Export4FlatKeyDTO) {

        const filter = await this.export4FlatKeyDTO2FilterQueryConverter.convert(context, input)

        const result = await MongoDBHelper.get<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(this.model, filter, { status: 1 }) as Export

        if (ObjectHelper.isEmpty(result)) {
            return undefined
        }

        return await this.export2Export4CheckOutputDTOConverter.convert(context, result)

    }

    public async existsWithStatus(context: TransactionalContext, input: Export4FlatKeyDTO | Export4FlatKeyWithOptionalTransactionDTO | Export4FlatKeyWithoutTransactionDTO, statuses: ExportStatus[], session?: ClientSession) {

        const filter = await this.export4FlatKeyDTO2FilterQueryConverter.convert(context, input)

        filter.$or = statuses.map(status => ({ status }))

        const options = ObjectHelper.isEmpty(session) ? {} : { session }

        const output = await MongoDBHelper.exists<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(this.model, filter, options)

        return output

    }

    public async list<T extends 'dto' | 'raw'>(context: TransactionalContext, input: Export4ListInputDTO | TaskKeyDTO, returns: T, session?: ClientSession): Promise<T extends 'dto' ? ExportDTO[] : Export[]> {

        const filter =
            '_export' in input
                ? await this.taskKeyDTO2FilterQueryConverter.convert(context, input)
                : await this.export4ListInputDTO2FilterQueryConverter.convert(context, input)

        const options = ObjectHelper.isEmpty(session) ? {} : { session }

        const result = await MongoDBHelper.list<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(this.model, filter, options)

        if (returns === 'raw') {
            return result
        }

        if (CollectionHelper.isEmpty(result)) {
            return []
        }

        const output = await Promise.all(
            result.map(
                async (model) => await this.export2ExportDTOConverter.convert(context, model)
            )
        )

        return output as any

    }

    public async listWithStatus<T extends 'dto' | 'raw'>(context: TransactionalContext, input: Export4FlatKeyDTO | Export4FlatKeyWithOptionalTransactionDTO | Export4FlatKeyWithoutTransactionDTO | Export, statuses: ExportStatus[], returns: T, session?: ClientSession): Promise<T extends 'dto' ? ExportDTO[] : Export[]> {

        const filter: FilterQuery<Partial<Export>> =
            typeof input.source === 'string'
                ? await this.export4FlatKeyDTO2FilterQueryConverter.convert(context, input as any)
                : await this.export2FilterQueryConverter.convert(context, input as any)

        filter.$or = statuses.map(status => ({ status }))

        const options = ObjectHelper.isEmpty(session) ? {} : { session }

        const result = await MongoDBHelper.list<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(this.model, filter, options)

        if (CollectionHelper.isEmpty(result)) {
            return []
        }

        if (returns === 'raw') {
            return result
        }

        const output = await Promise.all(
            result.map(
                async (model) => await this.export2ExportDTOConverter.convert(context, model)
            )
        )

        return output as any

    }

}
