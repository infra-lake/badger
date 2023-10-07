import { ClassValidatorHelper, StringHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { type TransactionalContext } from '@badger/common/transaction'
import { ConverterService } from '@badger/common/types'
import { Injectable } from '@nestjs/common'
import { type FilterQuery } from 'mongoose'
import { type Export4FlatKeyWithOptionalTransactionDTO, type Export4FlatKeyDTO, type Export4FlatKeyWithoutTransactionDTO } from '../../export.dto'
import { type Export } from '../../export.entity'

type Source = Export4FlatKeyDTO | Export4FlatKeyWithOptionalTransactionDTO | Export4FlatKeyWithoutTransactionDTO

@Injectable()
export class Export4FlatKeyDTO2FilterQueryExportConverterService extends ConverterService<Source, FilterQuery<Partial<Export>>> {

    public constructor(logger: TransactionalLoggerService) { super(logger) }

    public async convert(context: TransactionalContext, input: Source): Promise<FilterQuery<Partial<Export>>> {

        await this.validate(context, input)

        const output: FilterQuery<Partial<Export>> = {
            'source.name': input.source,
            'target.name': input.target,
            database: input.database
        }

        if ('transaction' in input && !StringHelper.isEmpty(input.transaction)) {
            output.transaction = input.transaction
        }

        return output

    }

    protected async validate(context: TransactionalContext, input: Source): Promise<void> {
        await ClassValidatorHelper.validate('input', input)
    }

}
