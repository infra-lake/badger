import { CountDocumentsOptions } from 'mongodb'
import { AuthHelper } from '../../../helpers/auth.helper'
import { ObjectHelper } from '../../../helpers/object.helper'
import { QueryStringHelper } from '../../../helpers/querystring.helper'
import { HTTPIncomingMessage, HTTPServerResponse, Regex, RegexHTTPController } from '../../../regex'
import { ExportService } from '../../../services/export/service'

export class ManageExportFindHTTPController implements RegexHTTPController {

    public static readonly path = '^/export/find$'

    public async get(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const service = Regex.inject(ExportService)

        const { searchParams } = request.getURL()
        const parameters = QueryStringHelper.parse({ value: searchParams, mode: 'query' })
        const filter = (ObjectHelper.has(parameters.filter) ? parameters.filter : undefined)
        const options = { projection: parameters.projection, sort: parameters.sort }

        let count = await service.count({ context: request, filter, options: options as CountDocumentsOptions })

        response.setHeader('Content-Type', 'application/json')
        response.write(`{ "metadata": ${JSON.stringify({ count })}, "results": [`)
        response.setStatusCode(200)

        const cursor = service.find({ context: request, filter, options })
        while (await cursor.hasNext()) {
            const document = await cursor.next()
            if (++count > 1) { response.write(',') }
            response.write(JSON.stringify(document))
        }

        response.write('] }')
        response.end()

    }

}