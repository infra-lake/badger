import { HTTPClientHelper, URLHelper } from '@badger/common/helper'
import { type TransactionalContext } from '@badger/common/transaction'
import { type HttpService } from '@nestjs/axios'
import { READINESS_PROBE_PATH } from '../health'
import { type VoterDTO } from './voter.dto'

export class VoterHelper {

    private constructor() { }

    public static async ping(context: TransactionalContext, http: HttpService, voter: Pick<VoterDTO, 'url'>) {
        const url = URLHelper.join(voter.url, READINESS_PROBE_PATH)
        await HTTPClientHelper.request(context, http, { method: 'GET', url })
    }

}
