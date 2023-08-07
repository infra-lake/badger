import { AuthHelper } from '../../helpers/auth.helper'
import { QueryStringHelper } from '../../helpers/querystring.helper'
import { HTTPIncomingMessage, HTTPServerResponse, Regex, RegexHTTPController } from '../../regex'
import { WorkerService } from '../../services/worker.service'

export class ViterHTTPController implements RegexHTTPController {

    public static readonly path = '^/worker$'

    public async get(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const input = read(request)

        const service = Regex.inject(WorkerService)

        const output = await service.list(input)

        response.write(JSON.stringify(output))
        response.setStatusCode(200)
        response.end()

    }

}

function read(request: HTTPIncomingMessage) {
    const { searchParams } = request.getURL()
    const { filter = {} } = QueryStringHelper.parse(searchParams)
    const { name, status } = filter ?? {}
    return { context: request, filter: { name, status } }
}