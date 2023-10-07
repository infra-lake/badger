import { CommonModule } from '@badger/common'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Target } from './target.entity'
import { TargetService } from './target.service'
import { MongoDBHelper } from '@badger/common/mongodb'
import { TargetConfigService } from './target.config.service'
import { ConfigModule } from '@nestjs/config'
import { Target2TargetDTOConverterService } from './target-2-targetdto.converter.service'

@Module({
    imports: [ConfigModule, MongooseModule.forFeature(MongoDBHelper.getModelDefinitionsFrom(Target)), CommonModule],
    providers: [TargetConfigService, Target2TargetDTOConverterService, TargetService],
    exports: [Target2TargetDTOConverterService, TargetService]
})
export class TargetModule { }
