import { ConfigService } from '@nestjs/config'
import { NestHelper } from '../helper/nest.helper'
import { type PartialStampsDTO } from './stamps.dto'
import { type IStamps } from './stamps.contract'
import { CollectionHelper } from '../helper'

export class StampsHelper {

    private constructor() { }

    public static get DEFAULT_STAMP_ID() {
        const config = NestHelper.get(ConfigService)
        return config.get<string>('DEFAULT_STAMP_ID', '_id')
    }

    public static get DEFAULT_STAMP_INSERT() {
        const config = NestHelper.get(ConfigService)
        return config.get<string>('DEFAULT_STAMP_INSERT', 'createdAt')
    }

    public static get DEFAULT_STAMP_UPDATE() {
        const config = NestHelper.get(ConfigService)
        return config.get<string>('DEFAULT_STAMP_UPDATE', 'updatedAt')
    }

    public static mergeOrDefault(...stampss: Array<PartialStampsDTO | undefined>): IStamps {

        const defaultStamps: IStamps = {
            id: StampsHelper.DEFAULT_STAMP_ID,
            insert: StampsHelper.DEFAULT_STAMP_INSERT,
            update: StampsHelper.DEFAULT_STAMP_UPDATE
        }

        if (CollectionHelper.isEmpty(stampss)) {
            return defaultStamps
        }

        return stampss.reduce((result, stamps) => ({
            id: stamps?.id ?? result?.id ?? defaultStamps.id,
            insert: stamps?.insert ?? result?.insert ?? defaultStamps.insert,
            update: stamps?.update ?? result?.update ?? defaultStamps.update
        }), defaultStamps) as IStamps

    }

}
