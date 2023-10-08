import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { WithTransaction } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { ErrorExportStateService, TerminateExportStateService } from '@badger/workload/export/service/state'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ExportStatus } from 'libs/workload/src/export'
import { ClientSession, Model } from 'mongoose'
import { type TaskWithWorkerDTO } from '../../task.dto'
import { Task } from '../../task.entity'
import { TaskService } from '../task.service'

@Injectable()
export class TerminateTaskStateService extends StateService<TaskWithWorkerDTO> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Task.name) private readonly model: Model<Task>,
        @Inject(forwardRef(() => TaskService)) private readonly service: TaskService,
        @Inject(forwardRef(() => TerminateExportStateService)) private readonly terminateExportService: TerminateExportStateService,
        @Inject(forwardRef(() => ErrorExportStateService)) private readonly errorExportService: ErrorExportStateService
    ) { super(logger) }

    @WithTransaction(Task.name)
    public async change(context: TransactionalContext, key: TaskWithWorkerDTO, value: undefined, session?: ClientSession): Promise<void> {

        await this.validate(context, key, undefined, session)

        if (await this.service.existsWithStatus(context, key, [ExportStatus.PAUSED])) { return }

        await this.model.findOneAndUpdate(
            {
                transaction: key.transaction,
                _export: key._export,
                _collection: key._collection,
                worker: key.worker,
                status: ExportStatus.RUNNING
            },
            { $set: { status: ExportStatus.TERMINATED, error: null } },
            { upsert: false, returnDocument: 'after', session }
        )

        if (await this.service.isAllTerminated(key._export, session)) {
            await this.terminateExportService.apply(context, key._export, undefined)
        } else if (await this.service.isAllTerminatedOrError(key._export, session)) {
            await this.errorExportService.apply(context, key._export, undefined)
        }

    }

    protected async validate(context: TransactionalContext, key: TaskWithWorkerDTO, value: undefined, session?: ClientSession): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        if (ObjectHelper.isEmpty(session)) {
            throw new InvalidParameterException('session', session)
        }

        try {

            await ClassValidatorHelper.validate('key', key)

            if (await this.service.existsWithStatus(context, key, [ExportStatus.PAUSED])) { return }

            const found = await this.service.listWithStatus(context, key, [ExportStatus.RUNNING], 'dto')
            if (CollectionHelper.isEmpty(found)) {
                throw new InvalidParameterException('task', found, 'task not to be terminated because it is not running')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

    protected async before(context: TransactionalContext, key: TaskWithWorkerDTO) {
        this.logger.debug?.(TerminateTaskStateService.name, context, 'terminating task', {
            transaction: key.transaction,
            source: key._export.source.name,
            target: key._export.target.name,
            database: key._export.database,
            _collection: key._collection,
            worker: key.worker
        })
    }

    protected async after() { }

}
