import { type App } from 'libs/common/src/types'
import { makeCounterProvider, makeGaugeProvider, type PrometheusOptions } from '@willsoto/nestjs-prometheus'
import { name, version } from '../../../../package.json'
import { MetricsController } from './metrics.controller'

export const METRICS_PATH = '/metrics'

export enum Metrics {
    SERVICE_STATE_UP = 'service_state_up',
    HTTP_RECEIVED_REQUESTS_TOTAL = 'http_received_requests_total',
}

function getServiceStateUpProvider(app: App) {
    return makeGaugeProvider({
        name: Metrics.SERVICE_STATE_UP,
        help: 'Situação do serviço'
    })
}

function getHTTPReceivedRequestsTotalProvider() {
    return makeCounterProvider({
        name: Metrics.HTTP_RECEIVED_REQUESTS_TOTAL,
        help: 'Quantidade total de requisições HTTP recebidas',
        labelNames: [
            'method',
            'path',
            'controller',
            'function',
            'state'
        ]
    })
}

export class MetricsHelper {

    private constructor() { }

    public static getOptions(service: App): PrometheusOptions {
        return {
            path: METRICS_PATH,
            controller: MetricsController,
            defaultLabels: {
                app: name,
                version,
                service
            }
        }
    }

    public static getMetricsFor(app: App) {

        const result = [
            getServiceStateUpProvider(app), getHTTPReceivedRequestsTotalProvider()
        ]

        return result

    }

}
