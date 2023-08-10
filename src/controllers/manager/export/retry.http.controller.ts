import { AuthHelper } from '../../../helpers/auth.helper'
import { HTTPIncomingMessage, HTTPServerResponse, Regex, RegexHTTPController } from '../../../regex'
import { ExportRetryInput, ExportRetryService } from '../../../services/export/retry.service'

export class ManagerExportRetryHTTPController implements RegexHTTPController {

    public static readonly path = '^/export/retry$'

    public async post(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const body = await request.json<ExportRetryInput['id'] & ExportRetryInput['document']>()

        request.transaction = body.transaction

        const { transaction, source, target, database, force } = body
        const id = { transaction, source, target, database }
        const document = { force }
        const input = { context: request, id, document }

        const service = Regex.inject(ExportRetryService)
        await service.apply(input)

        response.write(JSON.stringify({ transaction: body.transaction }))
        response.setStatusCode(200)
        response.end()

    }

}
