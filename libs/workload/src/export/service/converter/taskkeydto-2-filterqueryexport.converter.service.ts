import { ClassValidatorHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { type TransactionalContext } from '@badger/common/transaction'
import { ConverterService } from '@badger/common/types'
import { Injectable } from '@nestjs/common'
import { type FilterQuery } from 'mongoose'
import { type Export } from '../../export.entity'
import { type TaskKeyDTO } from '@badger/workload/task'

@Injectable()
export class TaskKeyDTO2FilterQueryExportConverterService extends ConverterService<TaskKeyDTO, FilterQuery<Partial<Export>>> {

    public constructor(logger: TransactionalLoggerService) { super(logger) }

    public async convert(context: TransactionalContext, input: TaskKeyDTO): Promise<FilterQuery<Partial<Export>>> {

        await this.validate(context, input)

        const output: FilterQuery<Partial<Export>> = {
            'source.name': input._export.source.name,
            'target.name': input._export.target.name,
            database: input._export.database
        }

        return output

    }

    protected async validate(context: TransactionalContext, input: TaskKeyDTO): Promise<void> {
        await ClassValidatorHelper.validate('input', input)
    }

}
