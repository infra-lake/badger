import { AuthConfigService } from '@badger/common/auth'
import { ObjectHelper } from '@badger/common/helper'
import { Source4SearchDTO, type SourceDTO, SourceService, type Source, SourceDTO4SaveDTO } from '@badger/source'
import { Body, Controller, Get, NotFoundException, Param, Post, Query, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ApiBasicAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'

@Controller('/source')
@ApiBasicAuth()
@ApiTags(SourceController.name)
@UseGuards(AuthGuard(AuthConfigService.STRATEGY))
export class SourceController {

    public constructor(
        private readonly service: SourceService
    ) { }

    @Post()
    @UsePipes(ValidationPipe)
    @ApiBody({ type: SourceDTO4SaveDTO, required: true })
    @ApiResponse({ type: Array<SourceDTO> })
    public async post(@Req() context: Request, @Body() dto: SourceDTO4SaveDTO) {
        return await this.service.save(context, dto)
    }

    @Get()
    @ApiResponse({ type: Array<SourceDTO> })
    public async list(@Query() filter: Source4SearchDTO) {
        const result = await this.service.list(filter)
        return result.map(({ name, url, filter }) => ({ name, url, filter }))
    }

    @Get('/:name')
    @ApiResponse({ type: Array<SourceDTO> })
    public async get(@Param('name') name: string) {
        const result = await this.service.get({ name })
        if (ObjectHelper.isNullOrUndefined(result)) {
            throw new NotFoundException('source not found')
        }
        const { url, filter } = result as Source
        return { name, url, filter }
    }

}
