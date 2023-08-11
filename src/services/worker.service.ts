import { RequestOptions } from 'http'
import { InvalidParameterError } from '../exceptions/invalid-parameter.error'
import { NotFoundError } from '../exceptions/not-found.error'
import { UnsupportedOperationError } from '../exceptions/unsupported-operation.error'
import { ApplicationHelper, ApplicationMode } from '../helpers/application.helper'
import { AuthHelper } from '../helpers/auth.helper'
import { EnvironmentHelper } from '../helpers/environment.helper'
import { HTTPHelper } from '../helpers/http.helper'
import { StringHelper } from '../helpers/string.helper'
import { Regex, TransactionalContext } from '../regex'
import { ExportTaskService } from './export/task/service'

export interface Worker {
    name: string
    url: string
}

export type WorkerTestInput = { context: TransactionalContext, worker: Worker }
export type WorkerStatus = 'free' | 'busy'
export type WorkerServiceListItem = Worker & { status: WorkerStatus }
export type WorkerServiceListInput = { context: TransactionalContext, filter?: Partial<Omit<WorkerServiceListItem, 'url'>> }
export type WorkerServiceListOutput = Array<WorkerServiceListItem>
export type WorkerGetInput = { id: Pick<Worker, 'name'> }

export class WorkerService {

    private readonly workers: Array<Worker> = []

    public name() {
        if ([ApplicationMode.MANAGER, ApplicationMode.VOTER].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${WorkerService.name}.name()`)
        }
        return EnvironmentHelper.get('WORKER_NAME').trim().toLowerCase()
    }

    public get({ id }: WorkerGetInput) {
        if ([ApplicationMode.MANAGER, ApplicationMode.WORKER].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${WorkerService.name}.get()`)
        }
        const found = this.workers.map(worker => worker)
        if (found.length <= 0) { throw new NotFoundError('worker', `id: "${JSON.stringify(id)}"`) }
        return found[0]
    }

    public async list({ context, filter }: WorkerServiceListInput): Promise<WorkerServiceListOutput> {

        context.logger.log('WorkerService.list() input.filter:', filter)

        const { name, status } = filter ?? {}

        const workers = this.workers.filter(worker =>
            StringHelper.empty(name) ||
            worker.name.startsWith(name as string) ||
            worker.name.endsWith(name as string)
        )

        const task = Regex.inject(ExportTaskService)

        const busy = await task.busy()

        const temp = workers.map(worker => {
            const status: WorkerStatus = busy.filter(({ name }) => worker.name === name).length > 0 ? 'busy' : 'free'
            return { ...worker, status }
        })

        const result = StringHelper.empty(status) ? temp : temp.filter(worker => worker.status === status)

        context.logger.log('WorkerService.list() result:', result)

        return result

    }

    public async load(context: TransactionalContext) {

        if ([ApplicationMode.MANAGER, ApplicationMode.WORKER].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${WorkerService.name}.load()`)
        }

        await Promise.all(EnvironmentHelper
            .list('^WORKER_[a-zA-Z0-9]+_URL$')
            .map(({ key: name, value: url }) => ({ name: name.replace('WORKER_', '').replace('_URL', '').toLocaleLowerCase(), url }))
            .map(async worker => {
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