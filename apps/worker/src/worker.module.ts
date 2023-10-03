import { CommonModule } from '@badger/common'
import { App } from '@badger/common/types'
import { WorkloadModule } from '@badger/workload'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { WorkerConfigService } from './worker.config.service'
import { WorkerController } from './worker.controller'

@Module({
    imports: [
        ConfigModule.forRoot(),
        ScheduleModule.forRoot(),
        CommonModule.forRoot(App.WORKER),
        WorkloadModule
    ],
    controllers: [WorkerController],
    providers: [WorkerConfigService]
})
export class WorkerModule { }
