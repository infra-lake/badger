import { InvalidParameterException } from '@badger/common/exception'
import { CollectionHelper, ObjectHelper, ResilienceHelper } from '@badger/common/helper'
import { type TransactionalContext } from '@badger/common/transaction'
import { type WindowDTO } from '@badger/common/window'
import { Source4DownloadDocumentsDTO, SourceService } from '@badger/source'
import { Target4UploadDocumentsDTO, TargetService } from '@badger/target'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { type ClientSession } from 'mongoose'
import { Task4RunKeyInputDTO, TaskService, type TaskWithWorkerDTO } from '../task'
import { WorkerConfigService } from './worker.config.service'
import { WorkerStatus, type IWorker } from './worker.contract'
import { type Worker4SearchDTO } from './worker.dto'

@Injectable()
export class WorkerService {

    constructor(
        private readonly config: WorkerConfigService,
        private readonly sourceService: SourceService,
        private readonly targetService: TargetService,
        @Inject(forwardRef(() => TaskService)) private readonly taskService: TaskService
    ) { }

    public async handle(context: TransactionalContext) {

        if (this.config.working) { return }

        this.config.working = true

        const task = await this.getNextTask(context)

        try {

            if (ObjectHelper.isEmpty(task)) {
                return
            }

            await ResilienceHelper.tryToRun(context, 5, this.perform.bind(this), task, new Date())

        } catch (error) {

            await this.taskService.error(context, task, error)

        } finally {

            this.config.working = false

        }

    }

    private async getNextTask(context: TransactionalContext) {
        const dto = new Task4RunKeyInputDTO()
        dto.worker = this.config.getCurrentWorkerName()
        const result = await this.taskService.next(context, dto) as TaskWithWorkerDTO
        return result
    }

    private async perform(context: TransactionalContext, task: TaskWithWorkerDTO, date: Date) {

        const downloadDTO = new Source4DownloadDocumentsDTO()
        downloadDTO.name = task._export.source.name
        downloadDTO.url = task._export.source.url
        downloadDTO.stamps = task._export.source.stamps
        downloadDTO.database = task._export.database
        downloadDTO._collection = task._collection
        downloadDTO.window = task.window as WindowDTO
        downloadDTO.tempDir = this.config.getTempDir()
        downloadDTO.tempFile = this.config.getTempFile()
        downloadDTO.date = date

        const count = await this.sourceService.downloadDocuments(context, downloadDTO)

        if (count <= 0) {
            await this.taskService.terminate(context, task)
            return
        }

        const uploadDTO = new Target4UploadDocumentsDTO()
        uploadDTO.transaction = task.transaction
        uploadDTO.credentials = task._export.target.credentials
        uploadDTO.dataset = task._export.database
        uploadDTO.table = task._collection
        uploadDTO.tempDir = this.config.getTempDir()
        uploadDTO.tempFile = this.config.getTempFile()

        await this.targetService.uploadDocuments(context, uploadDTO)

        await this.taskService.terminate(context, task)

    }

    public async list(context: TransactionalContext, filter?: Worker4SearchDTO, session?: ClientSession) {

        if (ObjectHelper.isEmpty(context)) { throw new InvalidParameterException('context', context) }

        const workers = await this.config.getWorkers(context)

        const temp =
            ObjectHelper.isEmpty(filter)
                ? workers
                : workers.filter(worker =>
                    (worker?.name ?? '').includes(filter?.name ?? '') &&
                    (worker?.url ?? '').includes(filter?.url ?? '')
                )

        if (CollectionHelper.isEmpty(temp)) {
            return temp
        }

        const busyWorkers = await this.taskService.listBusyWorkerNames(session)

        const result: IWorker[] = []

        for (const { name, url } of temp) {
            result.push({
                name,
                url,
                status:
                    busyWorkers.filter(busyWorker => busyWorker.name === name).length > 0
                        ? WorkerStatus.BUSY
                        : WorkerStatus.FREE
            })
        }

        return result.filter(({ status }) => (filter?.status ?? status) === status)

    }

}
