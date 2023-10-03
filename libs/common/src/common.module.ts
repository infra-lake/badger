import { HttpModule } from '@nestjs/axios'
import { Logger, Module, type DynamicModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { PassportModule } from '@nestjs/passport'
import { PrometheusModule } from '@willsoto/nestjs-prometheus'
import { type App } from 'libs/common/src/types'
import { AuthConfigService, BasicAuthStrategy, NoAuthStrategy } from './auth'
import { HealthController } from './health'
import { DefaultLoggingInterceptor, TransactionalLoggerService } from './logging'
import { DefaultMetricsInterceptor, MetricsHelper } from './metrics'
import { MongoDBConfigService } from './mongodb'

@Module({
    imports: [
        ConfigModule.forRoot(),
        PassportModule,
        HttpModule,
        MongooseModule.forRootAsync({
            imports: [ConfigModule.forRoot()],
            useClass: MongoDBConfigService
        })
    ],
    providers: [
        Logger,
        TransactionalLoggerService,
        DefaultLoggingInterceptor,
        AuthConfigService,
        NoAuthStrategy,
        BasicAuthStrategy,
        MongoDBConfigService
    ],
    exports: [
        Logger,
        TransactionalLoggerService,
        DefaultLoggingInterceptor,
        AuthConfigService
    ],
    controllers: [HealthController]
})
export class CommonModule {
    public static forRoot(app: App): DynamicModule {
        const metrics = MetricsHelper.getMetricsFor(app)
        return {
            module: CommonModule,
            imports: [
                PrometheusModule.register(
                    MetricsHelper.getOptions(app)
                )
            ],
            providers: [...metrics, DefaultMetricsInterceptor],
            exports: [...metrics, DefaultMetricsInterceptor]
        }
    }
}
