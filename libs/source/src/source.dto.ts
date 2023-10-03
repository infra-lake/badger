import { Environment, EnvironmentHelper } from '@badger/common/helper'
import { type ICollectionsFilter } from '@badger/common/mongodb'
import { type PartialStampsDTO, StampsDTO } from '@badger/common/stamps/stamps.dto'
import { WindowDTO } from '@badger/common/window'
import { ApiProperty, OmitType, PartialType, PickType } from '@nestjs/swagger'
import { IsArray, IsDate, IsDefined, IsNotEmpty, IsObject, IsOptional, IsString, IsUrl, MinLength } from 'class-validator'

export class FilterSourceDTO implements ICollectionsFilter {

    @IsArray()
    @IsOptional()
    ignoredCollections?: string[]

}

export class SourceDTO {

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    @ApiProperty({ description: 'source name' })
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
    @ApiProperty({ description: 'url used to read source mongodb data' })
    public url: string

    @IsObject()
    @IsOptional()
    @ApiProperty({ description: 'filter used on read source data' })
    public filter?: FilterSourceDTO

    @IsObject()
    @IsDefined()
    public stamps: StampsDTO

}

export class SourceDTO4SaveDTO extends OmitType(SourceDTO, ['stamps'] as const) {
    @IsObject()
    @IsOptional()
    public stamps?: PartialStampsDTO
}

export class Source4SearchDTO extends PartialType(SourceDTO) { }

export class SourceKeyDTO extends PickType(SourceDTO, ['name'] as const) { }

export class Source4DownloadDocumentsDTO extends OmitType(SourceDTO, ['filter'] as const) {

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public database: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public _collection: string

    @IsObject()
    @IsDefined()
    @IsNotEmpty()
    public window: WindowDTO

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(1)
    public tempDir: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(1)
    public tempFile: string

    @IsDate()
    @IsDefined()
    @IsNotEmpty()
    public date: Date

}

export class Source4CountOrReadDocumentsDTO extends OmitType(SourceDTO, ['filter'] as const) {

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public database: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public _collection: string

    @IsObject()
    @IsDefined()
    @IsNotEmpty()
    public window: WindowDTO

}
