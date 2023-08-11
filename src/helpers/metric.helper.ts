import { Counter, Gauge, collectDefaultMetrics, register } from 'prom-client'
import { EnvironmentHelper } from './environment.helper'

export class MetricHelper {

    private static configured = false

    private static _http_received_request_total = new Counter({
        name: 'http_received_request_total',
        help: 'Total of Received HTTP Requests',
        labelNames: ['method', 'path', 'status']
    })
    public static get http_received_request_total() { return MetricHelper._http_received_request_total }

    private static _service_exponential_backoff_total = new Gauge({
        name: 'service_exponential_backoff_total',
        help: 'Exponential Backoff of Service'
    })
    public static get service_exponential_backoff_total() { return MetricHelper._service_exponential_backoff_total }

    private static _service_state_up = new Gauge({
        name: 'service_state_up',
        help: 'State of Service',
        labelNames: [
            'version',
            'log_mode',
            'port',
            'mode',
            'ignore_collections',
            'auth_mode',
            'mongodb_database',
            'default_stamp_insert',
            'default_stamp_update',
            'default_stamp_id',
            'default_stamp_dataset_name_prefix',
        ]
    })
    public static get service_state_up() { return MetricHelper._service_state_up }

    public static config() {

        if (MetricHelper.configured) {
            return
        }

        collectDefaultMetrics()

        register.setDefaultLabels({
            service: EnvironmentHelper.get('PROJECT_NAME'),
            service_version: EnvironmentHelper.get('PROJECT_VERSION')
        })

        MetricHelper.configured = true

    }

    public static get contentType() { return register.contentType }
    public static async payload() { return await register.metrics() }

}
