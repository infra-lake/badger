import { ApiProperty } from '@nestjs/swagger'
import { type IWindow } from './window.contract'
import { IsDate, IsDefined, IsNotEmpty } from 'class-validator'

export class WindowDTO implements IWindow {

    @IsDate()
    @IsDefined()
    @IsNotEmpty()
    @ApiProperty({ description: 'start date' })
    begin: Date

    @IsDate()
    @IsDefined()
    @IsNotEmpty()
    @ApiProperty({ description: 'finish date' })
    end: Date

}
