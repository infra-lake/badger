import { HTTPClientHelper, NestHelper, URLHelper } from '@badger/common/helper'
import { type TransactionalContext } from '@badger/common/transaction'
import { type HttpService } from '@nestjs/axios'
import { type IWorker } from './worker.contract'
import { READINESS_PROBE_PATH } from '@badger/common/health'
import { TransactionalLoggerService } from '@badger/common/logging'

export class WorkerHelper {

    private constructor() { }

    public static async ping(context: TransactionalContext, http: HttpService, workers: Array<Pick<IWorker, 'url'>>) {
        await Promise.all(workers.map(async (worker) => {
            URLHelper.validate(worker.url)
            const url = URLHelper.join(worker.url, READINESS_PROBE_PATH)
            await HTTPClientHelper.request(context, http, { method: 'GET', url })
        }))
    }

    public static sortOne(context: TransactionalContext, workers: IWorker[]) {
        const logger = NestHelper.get(TransactionalLoggerService)
        const result = workers[Math.floor(Math.random() * workers.length)]
        logger.log(WorkerHelper.name, context, 'sorted worker', result)
        return result
    }

}
