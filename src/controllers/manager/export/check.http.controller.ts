import { AuthHelper } from '../../../helpers/auth.helper'
import { QueryStringHelper } from '../../../helpers/querystring.helper'
import { HTTPIncomingMessage, HTTPServerResponse, Regex, RegexHTTPController } from '../../../regex'
import { Export, ExportService } from '../../../services/export/service'

export class ManageExportCheckHTTPController implements RegexHTTPController {

    public static readonly path = '^/export/check$'

    public async get(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const service = Regex.inject(ExportService)

        const { searchParams } = request.getURL() 
        const parameters = QueryStringHelper.parse(searchParams)
        const { transaction, source, target, database } = parameters
        const id = { transaction, source, target, database }

        const result = await service.check({ context: request, id })

        response.setHeader('Content-Type', 'application/json')
        response.write(JSON.stringify(result))
        response.setStatusCode(200)
        response.end()

    }

}