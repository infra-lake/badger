import { VoterHTTPClient } from '../../clients/voter.http.client'
import { AuthHelper } from '../../helpers/auth.helper'
import { QueryStringHelper } from '../../helpers/querystring.helper'
import { HTTPIncomingMessage, HTTPServerResponse, Regex, RegexHTTPController } from '../../regex'

export class ManagerWorkerHTTPController implements RegexHTTPController {

    public static readonly path = '^/worker$'

    public async get(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const { searchParams } = request.getURL()
        const { filter = {} } = QueryStringHelper.parse(searchParams)
        const { name, status } = filter ?? {}
        const input = { context: request, filter: { name, status } }

        const client = Regex.inject(VoterHTTPClient)
        const output = await client.workers(input)

        response.setHeader('Content-Type', 'application/json')
        response.write(JSON.stringify(output))
        response.setStatusCode(200)
        response.end()

    }

}