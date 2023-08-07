import { ObjectHelper } from '../helpers/object.helper'
import { ThreadHelper } from '../helpers/thread.helper'
import { TransactionalContext } from './context'
import { Regex, RegexField } from './ioc'
import { Logger } from './logger'

export interface BatchIncomingMessage extends TransactionalContext {
    date: Date
}

export type BatchSettings = { sleep?: number | undefined }

export interface RegexBatchController {
    get settings(): BatchSettings
    handle(message: BatchIncomingMessage): Promise<void> | void
    startup?(context: TransactionalContext): Promise<void> | void
    shutdown?(context: TransactionalContext): Promise<void> | void
}

export type BatchManagerStartInput = { controller: RegexBatchController, message: BatchIncomingMessage }

export class BatchManager {

    private stopped: boolean = true

    public async start() {

        const logger = Regex.register(Logger)

        try {

            const controllers = Regex.controllers('batch') as Array<RegexBatchController>
            await Promise.all(controllers.map(async (controller) => {
                await this.startup(controller)
                this.run(controller)
            }))

        } catch (error) {
            logger.error('error:', error)
            await this.stop()
        } finally {
            Regex.unregister(logger)
        }

    }

    public async stop() {
        this.stopped = true
    }

    private async run(controller: RegexBatchController): Promise<void> {

        const logger = Regex.register(Logger)
        const { transaction } = logger

        try {

            const message: BatchIncomingMessage = {
                get transaction() { return logger.transaction },
                set transaction(value: string) {
                    logger.transaction = `${logger.transaction} ${value}`
                },
                logger,
                date: new Date()
            }

            if (this.stopped) {

                try {
                    if (ObjectHelper.has(controller.shutdown)) {
                        await this.shutdown(controller)
                    }
                } catch (error) {
                    message.logger.error('error:', error)
                }

                message.logger.log('batch controller stopped')
                return
            }

            await ThreadHelper.sleep(controller.settings?.sleep ?? 1000)
            console.log('running controller', (controller as any)[RegexField.TYPE], '...')
            await controller.handle(message)
            await this.run(controller)

        } catch (error) {
            throw error
        } finally {
            Regex.unregister(logger)
        }

    }

    private async startup(controller: RegexBatchController) {

        const logger = Regex.register(Logger)
        const { transaction } = logger

        try {

            logger.log('starting batch controller', (controller as any)[RegexField.TYPE])

            const message = { transaction, logger }

            await controller.startup?.(message)

            this.stopped = false

        } catch (error) {
            throw error
        } finally {
            Regex.unregister(logger)
        }

    }

    private async shutdown(controller: RegexBatchController) {

        const logger = Regex.register(Logger)
        const { transaction } = logger

        try {

            const message = { transaction, logger }

            await controller.shutdown?.(message)

        } catch (error) {
            logger.error('error:', error)
        } finally {
            Regex.unregister(logger)
        }
    }

}
export type BatchBootstrapOutput = { manager: BatchManager }

export class Batch {
    public static async bootstrap(): Promise<BatchBootstrapOutput> {
        const manager = new BatchManager()
        return { manager }
    }
}