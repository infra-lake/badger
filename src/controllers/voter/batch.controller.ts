import { Regex, TransactionalContext } from '../../regex'
import { BatchIncomingMessage, BatchSettings, RegexBatchController } from '../../regex/batch'
import { Export, ExportService } from '../../services/export.service'
import { ExportTask, ExportTaskService } from '../../services/export.task.service'
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

        if (free.length <= 0) { return }

        const exports = Regex.inject(ExportService)
        const tasks = Regex.inject(ExportTaskService)
        
        const cursor1 = tasks.find({ context: message, filter: { status: 'created' } })
        if (await cursor1.hasNext()) {
            const { transaction, source, target, database, collection } = await cursor1.next() as ExportTask
            const worker = free[Math.floor(Math.random() * free.length)].name
            await tasks.start({ context: message, id: { transaction, source, target, database, collection }, document: { worker } })
            const created = await exports.exists({ filter: { transaction, source, target, database, status: 'created' } })
            if (created) {
                await exports.start({ context: message, id: { transaction, source, target, database } })
            }
        }

        const cursor2 = exports.find({ context: message, filter: { status: 'created' } })
        if(await cursor2.hasNext()) {
            const { transaction, source, target, database } = await cursor2.next() as Export
            const running = await tasks.exists({ context: message, filter: { transaction, source, target, database, status: 'running' } })
            if (running) {
                await exports.start({ context: message, id: { transaction, source, target, database } })
            }
        }

        const cursor3 = exports.find({ context: message, filter: { status: 'running' } })
        if(await cursor3.hasNext()) {
            const { transaction, source, target, database } = await cursor3.next() as Export
            const running = await tasks.exists({ context: message, filter: { transaction, source, target, database, status: 'running' } })
            if (!running) {
                const error = await tasks.exists({ context: message, filter: { transaction, source, target, database, status: 'error' } }) 
                if (error) {
                    await exports.error({ context: message, id: { transaction, source, target, database } })
                }
                const stopped = await tasks.exists({ context: message, filter: { transaction, source, target, database, status: 'stopped' } }) 
                if (!stopped) {
                    await exports.finish({ context: message, id: { transaction, source, target, database } })
                }
            }
        }

    }

    public async shutdown(context: TransactionalContext): Promise<void> {

    }


}