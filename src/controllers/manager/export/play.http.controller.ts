import { AuthHelper } from '../../../helpers/auth.helper'
import { HTTPIncomingMessage, HTTPServerResponse, Regex, RegexHTTPController } from '../../../regex'
import { ExportPlayInput, ExportPlayService } from '../../../services/export/play.service'

export class ManagerExportPlayHTTPController implements RegexHTTPController {

    public static readonly path = '^/export/play$'

    public async post(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const body = await request.json<ExportPlayInput['id']>()

        request.transaction = body.transaction

        const { transaction, source, target, database } = body
        const id = { transaction, source, target, database }
        const input = { context: request, id }

        const service = Regex.inject(ExportPlayService)
        await service.apply(input)

        response.setHeader('Content-Type', 'application/json')
        response.write(JSON.stringify({ transaction: body.transaction }))
        response.setStatusCode(200)
        response.end()

    }

}
