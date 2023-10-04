import { AuthConfigService } from '@badger/common/auth'
import { ObjectHelper } from '@badger/common/helper'
import { TransactionDTO } from '@badger/common/transaction'
import { Target4SearchDTO, TargetDTO, TargetService, type Target } from '@badger/target'
import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Query, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ApiBasicAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'

@Controller('/target')
@ApiBasicAuth()
@ApiTags(TargetController.name)
@UseGuards(AuthGuard(AuthConfigService.STRATEGY))
export class TargetController {

    public constructor(
        private readonly service: TargetService
    ) { }

    @Post()
    @UsePipes(ValidationPipe)
    @ApiBody({ type: TargetDTO, required: true })
    @ApiResponse({ type: Array<TargetDTO> })
    public async post(@Req() context: Request, @Body() dto: TargetDTO) {
        return await this.service.save(context, dto)
    }

    @Delete('/:name')
    @ApiResponse({ type: TransactionDTO })
    public async delete(@Req() context: Request, @Param('name') name: string) {
        return await this.service.delete(context, { name })
    }

    @Get()
    @ApiResponse({ type: Array<TargetDTO> })
    public async list(@Query() filter: Target4SearchDTO) {
        const result = await this.service.list(filter)
        return result.map(({ name, credentials }) => ({ name, credentials }))
    }

    @Get('/:name')
    @ApiResponse({ type: Array<TargetDTO> })
    public async get(@Param('name') name: string) {
        const result = await this.service.get({ name })
        if (ObjectHelper.isNullOrUndefined(result)) {
            throw new NotFoundException('Target not found')
        }
        const { credentials } = result as Target
        return { name, credentials }
    }
}
