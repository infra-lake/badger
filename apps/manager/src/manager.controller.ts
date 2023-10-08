import { AuthConfigService } from '@badger/common/auth'
import { VoterDTO } from '@badger/common/voter'
import { Worker4SearchDTO, type WorkerDTO } from '@badger/workload'
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Cron, CronExpression } from '@nestjs/schedule'
import { ApiBasicAuth, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { ManagerService } from './manager.service'

@Controller()
@ApiBasicAuth()
@ApiTags(ManagerController.name)
@UseGuards(AuthGuard(AuthConfigService.STRATEGY))
export class ManagerController {

    public constructor(private readonly service: ManagerService) { }

    @Get('/voter')
    @Cron(CronExpression.EVERY_MINUTE)
    @ApiResponse({ type: VoterDTO })
    public async voter(@Req() context: Request) {
        const output = await this.service.getVoter(context)
        return output
    }

    @Get('/worker')
    @Cron(CronExpression.EVERY_MINUTE)
    @ApiResponse({ type: Array<WorkerDTO> })
    public async exports(@Req() context: Request, @Query() input: Worker4SearchDTO) {
        const output = await this.service.getWorkers(context, input)
        return output
    }

}
