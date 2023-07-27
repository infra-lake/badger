import { Table } from '@google-cloud/bigquery'
import bytes from 'bytes'
import sizeof from 'object-sizeof'
import { Ingested } from '../services/ingested.service'

export type ExportWorkerStatisticsRemaining = { count: number }
export type ExportWorkerStatisticsIngested = { count: number, bytes: number, percent: number }
export type ExportWorkerStatisticsCurrent = { count: number, bytes: number }
export type ExportWorkerStatisticsUpdateInput = { rows: any[], ingested: Ingested }
export type ExportStatisticsLimits = { count: number, bytes: number }

export class ExportStatistics {

    private _remaining: ExportWorkerStatisticsRemaining
    private _ingested: ExportWorkerStatisticsIngested = { count: 0, bytes: 0, percent: 0 }
    private _current: ExportWorkerStatisticsCurrent = { count: 0, bytes: 0 }
    private _broken = false

    constructor(
        private readonly table: Table,
        private readonly limits: ExportStatisticsLimits,
        total: number,
        ingested: Ingested
    ) {
        this._remaining = { count: total - ingested.hashs.length }
        this._ingested = { count: ingested.hashs.length, bytes: 0, percent: (ingested.hashs.length/total) * 100 }
    }

    public get broken() { return this._broken }

    public simulate({ rows, ingested }: ExportWorkerStatisticsUpdateInput) {

        const __current = {
            count: rows.length,
            bytes: ExportHelper.bytes(rows)
        }

        const __remaining = {
            count: this._remaining.count - __current.count
        }

        const total = ingested.hashs.length + __remaining.count

        const __ingested = {
            count: ingested.hashs.length,
            bytes: this._ingested.bytes + __current.bytes,
            percent: (ingested.hashs.length/total) * 100
        }

        // bigquery bytes limit docs: https://cloud.google.com/bigquery/quotas#streaming_inserts
        const broken = (__current.bytes > this.limits.bytes) || (__current.count > this.limits.bytes)

        return {
            current: __current,
            ingested: __ingested,
            remaining: __remaining,
            broken
        }

    }

    public update(input: ExportWorkerStatisticsUpdateInput) {
        const { current, ingested, remaining, broken } = this.simulate(input)
        this._current = current
        this._ingested = ingested
        this._remaining = remaining
        this._broken = broken
    }

    public toString() {
        return `${this._current.count.toLocaleString('pt-BR')} rows (${bytes(this._current.bytes)}) to bigquery temporary table "${this.table.metadata.id}" (${this._ingested.percent.toFixed(2)}%, ${this._ingested.count.toLocaleString('pt-BR')} rows, ${bytes(this._ingested.bytes)})`
    }

}

export class ExportHelper {

    private constructor() { }

    public static bytes(rows: any[]) {
        return rows.map(sizeof).reduce((sum, value) => sum + value, 0)
    }

}