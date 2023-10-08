import { LIVENESS_PROBE_PATH, READINESS_PROBE_PATH } from '@badger/common/health'
import { ApplicationHelper, NestHelper, SwaggerHelper } from '@badger/common/helper'
import { DefaultLoggingInterceptor, LoggingHelper } from '@badger/common/logging'
import { DefaultMetricsInterceptor, METRICS_PATH } from '@badger/common/metrics'
import { App } from '@badger/common/types'
import { NestFactory } from '@nestjs/core'
import { ManagerConfigService } from './manager.config.service'
import { ManagerModule } from './manager.module'

const logger = LoggingHelper.getDefaultLoggerService()
const OBSERVABILITY_PATHS = [
    METRICS_PATH, LIVENESS_PROBE_PATH, READINESS_PROBE_PATH
]

async function bootstrap() {

    const app = await NestFactory.create(ManagerModule, {
        logger
    })

    app.useGlobalInterceptors(
        app.get(DefaultLoggingInterceptor),
        app.get(DefaultMetricsInterceptor)
    )

    app.setGlobalPrefix(ApplicationHelper.BASE_API_PATH, {
        exclude: OBSERVABILITY_PATHS
    })

    NestHelper.register(app)
    SwaggerHelper.setup(app, App.MANAGER)

    const config = app.get(ManagerConfigService)

    await app.listen(config.port)

}

bootstrap()
    .catch(
        (error: Error) => {
            logger.error({
                message: 'error on bootstrap',
                error: {
                    name: error?.name,
                    message: error?.message,
                    stack: error?.stack
                }
            })
        }
    )
