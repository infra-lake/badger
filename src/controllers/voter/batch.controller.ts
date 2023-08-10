import { WorkerHTTPClient } from '../../clients/worker.http.client'
import { Regex, TransactionalContext } from '../../regex'
import { BatchIncomingMessage, BatchSettings, RegexBatchController } from '../../regex/batch'
import { ExportErrorService } from '../../services/export/error.service'
import { ExportFinishService } from '../../services/export/finish.service'
import { Export, ExportService } from '../../services/export/service'
import { ExportStartService } from '../../services/export/start.service'
import { ExportTask, ExportTaskService } from '../../services/export/task/service'
import { WorkerService } from '../../services/worker.service'

export class VoterBatchController implements RegexBatchController {

    public get settings(): BatchSettings { return {} }

    public async startup(context: TransactionalContext): Promise<void> {
        const worker = Regex.inject(WorkerService)
        await worker.load(context)
    }

    public async handle(message: BatchIncomingMessage): Promise<void> {

        const workers = Regex.inject(WorkerService)
        const free = await workers.list({ context: message, filter: { status: 'free' } })
        message.logger.log('free workers:', JSON.stringify(free))

        if (free.length <= 0) { return }

        const exports = Regex.inject(ExportService)
        const tasks = Regex.inject(ExportTaskService)

        const cursor1 = tasks.find({ context: message, filter: { status: 'created' } })
        if (await cursor1.hasNext()) {

            const { transaction, source, target, database, collection } = await cursor1.next() as ExportTask
            const id = { transaction, source, target, database, collection }

            const index = Math.floor(Math.random() * free.length)
            message.logger.log('sorted worker index:', index)
            const worker = free[index].name
            const document = { worker }

            const client = Regex.inject(WorkerHTTPClient)
            await client.start({ context: message, id, document })

        }
        await cursor1.close()

        const cursor2 = exports.find({ context: message, filter: { status: 'created' } })
        if (await cursor2.hasNext()) {

            const { transaction, source, target, database } = await cursor2.next() as Export
            const id = { transaction, source, target, database }

            const running = await tasks.exists({ context: message, filter: { transaction, source, target, database, status: 'running' } })
            if (running) {
                const start = Regex.inject(ExportStartService)
                await start.apply({ context: message, id })
            }

        }
        await cursor2.close()

        const cursor3 = exports.find({ context: message, filter: { status: 'running' } })
        if (await cursor3.hasNext()) {

            const { transaction, source, target, database } = await cursor3.next() as Export
            const running = await tasks.exists({ context: message, filter: { transaction, source, target, database, status: 'running' } })
            if (!running) {
                const error = await tasks.exists({ context: message, filter: { transaction, source, target, database, status: 'error' } })
                if (error) {
                    const errors = Regex.inject(ExportErrorService)
                    await errors.apply({ context: message, id: { transaction, source, target, database } })
                } else {
                    const stopped = await tasks.exists({ context: message, filter: { transaction, source, target, database, status: 'stopped' } })
                    if (!stopped) {
                        const finishs = Regex.inject(ExportFinishService)
                        await finishs.apply({ context: message, id: { transaction, source, target, database } })
                    }
                }
            }
        }
        await cursor3.close()

    }

    public async shutdown(context: TransactionalContext): Promise<void> {

    }


}