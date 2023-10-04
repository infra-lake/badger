import { WindowDTO } from '@badger/common/window/window.dto'
import { PickType } from '@nestjs/swagger'
import { IsDefined, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator'
import { ExportDTO, ExportStatus } from '../export'

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

export class Task4RunKeyInputDTO {

    @IsDefined()
    @IsString()
    @MinLength(2)
    public worker: string

    public isToReturnCurrentRunningTask: boolean

}

export class Task4TerminateInputDTO extends PickType(TaskDTO, ['transaction', '_export', '_collection'] as const) {
    @IsDefined()
    @IsString()
    @MinLength(2)
    public worker: string
}

export class TaskValue4ErrorKeyInputDTO extends PickType(TaskDTO, ['transaction', '_export', '_collection'] as const) { }

export class TaskValue4ErrorValueInputDTO {

    @IsDefined()
    @IsString()
    @MinLength(2)
    public worker: string

    @IsDefined()
    public error: any

}

export class Task4ListInputDTO {

    @IsUUID()
    @IsOptional()
    public transaction?: string

    @IsString()
    @IsOptional()
    public source?: string

    @IsString()
    @IsOptional()
    public target?: string

    @IsString()
    @IsOptional()
    public database?: string

    @IsString()
    @IsOptional()
    public _collection: string

    @IsString()
    @IsOptional()
    public status: ExportStatus

    @IsString()
    @IsOptional()
    public worker?: string

}

export class Task4GetDateOfLastTerminatedInputDTO {

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public source: string

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public target: string

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

}

export class Task4IsAllTerminatedInputDTO {

    @IsUUID()
    @IsDefined()
    @IsNotEmpty()
    public transaction: string

    @IsDefined()
    @IsNotEmpty()
    public _export: ExportDTO

}

export class Task4IsAllTerminateOrErrordInputDTO {

    @IsUUID()
    @IsDefined()
    @IsNotEmpty()
    public transaction: string

    @IsDefined()
    @IsNotEmpty()
    public _export: ExportDTO

}

export class Task4GetCreatedOrRunningInputDTO {

    @IsUUID()
    @IsOptional()
    public transaction?: string

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public source: string

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public target: string

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

    @IsOptional()
    @IsString()
    @MinLength(2)
    public worker?: string

}

export class Task4CountCreatedOrRunningInputDTO {

    @IsUUID()
    @IsOptional()
    public transaction?: string

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public source: string

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public target: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public database: string

    @IsOptional()
    @IsString()
    @MinLength(2)
    public worker?: string

}

export class Task4CountPausedInputDTO {

    @IsUUID()
    @IsOptional()
    public transaction?: string

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public source: string

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public target: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public database: string

}

export class Task4CountErrorInputDTO {

    @IsUUID()
    @IsOptional()
    public transaction?: string

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public source: string

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public target: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public database: string

}

export class Task4IsCreatedInputDTO extends PickType(TaskDTO, ['transaction', '_export', '_collection'] as const) { }

export class Task4ListRunningInputDTO {

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

    @IsOptional()
    @IsString()
    @MinLength(2)
    public worker?: string

}

export class Task4RunOutputDTO {

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

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public worker: string

    @IsOptional()
    error?: any

    @IsOptional()
    count?: number

    @IsOptional()
    window?: WindowDTO

}

export class TaskKey4CreateInputDTO {

    @IsUUID()
    @IsDefined()
    @IsNotEmpty()
    public transaction: string

    @IsDefined()
    @IsNotEmpty()
    public _export: ExportDTO

    @IsString()
    @IsOptional()
    public _collection?: string

}

export class Task4ScaleKeyInputDTO extends PickType(TaskDTO, ['transaction', '_export', '_collection'] as const) { }

export class Task4ScaleValueInputDTO {

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public worker: string

}

export class Task4TerminateKeyInputDTO extends PickType(TaskDTO, ['transaction', '_export', '_collection'] as const) { }

export class Task4TerminateValueInputDTO {

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public worker: string

}
