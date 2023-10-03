import { WindowDTO } from '@badger/common/window/window.dto'
import { IntersectionType, OmitType, PartialType, PickType } from '@nestjs/swagger'
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

export class TaskKeyDTO extends PickType(TaskDTO, ['transaction', '_export', '_collection'] as const) { }

export class TaskKey4GetDateOfLastTerminatedInputDTO extends PickType(TaskKeyDTO, ['_collection']) {

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public sourceName: string

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public targetName: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public database: string

}

class RequiredTaskWorkerDTO {
    @IsDefined()
    @IsString()
    @MinLength(2)
    public worker: string
}

class RequiredTaskErrorDTO {
    @IsOptional()
    public error: any
}

export class TaskKey4CreateInputDTO extends IntersectionType(
    OmitType(TaskKeyDTO, ['_collection'] as const),
    PartialType(PickType(TaskKeyDTO, ['_collection'] as const))
) { }

export class TaskValue4ErrorInputDTO extends IntersectionType(
    PickType(RequiredTaskWorkerDTO, ['worker'] as const),
    PickType(RequiredTaskErrorDTO, ['error'] as const)
) { }

export class Task4GetCreatedOrRunningInputDTO extends IntersectionType(
    PickType(TaskKeyDTO, ['_collection'] as const),
    PartialType(PickType(TaskDTO, ['transaction', 'worker'] as const))
) {

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public sourceName: string

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public targetName: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public database: string

}
export class Task4CountCreatedOrRunningInputDTO extends OmitType(Task4GetCreatedOrRunningInputDTO, ['_collection'] as const) { }

export class Task4CountPausedInputDTO extends PartialType(PickType(TaskDTO, ['transaction'] as const)) {

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public sourceName: string

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public targetName: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public database: string

}

export class Task4IsScaledKeyInputDTO extends IntersectionType(PickType(TaskDTO, ['transaction', '_collection'] as const), RequiredTaskWorkerDTO) {

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public sourceName: string

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public targetName: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    public database: string

}

export class Task4SearchInputDTO extends PartialType(TaskDTO) { }
export class TaskKey4RunInputDTO extends RequiredTaskWorkerDTO {
    isToReturnCurrentRunningTask: boolean
}
export class Task4RunOutputDTO extends IntersectionType(TaskDTO, RequiredTaskWorkerDTO) { }
export class TaskValue4ScaleInputDTO extends PickType(RequiredTaskWorkerDTO, ['worker'] as const) { }
export class TaskValue4TerminateInputDTO extends PickType(RequiredTaskWorkerDTO, ['worker'] as const) { }
export class Task4TerminateInputDTO extends IntersectionType(TaskKeyDTO, TaskValue4TerminateInputDTO) { }
export class Task4IsAllTerminatedInputDTO extends OmitType(TaskKeyDTO, ['_collection'] as const) { }
export class Task4IsAllTerminateOrErrordInputDTO extends OmitType(TaskKeyDTO, ['_collection'] as const) { }
export class Task4IsOrGetRunningInputDTO extends IntersectionType(TaskKeyDTO, PartialType(PickType(TaskDTO, ['worker'] as const))) { }
