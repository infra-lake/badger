import { ApiProperty } from '@nestjs/swagger'
import { IsDefined, IsNotEmpty, IsUUID } from 'class-validator'

export class TransactionDTO {

    @IsUUID()
    @IsDefined()
    @IsNotEmpty()
    @ApiProperty({ description: 'transation uuid' })
    public transaction: string

}
