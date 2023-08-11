import { BigQueryTimestamp } from '@google-cloud/bigquery'
import bytes from 'bytes'
import { createHash } from 'crypto'
import { DeserializationHelper } from '../../helpers/deserialization.helper'
import { ObjectHelper } from '../../helpers/object.helper'
import { StampsHelper } from '../../helpers/stamps.helper'
import { ThreadHelper } from '../../helpers/thread.helper'
import { ExportHelper, WorkloadLimits, WorkloadStatistics } from '../../helpers/workload.helper'
import { Regex, TransactionalContext } from '../../regex'
import { BatchIncomingMessage, BatchSettings, RegexBatchController } from '../../regex/batch'
import { Workload, WorkloadService } from '../../services/workload.service'

type WorkerPerformInput = { context: BatchIncomingMessage, workload: Workload }
type WorkerFlushInput = { remaining: number, rows: any[] }
type WorkerInsertInput = { context: TransactionalContext, workload: Workload, rows: any[], statistics: WorkloadStatistics }
type WorkerRowInput = { chunk: any, date: Date }

export class WorkerBatchController implements RegexBatchController {

    // bigquery bytes limit docs: https://cloud.google.com/bigquery/quotas#streaming_inserts
    private limits: WorkloadLimits = { bytes: bytes('10MB') }

    public get settings(): BatchSettings { return {} }

    public async startup(context: TransactionalContext): Promise<void> {

    }

    public async handle(message: BatchIncomingMessage): Promise<void> {

        const workloads = Regex.inject(WorkloadService)
        const workload = await workloads.next(message) as Workload

        if (!ObjectHelper.has(workload)) { return }

        let attempt = 0
        const attempts = 5
        let again = false

        do {

            try {

                attempt++

                again = attempt < attempts

                message.logger.log('attempt', attempt, 'of', attempts, 'attempts...')

                await this.perform({ context: message, workload })

                again = false

                message.logger.log('attempt', attempt, 'successfully finished')

            } catch (error) {

                message.logger.error('error at attempt', attempt, ':', error)

                if (again) {
                    await ThreadHelper.sleep(2000 * Math.pow(2, attempt))
                } else {
                    try {
                        await workload.error(error)
                    } catch (error) {
                        message.logger.error('another error at attempt', attempt, ':', error)
                    }
                }

            }

        } while (again)

    }

    private isTooLarge(error: any) {
        return (error?.code ?? 0) === 413
    }

    public async shutdown(context: TransactionalContext): Promise<void> {

    }

    private async perform({ context, workload }: WorkerPerformInput) {

        let count = await workload.source.count()
        if (count <= 0) {
            await workload.finish()
        }

        context.logger.log('starting export task "', JSON.parse(workload.name), '" at "', context.date.toISOString(), '"')

        const statistics = new WorkloadStatistics(workload, this.limits, count)

        let rows: any[] = []
        const cursor = workload.source.find()
        while (await cursor.hasNext()) {

            const chunk = await cursor.next()

            const row = this.row({ chunk, date: context.date })

            rows.push(row)

            if (this.flush({ remaining: --count, rows })) {
                rows = await this.insert({ context, workload: workload, rows, statistics })
            }

        }

        await workload.finish()

        context.logger.log(`exported was successfully finished`)

        return true

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

    private flush({ remaining, rows }: WorkerFlushInput) {
        const bytes = ExportHelper.bytes(rows)
        return rows.length > 0 && (remaining <= 0 || bytes > this.limits.bytes)
    }

    private async insert({ context, workload, rows, statistics }: WorkerInsertInput): Promise<WorkerInsertInput['rows']> {

        const { count } = workload
        const included = rows
        const excluded = [] as WorkerInsertInput['rows']


        while (statistics.simulate({ rows: included, task: { count } }).broken) {
            excluded.push(included.pop())
        }

        const date = included[included.length - 1][StampsHelper.DEFAULT_STAMP_UPDATE]
        included.forEach(row => delete row[StampsHelper.DEFAULT_STAMP_UPDATE])

        try {
            await workload.target.table.temporary.insert(included)
            this.limits.bytes = this.limits.bytes * 1.1
        } catch (error) {
            if (this.isTooLarge(error)) {
                this.limits.bytes = this.limits.bytes * 0.9
                return await this.insert({ context, workload, rows, statistics })
            }
            throw error
        }

        await workload.update(date, count + included.length)

        statistics.update({ rows: included, task: workload })
        context.logger.log(`flushing ${statistics}...`)

        return excluded

    }

}
