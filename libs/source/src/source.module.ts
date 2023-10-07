import { CommonModule } from '@badger/common'
import { MongoDBHelper } from '@badger/common/mongodb'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Source } from './source.entity'
import { SourceService } from './source.service'
import { Source2SourceDTOConverterService } from './source-2-sourcedto.converter.service'

@Module({
    imports: [CommonModule, MongooseModule.forFeature(MongoDBHelper.getModelDefinitionsFrom(Source))],
    providers: [Source2SourceDTOConverterService, SourceService],
    exports: [Source2SourceDTOConverterService, SourceService]
})
export class SourceModule { }
