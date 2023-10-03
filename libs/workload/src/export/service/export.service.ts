import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { TransactionHelper, type TransactionalContext } from '@badger/common/transaction'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type ClientSession, Model } from 'mongoose'
import { type Export4SearchDTO, type Export4CreateDTO, type Export4GetCreatedOrRunningDTO, type ExportKeyDTO } from '../export.dto'
import { Export, ExportStatus } from '../export.entity'
import { CreateExportStateService, PlayExportStateService, PauseExportStateService } from './state'

@Injectable()
export class ExportService {

    public constructor(
        private readonly logger: TransactionalLoggerService,
        @InjectModel(Export.name) private readonly model: Model<Export>,
        @Inject(forwardRef(() => CreateExportStateService)) private readonly createService: CreateExportStateService,
        @Inject(forwardRef(() => PauseExportStateService)) private readonly pauseService: PauseExportStateService,
        @Inject(forwardRef(() => PlayExportStateService)) private readonly playService: PlayExportStateService
    ) { }

    public async create(context: TransactionalContext, key: Export4CreateDTO) {
        await this.createService.apply(context, key)
        return { transaction: TransactionHelper.getTransactionIDFrom(context) }
    }

    public async play(context: TransactionalContext, key: ExportKeyDTO): Promise<void> {
        await this.playService.apply(context, key)
    }

    public async pause(context: TransactionalContext, key: ExportKeyDTO): Promise<void> {
        await this.pauseService.apply(context, key)
    }

    public async list(filter: Export4SearchDTO) {
        return await MongoDBHelper.list<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(this.model, filter)
    }

    public async getByTransaction(transaction: string) {
        return await MongoDBHelper.get<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(this.model, { transaction })
    }

    public async get(key: ExportKeyDTO) {
        return await MongoDBHelper.get<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(this.model, key)
    }

    public async isCreated({ transaction, source, target, database }: ExportKeyDTO, session?: ClientSession) {
        return await MongoDBHelper.exists<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(
            this.model,
            { transaction, source, target, database, status: ExportStatus.CREATED },
            { session }
        )
    }

    public async getCreatedOrRunning({ source, target, database }: Export4GetCreatedOrRunningDTO) {
        return await MongoDBHelper.list<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(
            this.model,
            {
                source,
                target,
                database,
                $or: [{ status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING }]
            }
        )
    }

    public async isRunning({ transaction, source, target, database }: ExportKeyDTO, session?: ClientSession) {
        return await MongoDBHelper.exists<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(
            this.model,
            { transaction, source, target, database, status: ExportStatus.RUNNING },
            { session }
        )
    }

    public async getRunning({ transaction, source, target, database }: ExportKeyDTO) {
        return await MongoDBHelper.list<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(
            this.model,
            { transaction, source, target, database, status: ExportStatus.RUNNING }
        )
    }

    public async getPaused({ transaction, source, target, database }: ExportKeyDTO) {
        return await MongoDBHelper.list<Export, 'transaction' | 'source' | 'target' | 'database', Model<Export>>(
            this.model,
            { transaction, source, target, database, status: ExportStatus.PAUSED }
        )
    }

}
