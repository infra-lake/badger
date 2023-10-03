import { AuthConfigService } from '@badger/common/auth'
import { ObjectHelper } from '@badger/common/helper'
import { Export4CreateDTO, Export4SearchDTO, ExportDTO, ExportService, type Export } from '@badger/workload'
import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Query, Req, UseGuards, UsePipes, ValidationPipe, forwardRef } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ApiBasicAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'

@Controller('/export')
@ApiBasicAuth()
@ApiTags(ExportController.name)
@UseGuards(AuthGuard(AuthConfigService.STRATEGY))
export class ExportController {

    public constructor(
        @Inject(forwardRef(() => ExportService)) private readonly service: ExportService
    ) { }

    @Post('/create')
    @UsePipes(ValidationPipe)
    @ApiBody({ type: Export4CreateDTO, required: true })
    @ApiResponse({ type: ExportDTO })
    public async post(@Req() context: Request, @Body() dto: Export4CreateDTO) {
        return await this.service.create(context, dto)
    }

    @Get()
    @ApiResponse({ type: Array<ExportDTO> })
    public async list(@Query() filter: Export4SearchDTO) {
        const result = await this.service.list(filter)
        return result.map(({ transaction, source, target, database, status }) => ({ transaction, source, target, database, status }))
    }

    @Get('/:transaction')
    @ApiResponse({ type: ExportDTO })
    public async get(@Param('transaction') transaction: string) {
        const result = await this.service.getByTransaction(transaction)
        if (ObjectHelper.isNullOrUndefined(result)) {
            throw new NotFoundException('Export not found')
        }
        const { source, target, database, status } = result as Export
        return { transaction, source, target, database, status }
    }
}
