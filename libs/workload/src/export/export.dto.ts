import { SourceDTO } from '@badger/source'
import { TargetDTO } from '@badger/target'
import { ApiProperty, OmitType, PickType } from '@nestjs/swagger'
import { IsDefined, IsEnum, IsNotEmpty, IsString, IsUUID, MinLength } from 'class-validator'
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

export class Export4CreateKeyInputDTO extends OmitType(ExportDTO, [
    'transaction',
    'source',
    'target',
    'status'
] as const) {

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    @ApiProperty({ description: 'export source name' })
    public source: SourceDTO['name']

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    @ApiProperty({ description: 'export target name' })
    public target: TargetDTO['name']

}

export class Export4PlayInputDTO {

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

export class Export4PauseInputDTO {

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

export class Export4ListInputhDTO {

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

    @IsEnum(ExportStatus)
    @IsDefined()
    @IsNotEmpty()
    @ApiProperty({ description: 'export status' })
    public status: ExportStatus

}

export class Export4GetCreatedOrRunningInputDTO {

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

export class Export4CheckInputDTO {

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

export class Export4CheckOutputDTO extends PickType(ExportDTO, ['status'] as const) { }
export class Export4IsCreatedInputDTO extends OmitType(ExportDTO, ['status'] as const) { }
export class Export4IsRunningInputDTO extends OmitType(ExportDTO, ['status'] as const) { }
export class Export4GetRunningInputDTO extends OmitType(ExportDTO, ['status'] as const) { }

export class Export4GetPausedInputDTO {

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

export class Export4RunKeyInputDTO extends OmitType(ExportDTO, ['status'] as const) { }
export class Export4ErrorKeyInputDTO extends OmitType(ExportDTO, ['status'] as const) { }
export class Export4TerminateKeyInputDTO extends OmitType(ExportDTO, ['status'] as const) { }
