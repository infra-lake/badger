import { BigQueryTimestamp } from '@google-cloud/bigquery'
import bytes from 'bytes'
import { createHash } from 'crypto'
import { DeserializationHelper } from '../../helpers/deserialization.helper'
import { ExportHelper, ExportTaskStatistics, ExportTaskStatisticsLimits } from '../../helpers/export.task.helper'
import { ObjectHelper } from '../../helpers/object.helper'
import { StampsHelper } from '../../helpers/stamps.helper'
import { ThreadHelper } from '../../helpers/thread.helper'
import { Regex, TransactionalContext } from '../../regex'
import { BatchIncomingMessage, BatchSettings, RegexBatchController } from '../../regex/batch'
import { ExportTaskService, ExportTaskServiceNextOutput } from '../../services/export.task.service'
import { WorkerService } from '../../services/worker.service'

type NextInput = { context: BatchIncomingMessage }
type WorkRunInut = { context: BatchIncomingMessage, task: ExportTaskServiceNextOutput }
type WorkerFlushInput = { remaining: number, rows: any[] }
type WorkerInsertInput = { context: TransactionalContext, task: ExportTaskServiceNextOutput, rows: any[], statistics: ExportTaskStatistics }
type WorkerRowInput = { chunk: any, date: Date }

export class WorkerBatchController implements RegexBatchController {

    private limits: ExportTaskStatisticsLimits = { count: 3000, bytes: bytes('13MB') }

    public get settings(): BatchSettings { return {} }

    public async startup(context: TransactionalContext): Promise<void> {

    }

    public async handle(message: BatchIncomingMessage): Promise<void> {

        const task = await this.next({ context: message }) as ExportTaskServiceNextOutput

        let attempt = 0
        const attempts = 5
        let again = false

        do {

            try {

                attempt++

                again = attempt < attempts

                message.logger.log('attempt', attempt, 'of', attempts, 'attempts...')

                await this.perform({ context: message, task })

                again = false

                message.logger.log('attempt', attempt, 'successfully finished')

            } catch (error) {

                message.logger.error('error at attempt', attempt, ':', error)

                if (again) {
                    await ThreadHelper.sleep(2000 * Math.pow(2, attempt))
                } else {
                    try {
                        await task.error(task.count, error)
                    } catch (error) {
                        message.logger.error('another error at attempt', attempt, ':', error)
                    }
                }

            }

        } while (again)

    }

    public async shutdown(context: TransactionalContext): Promise<void> {

    }

    private async next({ context }: NextInput) {

        const workers = Regex.inject(WorkerService)
        const tasks = Regex.inject(ExportTaskService)

        const task = await tasks.next({ context, worker: workers.name() }) as ExportTaskServiceNextOutput

        if (!ObjectHelper.has(task)) {
            return undefined
        }

        return task

    }

    private async perform({ context, task }: WorkRunInut) {

        if (!ObjectHelper.has(task)) { return }

        let count = await task.source.count()
        if (count <= 0) {
            await task.finish((task.count ?? 0))
            return
        }

        context.logger.log('starting export task "', JSON.parse(task.name()), '" at "', context.date.toISOString(), '"')

        const statistics = new ExportTaskStatistics(task, this.limits, count)

        let rows: any[] = []
        const cursor = task.source.find()
        while (await cursor.hasNext()) {

            const chunk = await cursor.next()

            const row = this.row({ chunk, date: context.date })

            rows.push(row)

            if (this.flush({ remaining: --count, rows })) {
                rows = await this.insert({ context, task, rows, statistics })
            }

        }

        await task.finish(task.count)

        context.logger.log(`exported was successfully finished`)

    }

    private row({ chunk, date }: WorkerRowInput) {

        const data = JSON.stringify(DeserializationHelper.fix(chunk))

        return {
            [StampsHelper.DEFAULT_STAMP_ID]: chunk[StampsHelper.DEFAULT_STAMP_ID].toString(),
            [StampsHelper.DEFAULT_STAMP_INSERT]: new BigQueryTimestamp(date),
            [StampsHelper.DEFAULT_STAMP_UPDATE]: chunk[StampsHelper.DEFAULT_STAMP_UPDATE],
            data,
            hash: createHash('md5').update(data).digest('hex')
        }

    }

    private flush({ remaining: total, rows }: WorkerFlushInput) {
        return rows.length > 0 && (total <= 0 || (total % this.limits.count) === 0 || ExportHelper.bytes(rows) > this.limits.bytes)
    }

    private async insert({ context, task, rows, statistics }: WorkerInsertInput) {

        const { count } = task
        const included = rows
        const excluded = [] as WorkerInsertInput['rows']

        while (statistics.simulate({ rows: included, task: { count } }).broken) {
            excluded.push(included.pop())
        }

        const date = included[included.length - 1][StampsHelper.DEFAULT_STAMP_UPDATE]
        included.forEach(row => delete row[StampsHelper.DEFAULT_STAMP_UPDATE])

        await task.target.table.temporary.insert(included)

        task.count = (task.count ?? 0) + included.length
        task.date = date

        await task.update(date, task.count ?? 0)

        statistics.update({ rows: included, task })
        context.logger.log(`flushing ${statistics}...`)

        return excluded

    }

}
