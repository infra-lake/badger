import http from 'http'
import https from 'https'
import { HTTPIncomingMessage, HTTPServerResponse, LogMode, Logger, Regex } from '../regex'
import { AuthHelper } from './auth.helper'
import { ObjectHelper } from './object.helper'
import { ResilienceHelper } from './resilience.helper'

export type HTTPRequestInput<T extends 'http' | 'https'> = { logger?: Logger, url: string, options: T extends 'http' ? http.RequestOptions : https.RequestOptions, body?: any }

export type HTTPHelperIncomingInput = { logger?: Logger, message: http.IncomingMessage }

export type HTTPHelperHeadersInput = { authenticated: boolean, extras?: any }

export class HTTPHelper {

    public static readonly HTTP_HEADER_TRANSACTION = 'x-badger-transaction'

    public static incoming({ logger, message }: HTTPHelperIncomingInput): HTTPIncomingMessage {

        const request = message as any as HTTPIncomingMessage

        request.logger = ObjectHelper.has(logger) ? logger as Logger : Regex.register(Logger, request.headers?.[HTTPHelper.HTTP_HEADER_TRANSACTION])
        request.transaction = request.logger.transaction as string

        request.getURL = () => new URL(request.url as string, `http://${request.headers.host}`)
        request.body = async () => {
            const body = await HTTPHelper.body(request)
            if (request.logger.mode === LogMode.DEBUG) {
                request.logger.debug('received body:', { body })
            }
            return body
        }
        request.json = async <T>() => JSON.parse(await request.body()) as T
        request.ok = () => {
            const { statusCode = 0 } = request
            return statusCode >= 200 && statusCode < 300
        }

        if (request.logger.mode === LogMode.DEBUG) {
            const { headers } = request
            request.logger.debug('received headers:', { headers })
        }

        return request

    }

    public static response(response: http.ServerResponse): HTTPServerResponse {

        const _response = response as any as HTTPServerResponse

        _response.setStatusCode = value => {
            if (value === 401 || value === 423 || value === 429 || value >= 500) {
                ResilienceHelper.increment()
                _response.setHeader('Retry-After', ResilienceHelper.backoff())
            }
            _response.statusCode = value
        }

        return _response

    }

    public static async body(request: HTTPIncomingMessage) {
        return new Promise<string>((resolve, reject) => {
            let data = ''
            request
                .on('data', (chunk: string) => data += chunk)
                .on('end', () => resolve(data))
                .on('error', reject)
        })
    }

    public static async request<T extends 'http' | 'https'>({ logger, url, options, body }: HTTPRequestInput<T>) {

        const type = url.startsWith('http:') ? 'http' : 'https' as T

        const { request: _request } = type === 'http' ? http : https

        return new Promise<HTTPIncomingMessage>((resolve, reject) => {

            options.headers = options.headers ?? {}
            options.headers[HTTPHelper.HTTP_HEADER_TRANSACTION] = logger?.transaction

            const __request = _request(new URL(url), options, async (message: http.IncomingMessage) => {

                const _message = HTTPHelper.incoming({ logger, message })

                if (!_message.ok()) {
                    const { headers } = _message
                    const cause = {
                        request: { url, options },
                        response: { headers, body: await _message.body() }
                    }
                    reject(new Error(`${_message.statusCode} - ${_message.statusMessage} at ${url}`, { cause }))
                    return
                }

                resolve(_message)

            })
            __request.on('error', reject)

            if (ObjectHelper.has(body)) {
                __request.write(JSON.stringify(body))
            }

            __request.end()

        })

    }

    public static headers({ authenticated, extras }: HTTPHelperHeadersInput) {
        const auth = authenticated ? AuthHelper.header() : {}
        return {
            ...extras,
            ...auth
        }
    }

}