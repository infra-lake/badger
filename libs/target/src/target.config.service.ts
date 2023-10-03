import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export const DEFAULT_TARGET_DATASET_NAME_PREFIX = 'raw_mongodb_'

@Injectable()
export class TargetConfigService {

    constructor(
        private readonly config: ConfigService
    ) { }

    public getTargetDataSetNamePrefix() {
        return this.config.get<string>('TARGET_DATASET_NAME_PREFIX', DEFAULT_TARGET_DATASET_NAME_PREFIX).toString()
    }

}
