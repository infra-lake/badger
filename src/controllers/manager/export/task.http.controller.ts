import { AuthHelper } from '../../../helpers/auth.helper'
import { QueryStringHelper } from '../../../helpers/querystring.helper'
import { HTTPIncomingMessage, HTTPServerResponse, Regex, RegexHTTPController } from '../../../regex'
import { ExportTaskService } from '../../../services/export/task/service'
export class ManagerExportTaskHTTPController implements RegexHTTPController {

    public static readonly path = '^/export/task$'

    public async get(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const { searchParams } = request.getURL()
        const parameters = QueryStringHelper.parse({ value: searchParams, mode: 'query' })
        const { filter = {} } = parameters

        const service = Regex.inject(ExportTaskService)
        let count = await service.count({ context: request, filter })

        response.setHeader('Content-Type', 'application/json')
        response.write(`{ "metadata": ${JSON.stringify({ count })}, "results": [`)
        response.setStatusCode(200)

        const cursor = service.find({ context: request, filter })
        while (await cursor.hasNext()) {
            const document = await cursor.next()
            if (++count > 1) { response.write(',') }
            response.write(JSON.stringify(document))
        }

        response.write('] }')
        response.end()

    }

}