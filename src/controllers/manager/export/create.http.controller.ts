import { AuthHelper } from '../../../helpers/auth.helper'
import { HTTPIncomingMessage, HTTPServerResponse, Regex, RegexHTTPController } from '../../../regex'
import { ExportCreateInput, ExportCreateService } from '../../../services/export/create.service'

export class ManagerExportCreateHTTPController implements RegexHTTPController {

    public static readonly path = '^/export/create$'

    public async post(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const body = await request.json<ExportCreateInput['id']>()

        body.transaction = request.transaction

        const { transaction, source, target, database } = body
        const id = { transaction, source, target, database }
        const input = { context: request, id }

        const service = Regex.inject(ExportCreateService)
        await service.apply(input)

        response.setHeader('Content-Type', 'application/json')
        response.write(JSON.stringify({ transaction: body.transaction }))
        response.setStatusCode(200)
        response.end()

    }

}
