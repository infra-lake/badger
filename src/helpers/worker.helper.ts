import { UnsupportedOperationError } from '../exceptions/unsupported-operation.error'
import { WorkerService } from '../services/worker.service'
import { ApplicationHelper, ApplicationMode } from './application.helper'
import { EnvironmentHelper } from './environment.helper'

export interface Worker {
    name: string
    url: string
}

export class WorkerHelper {

    public static get ENVS() { return EnvironmentHelper.list('^WORKER_[a-zA-Z0-9]+_URL$') }
    public static get WORKERS(): Array<Worker> { 
        return WorkerHelper.ENVS.map(({ key: name, value: url }) => ({ name: name.replace('WORKER_', '').replace('_URL', '').trim().toLocaleLowerCase(), url })) }
    public static get CURRENT() {
        if ([ApplicationMode.MANAGER, ApplicationMode.VOTER].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${WorkerService.name}.name()`)
        }
        return EnvironmentHelper.get('WORKER_NAME').trim().toLowerCase()
    }
}