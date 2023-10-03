import { AuthConfigService } from '@badger/common/auth'
import { VoterDTO, VoterHelper } from '@badger/common/voter'
import { type WorkerDTO } from '@badger/workload'
import { HttpService } from '@nestjs/axios'
import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ApiBasicAuth, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { ManagerConfigService } from './manager.config.service'
import { Cron, CronExpression } from '@nestjs/schedule'
import { HTTPClientHelper, URLHelper } from '@badger/common/helper'
import { READINESS_PROBE_PATH } from '@badger/common/health'

@Controller('/manager')
@ApiBasicAuth()
@ApiTags(TargetController.name)
@UseGuards(AuthGuard(AuthConfigService.STRATEGY))
export class TargetController {

    public constructor(
        private readonly config: ManagerConfigService,
        private readonly http: HttpService
    ) { }

    @Get('/voter')
    @Cron(CronExpression.EVERY_MINUTE)
    @ApiResponse({ type: VoterDTO })
    public async voter(@Req() context: Request) {
        const voter = await this.config.getVoter(context)
        try {
            const url = URLHelper.join(voter.url, READINESS_PROBE_PATH)
            await VoterHelper.ping(context, this.http, { url })
            return { url, status: 'ok' }
        } catch (error) {
            return { url: voter.url, status: 'error', error }
        }
    }

    @Get('/worker')
    @Cron(CronExpression.EVERY_MINUTE)
    @ApiResponse({ type: Array<WorkerDTO> })
    public async workers(@Req() context: Request) {
        const voter = await this.config.getVoter(context)
        const url = URLHelper.join(voter.url, '/workers')
        const { data } = await HTTPClientHelper.request(context, this.http, { method: 'GET', url })
        return data
    }

}
