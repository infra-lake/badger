import { NotFoundError } from '../../exceptions/not-found.error'
import { AuthHelper } from '../../helpers/auth.helper'
import { QueryStringHelper } from '../../helpers/querystring.helper'
import { HTTPIncomingMessage, HTTPServerResponse, Regex, RegexHTTPController } from '../../regex'
import { ExportTaskService } from '../../services/export.task.service'
import { Source, SourceService } from '../../services/source.service'
import { Target, TargetService } from '../../services/target.service'

export class ManagerHTTPController implements RegexHTTPController {

    public static readonly path = '^/(source|target|task)$'

    public async post(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) {
            return
        }

        const { pathname } = request.getURL()
        const [_, type] = pathname.split('/')

        switch (type) {
            case 'source':
                const { name: source, url } = await request.json<Source>()
                const sources = Regex.inject(SourceService)
                await sources.save({ context: request, id: { name: source }, document: { url } })
                break

            case 'target':
                const { name: target, credentials } = await request.json<Target>()
                const targets = Regex.inject(TargetService)
                await targets.save({ context: request, id: { name: target }, document: { credentials } })
                break

            default:
                throw new NotFoundError(type)
        }

        response.write(JSON.stringify({ transaction: request.transaction }))
        response.end()

    }

    public async get(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) {
            return
        }

        const { pathname, searchParams } = request.getURL()
        const [_, type] = pathname.split('/')

        let service = undefined
        switch (type) {
            case 'source': service = Regex.inject(SourceService); break
            case 'target': service = Regex.inject(TargetService); break
            case 'task': service = Regex.inject(ExportTaskService); break
            default: throw new NotFoundError(type)
        }

        const parameters = QueryStringHelper.parse(searchParams)
        const { filter = {} } = parameters

        let count = 0
        service.find(filter).stream()
            .on('resume', () => {
                response.setHeader('Content-Type', 'application/json')
                response.write('{ "results": [')
                response.setStatusCode(200)
            })
            .on('data', chunk => {
                if (++count > 1) {
                    response.write(',')
                }
                delete chunk._id
                response.write(JSON.stringify(chunk))
            })
            .on('end', () => {
                response.write(`], "metadata": { "count": ${count} } }`)
                response.end()
            })
            .on('error', (error) => {
                console.error('error:', error)
                response.setStatusCode(500)
                response.end()
            })

    }

    public async delete(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) {
            return
        }

        const { pathname, searchParams } = request.getURL()
        const [_, type] = pathname.split('/')

        let service = undefined
        switch (type) {
            case 'source': service = Regex.inject(SourceService); break
            case 'target': service = Regex.inject(TargetService); break
            default: throw new NotFoundError(type)
        }

        const { name } = QueryStringHelper.parse(searchParams)
        await service.delete({ context: request, id: { name } })

        response.write(JSON.stringify({ transaction: request.transaction }))
        response.end()

    }

}