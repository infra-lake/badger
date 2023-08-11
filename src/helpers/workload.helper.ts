import bytes from 'bytes'
import sizeof from 'object-sizeof'
import { Workload } from '../services/workload.service'

export type WorkloadLimits = { bytes: number }

export type WorkloadStatisticsRemaining = { count: number }
export type WorkloadStatisticsIngested = { count: number, bytes: number, percent: number }
export type WorkloadStatisticsCurrent = { count: number, bytes: number }
export type WorkloadStatisticsUpdateInput = { rows: any[], task: Pick<Workload, 'count'> }

export class WorkloadStatistics {

    private table: string
    private _remaining: WorkloadStatisticsRemaining
    private _ingested: WorkloadStatisticsIngested = { count: 0, bytes: 0, percent: 0 }
    private _current: WorkloadStatisticsCurrent = { count: 0, bytes: 0 }
    private _broken = false

    constructor(
        workload: Workload,
        private readonly limits: WorkloadLimits,
        total: number
    ) {
        this.table = workload.target.table.main.metadata.id
        this._remaining = { count: total - (workload.count ?? 0) }
        this._ingested = { count: (workload.count ?? 0), bytes: 0, percent: ((workload.count ?? 0) / total) * 100 }
    }

    public get broken() { return this._broken }

    public simulate({ rows, task }: WorkloadStatisticsUpdateInput) {

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

        const broken = (__current.bytes > this.limits.bytes)

        return {
            current: __current,
            ingested: __ingested,
            remaining: __remaining,
            broken
        }

    }

    public update(input: WorkloadStatisticsUpdateInput) {
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
        const limit = {
            bytes: bytes(this.limits.bytes)
        }
        return `${current.count} rows (${current.size}) to bigquery table "${this.table}" (${ingested.percent}%, ${ingested.count} rows, ${ingested.size}) (throughput: ${limit.bytes}/insert)`
    }

}

export class ExportHelper {

    private constructor() { }

    public static bytes(rows: any[]) {
        const result = rows.map(sizeof).reduce((sum, value) => sum + value, 0)
        return result
    }

}