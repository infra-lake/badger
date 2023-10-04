import { AuthConfigService } from '@badger/common/auth'
import { ObjectHelper } from '@badger/common/helper'
import { TransactionDTO } from '@badger/common/transaction'
import { Export4CheckInputDTO, Export4CheckOutputDTO, Export4CreateKeyInputDTO, Export4ListInputhDTO, type ExportDTO, ExportService, Export4PlayInputDTO } from '@badger/workload'
import { Body, Controller, Get, Inject, NotFoundException, Post, Query, Req, UseGuards, UsePipes, ValidationPipe, forwardRef } from '@nestjs/common'
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

    @Post()
    @UsePipes(ValidationPipe)
    @ApiBody({ type: Export4CreateKeyInputDTO, required: true })
    @ApiResponse({ type: TransactionDTO })
    public async create(@Req() context: Request, @Body() input: Export4CreateKeyInputDTO) {
        return await this.service.create(context, input)
    }

    @Get('/cleanup')
    @ApiResponse({ type: TransactionDTO })
    public async cleanup(@Req() context: Request) {
        return await this.service.cleanup(context)
    }

    @Post('/play')
    @ApiResponse({ type: TransactionDTO })
    public async play(@Req() context: Request, @Body() input: Export4PlayInputDTO) {
        return await this.service.play(context, input)
    }

    @Get()
    @ApiResponse({ type: Array<ExportDTO> })
    public async list(@Query() input: Export4ListInputhDTO) {
        const output = await this.service.list(input)
        return output
    }

    @Get('/check')
    @ApiResponse({ type: Export4CheckOutputDTO })
    public async check(@Query() input: Export4CheckInputDTO) {
        const output = await this.service.check(input) as Export4CheckOutputDTO
        if (ObjectHelper.isEmpty(output)) {
            throw new NotFoundException('Export not found')
        }
        const { status } = output
        return { status }
    }

}
