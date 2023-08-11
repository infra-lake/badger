import { Filter } from "mongodb"
import { UnsupportedOperationError } from "../exceptions/unsupported-operation.error"
import { ApplicationHelper, ApplicationMode } from "../helpers/application.helper"
import { StampsHelper } from "../helpers/stamps.helper"
import { ThreadHelper } from "../helpers/thread.helper"
import { WorkerHelper } from "../helpers/worker.helper"
import { Regex } from "../regex"
import { BatchIncomingMessage } from "../regex/batch"
import { ExportTaskErrorService } from "./export/task/error.service"
import { ExportTaskFinishService } from "./export/task/finish.service"
import { ExportTask, ExportTaskService } from "./export/task/service"
import { SourceOutput, SourceService } from "./source.service"
import { TargetOutput, TargetService } from "./target.service"


export class WorkloadService {

    public async next(context: BatchIncomingMessage): Promise<Workload | undefined> {

        if (![ApplicationMode.WORKER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError('ExportTaskService.next()')
        }

        const worker = WorkerHelper.CURRENT

        context.logger.debug('worker.name', worker)

        const tasks = Regex.inject(ExportTaskService)
        const filter: Filter<ExportTask> = { worker, status: 'running' }
        const cursor = tasks.find({ context, filter })
        if (!await cursor.hasNext()) {
            context.logger.debug('task does not find for:', filter)
            return
        }
        const task = await cursor.next() as ExportTask
        await cursor.close()
        context.logger.debug('new task was found:', task)

        context.transaction = task.transaction

        const sources = Regex.inject(SourceService)
        const source = await sources.source({ context, task })

        const targets = Regex.inject(TargetService)
        const target = await targets.target({ context, task })

        return new Workload(context, worker, tasks, task, source, target)

    }

}

export class Workload {

    public constructor(
        private readonly context: BatchIncomingMessage,
        private readonly worker: string,
        private readonly service: ExportTaskService,
        private readonly task: ExportTask,
        public readonly source: SourceOutput,
        public readonly target: TargetOutput,
    ) {

    }

    public get name() {
        const from = `${this.source.name}.${this.task.database}.${this.task.collection}`
        const to = this.target.name
        return JSON.stringify({ from, to })
    }

    public get count() { return this.task.count ?? 0 }

    public get date(): Date | undefined { return this.task.date }

    public async update(date: Date, count: number, error?: Error) {

        this.task.date = date
        this.task.count = count
        this.task.error = error

        const id = {
            transaction: this.task.transaction,
            source: this.source.name,
            target: this.target.name,
            database: this.task.database,
            collection: this.task.collection
        }

        const document = {
            status: this.task.status,
            worker: this.task.worker,
            date: this.task.date,
            count: this.task.count,
            error: this.task.error
        }

        await this.service.save({ context: this.context, id, document })

    }

    public async finish() {

        const id = {
            transaction: this.task.transaction,
            source: this.source.name,
            target: this.target.name,
            database: this.task.database,
            collection: this.task.collection
        }

        const document = {
            worker: this.worker,
            date: this.context.date,
            count: this.count
        }

        await this.consolidate()

        this.context.logger.log(`removing temporary data "${this.target.table.temporary.metadata.id}"...`)

        await this.cleanup()

        this.context.logger.log(`removing temporary data was removed successfully!!!`)

        const finish = Regex.inject(ExportTaskFinishService)
        await finish.apply({ context: this.context, id, document })

    }

    private async consolidate() {

        this.context.logger.log(`consolidating temporary data to table "${this.target.table.main.metadata.id}"...`)

        const main = `\`${this.target.table.main.metadata.id.replace(/\:/g, '.').replace(/\./g, '`.`')}\``
        const temporary = `\`${this.target.table.temporary.metadata.id.replace(/\:/g, '.').replace(/\./g, '`.`')}\``

        await this.target.client.query(`
            INSERT ${main} (${StampsHelper.DEFAULT_STAMP_ID}, ${StampsHelper.DEFAULT_STAMP_INSERT}, data, \`hash\`)
            WITH
                temporary AS (
                    SELECT ${StampsHelper.DEFAULT_STAMP_ID}, ${StampsHelper.DEFAULT_STAMP_INSERT}, data, \`hash\`
                    FROM ${temporary}
                ),
                main AS (
                    SELECT ${StampsHelper.DEFAULT_STAMP_ID}, MAX(${StampsHelper.DEFAULT_STAMP_INSERT}) AS ${StampsHelper.DEFAULT_STAMP_INSERT}
                    FROM ${main}
                    GROUP BY ${StampsHelper.DEFAULT_STAMP_ID}
                )
            SELECT temporary.${StampsHelper.DEFAULT_STAMP_ID}, temporary.${StampsHelper.DEFAULT_STAMP_INSERT}, temporary.data, temporary.\`hash\`
            FROM temporary
            WHERE temporary.${StampsHelper.DEFAULT_STAMP_ID} NOT IN (SELECT main.${StampsHelper.DEFAULT_STAMP_ID} FROM main)
                OR \`hash\` <> (
                    SELECT \`hash\`
                    FROM main AS B
                    INNER JOIN ${main} AS C
                            ON C.${StampsHelper.DEFAULT_STAMP_ID} = B.${StampsHelper.DEFAULT_STAMP_ID}
                            AND C.${StampsHelper.DEFAULT_STAMP_INSERT} = B.${StampsHelper.DEFAULT_STAMP_INSERT}
                    WHERE B.${StampsHelper.DEFAULT_STAMP_ID} = temporary.${StampsHelper.DEFAULT_STAMP_ID}
                        AND C.${StampsHelper.DEFAULT_STAMP_ID} = temporary.${StampsHelper.DEFAULT_STAMP_ID}
                )
        `)

        await ThreadHelper.sleep(10000)

        this.context.logger.log(`temporary data was consolidated to table "${this.target.table.main.metadata.id}" successfully!!!`)

    }

    private async cleanup() {

        let exists = false
        try {
            exists = (await this.target.table.temporary.exists())[0]
        } catch (error) {
            exists = false
        }

        if (exists) {
            try { await this.target.table.temporary.delete() } catch (error) { }
            await ThreadHelper.sleep(1000)
            this.cleanup()
        }

    }

    public async error(cause?: any) {

        const id = {
            transaction: this.task.transaction,
            source: this.source.name,
            target: this.target.name,
            database: this.task.database,
            collection: this.task.collection
        }

        const document = {
            worker: this.worker,
            date: this.context.date,
            count: this.count,
            error: cause
        }

        const error = Regex.inject(ExportTaskErrorService)
        await error.apply({ context: this.context, id, document })

    }

}