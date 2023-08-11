import { AuthHelper } from '../../../helpers/auth.helper'
import { QueryStringHelper } from '../../../helpers/querystring.helper'
import { HTTPIncomingMessage, HTTPServerResponse, Regex, RegexHTTPController } from '../../../regex'
import { Export, ExportService } from '../../../services/export/service'

export class ManageExportCleanupHTTPController implements RegexHTTPController {

    public static readonly path = '^/export/cleanup$'

    public async post(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const service = Regex.inject(ExportService)

        await service.cleanup()

        response.setHeader('Content-Type', 'application/json')
        response.write(JSON.stringify({ transaction: request.transaction }))
        response.setStatusCode(200)
        response.end()

    }

}