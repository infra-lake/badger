import { IncomingMessage, Server, ServerResponse, createServer } from 'http'
import { NotFoundController } from '../controllers/common/not-found.controller'
import { ApplicationHelper } from '../helpers/application.helper'
import { AuthHelper } from '../helpers/auth.helper'
import { ControllerHelper } from '../helpers/controller.helper'
import { HTTPHelper } from '../helpers/http.helper'
import { MetricHelper } from '../helpers/metric.helper'
import { ObjectHelper } from '../helpers/object.helper'
import { TransactionalContext } from './context'
import { Regex, RegexField } from './ioc'
import { QueryStringHelper } from '../helpers/querystring.helper'

export interface HTTPIncomingMessage extends IncomingMessage, TransactionalContext {
    getURL(): URL
    body(): Promise<string>
    json<T>(): Promise<T>
    ok(): boolean
}

export interface HTTPServerResponse extends ServerResponse {
    setStatusCode(value: number): void
}

export type RegexHTTPControllerHandler = (request: HTTPIncomingMessage, response: HTTPServerResponse) => Promise<void> | void

export interface RegexHTTPController {
    get?: RegexHTTPControllerHandler
    post?: RegexHTTPControllerHandler
    put?: RegexHTTPControllerHandler
    delete?: RegexHTTPControllerHandler
    patch?: RegexHTTPControllerHandler
    handle?: RegexHTTPControllerHandler
}

export type HTTPServer = Server<typeof IncomingMessage, typeof ServerResponse>
export type HTTPBootstrapOutput = { server: HTTPServer }

export class HTTP {
    public static async bootstrap(): Promise<HTTPBootstrapOutput> {
        const server = await createServer(listener)
        return { server }
    }
}

async function listener(request: IncomingMessage, response: ServerResponse) {

    const _request = HTTPHelper.incoming({ message: request })
    const _response = HTTPHelper.response(response)

    const { pathname, searchParams } = _request.getURL()
    const method = _request.method?.toLocaleLowerCase()

    try {
        
        const qs = QueryStringHelper.parse({ value: searchParams, mode: 'raw' }) 
        _request.logger.log('call', method, 'on', pathname, ObjectHelper.empty(qs) ? '' : qs)
        MetricHelper.http_received_request_total.inc()
        MetricHelper.http_received_request_total.inc({ path: pathname })

        if (pathname === '/') {

            if (!AuthHelper.validate(_request, _response)) {
                return
            }

            const paths = ApplicationHelper.paths()
            _response.setStatusCode(200)
            _response.write(JSON.stringify(paths))
            _response.end()
            return

        }

        const controller = Regex.inject<RegexHTTPController>(pathname)

        if (!controller) {
            const controller = Regex.inject<NotFoundController>('404')
            await controller.handle(_request, _response)
            return
        }

        if (!ObjectHelper.has(method)) {
            const controller = Regex.inject<NotFoundController>('404')
            await controller.handle(_request, _response)
            return
        }

        if (Array.isArray(controller)) {

            const controllers =
                (controller as any[])
                    .filter(_controller => _handler(_controller, method))
                    .map(_controller => ({ name: _controller[RegexField.TYPE], handler: _handler(_controller, method) }))

            if (controllers.length === 1) {
                await controllers[0].handler(_request, _response)
                return
            }

            _request.logger.error('there are more than one controller found to process this request:', controllers.map(({ name, handler }) => ({ name, handler: handler.name })))
            _response.setStatusCode(500)
            _response.end()
            return
        }

        const handler = _handler(controller, method)

        if (!ObjectHelper.has(handler)) {
            const controller = Regex.inject<NotFoundController>('404')
            await controller.handle(_request, _response)
            return
        }

        await handler(_request, _response)

    } catch (error) {
        ControllerHelper.catch(_request, _response, error)
    } finally {
        MetricHelper.http_received_request_total.inc({ method, path: pathname, status: _response.statusCode })
        Regex.unregister(_request.logger)
    }

}

function _handler(controller: any, method: string | undefined) {
    return controller[method as string] ?? controller.handle
}