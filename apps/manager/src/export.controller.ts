import { AuthConfigService } from '@badger/common/auth'
import { ObjectHelper } from '@badger/common/helper'
import { TransactionDTO } from '@badger/common/transaction'
import { Export4CheckOutputDTO, Export4FlatKeyDTO, Export4FlatKeyWithoutTransactionDTO, Export4ListInputDTO, type ExportDTO, ExportService, Task4ListInputDTO, type TaskDTO, TaskService } from '@badger/workload'
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
        @Inject(forwardRef(() => ExportService)) private readonly exportService: ExportService,
        @Inject(forwardRef(() => TaskService)) private readonly taskService: TaskService
    ) { }

    @Post('/create')
    @UsePipes(ValidationPipe)
    @ApiBody({ type: Export4FlatKeyWithoutTransactionDTO, required: true })
    @ApiResponse({ type: TransactionDTO })
    public async create(@Req() context: Request, @Body() input: Export4FlatKeyWithoutTransactionDTO) {
        return await this.exportService.create(context, input)
    }

    @Post('/cleanup')
    @ApiResponse({ type: TransactionDTO })
    public async cleanup(@Req() context: Request) {
        return await this.exportService.cleanup(context)
    }

    @Post('/play')
    @ApiResponse({ type: TransactionDTO })
    public async play(@Req() context: Request, @Body() input: Export4FlatKeyDTO) {
        return await this.exportService.play(context, input)
    }

    @Post('/pause')
    @ApiResponse({ type: TransactionDTO })
    public async pause(@Req() context: Request, @Body() input: Export4FlatKeyDTO) {
        return await this.exportService.pause(context, input)
    }

    @Post('/retry')
    @ApiResponse({ type: TransactionDTO })
    public async retry(@Req() context: Request, @Body() input: Export4FlatKeyDTO) {
        return await this.exportService.retry(context, input)
    }

    @Get()
    @ApiResponse({ type: Array<ExportDTO> })
    public async exports(@Req() context: Request, @Query() input: Export4ListInputDTO) {
        const output = await this.exportService.list(context, input, 'dto')
        return output
    }

    @Get('/tasks')
    @ApiResponse({ type: Array<TaskDTO> })
    public async tasks(@Req() context: Request, @Query() input: Task4ListInputDTO) {
        const output = await this.taskService.list(context, input)
        return output
    }

    @Get('/check')
    @ApiResponse({ type: Export4CheckOutputDTO })
    public async check(@Req() context: Request, @Query() input: Export4FlatKeyDTO) {
        const output = await this.exportService.check(context, input) as Export4CheckOutputDTO
        if (ObjectHelper.isEmpty(output)) {
            throw new NotFoundException('Export not found')
        }
        const { status } = output
        return { status }
    }

}
