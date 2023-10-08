import { ApplicationHelper, HTTPClientHelper, URLHelper } from '@badger/common/helper'
import { type TransactionalContext } from '@badger/common/transaction'
import { type Worker4SearchDTO, type WorkerDTO } from '@badger/workload'
import { HttpService } from '@nestjs/axios'
import { Injectable } from '@nestjs/common'
import { ManagerConfigService } from './manager.config.service'
import { VoterHelper } from '@badger/common/voter'
import { READINESS_PROBE_PATH } from '@badger/common/health'

@Injectable()
export class ManagerService {

    constructor(
        private readonly config: ManagerConfigService,
        private readonly http: HttpService
    ) { }

    public async getVoter(context: TransactionalContext) {
        const voter = await this.config.getVoter(context)
        try {
            const url = URLHelper.join(voter.url, READINESS_PROBE_PATH)
            await VoterHelper.ping(context, this.http, { url })
            return { url, status: 'ok' }
        } catch (error) {
            return { url: voter.url, status: 'error', error }
        }
    }

    public async getWorkers(context: TransactionalContext, input: Worker4SearchDTO) {

        const voter = await this.config.getVoter(context)

        const url = URLHelper.join(voter.url, ApplicationHelper.BASE_API_PATH, '/voter/worker')

        const { data: output } = await HTTPClientHelper.request<WorkerDTO[]>(context, this.http, {
            method: 'GET',
            url,
            params: input
        })

        return output

    }
}
