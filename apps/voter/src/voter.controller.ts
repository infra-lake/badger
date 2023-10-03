import { AuthConfigService } from '@badger/common/auth'
import { TransactionHelper } from '@badger/common/transaction'
import { TaskService, Worker4SearchDTO, WorkerService, type WorkerDTO } from '@badger/workload'
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Cron, CronExpression } from '@nestjs/schedule'
import { ApiBasicAuth, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'

@Controller('/voter')
@ApiBasicAuth()
@ApiTags(VoterController.name)
@UseGuards(AuthGuard(AuthConfigService.STRATEGY))
export class VoterController {

    public constructor(
        private readonly workerService: WorkerService,
        private readonly taskService: TaskService
    ) { }

    @Cron(CronExpression.EVERY_MINUTE)
    @Get('/worker')
    @ApiResponse({ type: Array<WorkerDTO> })
    public async workers(@Req() context: Request, @Query() filter: Worker4SearchDTO) {
        const _context = context ?? TransactionHelper.newTransactionalContext()
        return await this.workerService.list(_context, filter)
    }

    @Cron(CronExpression.EVERY_MINUTE)
    public async scale() {
        const context = TransactionHelper.newTransactionalContext()
        await this.taskService.scale(context)
    }

}
