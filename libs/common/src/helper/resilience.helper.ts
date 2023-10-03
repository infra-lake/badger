import { TransactionalLoggerService } from '../logging'
import { type TransactionalContext } from '../transaction'
import { NestHelper } from './nest.helper'
import { ThreadHelper } from './thread.helper'

export class ResilienceHelper {

    private constructor() { }

    public static async tryToRun(context: TransactionalContext, attempts: number, method: (context: TransactionalContext, ...params: any) => Promise<void>, ...args: any) {

        const logger = NestHelper.get(TransactionalLoggerService)

        let attempt = 0

        let tryAgain = false

        do {

            try {

                await method(context, ...args)

                tryAgain = false

            } catch (error) {

                tryAgain = ++attempt < attempts

                logger.error(method.name, context, 'error', error, { attempts, attempt, tryAgain })

                if (!tryAgain) { throw error }

                await ThreadHelper.sleep(2000 * Math.pow(2, attempt))

            }

        } while (tryAgain)

    }

}
