import { WindowDTO } from '@badger/common/window/window.dto'
import { ApiProperty, OmitType } from '@nestjs/swagger'
import { IsDefined, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator'
import { Export, ExportDTO, ExportStatus } from '../export'
import { Export4FlatKeyDTO, Export4FlatKeyWithOptionalTransactionDTO } from '../export/export.dto'

export class TaskDTO {

    @IsUUID()
    @IsDefined()
    @IsNotEmpty()
    public transaction: string

    @IsDefined()
    @IsNotEmpty()
    public _export: ExportDTO

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public _collection: string

    // @IsEnum(ExportStatus)
    @IsDefined()
    @IsNotEmpty()
    public status: ExportStatus

    @IsOptional()
    @IsString()
    @MinLength(2)
    public worker?: string

    @IsOptional()
    error?: any

    @IsOptional()
    count?: number

    @IsOptional()
    window?: WindowDTO

}

export class Task4FlatKeyDTO extends Export4FlatKeyDTO {

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public _collection: string

    @IsOptional()
    @IsString()
    @MinLength(2)
    public worker?: string

}

export class Task4FlatKeyWithOptionalTransactionDTO extends Export4FlatKeyWithOptionalTransactionDTO {

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public _collection: string

    @IsOptional()
    @IsString()
    @MinLength(2)
    public worker?: string

}

export class TaskKeyDTO {

    @IsUUID()
    @IsDefined()
    @IsNotEmpty()
    public transaction: string

    @IsDefined()
    @IsNotEmpty()
    public _export: Export

    @IsString()
    @IsOptional()
    public _collection: string

    @IsOptional()
    @IsString()
    @MinLength(2)
    public worker?: string

}

export class TaskKeyWithOptionalCollectionDTO {

    @IsUUID()
    @IsDefined()
    @IsNotEmpty()
    public transaction: string

    @IsDefined()
    @IsNotEmpty()
    public _export: Export

    @IsString()
    @IsOptional()
    public _collection?: string

    @IsOptional()
    @IsString()
    @MinLength(2)
    public worker?: string

}

export class Task4RunKeyInputDTO {

    @IsDefined()
    @IsString()
    @MinLength(2)
    public worker: string

}

export class TaskWithWorkerDTO extends OmitType(TaskDTO, ['_export', 'worker'] as const) {

    @IsDefined()
    @IsNotEmpty()
    public _export: Export

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public worker: string

}

export class Task4ScaleValueInputDTO {

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public worker: string

}

export class TaskValue4ErrorValueInputDTO {

    @IsDefined()
    public error: any

}

export class Task4ListInputDTO {

    @IsUUID()
    @IsOptional()
    @ApiProperty({ description: 'transation uuid', required: false })
    public transaction?: string

    @IsString()
    @IsOptional()
    @ApiProperty({ description: 'task export source name', required: false })
    public source?: string

    @IsString()
    @IsOptional()
    @ApiProperty({ description: 'task export target name', required: false })
    public target?: string

    @IsString()
    @IsOptional()
    @ApiProperty({ description: 'task export database name', required: false })
    public database?: string

    @IsString()
    @IsOptional()
    @ApiProperty({ description: 'task collection name', required: false })
    public _collection?: string

    @IsString()
    @IsOptional()
    @ApiProperty({
        description: 'task status',
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

    @IsString()
    @IsOptional()
    @ApiProperty({ description: 'worker scaled to perform task', required: false })
    public worker?: string

}
