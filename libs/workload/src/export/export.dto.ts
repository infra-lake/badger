import { SourceDTO } from '@badger/source'
import { TargetDTO } from '@badger/target'
import { OmitType, PartialType } from '@nestjs/swagger'
import { IsDefined, IsEnum, IsNotEmpty, IsString, IsUUID, MinLength } from 'class-validator'
import { ExportStatus } from './export.entity'

export class ExportDTO {

    @IsUUID()
    @IsDefined()
    @IsNotEmpty()
    public transaction: string

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public source: SourceDTO

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public target: TargetDTO

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public database: string

    @IsEnum(ExportStatus)
    @IsDefined()
    @IsNotEmpty()
    public status: ExportStatus

}

export class Export4SearchDTO extends PartialType(ExportDTO) { }
export class ExportKeyDTO extends OmitType(ExportDTO, ['status'] as const) { }
export class Export4CreateDTO extends OmitType(ExportDTO, [
    'transaction',
    'source',
    'target',
    'status'
] as const) {

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public source: SourceDTO['name']

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public target: TargetDTO['name']

}

export class Export4GetCreatedOrRunningDTO extends OmitType(ExportDTO, ['transaction', 'status'] as const) { }
