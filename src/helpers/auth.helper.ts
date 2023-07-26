import { HTTPIncomingMessage, HTTPServerResponse } from "../regex";
import { EnvironmentHelper } from "./environment.helper";

export class AuthHelper {

    private static readonly NO_AUTH = 'no_auth'

    public static validate(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        const mode = EnvironmentHelper.get('AUTH_MODE', AuthHelper.NO_AUTH).toLowerCase()

        if (mode === AuthHelper.NO_AUTH) {
            return true
        }

        const authorization = request.headers['authorization'] ?? ''
        const [strategy = AuthHelper.NO_AUTH, token = ''] = authorization.split(' ').filter(value => value)
        const method = strategy.toLowerCase()

        if (mode === method) {
            const result = (this as any)[method]?.(token) as boolean ?? false
            if (!result) {
                response.setStatusCode(401)
                response.end()
            }
            return result
        }

        response.setStatusCode(401)
        response.end()
        return false

    }

    private static no_auth(token: string): boolean {
        return true
    }

    private static basic(token: string): boolean {
        const [user, password] = Buffer.from(token, 'base64').toString('utf-8').split(':')
        return user === EnvironmentHelper.get('AUTH_USER') && password === EnvironmentHelper.get('AUTH_PASS')
    }

}