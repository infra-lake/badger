import { ClassValidatorHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { type TransactionalContext } from '@badger/common/transaction'
import { ConverterService } from '@badger/common/types'
import { Export2ExportDTOConverterService } from '@badger/workload/export/service/converter'
import { Injectable } from '@nestjs/common'
import { TaskDTO } from '../../task.dto'
import { type Task } from '../../task.entity'

@Injectable()
export class Task2TaskDTOConverterService extends ConverterService<Task, TaskDTO> {

    public constructor(
        logger: TransactionalLoggerService,
        private readonly exportConverter: Export2ExportDTOConverterService
    ) { super(logger) }

    public async convert(context: TransactionalContext, input: Task): Promise<TaskDTO> {

        await this.validate(context, input)

        const output = new TaskDTO()

        output.transaction = input.transaction

        output._export = await this.exportConverter.convert(context, input._export)

        output._collection = input._collection
        output.worker = input.worker
        output.status = input.status
        output.error = input.error
        output.window = input.window
        output.count = input.count

        return output

    }

    protected async validate(context: TransactionalContext, input: Task): Promise<void> {
        await ClassValidatorHelper.validate('input', input)
    }

}
