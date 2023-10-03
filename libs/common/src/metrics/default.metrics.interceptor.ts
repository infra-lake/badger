import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common'
import { type HttpArgumentsHost } from '@nestjs/common/interfaces'
import { InjectMetric } from '@willsoto/nestjs-prometheus'
import { type Request } from 'express'
import { Counter } from 'prom-client'
import { tap } from 'rxjs/operators'
import { Metrics } from '.'
import { TransactionalLoggerService } from '../logging'
import { ExecutionContextHelper } from '../helper'

interface MetadataDTO {
    controller: string
    function: string
}

@Injectable()
export class DefaultMetricsInterceptor implements NestInterceptor {

    public constructor(
        @InjectMetric(Metrics.HTTP_RECEIVED_REQUESTS_TOTAL) public httpReceivedRequestsTotal: Counter<string>,
        private readonly logger: TransactionalLoggerService
    ) { }

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

    private getMetadataFrom(executionContext: ExecutionContext): MetadataDTO {
        return {
            controller: ExecutionContextHelper.getControllerFrom(executionContext),
            function: ExecutionContextHelper.getFunctionFrom(executionContext)
        }
    }

    private interceptHTTP(metadata: MetadataDTO, executionContext: ExecutionContext, next: CallHandler) {

        const http = executionContext.switchToHttp()

        this.incHTTPReceivedRequestsTotalMetric(metadata, http, 'received')

        return next.handle().pipe(tap({
            next: () => { this.incHTTPReceivedRequestsTotalMetric(metadata, http, 'success') },
            error: () => { this.incHTTPReceivedRequestsTotalMetric(metadata, http, 'error') }
        }))

    }

    private incHTTPReceivedRequestsTotalMetric(metadata: MetadataDTO, http: HttpArgumentsHost, state: 'received' | 'success' | 'error') {

        const request = http.getRequest<Request>()
        const { method, path } = request as any
        const labels: any = {
            method,
            path,
            controller: metadata.controller,
            function: metadata.function,
            state
        }

        this.httpReceivedRequestsTotal.labels(labels).inc()

    }

}
