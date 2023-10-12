import { Injectable, type CallHandler, type ExecutionContext } from '@nestjs/common'
import { type HttpArgumentsHost } from '@nestjs/common/interfaces'
import { type Request } from 'express'
import { tap } from 'rxjs/operators'
import { LoggingHelper } from './logging.helper'
import { TransactionalLoggerService } from './transactional-logger.service'
import { LoggingInterceptor, type MetadataDTO } from './logging.interceptor'
import { METRICS_PATH } from '../metrics'
import { LIVENESS_PROBE_PATH, READINESS_PROBE_PATH } from '../health'

type LogHTTPRequestStep = 'before-execution' | 'after-execution'

@Injectable()
export class DefaultLoggingInterceptor extends LoggingInterceptor {

    public constructor(logger: TransactionalLoggerService) {
        super(logger)
    }

    public intercept(executionContext: ExecutionContext, next: CallHandler) {

        const type = executionContext.getType()
        const metadata = this.getMetadataFrom(executionContext)

        switch (type) {
            case 'http':
                return this.interceptHTTP(metadata, executionContext, next)
        }

        this.logger.warn(metadata.controller, executionContext, `logging interceptor was not implemented for execution context type "${type}"`)

        return next.handle()

    }

    // HTTP...

    private interceptHTTP(metadata: MetadataDTO, executionContext: ExecutionContext, next: CallHandler) {

        const http = executionContext.switchToHttp()

        this.logHTTPRequest('before-execution', metadata, http)

        return next.handle().pipe(tap({
            next: (result) => {
                this.logHTTPRequest('after-execution', metadata, http, result)
            },
            error: (error: Error) => {
                this.logger.error(metadata.controller, http, 'fail to handle http request', error)
            }
        }))

    }

    private logHTTPRequest(step: LogHTTPRequestStep, metadata: MetadataDTO, http: HttpArgumentsHost, result?: any) {

        if (this.isUnloggable(http)) {
            return
        }

        if (this.isHTTPRequestForWriting(http)) {
            const { message, value } = this.getLogEntryForHTTPRequest(metadata, http, step, result)
            this.logger.log(metadata.controller, http, message, value)
            return
        }

        if (['verbose', 'debug', 'silly'].includes(LoggingHelper.getLoggerLevel())) {
            const { message, value } = this.getLogEntryForHTTPRequest(metadata, http, step, result)
            this.logger.verbose?.(metadata.controller, http, message, value)
        }

    }

    private getLogEntryForHTTPRequest(metadata: MetadataDTO, http: HttpArgumentsHost, step: LogHTTPRequestStep, result: any) {

        const message =
            step === 'before-execution'
                ? 'new request received'
                : 'request processed successfully'

        const entry: any = { message, value: {} }

        if (step === 'before-execution') {
            entry.value.function = metadata.function
            entry.value.http = this.getHTTPInfo(http)
        } else {
            entry.value.result = result ?? 'void'
        }

        return entry

    }

    private getHTTPInfo(http: HttpArgumentsHost) {

        const request = http.getRequest<Request>()

        const { url, method } = request

        if (LoggingHelper.getLoggerLevel() !== 'debug') {
            return { request: { url, method } }
        }

        if ([LIVENESS_PROBE_PATH, READINESS_PROBE_PATH, METRICS_PATH].includes(url) &&
            LoggingHelper.getLoggerLevel() !== 'silly') {
            return { request: { url, method } }
        }

        const { httpVersion, headers: _headers } = http.getRequest<Request>()

        const headers: any = {}
        headers.accept = _headers?.accept
        headers.connection = _headers?.connection
        headers.host = _headers?.host
        headers['accept-encoding'] = _headers?.['accept-encoding']
        headers['accept-language'] = _headers?.['accept-language']
        headers['content-length'] = _headers?.['content-length']
        headers['sec-fetch-mode'] = _headers?.['sec-fetch-mode']
        headers['user-agent'] = _headers?.['user-agent']

        return { request: { url, httpVersion, method, headers } }

    }

}
