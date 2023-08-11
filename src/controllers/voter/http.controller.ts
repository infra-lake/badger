import { AuthHelper } from '../../helpers/auth.helper'
import { QueryStringHelper } from '../../helpers/querystring.helper'
import { HTTPIncomingMessage, HTTPServerResponse, Regex, RegexHTTPController } from '../../regex'
import { WorkerService } from '../../services/worker.service'

export class VoterHTTPController implements RegexHTTPController {

    public static readonly path = '^/voter/worker$'

    public async get(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const { searchParams } = request.getURL()
        const { filter = {} } = QueryStringHelper.parse(searchParams)
        const { name, status } = filter ?? {}
        const input = { context: request, filter: { name, status } }

        const service = Regex.inject(WorkerService)

        const result = await service.list(input)

        response.write(JSON.stringify({ result }))
        response.setStatusCode(200)
        response.end()

    }

}