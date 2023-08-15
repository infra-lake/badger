import { HTTPIncomingMessage, HTTPServerResponse, RegexHTTPController } from '../../regex'

export class NotFoundController implements RegexHTTPController {

    public static readonly path = '^404$'

    public async handle(request: HTTPIncomingMessage, response: HTTPServerResponse) {
        response.setStatusCode(404)
        response.end()
    }

}