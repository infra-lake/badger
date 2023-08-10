import { AuthHelper } from '../../../helpers/auth.helper'
import { HTTPIncomingMessage, HTTPServerResponse, Regex, RegexHTTPController } from '../../../regex'
import { ExportErrorInput, ExportErrorService } from '../../../services/export/error.service'

export class ManagerExportStopHTTPController implements RegexHTTPController {

    public static readonly path = '^/export/stop$'

    public async post(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const body = await request.json<ExportErrorInput['id']>()

        request.transaction = body.transaction

        const { transaction, source, target, database } = body
        const id = { transaction, source, target, database }
        const input = { context: request, id }

        const service = Regex.inject(ExportErrorService)
        await service.apply(input)

        response.write(JSON.stringify({ transaction: body.transaction }))
        response.setStatusCode(200)
        response.end()

    }

}
