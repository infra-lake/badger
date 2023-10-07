import { ClassValidatorHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { type TransactionalContext } from '@badger/common/transaction'
import { ConverterService } from '@badger/common/types'
import { Injectable } from '@nestjs/common'
import { TargetDTO } from './target.dto'
import { type Target } from './target.entity'

@Injectable()
export class Target2TargetDTOConverterService extends ConverterService<Target, TargetDTO> {

    public constructor(logger: TransactionalLoggerService) { super(logger) }

    public async convert(context: TransactionalContext, input: Target): Promise<TargetDTO> {

        await this.validate(context, input)

        const output = new TargetDTO()

        output.name = input.name
        output.credentials = input.credentials

        return output

    }

    protected async validate(context: TransactionalContext, input: Target): Promise<void> {
        await ClassValidatorHelper.validate('input', input)
    }

}
