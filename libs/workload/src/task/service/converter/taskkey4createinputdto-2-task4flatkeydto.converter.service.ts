import { ClassValidatorHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { type TransactionalContext } from '@badger/common/transaction'
import { ConverterService } from '@badger/common/types'
import { Injectable } from '@nestjs/common'
import { Task4FlatKeyWithOptionalTransactionDTO, type TaskKeyDTO } from '../../task.dto'

@Injectable()
export class TaskKey4CreateInputDTO2Task4FlatKeyDTOConverterService extends ConverterService<Omit<TaskKeyDTO, 'transaction'>, Task4FlatKeyWithOptionalTransactionDTO> {

    public constructor(logger: TransactionalLoggerService) { super(logger) }

    public async convert(context: TransactionalContext, input: Omit<TaskKeyDTO, 'transaction'>): Promise<Task4FlatKeyWithOptionalTransactionDTO> {

        await this.validate(context, input)

        const output = new Task4FlatKeyWithOptionalTransactionDTO()

        output.source = input._export.source.name
        output.target = input._export.target.name
        output.database = input._export.database
        output._collection = input._collection

        return output

    }

    protected async validate(context: TransactionalContext, input: Omit<TaskKeyDTO, 'transaction'>): Promise<void> {
        await ClassValidatorHelper.validate('input', input)
    }

}
