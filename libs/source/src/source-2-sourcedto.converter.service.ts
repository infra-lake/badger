import { ClassValidatorHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { type TransactionalContext } from '@badger/common/transaction'
import { ConverterService } from '@badger/common/types'
import { Injectable } from '@nestjs/common'
import { SourceDTO } from './source.dto'
import { type Source } from './source.entity'

@Injectable()
export class Source2SourceDTOConverterService extends ConverterService<Source, SourceDTO> {

    public constructor(logger: TransactionalLoggerService) { super(logger) }

    public async convert(context: TransactionalContext, input: Source): Promise<SourceDTO> {

        await this.validate(context, input)

        const output = new SourceDTO()

        output.name = input.name
        output.url = input.url
        output.filter = input.filter
        output.stamps = input.stamps

        return output

    }

    protected async validate(context: TransactionalContext, input: Source): Promise<void> {
        await ClassValidatorHelper.validate('input', input)
    }

}
