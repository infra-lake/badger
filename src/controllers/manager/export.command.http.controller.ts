import { InvalidParameterError } from '../../exceptions/invalid-parameter.error'
import { NotFoundError } from '../../exceptions/not-found.error'
import { AuthHelper } from '../../helpers/auth.helper'
import { ObjectHelper } from '../../helpers/object.helper'
import { HTTPIncomingMessage, HTTPServerResponse, Regex, RegexHTTPController, TransactionalContext } from '../../regex'
import { ExportService, ExportStateChangeInput } from '../../services/export.service'
import { Source, SourceService } from '../../services/source.service'
import { Target, TargetService } from '../../services/target.service'

type ManagerCommandExportHTTPControllerInput = { method: 'create' | 'stop' | 'retry', input: ExportStateChangeInput }

export class ManagerCommandExportHTTPController implements RegexHTTPController {

    public static readonly path = '^/export/(create|stop|retry)$'

    public async post(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const { method, input } = await read(request)

        const service = Regex.inject(ExportService)

        await service[method](input)

        response.write(JSON.stringify({ transaction: request.transaction }))
        response.setStatusCode(200)
        response.end()

    }

}

async function read(request: HTTPIncomingMessage): Promise<ManagerCommandExportHTTPControllerInput> {

    const { pathname } = request.getURL()
    const method = pathname.split('/')[2] as ManagerCommandExportHTTPControllerInput['method']

    const id = await request.json<ExportStateChangeInput['id']>()
    id.transaction = request.transaction

    await _validate(request, id)

    const { transaction, source, target, database } = id
    const input = { context: request, id: { transaction, source, target, database } }
    return { method, input }

}

async function _validate(request: TransactionalContext, id: ExportStateChangeInput['id']) {

    const sources = Regex.inject(SourceService)

    const source1 = await sources.get({ context: request, id: { name: id.source } })
    if (!ObjectHelper.has(source1)) { throw new InvalidParameterError('source', 'not found') }
    await sources.test(source1 as Source)

    const source2 = await sources.collections({ name: id.source, database: id.database })
    if (!ObjectHelper.has(source2)) { throw new InvalidParameterError('database', 'not found') }
    if (source2.length <= 0) {
        throw new NotFoundError('document collections', 'does not possible start ingestion for datanase without collections')
    }

    const targets = Regex.inject(TargetService)
    const target = await targets.get({ context: request, id: { name: id.target } })
    if (!ObjectHelper.has(target)) { throw new InvalidParameterError('target', 'not found') }

    await targets.test(target as Target)

}
