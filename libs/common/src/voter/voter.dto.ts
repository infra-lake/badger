import { ApiProperty } from '@nestjs/swagger'

export class VoterDTO {

    @ApiProperty({ description: 'url to access voter' })
    url: string

}
