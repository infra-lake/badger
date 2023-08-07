import { CountDocumentsOptions } from 'mongodb'
import { NotFoundError } from '../../exceptions/not-found.error'
import { AuthHelper } from '../../helpers/auth.helper'
import { ObjectHelper } from '../../helpers/object.helper'
import { QueryStringHelper } from '../../helpers/querystring.helper'
import { HTTPIncomingMessage, HTTPServerResponse, Regex, RegexHTTPController } from '../../regex'
import { Export, ExportService } from '../../services/export.service'

export class ManagerQueryExportHTTPController implements RegexHTTPController {

    public static readonly path = '^/export/(check|find)$'

    public async get(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const service = Regex.inject(ExportService)

        const { pathname, searchParams } = request.getURL()
        const method = pathname.split('/')[2]

        switch (method) {
            case 'check':
                const id = await request.json<Pick<Export, 'transaction' | 'source' | 'target' | 'database'>>()
                const result = await service.check({ context: request, id })
                response.write(JSON.stringify(result))
                response.setStatusCode(200)
                response.end()
                return

            case 'find':
                const parameters = QueryStringHelper.parse(searchParams)
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
                return

            default:
                throw new NotFoundError(method);

        }

    }

}