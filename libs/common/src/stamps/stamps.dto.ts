import { PartialType } from '@nestjs/swagger'
import { IsDefined, IsNotEmpty, IsString } from 'class-validator'
import { type IStamps } from './stamps.contract'

export class StampsDTO implements IStamps {

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    id: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    insert: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    update: string

}

export class PartialStampsDTO extends PartialType(StampsDTO) { }
