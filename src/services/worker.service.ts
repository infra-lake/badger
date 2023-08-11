import { RequestOptions } from 'http'
import { InvalidParameterError } from '../exceptions/invalid-parameter.error'
import { NotFoundError } from '../exceptions/not-found.error'
import { UnsupportedOperationError } from '../exceptions/unsupported-operation.error'
import { ApplicationHelper, ApplicationMode } from '../helpers/application.helper'
import { AuthHelper } from '../helpers/auth.helper'
import { EnvironmentHelper } from '../helpers/environment.helper'
import { HTTPHelper } from '../helpers/http.helper'
import { StringHelper } from '../helpers/string.helper'
import { Worker, WorkerHelper } from '../helpers/worker.helper'
import { Regex, TransactionalContext } from '../regex'
import { ExportTaskService } from './export/task/service'

export type WorkerTestInput = { context: TransactionalContext, worker: Worker }
export type WorkerStatus = 'free' | 'busy'
export type WorkerServiceListItem = Worker & { status: WorkerStatus }
export type WorkerServiceListInput = { context: TransactionalContext, filter?: Partial<Omit<WorkerServiceListItem, 'url'>> }
export type WorkerServiceListOutput = Array<WorkerServiceListItem>
export type WorkerGetInput = { id: Pick<Worker, 'name'> }

export class WorkerService {

    private readonly workers: Array<Worker> = []

    public get({ id }: WorkerGetInput) {
        if ([ApplicationMode.MANAGER, ApplicationMode.WORKER].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${WorkerService.name}.get()`)
        }
        const found = this.workers.filter(worker => worker.name === id.name)
        if (found.length <= 0) { throw new NotFoundError('worker', `id: "${JSON.stringify(id)}"`) }
        return found[0]
    }

    public async list({ context, filter }: WorkerServiceListInput): Promise<WorkerServiceListOutput> {

        const { name, status } = filter ?? {}

        const _name = (name ?? '').toString()

        const workers = this.workers.filter(worker =>
            StringHelper.empty(_name) ||
            worker.name.startsWith(_name) ||
            worker.name.endsWith(_name)
        )

        const task = Regex.inject(ExportTaskService)

        const busy = await task.busy()

        const temp = workers.map(worker => {
            const status: WorkerStatus = busy.filter(({ name }) => worker.name === name).length > 0 ? 'busy' : 'free'
            return { ...worker, status }
        })

        const result = StringHelper.empty(status) ? temp : temp.filter(worker => worker.status === status)

        return result

    }

    public async load(context: TransactionalContext) {

        if ([ApplicationMode.MANAGER, ApplicationMode.WORKER].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${WorkerService.name}.load()`)
        }

        await Promise.all(WorkerHelper.WORKERS.map(async worker => {
            await this.test({ context, worker })
            this.workers.push(worker)
        }))

    }

    public async test({ context, worker }: WorkerTestInput) {

        if ([ApplicationMode.MANAGER, ApplicationMode.WORKER].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${WorkerService.name}.test()`)
        }

        const { logger } = context
        const { name, url } = worker

        try {

            const options: RequestOptions = { method: 'GET', headers: AuthHelper.header() }

            const response = await HTTPHelper.request({ logger, url: `${url}/health/readiness`, options })

            if (!response.ok()) {
                const { statusCode, statusMessage } = response
                throw new Error(`${statusCode} - ${statusMessage}`)
            }

        } catch (error) {
            throw new InvalidParameterError('worker.url', `fail to connect at worker "${name}" by the url "${url}/health/readiness"`, error)
        }

    }



}