import { AuthConfigService } from '@badger/common/auth'
import { ObjectHelper } from '@badger/common/helper'
import { TransactionDTO } from '@badger/common/transaction'
import { Export4CheckInputDTO, Export4CheckOutputDTO, Export4CreateKeyInputDTO, Export4ListInputDTO, Export4PauseInputDTO, Export4PlayInputDTO, Export4RetryInputDTO, ExportService, Task4ListInputDTO, TaskService, type ExportDTO, type TaskDTO } from '@badger/workload'
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
    @ApiBody({ type: Export4CreateKeyInputDTO, required: true })
    @ApiResponse({ type: TransactionDTO })
    public async create(@Req() context: Request, @Body() input: Export4CreateKeyInputDTO) {
        return await this.exportService.create(context, input)
    }

    @Post('/cleanup')
    @ApiResponse({ type: TransactionDTO })
    public async cleanup(@Req() context: Request) {
        return await this.exportService.cleanup(context)
    }

    @Post('/play')
    @ApiResponse({ type: TransactionDTO })
    public async play(@Req() context: Request, @Body() input: Export4PlayInputDTO) {
        return await this.exportService.play(context, input)
    }

    @Post('/pause')
    @ApiResponse({ type: TransactionDTO })
    public async pause(@Req() context: Request, @Body() input: Export4PauseInputDTO) {
        return await this.exportService.pause(context, input)
    }

    @Post('/retry')
    @ApiResponse({ type: TransactionDTO })
    public async retry(@Req() context: Request, @Body() input: Export4RetryInputDTO) {
        return await this.exportService.retry(context, input)
    }

    @Get()
    @ApiResponse({ type: Array<ExportDTO> })
    public async exports(@Query() input: Export4ListInputDTO) {
        const output = await this.exportService.list(input, 'dto')
        return output
    }

    @Get('/tasks')
    @ApiResponse({ type: Array<TaskDTO> })
    public async tasks(@Query() input: Task4ListInputDTO) {
        const output = await this.taskService.list(input)
        return output
    }

    @Get('/check')
    @ApiResponse({ type: Export4CheckOutputDTO })
    public async check(@Query() input: Export4CheckInputDTO) {
        const output = await this.exportService.check(input) as Export4CheckOutputDTO
        if (ObjectHelper.isEmpty(output)) {
            throw new NotFoundException('Export not found')
        }
        const { status } = output
        return { status }
    }

}
