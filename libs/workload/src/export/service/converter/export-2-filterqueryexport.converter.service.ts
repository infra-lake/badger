import { ClassValidatorHelper, StringHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { type TransactionalContext } from '@badger/common/transaction'
import { ConverterService } from '@badger/common/types'
import { Injectable } from '@nestjs/common'
import { type FilterQuery } from 'mongoose'
import { type Export } from '../../export.entity'

@Injectable()
export class Export2FilterQueryExportConverterService extends ConverterService<Export, FilterQuery<Partial<Export>>> {

    public constructor(logger: TransactionalLoggerService) { super(logger) }

    public async convert(context: TransactionalContext, input: Export): Promise<FilterQuery<Partial<Export>>> {

        await this.validate(context, input)

        let output: FilterQuery<Partial<Export>>

        if ('_id' in input) {

            output = { _id: input._id }

        } else {

            output = {
                'source.name': input.source.name,
                'target.name': input.target.name,
                database: input.database
            }

            if ('transaction' in input && !StringHelper.isEmpty(input.transaction)) {
                output.transaction = input.transaction
            }

        }

        return output

    }

    protected async validate(context: TransactionalContext, input: Export): Promise<void> {
        await ClassValidatorHelper.validate('input', input)
    }

}
