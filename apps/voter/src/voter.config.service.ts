import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export const DEFAULT_MANAGER_PORT = '3000'

@Injectable()
export class VoterConfigService {

    constructor(
        private readonly config: ConfigService
    ) { }

    public get port(): string {
        return this.config.get('VOTER_PORT', DEFAULT_MANAGER_PORT)
    }

}
