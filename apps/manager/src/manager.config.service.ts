import { ObjectHelper } from '@badger/common/helper'
import { type TransactionalContext } from '@badger/common/transaction'
import { VoterHelper, type VoterDTO } from '@badger/common/voter'
import { HttpService } from '@nestjs/axios'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export const DEFAULT_MANAGER_PORT = '3000'

@Injectable()
export class ManagerConfigService {

    constructor(
        private readonly config: ConfigService,
        private readonly http: HttpService
    ) { }

    public get port(): string {
        return this.config.get('MANAGER_PORT', DEFAULT_MANAGER_PORT)
    }

    private voter: VoterDTO
    public async getVoter(context: TransactionalContext) {
        if (ObjectHelper.isEmpty(this.voter)) {
            const _voter = JSON.parse(this.config.getOrThrow<string>('VOTER')) as VoterDTO
            await VoterHelper.ping(context, this.http, _voter)
            this.voter = _voter
        }
        return this.voter
    }
}
