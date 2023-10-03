import { CommonModule } from '@badger/common'
import { App } from '@badger/common/types'
import { WorkloadModule } from '@badger/workload'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { VoterConfigService } from './voter.config.service'
import { VoterController } from './voter.controller'

@Module({
    imports: [
        ConfigModule.forRoot(),
        ScheduleModule.forRoot(),
        CommonModule.forRoot(App.VOTER),
        WorkloadModule
    ],
    controllers: [VoterController],
    providers: [VoterConfigService]
})
export class VoterModule { }
