import { NotFoundController } from "../controllers/common/not-found.controller";
import { BadRequestError } from "../exceptions/bad-request.error";
import { NotFoundError } from "../exceptions/not-found.error";
import { HTTPIncomingMessage, HTTPServerResponse, Logger, Regex } from "../regex";

export class ControllerHelper {

    public static async catch(request: HTTPIncomingMessage, response: HTTPServerResponse, error: any) {

        const logger = Logger.from(request)

        logger.error('error:', error)

        const bad = error instanceof BadRequestError
        
        response.setStatusCode(bad ? 400 : 500)
        
        if (bad) {
            const { message } = error
            response.setHeader('Content-Type', 'application/json')
            response.write(JSON.stringify({ message }))
        }

        if (error instanceof NotFoundError) {
            const { handle } = Regex.inject(NotFoundController)
            await handle(request, response)
            return
        }

        response.end()

    }

}