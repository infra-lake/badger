import { CommonModule } from '@badger/common'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Target } from './target.entity'
import { TargetService } from './target.service'
import { MongoDBHelper } from '@badger/common/mongodb'
import { TargetConfigService } from './target.config.service'
import { ConfigModule } from '@nestjs/config'

@Module({
    imports: [ConfigModule, MongooseModule.forFeature(MongoDBHelper.getModelDefinitionsFrom(Target)), CommonModule],
    providers: [TargetConfigService, TargetService],
    exports: [TargetService]
})
export class TargetModule { }
