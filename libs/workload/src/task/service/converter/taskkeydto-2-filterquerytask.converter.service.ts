import { ClassValidatorHelper, StringHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { type TransactionalContext } from '@badger/common/transaction'
import { ConverterService } from '@badger/common/types'
import { Injectable } from '@nestjs/common'
import { type FilterQuery } from 'mongoose'
import { type Task } from '../../task.entity'
import { type TaskKeyDTO } from '../../task.dto'

type Source = TaskKeyDTO
type Target = FilterQuery<Required<Pick<Task, 'transaction' | '_export' | '_collection'>>>

@Injectable()
export class TaskKeyDTO2FilterQueryTaskConverterService extends ConverterService<Source, Target> {

    public constructor(logger: TransactionalLoggerService) { super(logger) }

    public async convert(context: TransactionalContext, input: Source): Promise<Target> {

        await this.validate(context, input)

        const output: FilterQuery<Partial<Task>> = {
            transaction: input.transaction,
            _export: input._export,
            _collection: input._collection
        }

        if (!StringHelper.isEmpty(input.worker)) {
            output.worker = input.worker
        }

        return output

    }

    protected async validate(context: TransactionalContext, input: Source): Promise<void> {
        await ClassValidatorHelper.validate('input', input)
    }

}
