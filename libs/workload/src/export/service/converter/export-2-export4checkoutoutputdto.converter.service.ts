import { ClassValidatorHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { type TransactionalContext } from '@badger/common/transaction'
import { ConverterService } from '@badger/common/types'
import { Injectable } from '@nestjs/common'
import { Export4CheckOutputDTO } from '../../export.dto'
import { type Export } from '../../export.entity'

@Injectable()
export class Export2Export4CheckOutputDTOConverterService extends ConverterService<Export, Export4CheckOutputDTO> {

    public constructor(logger: TransactionalLoggerService) { super(logger) }

    public async convert(context: TransactionalContext, input: Export): Promise<Export4CheckOutputDTO> {

        await this.validate(context, input)

        const output = new Export4CheckOutputDTO()
        output.status = input.status

        return output

    }

    protected async validate(context: TransactionalContext, input: Export): Promise<void> {
        await ClassValidatorHelper.validate('input', input)
    }

}
