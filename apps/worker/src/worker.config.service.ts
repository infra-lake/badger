import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export const DEFAULT_WORKER_PORT = '3000'

@Injectable()
export class WorkerConfigService {

    constructor(
        private readonly config: ConfigService
    ) { }

    public get port(): string {
        return this.config.get('WORKER_PORT', DEFAULT_WORKER_PORT)
    }

    public get name(): string {
        return this.config.getOrThrow('WORKER_NAME')
    }

}
