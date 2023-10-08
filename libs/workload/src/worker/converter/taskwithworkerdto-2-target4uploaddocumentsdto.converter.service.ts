import { ClassValidatorHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { type TransactionalContext } from '@badger/common/transaction'
import { ConverterService } from '@badger/common/types'
import { Target4UploadDocumentsDTO } from '@badger/target'
import { type TaskWithWorkerDTO } from '@badger/workload/task'
import { Injectable } from '@nestjs/common'
import { WorkerConfigService } from '../worker.config.service'

@Injectable()
export class TaskWithWorkerDTO2Target4UploadDocumentsDTOConverterService extends ConverterService<TaskWithWorkerDTO, Target4UploadDocumentsDTO> {

    public constructor(
        logger: TransactionalLoggerService,
        private readonly config: WorkerConfigService
    ) { super(logger) }

    public async convert(context: TransactionalContext, input: TaskWithWorkerDTO): Promise<Target4UploadDocumentsDTO> {

        await this.validate(context, input)

        const output = new Target4UploadDocumentsDTO()

        output.transaction = input.transaction
        output.credentials = input._export.target.credentials
        output.dataset = input._export.database
        output.table = input._collection

        output.tempDir = this.config.getTempDir()
        output.tempFile = this.config.getTempFile()

        return output

    }

    protected async validate(context: TransactionalContext, input: TaskWithWorkerDTO): Promise<void> {
        await ClassValidatorHelper.validate('input', input)
    }

}
