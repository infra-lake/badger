import { BigQuery, BigQueryTimestamp, Table } from '@google-cloud/bigquery'
import { createHash } from 'crypto'
import { MongoClient } from 'mongodb'
import { ExportHelper, ExportStatistics } from '../helpers/export.helper'
import { MongoDBHelper } from '../helpers/mongodb.helper'
import { ObjectHelper } from '../helpers/object.helper'
import { StampsHelper } from '../helpers/stamps.helper'
import { Regex, TransactionalContext, Worker } from '../regex'
import { Export, ExportService, ExportServiceLimits } from '../services/export.service'
import { Ingested, IngestedService } from '../services/ingested.service'
import { Source, SourceService } from '../services/source.service'

type ExportWorkerSource = { client: MongoClient, database: string, collection: string, filter: any }
type ExportWorkerTarget = { client: BigQuery, dataset: string, table: { main: Table, temporary: Table } }
type ExportWorkerInsertInput = { table: Table, rows: any[], ingested: Ingested }
type ExportWorkerFlushInput = { remaining: number, rows: any[] }

export class ExportWorker extends Worker {

    private statistics?: ExportStatistics = undefined

    public constructor(
        private readonly _context: TransactionalContext,
        private readonly _input: Export
    ) { super() }

    public get name(): string {
        const name = ExportWorker.name
        const from = `${this.input.source.name}.${this.input.source.database}.${this.input.source.collection}`
        const to = this.input.target.name
        return JSON.stringify({ name, from, to })
    }

    public get context() { return this._context }
    public get input() { return this._input }
    protected get logger() { return this.context.logger }
    protected get attempts() { return this.input.settings.attempts }
    private get stamps() { return this.input.settings.stamps }
    private get window() { return this.input.window }

    private get limits(): ExportServiceLimits {

        const service = Regex.inject(ExportService)
        const { count, bytes } = service.limits()

        if (this.input.settings.limit > count) {
            return { count, bytes }
        }

        return { count: this.input.settings.limit, bytes }

    }

    protected async perform() {

        let source: ExportWorkerSource | undefined = undefined
        let target: ExportWorkerTarget | undefined = undefined

        try {

            const now = new Date()
            this.logger.log('starting export task"', JSON.parse(this.name), '" at "', now.toISOString(), '"')

            source = await this.source()
            target = await this.target()

            let count = await MongoDBHelper.count(source)

            if(count <= 0) {
                this.logger.log('there aren\'t rows to export')
                return
            }

            this.logger.log(`exporting ${count.toLocaleString('pt-BR')} row(s)...`)

            const ingested = await this.ingested()

            this.statistics = new ExportStatistics(target.table.temporary, this.limits, count, ingested)

            let rows: any[] = []

            const cursor = MongoDBHelper.find(source)
            while (await cursor.hasNext()) {

                const document = await cursor.next()

                const row = this.row(document, now)

                if (!ingested.hashs.includes(row.hash)) {
                    rows.push(row)
                    ingested.hashs.push(row.hash)
                }

                if (this.flush({ remaining: --count, rows })) {
                    rows = await this.insert({ table: target.table.temporary, rows, ingested })
                }

            }

            await this.consolidate(target)

            this.logger.log(`exported was successfully finished`)

        } catch (error) {

            this.logger.error(`error on export:\n\t${error}`)
            throw error

        }

    }

    private async source(): Promise<ExportWorkerSource> {

        const service = Regex.inject(SourceService)

        const { name, database, collection } = this.input.source

        const { url } = await service.find({ name }).next() as Source

        const client = new MongoClient(url)

        const filter = ExportService.filter(this.stamps, this.window)

        return { client, database, collection, filter }

    }

    private async target(): Promise<ExportWorkerTarget> {

        const transaction = this.input.transaction

        const service = Regex.inject(ExportService)

        const source = this.input.source
        const dataset = service.dataset({ prefix: this.stamps.dataset.name, database: source.database })

        const target = this.input.target
        const client = await service.bigquery(target)
        const prefix = this.stamps.dataset.name
        const main = await service.table({ client, transaction, source, prefix, type: 'main', create: true }) as Table
        const temporary = await service.table({ client, transaction, source, prefix, type: 'temporary', create: true }) as Table

        return { client, dataset, table: { main, temporary } }

    }

    private async ingested() {

        const service = Regex.inject(IngestedService)

        const { transaction, source, target } = this.input

        const cursor = service.find({ transaction, source, target })

        let ingested = null

        if (await cursor.hasNext()) {
            ingested = await cursor.next()
        }

        if (!ObjectHelper.has(ingested)) {
            ingested = { transaction, source, target, hashs: [] }
            await service.save(ingested)
        }

        if ((ingested?.hashs.length ?? 0) > 0) {
            this.logger.log(`${ingested?.hashs.length.toLocaleString('pt-BR')} row(s) already ingested...`)
        }

        return ingested as Ingested

    }

    private flush({ remaining: total, rows }: ExportWorkerFlushInput) {
        return rows.length > 0 && (total <= 0 || (total % this.limits.count) === 0 || ExportHelper.bytes(rows) > this.limits.bytes)
    }

    private async insert({ table, rows, ingested }: ExportWorkerInsertInput) {

        const { hashs } = ingested

        const included = { rows, hashs }
        const excluded = { rows: [] as any[], hashs: [] as string[] }

        while (this.statistics?.simulate({ rows: included.rows, ingested }).broken) {
            excluded.rows.push(included.rows.pop())
            excluded.hashs.push(included.hashs.pop() as string)
        }

        await table.insert(included.rows)

        const service = Regex.inject(IngestedService)
        ingested.hashs = included.hashs
        await service.save(ingested)

        ingested.hashs.push(...excluded.hashs)

        this.statistics?.update({ rows: included.rows, ingested })
        this.logger.log(`flushing ${this.statistics}...`)

        return excluded.rows

    }

    private row(chunk: any, date: Date) {

        const data = JSON.stringify(this.fix(chunk))

        return {
            [StampsHelper.DEFAULT_STAMP_ID]: chunk[this.stamps.id].toString(),
            [StampsHelper.DEFAULT_STAMP_INSERT]: new BigQueryTimestamp(date),
            data,
            hash: createHash('md5').update(data).digest('hex')
        }

    }

    private fix(object: any): any {

        if (!ObjectHelper.has(object)) {
            return object
        }

        if (Array.isArray(object)) {
            return object.map(item => this.fix(item))
        }

        if (typeof object === 'object') {

            Object.keys(object).forEach(key => {

                if (key.trim() === '') {
                    const value = object[key]
                    delete object[key]
                    object['__empty__'] = this.fix(value)
                    return
                }

                object[key] = this.fix(object[key])

            })

            return object

        }

        return object

    }

    private async consolidate(target: ExportWorkerTarget) {

        this.logger.log(`consolidating temporary data to table "${target.table.main.metadata.id}"...`)

        const main = `\`${target.table.main.metadata.id.replace(/\:/g, '.').replace(/\./g, '`.`')}\``
        const temporary = `\`${target.table.temporary.metadata.id.replace(/\:/g, '.').replace(/\./g, '`.`')}\``

        await target.client.query(`
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

    }

}