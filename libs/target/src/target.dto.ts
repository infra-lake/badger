import { ApiProperty, PartialType, PickType } from '@nestjs/swagger'
import { IsDefined, IsNotEmpty, IsString, IsUUID, MinLength } from 'class-validator'

export class TargetDTO {

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    @ApiProperty({ description: 'target name' })
    public name: string

    @IsDefined()
    @ApiProperty({ description: 'json service account that must have rights to create datasets, tables, and rows to bigquery' })
    public credentials: object

}

export class Target4SearchDTO extends PartialType(TargetDTO) { }

export class TargetKeyDTO extends PickType(TargetDTO, ['name'] as const) { }

export class Target4UploadDocumentsDTO extends PickType(TargetDTO, ['credentials'] as const) {

    @IsUUID()
    @IsDefined()
    @IsNotEmpty()
    public transaction: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public dataset: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public table: string

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

}
