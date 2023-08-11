import { BigQueryTimestamp } from '@google-cloud/bigquery'
import { createHash } from 'crypto'
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, rmSync } from 'fs'
import { DeserializationHelper } from '../../helpers/deserialization.helper'
import { ObjectHelper } from '../../helpers/object.helper'
import { StampsHelper } from '../../helpers/stamps.helper'
import { ThreadHelper } from '../../helpers/thread.helper'
import { Regex, TransactionalContext } from '../../regex'
import { BatchIncomingMessage, BatchSettings, RegexBatchController } from '../../regex/batch'
import { Workload, WorkloadService } from '../../services/workload.service'

type WorkerPerformInput = { context: BatchIncomingMessage, workload: Workload }
type WorkerRowInput = { chunk: any, date: Date }

export class WorkerBatchController implements RegexBatchController {

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

    public async shutdown(context: TransactionalContext): Promise<void> {

    }

    private async perform({ context, workload }: WorkerPerformInput) {

        const tempdir = './temp'
        const tempfile = 'data.json'

        if (existsSync(tempdir)) {
            rmSync(tempdir, { force: true, recursive: true })
        }
        mkdirSync(tempdir, { recursive: true })

        let count = await workload.source.count()
        if (count <= 0) {
            await workload.finish()
            return
        }

        context.logger.log('starting export task "', JSON.parse(workload.name), '" at "', context.date.toISOString(), '"')

        const fd = openSync(`${tempdir}/${tempfile}`, 'a')

        try {

            const cursor = workload.source.find()
            while (await cursor.hasNext()) {
                const chunk = await cursor.next()
                const row = this.row({ chunk, date: context.date })
                appendFileSync(fd, `${JSON.stringify(row)}\n`, { encoding: 'utf-8' })
            }

        } catch (error) {
            throw error
        } finally {
            try { 
                if (fd !== undefined) { closeSync(fd) } 
            } catch (error) { 
                context.logger.error('error:', error) 
            }
        }

        await workload.target.table.temporary.load(`${tempdir}/${tempfile}`, workload.target.table.temporary.metadata)

        await workload.update(context.date, count)

        rmSync(`${tempdir}/${tempfile}`, { force: true, recursive: true })

        await workload.finish()

        context.logger.log(`exported was successfully finished`)

    }

    private row({ chunk, date }: WorkerRowInput) {

        const data = JSON.stringify(DeserializationHelper.fix(chunk))

        return {
            [StampsHelper.DEFAULT_STAMP_ID]: chunk[StampsHelper.DEFAULT_STAMP_ID].toString(),
            [StampsHelper.DEFAULT_STAMP_INSERT]: new BigQueryTimestamp(date).value,
            data,
            hash: createHash('md5').update(data).digest('hex')
        }

    }

}
