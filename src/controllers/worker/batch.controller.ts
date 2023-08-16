import { BigQueryTimestamp } from '@google-cloud/bigquery'
import bytes from 'bytes'
import { createHash } from 'crypto'
import { appendFileSync, closeSync, existsSync, fstatSync, mkdirSync, openSync, rmSync } from 'fs'
import { DeserializationHelper } from '../../helpers/deserialization.helper'
import { ObjectHelper } from '../../helpers/object.helper'
import { StampsHelper } from '../../helpers/stamps.helper'
import { ThreadHelper } from '../../helpers/thread.helper'
import { WorkerHelper } from '../../helpers/worker.helper'
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

        const tempdir = `./temp/${WorkerHelper.CURRENT}`
        const tempfile = 'data.json'

        if (existsSync(tempdir)) {
            context.logger.debug('deleting temp dir:', tempdir)
            rmSync(tempdir, { force: true, recursive: true })
        }
        context.logger.debug('creating temp dir:', tempdir)
        mkdirSync(tempdir, { recursive: true })

        context.logger.debug('counting documents')
        let count = await workload.source.count()
        if (count <= 0) {
            context.logger.debug('no documents found')
            await workload.finish()
            return
        }
        
        context.logger.debug('updating count on export task...')
        await workload.update(count)
        context.logger.debug('count on task was successfully updated!')

        context.logger.log('starting export task "', JSON.parse(workload.name), '" at "', context.date.toISOString(), '"')

        context.logger.debug('opening temp file:', `${tempdir}/${tempfile}`)
        const fd = openSync(`${tempdir}/${tempfile}`, 'a')

        try {

            context.logger.debug('searching documents...')
            let appends = 0
            const cursor = workload.source.find()
            while (await cursor.hasNext()) {

                const chunk = await cursor.next()

                const row = this.row({ chunk, date: context.date })

                appendFileSync(fd, `${JSON.stringify(row)}\n`, { encoding: 'utf-8' })

                context.logger.debug('append collection to temp file:', `${tempdir}/${tempfile}`)
                appends++
                const statistics = {
                    count: appends,
                    total: count.toLocaleString('pt-BR'),
                    percent: ((appends / count) * 100).toFixed(2),
                    size: bytes(fstatSync(fd).size)
                }

                context.logger.log('append statistics:', statistics.count, 'of', statistics.total, 'rows,', statistics.percent, '%,', statistics.size, ')')

            }

            await cursor.close()

        } catch (error) {
            throw error
        } finally {
            try {
                if (fd !== undefined) { closeSync(fd) }
            } catch (error) {
                context.logger.error('error:', error)
            }
        }

        context.logger.debug('loading documents on temp file to bigquery...')
        await workload.target.table.temporary.load(`${tempdir}/${tempfile}`, workload.target.table.temporary.metadata)
        context.logger.debug('documents load to bigquery successfully!!!')
        
        context.logger.debug('removing temp file:', `${tempdir}/${tempfile}`)
        rmSync(`${tempdir}/${tempfile}`, { force: true, recursive: true })

        await workload.finish()

        context.logger.log(`export task was successfully finished!!!`)

    }

    private row({ chunk, date }: WorkerRowInput) {

        const data = DeserializationHelper.fix(chunk)

        return {
            [StampsHelper.DEFAULT_STAMP_ID]: chunk[StampsHelper.DEFAULT_STAMP_ID].toString(),
            [StampsHelper.DEFAULT_STAMP_INSERT]: new BigQueryTimestamp(date).value,
            data,
            hash: createHash('md5').update(JSON.stringify(data)).digest('hex')
        }

    }

}
