import { type IEntity } from '@badger/common/types'

export type IWorkerKey = 'name'

export enum WorkerStatus {
    FREE = 'free',
    BUSY = 'busy'
}

export interface IWorker extends IEntity<IWorker, IWorkerKey> {

    get name(): string
    get url(): string
    get status(): WorkerStatus

}
