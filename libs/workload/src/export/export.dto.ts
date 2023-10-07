import { SourceDTO } from '@badger/source'
import { TargetDTO } from '@badger/target'
import { ApiProperty, IntersectionType, OmitType, PartialType, PickType } from '@nestjs/swagger'
import { IsDefined, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator'
import { ExportStatus } from './export.entity'

export class ExportDTO {

    @IsUUID()
    @IsDefined()
    @IsNotEmpty()
    @ApiProperty({ description: 'transation uuid' })
    public transaction: string

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    @ApiProperty({ description: 'export source' })
    public source: SourceDTO

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    @ApiProperty({ description: 'export target' })
    public target: TargetDTO

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    @ApiProperty({ description: 'export source database name' })
    public database: string

    @IsEnum(ExportStatus)
    @IsDefined()
    @IsNotEmpty()
    @ApiProperty({ description: 'export status' })
    public status: ExportStatus

}

export class Export4FlatKeyDTO {

    @IsUUID()
    @IsDefined()
    @IsNotEmpty()
    @ApiProperty({ description: 'transation uuid' })
    public transaction: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    @ApiProperty({ description: 'export source name' })
    public source: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    @ApiProperty({ description: 'export target name' })
    public target: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    @ApiProperty({ description: 'export source database name' })
    public database: string

}

export class Export4FlatKeyWithOptionalTransactionDTO extends IntersectionType(
    OmitType(Export4FlatKeyDTO, ['transaction'] as const),
    PartialType(PickType(Export4FlatKeyDTO, ['transaction'] as const))
) { }

export class Export4FlatKeyWithoutTransactionDTO
    extends OmitType(Export4FlatKeyWithOptionalTransactionDTO, ['transaction'] as const) {
}

export class Export4ListInputDTO extends PartialType(Export4FlatKeyWithOptionalTransactionDTO) {

    @IsEnum(ExportStatus)
    @IsOptional()
    @ApiProperty({
        description: 'export status',
        required: false,
        enum: [
            'created',
            'error',
            'paused',
            'running',
            'terminated'
        ]
    })
    public status?: ExportStatus

}

export class Export4CheckOutputDTO extends PickType(ExportDTO, ['status'] as const) { }
