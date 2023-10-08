import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper, StringHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { WithTransaction } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { SourceService } from '@badger/source'
import { Export, ExportStatus } from '@badger/workload/export'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ClientSession, Model } from 'mongoose'
import { Task } from '../../task.entity'
import { TaskService } from '../task.service'
import { TaskKey4CreateInputDTO2Task4FlatKeyDTOConverterService } from '../converter'
@Injectable()
export class CreateTaskStateService extends StateService<Export, string | undefined> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Task.name) private readonly model: Model<Task>,
        @Inject(forwardRef(() => TaskService)) private readonly service: TaskService,
        private readonly sourceService: SourceService,
        private readonly taskKey4CreateInputDTO2Task4FlatKeyDTOConverter: TaskKey4CreateInputDTO2Task4FlatKeyDTOConverterService
    ) { super(logger) }

    @WithTransaction(Task.name)
    public async change(context: TransactionalContext, key: Export, value: undefined, session?: ClientSession): Promise<void> {

        await this.validate(context, key, undefined, session)

        const collections = await this.sourceService.getCollections(
            key.source,
            key.database,
            key.source.filter
        )

        await Promise.all(collections.map(async _collection => {

            if (_collection !== 'trash') { return }

            await this.validate(context, key, _collection, session)

            this.logger.log(CreateTaskStateService.name, context, 'creating task', { _collection })

            await this.model.findOneAndUpdate(
                {
                    transaction: key.transaction,
                    _export: key,
                    _collection,
                    $or: [{ status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING }]
                },
                { $setOnInsert: { transaction: key.transaction, _export: key, _collection, status: ExportStatus.CREATED } },
                { upsert: true, returnDocument: 'after', session }
            )

        }))

    }

    protected async validate(context: TransactionalContext, key: Export, value?: string, session?: ClientSession): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        if (ObjectHelper.isEmpty(session)) {
            throw new InvalidParameterException('session', session)
        }

        try {

            await ClassValidatorHelper.validate('key', key)

            if (StringHelper.isEmpty(value)) { return }

            const filter = await this.taskKey4CreateInputDTO2Task4FlatKeyDTOConverter.convert(context, {
                _export: key,
                _collection: value as string
            })
            const found = await this.service.listWithStatus(context, filter, [ExportStatus.CREATED, ExportStatus.RUNNING, ExportStatus.PAUSED], 'dto')
            if (!CollectionHelper.isEmpty(found)) {
                throw new InvalidParameterException('export', found, 'does not possible create task because there is another task with created or running state')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

    protected async before() { }

    protected async after() { }

}
