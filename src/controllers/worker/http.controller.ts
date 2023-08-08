import { NotFoundError } from '../../exceptions/not-found.error'
import { AuthHelper } from '../../helpers/auth.helper'
import { ObjectHelper } from '../../helpers/object.helper'
import { HTTPIncomingMessage, HTTPServerResponse, Regex, RegexHTTPController, TransactionalContext } from '../../regex'
import { ExportTaskService, ExportTaskStateChangeInput } from '../../services/export.task.service'
import { Source, SourceService } from '../../services/source.service'
import { Target, TargetService } from '../../services/target.service'

export class WorkerHTTPController implements RegexHTTPController {

    public static readonly path = '^/start$'

    public async post(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const input = await read(request)

        const service = Regex.inject(ExportTaskService)

        const output = await service.start(input)

        response.write(JSON.stringify(output))
        response.setStatusCode(200)
        response.end()

    }

}

async function read(request: HTTPIncomingMessage): Promise<ExportTaskStateChangeInput> {

    const id = await request.json<ExportTaskStateChangeInput['id']>()
    request.transaction = id.transaction

    await _validate(request, id)

    const { transaction, source, target, database, collection } = id
    return { context: request, id: { transaction, source, target, database, collection } }

}

async function _validate(context: TransactionalContext, id: ExportTaskStateChangeInput['id']) {

    const sources = Regex.inject(SourceService)

    const source1 = await sources.get({ context, id: { name: id.source } })
    if (!ObjectHelper.has(source1)) { throw new NotFoundError('source') }
    await sources.test(source1 as Source)

    const source2 = await sources.collections({ name: id.source, database: id.database })
    if (!ObjectHelper.has(source2)) { throw new NotFoundError('database') }
    if (source2.length <= 0) { throw new NotFoundError('collections') }
    if (source2.filter(({ collection }) => collection === id.collection).length <= 0) { throw new NotFoundError('collection') }

    const targets = Regex.inject(TargetService)
    const target = await targets.get({ context, id: { name: id.target } })
    if (!ObjectHelper.has(target)) { throw new NotFoundError('target') }
    await targets.test(target as Target)

}
