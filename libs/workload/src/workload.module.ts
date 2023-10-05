import { CommonModule } from '@badger/common'
import { MongoDBHelper } from '@badger/common/mongodb'
import { SourceModule } from '@badger/source'
import { TargetModule } from '@badger/target'
import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { ExportService } from './export'
import { Export } from './export/export.entity'
import {
    CreateExportStateService,
    ErrorExportStateService,
    PauseExportStateService,
    PlayExportStateService,
    RetryExportStateService,
    RunExportStateService,
    TerminateExportStateService
} from './export/service/state'
import { Task, TaskService } from './task'
import {
    CreateTaskStateService,
    ErrorTaskStateService,
    PauseTaskStateService,
    PlayTaskStateService,
    RetryTaskStateService,
    RunTaskStateService,
    ScaleTaskStateService,
    TerminateTaskStateService
} from './task/service/state'
import { WorkerConfigService, WorkerService } from './worker'
import { WorkloadService } from './workload.service'

@Module({
    imports: [
        ConfigModule.forRoot(),
        HttpModule,
        MongooseModule.forFeature(MongoDBHelper.getModelDefinitionsFrom(Export, Task)),
        CommonModule,
        SourceModule,
        TargetModule
    ],
    providers: [
        ExportService,
        CreateExportStateService,
        RunExportStateService,
        TerminateExportStateService,
        ErrorExportStateService,
        PauseExportStateService,
        PlayExportStateService,
        RetryExportStateService,
        TaskService,
        CreateTaskStateService,
        ScaleTaskStateService,
        RunTaskStateService,
        TerminateTaskStateService,
        ErrorTaskStateService,
        PauseTaskStateService,
        PlayTaskStateService,
        RetryTaskStateService,
        WorkerConfigService,
        WorkloadService,
        WorkerService

    ],
    exports: [
        ExportService,
        TaskService,
        WorkloadService,
        WorkerService
    ]
})
export class WorkloadModule { }
