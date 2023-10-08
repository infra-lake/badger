import { CommonModule } from '@badger/common'
import { App } from '@badger/common/types'
import { SourceModule } from '@badger/source'
import { TargetModule } from '@badger/target'
import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { ManagerConfigService } from './manager.config.service'
import { SourceController } from './source.controller'
import { TargetController } from './target.controller'
import { WorkloadModule } from '@badger/workload'
import { ExportController } from './export.controller'
import { ManagerService } from './manager.service'
import { ManagerController } from './manager.controller'

@Module({
    imports: [
        ConfigModule.forRoot(),
        HttpModule,
        ScheduleModule.forRoot(),
        CommonModule.forRoot(App.MANAGER),
        SourceModule,
        TargetModule,
        WorkloadModule
    ],
    providers: [ManagerConfigService, ManagerService],
    controllers: [
        ManagerController,
        SourceController,
        TargetController,
        ExportController
    ]
})
export class ManagerModule { }
