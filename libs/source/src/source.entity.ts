import { Environment, EnvironmentHelper } from '@badger/common/helper'
import { MongoDBDocument, type ICollectionsFilter } from '@badger/common/mongodb'
import { type IStamps } from '@badger/common/stamps'
import { Prop, Schema } from '@nestjs/mongoose'
import { IsArray, IsDefined, IsNotEmpty, IsObject, IsOptional, IsString, IsUrl, MinLength } from 'class-validator'

export class StampsSource implements IStamps {

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @Prop()
    id: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @Prop()
    insert: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @Prop()
    update: string

}

export class FilterSource implements ICollectionsFilter {

    @IsArray()
    @IsOptional()
    @Prop()
    ignoredCollections?: string[]

}

@Schema({ collection: 'sources' })
export class Source extends MongoDBDocument<Source, 'name'> {

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    @Prop()
    public name: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @IsUrl({
        protocols: ['mongodb', 'mongodb+srv'],
        require_protocol: true,
        require_host: true,
        allow_query_components: true,
        require_tld: EnvironmentHelper.ENVIRONMENT !== Environment.LOCAL
    })
    @Prop()
    public url: string

    @IsObject()
    @IsOptional()
    @Prop({ type: FilterSource })
    public filter?: FilterSource

    @IsObject()
    @IsDefined()
    @Prop({ type: StampsSource })
    public stamps: StampsSource

}
