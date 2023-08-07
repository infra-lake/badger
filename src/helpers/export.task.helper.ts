import bytes from 'bytes'
import sizeof from 'object-sizeof'
import { ExportTaskServiceNextOutput } from '../services/export.task.service'

export type ExportTaskStatisticsRemaining = { count: number }
export type ExportTaskStatisticsIngested = { count: number, bytes: number, percent: number }
export type ExportTaskStatisticsCurrent = { count: number, bytes: number }
export type ExportTaskStatisticsUpdateInput = { rows: any[], task: Pick<ExportTaskServiceNextOutput, 'count'> }
export type ExportTaskStatisticsLimits = { count: number, bytes: number }

export class ExportTaskStatistics {

    private table: string
    private _remaining: ExportTaskStatisticsRemaining
    private _ingested: ExportTaskStatisticsIngested = { count: 0, bytes: 0, percent: 0 }
    private _current: ExportTaskStatisticsCurrent = { count: 0, bytes: 0 }
    private _broken = false

    constructor(
        task: ExportTaskServiceNextOutput,
        private readonly limits: ExportTaskStatisticsLimits,
        total: number
    ) {
        this.table = task.target.table.main.metadata.id
        this._remaining = { count: total - (task.count ?? 0) }
        this._ingested = { count: (task.count ?? 0), bytes: 0, percent: ((task.count ?? 0) / total) * 100 }
    }

    public get broken() { return this._broken }

    public simulate({ rows, task }: ExportTaskStatisticsUpdateInput) {

        const __current = {
            count: rows.length,
            bytes: ExportHelper.bytes(rows)
        }

        const __remaining = {
            count: this._remaining.count - __current.count
        }

        const total = (task.count ?? 0) + __remaining.count

        const __ingested = {
            count: (task.count ?? 0),
            bytes: this._ingested.bytes + __current.bytes,
            percent: ((task.count ?? 0) / total) * 100
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

    public update(input: ExportTaskStatisticsUpdateInput) {
        const { current, ingested, remaining, broken } = this.simulate(input)
        this._current = current
        this._ingested = ingested
        this._remaining = remaining
        this._broken = broken
    }

    public toString() {
        const current = {
            count: this._current.count.toLocaleString('pt-BR'),
            size: bytes(this._current.bytes)
        }
        const ingested = {
            percent: this._ingested.percent.toFixed(2),
            count: this._ingested.count.toLocaleString('pt-BR'),
            size: bytes(this._ingested.bytes)
        }
        return `${current.count} rows (${current.size}) to bigquery temporary table "${this.table}" (${ingested.percent}%, ${ingested.count} rows, ${ingested.size})`
    }

}

export class ExportHelper {

    private constructor() { }

    public static bytes(rows: any[]) {
        return rows.map(sizeof).reduce((sum, value) => sum + value, 0)
    }

}