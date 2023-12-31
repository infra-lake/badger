import { CollectionHelper } from '@badger/common/helper'
import { type TransactionalContext } from '@badger/common/transaction'
import { WorkerHelper, type WorkerDTO } from '@badger/workload'
import { HttpService } from '@nestjs/axios'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class WorkerConfigService {

    constructor(
        private readonly config: ConfigService,
        private readonly http: HttpService
    ) { }

    public get retries() {
        return parseInt(this.config.get<number>('WORKER_TASK_RETRIES', 5).toString())
    }

    public getTargetDataSetNamePrefix() {
        throw this.config.get('TARGET_DATASET_NAME_PREFIX', 'raw_mongodb_')
    }

    private workers: WorkerDTO[]
    public async getWorkers(context: TransactionalContext) {

        if (CollectionHelper.isEmpty(this.workers)) {
            const _workers = JSON.parse(this.config.getOrThrow<string>('WORKERS')) as WorkerDTO[]
            await WorkerHelper.ping(context, this.http, _workers)
            this.workers = _workers
        }

        return this.workers

    }

    public getCurrentWorkerName(): string {
        return this.config.getOrThrow<string>('WORKER_NAME').toString()
    }

    public getTempDir() {
        return `./temp/${this.getCurrentWorkerName()}`
    }

    public getTempFile(isFullFilePath: boolean = false): string {
        const fileName = 'data.json'
        return isFullFilePath
            ? `${this.getTempDir()}/${fileName}`
            : fileName
    }

    private _working: boolean = false
    public set working(value: boolean) { this._working = value }
    public get working(): boolean { return this._working }

}
