import { CommonModule } from '@badger/common'
import { MongoDBHelper } from '@badger/common/mongodb'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Source } from './source.entity'
import { SourceService } from './source.service'

@Module({
    imports: [CommonModule, MongooseModule.forFeature(MongoDBHelper.getModelDefinitionsFrom(Source))],
    providers: [SourceService],
    exports: [SourceService]
})
export class SourceModule { }
