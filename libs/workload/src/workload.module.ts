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
    Export2Export4CheckOutputDTOConverterService,
    Export2ExportDTOConverterService,
    Export2FilterQueryExportConverterService,
    Export4FlatKeyDTO2FilterQueryExportConverterService,
    Export4ListInputDTO2FilterQueryExportConverterService,
    TaskKeyDTO2FilterQueryExportConverterService
} from './export/service/converter'
import {
    CleanupExportStateService,
    CreateExportStateService,
    ErrorExportStateService,
    PauseExportStateService,
    RetryExportStateService,
    RunExportStateService,
    TerminateExportStateService,
    UnpauseExportStateService
} from './export/service/state'
import { Task, TaskService } from './task'
import {
    Task2TaskDTOConverterService,
    Task4FlatKeyDTO2FilterQueryTaskConverterService,
    Task4ListInputDTO2FilterQueryTaskConverterService,
    TaskKey4CreateInputDTO2Task4FlatKeyDTOConverterService,
    TaskKeyDTO2FilterQueryTaskConverterService
} from './task/service/converter'
import {
    CleanupTaskStateService,
    CreateTaskStateService,
    ErrorTaskStateService,
    PauseTaskStateService,
    RetryTaskStateService,
    RunTaskStateService,
    ScaleTaskStateService,
    TerminateTaskStateService,
    UnpauseTaskStateService
} from './task/service/state'
import { WorkerConfigService, WorkerService } from './worker'
import { WorkloadService } from './workload.service'
import {
    TaskWithWorkerDTO2Source4DownloadDocumentsDTOConverterService,
    TaskWithWorkerDTO2Target4UploadDocumentsDTOConverterService
} from './worker/converter'

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
        Export2ExportDTOConverterService,
        Export2FilterQueryExportConverterService,
        TaskKeyDTO2FilterQueryTaskConverterService,
        Export2Export4CheckOutputDTOConverterService,
        TaskKeyDTO2FilterQueryExportConverterService,
        Export4FlatKeyDTO2FilterQueryExportConverterService,
        Export4ListInputDTO2FilterQueryExportConverterService,
        ExportService,
        CreateExportStateService,
        RunExportStateService,
        TerminateExportStateService,
        ErrorExportStateService,
        PauseExportStateService,
        UnpauseExportStateService,
        RetryExportStateService,
        CleanupExportStateService,
        Task2TaskDTOConverterService,
        TaskKeyDTO2FilterQueryTaskConverterService,
        Task4FlatKeyDTO2FilterQueryTaskConverterService,
        Task4ListInputDTO2FilterQueryTaskConverterService,
        TaskKey4CreateInputDTO2Task4FlatKeyDTOConverterService,
        TaskService,
        CreateTaskStateService,
        ScaleTaskStateService,
        RunTaskStateService,
        TerminateTaskStateService,
        ErrorTaskStateService,
        PauseTaskStateService,
        UnpauseTaskStateService,
        RetryTaskStateService,
        CleanupTaskStateService,
        TaskWithWorkerDTO2Target4UploadDocumentsDTOConverterService,
        TaskWithWorkerDTO2Source4DownloadDocumentsDTOConverterService,
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
