import { ClassValidatorHelper, StringHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { type TransactionalContext } from '@badger/common/transaction'
import { ConverterService } from '@badger/common/types'
import { Injectable } from '@nestjs/common'
import { type FilterQuery } from 'mongoose'
import { type Export4ListInputDTO } from '../../export.dto'
import { type Export } from '../../export.entity'

@Injectable()
export class Export4ListInputDTO2FilterQueryExportConverterService extends ConverterService<Export4ListInputDTO, FilterQuery<Partial<Export>>> {

    public constructor(logger: TransactionalLoggerService) { super(logger) }

    public async convert(context: TransactionalContext, input: Export4ListInputDTO): Promise<FilterQuery<Partial<Export>>> {

        await this.validate(context, input)

        const output: FilterQuery<Partial<Export>> = {}

        if (!StringHelper.isEmpty(input.transaction)) {
            output.transaction = input.transaction
        }

        if (!StringHelper.isEmpty(input.source)) {
            output['source.name'] = input.source
        }

        if (!StringHelper.isEmpty(input.target)) {
            output['target.name'] = input.target
        }

        if (!StringHelper.isEmpty(input.database)) {
            output.database = input.database
        }

        if (!StringHelper.isEmpty(input.status)) {
            output.status = input.status
        }

        return output

    }

    protected async validate(context: TransactionalContext, input: Export4ListInputDTO): Promise<void> {
        await ClassValidatorHelper.validate('input', input)
    }

}
