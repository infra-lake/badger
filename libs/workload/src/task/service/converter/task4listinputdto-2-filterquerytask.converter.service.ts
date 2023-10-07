import { ClassValidatorHelper, StringHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { type TransactionalContext } from '@badger/common/transaction'
import { ConverterService } from '@badger/common/types'
import { Injectable } from '@nestjs/common'
import { type FilterQuery } from 'mongoose'
import { type Task4ListInputDTO } from '../../task.dto'
import { type Task } from '../../task.entity'

@Injectable()
export class Task4ListInputDTO2FilterQueryTaskConverterService extends ConverterService<Task4ListInputDTO, FilterQuery<Partial<Task>>> {

    public constructor(logger: TransactionalLoggerService) { super(logger) }

    public async convert(context: TransactionalContext, input: Task4ListInputDTO): Promise<FilterQuery<Partial<Task>>> {

        await this.validate(context, input)

        const output: FilterQuery<Partial<Task>> = {}

        if (!StringHelper.isEmpty(input.transaction)) {
            output.transaction = input.transaction
        }

        if (!StringHelper.isEmpty(input._collection)) {
            output._collection = input._collection
        }

        if (!StringHelper.isEmpty(input.status)) {
            output.status = input.status
        }

        if (!StringHelper.isEmpty(input.worker)) {
            output.worker = input.worker
        }

        return output

    }

    protected async validate(context: TransactionalContext, input: Task4ListInputDTO): Promise<void> {
        await ClassValidatorHelper.validate('input', input)
    }

}
