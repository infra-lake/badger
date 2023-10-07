import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, ObjectHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { WithTransaction } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { ExportService, ExportStatus, type Export4FlatKeyDTO } from '@badger/workload/export'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ClientSession, Model } from 'mongoose'
import { Task } from '../../task.entity'
import { TaskService } from '../task.service'

@Injectable()
export class RetryTaskStateService extends StateService<Export4FlatKeyDTO> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Task.name) private readonly model: Model<Task>,
        @Inject(forwardRef(() => TaskService)) private readonly service: TaskService,
        @Inject(forwardRef(() => ExportService)) private readonly exportService: ExportService
    ) { super(logger) }

    @WithTransaction(Task.name)
    public async change(context: TransactionalContext, key: Export4FlatKeyDTO, value: undefined, session?: ClientSession): Promise<void> {

        this.logger.debug?.(RetryTaskStateService.name, context, 'retrying tasks')

        await this.validate(context, key)

        const _export = await this.exportService.get(context, key, 'raw')

        await this.model.updateMany(
            {
                transaction: key.transaction,
                _export,
                status: ExportStatus.ERROR
            },
            { $set: { status: ExportStatus.CREATED, worker: null, error: null } },
            { upsert: false, session }
        )

        this.logger.debug?.(RetryTaskStateService.name, context, 'tasks successfully recreated')

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

            const count = await this.service.countWithStatus(context, key, [ExportStatus.ERROR])
            if (count <= 0) {
                throw new InvalidParameterException('key', key, 'there aren\'t error tasks')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

    protected async before() { }

    protected async after() { }

}
