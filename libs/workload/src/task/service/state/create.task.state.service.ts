import { InvalidParameterException, InvalidStateChangeException } from '@badger/common/exception'
import { ClassValidatorHelper, CollectionHelper, ObjectHelper, StringHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { type TransactionalContext } from '@badger/common/transaction'
import { StateService } from '@badger/common/types'
import { SourceService } from '@badger/source'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type TransactionOptions } from 'mongodb'
import { Model } from 'mongoose'
import { Task, Task4GetCreatedOrRunningInputDTO, TaskService, type TaskKey4CreateInputDTO } from '../..'
import { ExportStatus } from '@badger/workload/export'
@Injectable()
export class CreateTaskStateService extends StateService<TaskKey4CreateInputDTO, unknown> {

    public constructor(
        logger: TransactionalLoggerService,
        @InjectModel(Task.name) private readonly model: Model<Task>,
        private readonly service: TaskService,
        private readonly sourceService: SourceService
    ) { super(logger) }

    public async apply(context: TransactionalContext, key: TaskKey4CreateInputDTO): Promise<void> {

        this.logger.debug?.(CreateTaskStateService.name, context, 'creating tasks')

        const options: TransactionOptions = { writeConcern: { w: 'majority' } }

        await MongoDBHelper.withTransaction(this.model, async (session) => {

            await this.validate(context, key)

            const collections = await this.getCollectionsFrom(key)

            await Promise.all(collections.map(async _collection => {

                const { transaction, _export } = key

                const _key = { transaction, _export, _collection }

                await this.validate(context, _key)

                this.logger.debug?.(CreateTaskStateService.name, context, 'creating task', { _collection })

                await this.model.findOneAndUpdate(
                    {
                        transaction,
                        _export,
                        _collection,
                        $or: [{ status: ExportStatus.CREATED }, { status: ExportStatus.RUNNING }]
                    },
                    { $setOnInsert: { transaction, _export, _collection, status: ExportStatus.CREATED } },
                    { upsert: true, returnDocument: 'after', session }
                )

            }))

        }, options)

        this.logger.debug?.(CreateTaskStateService.name, context, 'all tasks are already successfully created')

    }

    private async getCollectionsFrom(key: TaskKey4CreateInputDTO) {
        const result = await this.sourceService.getCollections(
            key._export.source,
            key._export.database,
            key._export.source.filter
        )
        return result.map(({ collectionName: _collection }) => _collection)
    }

    protected async validate(context: TransactionalContext, key: TaskKey4CreateInputDTO): Promise<void> {

        if (ObjectHelper.isEmpty(context)) {
            throw new InvalidParameterException('context', context)
        }

        try {

            await ClassValidatorHelper.validate('key', key)

            if (StringHelper.isEmpty(key._collection)) { return }

            const found = await this.getCreatedOrRunningFrom(key)
            if (!CollectionHelper.isEmpty(found)) {
                throw new InvalidParameterException('export', found, 'does not possible create task because there is another task with created or running state')
            }

        } catch (error) {
            throw new InvalidStateChangeException(error)
        }

    }

    private async getCreatedOrRunningFrom(key: TaskKey4CreateInputDTO) {

        const filter = new Task4GetCreatedOrRunningInputDTO()
        filter.sourceName = key._export.source.name
        filter.targetName = key._export.target.name
        filter.database = key._export.database
        filter._collection = key._collection as string

        return await this.service.listCreatedOrRunning(filter)

    }

}
