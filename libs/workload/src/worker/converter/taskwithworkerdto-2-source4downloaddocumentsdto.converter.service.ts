import { ClassValidatorHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { type TransactionalContext } from '@badger/common/transaction'
import { ConverterService } from '@badger/common/types'
import { Source4DownloadDocumentsDTO } from '@badger/source'
import { type TaskWithWorkerDTO } from '@badger/workload/task'
import { Injectable } from '@nestjs/common'
import { WorkerConfigService } from '../worker.config.service'
import { type WindowDTO } from '@badger/common/window'
import { IsDate, IsDefined } from 'class-validator'

export class Input {

    @IsDefined()
    task: TaskWithWorkerDTO

    @IsDate()
    @IsDefined()
    date: Date

}

@Injectable()
export class TaskWithWorkerDTO2Source4DownloadDocumentsDTOConverterService extends ConverterService<Input, Source4DownloadDocumentsDTO> {

    public constructor(
        logger: TransactionalLoggerService,
        private readonly config: WorkerConfigService
    ) { super(logger) }

    public async convert(context: TransactionalContext, input: Input): Promise<Source4DownloadDocumentsDTO> {

        await this.validate(context, input)

        const output = new Source4DownloadDocumentsDTO()

        output.name = input.task._export.source.name
        output.url = input.task._export.source.url
        output.stamps = input.task._export.source.stamps
        output.database = input.task._export.database
        output._collection = input.task._collection
        output.window = input.task.window as WindowDTO

        output.tempDir = this.config.getTempDir()
        output.tempFile = this.config.getTempFile()

        output.date = input.date

        return output

    }

    protected async validate(context: TransactionalContext, input: Input): Promise<void> {
        await ClassValidatorHelper.validate('input', input)
    }

}
