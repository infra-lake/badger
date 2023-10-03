import { ApiProperty, PartialType } from '@nestjs/swagger'
import { WorkerStatus, type IWorker } from './worker.contract'

export class WorkerDTO implements IWorker {

    @ApiProperty({ description: 'worker name' })
    name: string

    @ApiProperty({ description: 'url to access worker' })
    url: string

    @ApiProperty({ description: 'url to access worker', enum: ['free', 'busy'] })
    status: WorkerStatus

}

export class Worker4SearchDTO extends PartialType(WorkerDTO) { }
