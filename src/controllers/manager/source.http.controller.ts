import { AuthHelper } from '../../helpers/auth.helper'
import { QueryStringHelper } from '../../helpers/querystring.helper'
import { HTTPIncomingMessage, HTTPServerResponse, Regex, RegexHTTPController } from '../../regex'
import { Source, SourceService } from '../../services/source.service'

export class ManagerSourceHTTPController implements RegexHTTPController {

    public static readonly path = '^/source$'

    public async post(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const body = await request.json<Source>()
        
        const { name: source, url } = body
        const id = { name: source }
        const document = { url }
        const input = { context: request, id, document }
        
        const service = Regex.inject(SourceService)
        await service.save(input)

        response.setHeader('Content-Type', 'application/json')
        response.write(JSON.stringify({ transaction: request.transaction }))
        response.end()

    }

    public async get(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const { searchParams } = request.getURL()
        const parameters = QueryStringHelper.parse({ value: searchParams, mode: 'query' })
        const { filter = {} } = parameters

        const service = Regex.inject(SourceService)
        let count = await service.count({ context: request, filter })

        response.setHeader('Content-Type', 'application/json')
        response.write(`{ "metadata": ${JSON.stringify({ count })}, "results": [`)
        response.setStatusCode(200)

        const cursor = service.find({ context: request, filter })
        while (await cursor.hasNext()) {
            const document = await cursor.next()
            if (count++ > 1) { response.write(',') }
            response.write(JSON.stringify(document))
        }

        response.write('] }')
        response.end()

    }

    public async delete(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const { searchParams } = request.getURL()
        const { name } = QueryStringHelper.parse({ value: searchParams, mode: 'raw' })

        let service = Regex.inject(SourceService)
        await service.delete({ context: request, id: { name } })

        response.setHeader('Content-Type', 'application/json')
        response.write(JSON.stringify({ transaction: request.transaction }))
        response.end()

    }

}