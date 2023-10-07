import { ClassValidatorHelper, StringHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { type TransactionalContext } from '@badger/common/transaction'
import { ConverterService } from '@badger/common/types'
import { Injectable } from '@nestjs/common'
import { type FilterQuery } from 'mongoose'
import { type Task4FlatKeyDTO, type Task4FlatKeyWithOptionalTransactionDTO } from '../../task.dto'
import { type Task } from '../../task.entity'
import { type Export4FlatKeyDTO } from '@badger/workload/export'

type Source = Task4FlatKeyDTO | Task4FlatKeyWithOptionalTransactionDTO | Export4FlatKeyDTO

@Injectable()
export class Task4FlatKeyDTO2FilterQueryTaskConverterService extends ConverterService<Source, FilterQuery<Partial<Task>>> {

    public constructor(logger: TransactionalLoggerService) { super(logger) }

    public async convert(context: TransactionalContext, input: Source): Promise<FilterQuery<Partial<Task>>> {

        await this.validate(context, input)

        const output: FilterQuery<Partial<Task>> = {}

        if ('_collection' in input && !StringHelper.isEmpty(input._collection)) {
            output._collection = input._collection
        }

        if (!StringHelper.isEmpty(input.transaction)) {
            output.transaction = input.transaction
        }

        if ('worker' in input && !StringHelper.isEmpty(input.worker)) {
            output.worker = input.worker
        }

        return output

    }

    protected async validate(context: TransactionalContext, input: Source): Promise<void> {
        await ClassValidatorHelper.validate('input', input)
    }

}
