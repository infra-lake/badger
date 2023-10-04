import { ApiProperty, PartialType } from '@nestjs/swagger'
import { IsDefined, IsNotEmpty, IsString } from 'class-validator'
import { type IStamps } from './stamps.contract'

export class StampsDTO implements IStamps {

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @ApiProperty({ description: 'name of id property of each document' })
    id: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @ApiProperty({ description: 'name of insert property of each document' })
    insert: string

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @ApiProperty({ description: 'name of update property of each document' })
    update: string

}

export class PartialStampsDTO extends PartialType(StampsDTO) { }
