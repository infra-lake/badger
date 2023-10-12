import { type ExecutionContext, type NestInterceptor } from '@nestjs/common'
import { type CallHandler, type HttpArgumentsHost } from '@nestjs/common/interfaces'
import { type Request } from 'express'
import { type Observable } from 'rxjs'
import { LIVENESS_PROBE_PATH, READINESS_PROBE_PATH } from '../health'
import { ExecutionContextHelper } from '@badger/common/helper'
import { type TransactionalLoggerService } from './transactional-logger.service'
import { METRICS_PATH } from '../metrics'

export interface MetadataDTO {
    controller: string
    function: string
}

export abstract class LoggingInterceptor<T = any, R = any> implements NestInterceptor<T, R> {

    public constructor(
        protected readonly logger: TransactionalLoggerService
    ) { }

    abstract intercept(executionContext: ExecutionContext, next: CallHandler<T>): Observable<R> | Promise<Observable<R>>

    protected isUnloggable(http: HttpArgumentsHost) {
        const request = http.getRequest<Request>()
        return [METRICS_PATH, LIVENESS_PROBE_PATH, READINESS_PROBE_PATH].includes(request.url)
    }

    protected isHTTPRequestForWriting(http: HttpArgumentsHost) {
        const result = !this.isHTTPRequestForReading(http)
        return result
    }

    protected isHTTPRequestForReading(http: HttpArgumentsHost) {
        const request = http.getRequest<Request>()
        const method = request.method?.toUpperCase() ?? ''
        const result = ['GET', 'HEAD', 'OPTIONS'].includes(method)
        return result
    }

    protected getMetadataFrom(executionContext: ExecutionContext): MetadataDTO {
        return {
            controller: ExecutionContextHelper.getControllerFrom(executionContext),
            function: ExecutionContextHelper.getFunctionFrom(executionContext)
        }
    }

}
