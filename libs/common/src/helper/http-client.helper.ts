import { type HttpService } from '@nestjs/axios'
import { AxiosError, type AxiosRequestConfig, type AxiosResponse, type Method } from 'axios'
import { lastValueFrom } from 'rxjs'
import { LoggingHelper, TransactionalLoggerService } from '../logging'
import { TransactionHelper, type TransactionalContext } from '../transaction'
import { NestHelper } from './nest.helper'
import { ObjectHelper } from './object.helper'
import { AuthConfigService, AuthStrategyType } from '../auth'

export type HttpRequestInput = AxiosRequestConfig & { method?: Method, throwErrorOnNotSuccess?: boolean }

export class HTTPClientHelper {

    private constructor() { }

    public static async request<T = any>(context: TransactionalContext, http: HttpService, config: HttpRequestInput): Promise<AxiosResponse<T>> {

        const logger = NestHelper.getOrThrow(TransactionalLoggerService)

        try {

            config.headers = config?.headers ?? {}
            config.headers[TransactionHelper.HEADER_TRANSACTION_ID] = TransactionHelper.getTransactionIDFrom(context)

            const data = ObjectHelper.isNullOrUndefined(config?.data) ? {} : config.data

            const value = {
                headers: config.headers,
                body: data
            }

            if (LoggingHelper.getLoggerLevel() === 'debug') {
                logger.debug?.(HTTPClientHelper.name, context, 'sending http request', value)
            }

            const response = await lastValueFrom(
                http.request<T>(config)
            )

            if (LoggingHelper.getLoggerLevel() === 'debug') {
                logger?.debug?.(HTTPClientHelper.name, context, 'http request was sent successfully')
            }

            const throwErrorOnNotSuccess = config.throwErrorOnNotSuccess ?? true
            if (throwErrorOnNotSuccess && HTTPClientHelper.isError(response)) {
                throw new AxiosError(response.statusText, response.status.toString(), response.config, response.request, response)
            }

            return response

        } catch (error) {

            if ('response' in error) {
                return error.response
            }

            throw error
        }

    }

    public static isSuccess({ status }: { status: number }) {
        const result = status >= 200 && status < 300
        return result
    }

    public static isError(response: { status: number }) {
        const result = !HTTPClientHelper.isSuccess(response)
        return result
    }

    public static withBasicAuthorizationHeaders() {

        if (AuthConfigService.STRATEGY === AuthStrategyType.NO) {
            return {}
        }

        const service = NestHelper.get(AuthConfigService)

        const { username, password } = service.basic

        const digest = Buffer.from(`${username}:${password}`).toString('base64')

        return {
            Authorization: `Basic ${digest}`
        }

    }

}
