import { TransactionalLoggerService } from '@badger/common/logging'
import { type TransactionalContext } from '@badger/common/transaction'
import { ConverterService } from '@badger/common/types'
import { Injectable } from '@nestjs/common'
import { ExportDTO } from '../../export.dto'
import { type Export } from '../../export.entity'
import { ClassValidatorHelper } from '@badger/common/helper'
import { Target2TargetDTOConverterService } from '@badger/target/target-2-targetdto.converter.service'
import { Source2SourceDTOConverterService } from '@badger/source/source-2-sourcedto.converter.service'

@Injectable()
export class Export2ExportDTOConverterService extends ConverterService<Export, ExportDTO> {

    public constructor(
        logger: TransactionalLoggerService,
        private readonly sourceConverter: Source2SourceDTOConverterService,
        private readonly targetConverter: Target2TargetDTOConverterService
    ) { super(logger) }

    public async convert(context: TransactionalContext, input: Export): Promise<ExportDTO> {

        await this.validate(context, input)

        const output = new ExportDTO()

        output.transaction = input.transaction

        output.source = await this.sourceConverter.convert(context, input.source)

        output.target = await this.targetConverter.convert(context, input.target)

        output.database = input.database
        output.status = input.status

        return output

    }

    protected async validate(context: TransactionalContext, input: Export): Promise<void> {
        await ClassValidatorHelper.validate('input', input)
    }

}
