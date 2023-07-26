import { Table } from '@google-cloud/bigquery'
import bytes from 'bytes'
import sizeof from 'object-sizeof'
import { EnvironmentHelper } from './environment.helper'
import { Ingested } from '../services/ingested.service'

export type ExportWorkerStatisticsRemaining = { count: number }
export type ExportWorkerStatisticsIngested = { count: number, bytes: number, percent: number }
export type ExportWorkerStatisticsCurrent = { count: number, bytes: number }
export type ExportWorkerStatisticsUpdateInput = { rows: any[], ingested: Ingested }

export class ExportStatistics {

    private _remaining: ExportWorkerStatisticsRemaining
    private _ingested: ExportWorkerStatisticsIngested = { count: 0, bytes: 0, percent: 0 }
    private _current: ExportWorkerStatisticsCurrent = { count: 0, bytes: 0 }
    private _broken = false

    constructor(
        private readonly table: Table,
        _remaining: ExportWorkerStatisticsRemaining
    ) {
        this._remaining = _remaining
    }

    private static get MAX_EXPORT_BYTES() { return EnvironmentHelper.get('DEFAULT_MAX_EXPORT_BYTES', '15MB') }

    public get broken() { return this._broken }

    public simulate({ rows, ingested }: ExportWorkerStatisticsUpdateInput) {

        const __current = {
            count: rows.length,
            bytes: rows.map(sizeof).reduce((sum, value) => sum + value, 0)
        }

        const __remaining = {
            count: this._remaining.count - __current.count
        }

        const count = ingested.hashs.length

        const __ingested = {
            count,
            bytes: this._ingested.bytes + __current.bytes,
            percent: (ingested.hashs.length / (count + __remaining.count)) * 100
        }

        // https://cloud.google.com/bigquery/quotas#streaming_inserts
        const broken = __ingested.bytes > bytes(ExportStatistics.MAX_EXPORT_BYTES)

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