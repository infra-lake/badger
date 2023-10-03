import { ApiProperty } from '@nestjs/swagger'

export class QueryOptionsDTO {

    @ApiProperty({ description: 'skip', required: false })
    skip?: number

    @ApiProperty({ description: 'limit', required: false })
    limit?: number

    @ApiProperty({ description: 'sort', required: false })
    sort?: any

}

export class QueryDTO {

    @ApiProperty({ description: 'projection', required: false })
    projection?: any

    @ApiProperty({ description: 'limit', type: QueryOptionsDTO, required: false })
    options?: QueryOptionsDTO

}

export class FindDTO {

    @ApiProperty({ description: 'query', type: QueryDTO, required: false })
    query?: QueryDTO

}
