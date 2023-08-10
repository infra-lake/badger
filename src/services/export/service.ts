import { Filter } from 'mongodb'
import { NotFoundError } from '../../exceptions/not-found.error'
import { UnsupportedOperationError } from '../../exceptions/unsupported-operation.error'
import { ApplicationHelper, ApplicationMode } from '../../helpers/application.helper'
import { MongoDBDocument, MongoDBGetInput, MongoDBService, MongoDBValidationInput } from '../../helpers/mongodb.helper'
import { ObjectHelper } from '../../helpers/object.helper'
import { Stamps, StampsHelper } from '../../helpers/stamps.helper'
import { Window } from '../../helpers/window.helper'
import { Regex, TransactionalContext } from '../../regex'
import { SettingsService } from '../settings.service'
import { Source } from '../source.service'
import { Target } from '../target.service'
import { ExportTaskService } from './task/service'

export interface Export extends MongoDBDocument<Export, 'transaction' | 'source' | 'target' | 'database'> {
    transaction: string
    source: Source['name']
    target: Target['name']
    database: string
    status: 'created' | 'running' | 'terminated' | 'stopped' | 'error'
}

export type ExportStateChangeInput = Pick<MongoDBValidationInput<Export, 'transaction' | 'source' | 'target' | 'database'>, 'id'> & { context: TransactionalContext }

export class ExportService extends MongoDBService<Export, 'transaction' | 'source' | 'target' | 'database'> {

    protected get database() { return SettingsService.DATABASE }
    public get collection() { return 'exports' }

    public async validate({ on }: MongoDBValidationInput<Export, 'transaction' | 'source' | 'target' | 'database'>) {
        if (['insert', 'update', 'delete'].includes(on)) {
            throw new UnsupportedOperationError(on)
        }
    }

    public name({ source, target, database }: Pick<Export, 'source' | 'target' | 'database'>) {
        return `${source}.${target}.${database}`
    }
    
    public async check({ context, id }: Pick<MongoDBGetInput<Export, 'transaction' | 'source' | 'target' | 'database'>, 'context' | 'id'>) {

        if (![ApplicationMode.MANAGER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${ExportService.name}.check()`)
        }

        const document = await this.get({ context, id }) as Export

        if (!ObjectHelper.has(document)) {
            throw new NotFoundError('export')
        }

        const { status } = document

        return { status }

    }

    public async cleanup() {
        const tasks = Regex.inject(ExportTaskService)
        await tasks.cleanup()
        await this._collection.deleteMany({})
    } 

    public static filter(window: Window, stamps: Stamps = StampsHelper.extract()): Filter<Document> {

        const date = {
            $ifNull: [
                `$${stamps.update}`,
                `$${StampsHelper.DEFAULT_STAMP_UPDATE}`,
                '$updatedAt',
                '$updated_at',
                '$updatedat',
                `$${stamps.insert}`,
                `$${StampsHelper.DEFAULT_STAMP_INSERT}`,
                '$createdAt',
                '$created_at',
                '$createdat',
                {
                    $convert: {
                        input: `$${stamps.id}`,
                        to: 'date',
                        onError: window.end,
                        onNull: window.end
                    }
                }
            ]
        }

        return {
            $expr: {
                $and: [
                    { $gt: [date, window.begin] },
                    { $lte: [date, window.end] }
                ]
            }
        }

    }


}