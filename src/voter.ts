import { VoterBatchController } from './controllers/voter/batch.controller'
import { VoterHTTPController } from './controllers/voter/http.controller'
import { ApplicationHelper } from './helpers/application.helper'
import { EnvironmentHelper } from './helpers/environment.helper'
import { MetricHelper } from './helpers/metric.helper'
import { WorkerHelper } from './helpers/worker.helper'
import { Regex, RegexApplication, StartupInput } from './regex'
import { SettingsService } from './services/settings.service'

Regex.controller(VoterBatchController)
Regex.controller(VoterHTTPController)

export async function startup({ logger, http, batch }: StartupInput) {

    const settings = Regex.inject(SettingsService)
    await settings.migrate()

    const port = ApplicationHelper.PORT
    http?.server.listen(port, async () => {
        const version = RegexApplication.version()
        logger.log(LOGO)
        logger.log(`badger v${version} was successfull started on port`, port)
        await batch?.manager.start()
        const labels: any = {
            version: EnvironmentHelper.get('PROJECT_VERSION'),
            log_mode: EnvironmentHelper.get('LOG_MODE'),
            port: EnvironmentHelper.get('PORT'),
            mode: EnvironmentHelper.get('MODE'),
            ignore_collections: EnvironmentHelper.get('IGNORE_COLLECTIONS'),
            auth_mode: EnvironmentHelper.get('AUTH_MODE'),
            mongodb_database: EnvironmentHelper.get('MONGODB_DATABASE'),
            default_stamp_insert: EnvironmentHelper.get('DEFAULT_STAMP_INSERT'),
            default_stamp_update: EnvironmentHelper.get('DEFAULT_STAMP_UPDATE'),
            default_stamp_id: EnvironmentHelper.get('DEFAULT_STAMP_ID'),
            default_stamp_dataset_name_prefix: EnvironmentHelper.get('DEFAULT_STAMP_DATASET_NAME_PREFIX')
        }
        WorkerHelper
            .ENVS
            .map(({ key, value }) => ({ key: key.trim().toLocaleLowerCase(), value }))
            .forEach(({ key, value }) => { labels[key] = value })
        MetricHelper.service_state_up.set(labels, 1)
        logger.log('environments:', Object.keys(labels).map(key => `${key.toLocaleUpperCase()}:"${labels[key]}"`))
    })

}

const LOGO = `\n
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░██████╗░░█████╗░██████╗░░██████╗░███████╗██████╗░░░
░░██╔══██╗██╔══██╗██╔══██╗██╔════╝░██╔════╝██╔══██╗░░
░░██████╦╝███████║██║░░██║██║░░██╗░█████╗░░██████╔╝░░
░░██╔══██╗██╔══██║██║░░██║██║░░╚██╗██╔══╝░░██╔══██╗░░
░░██████╦╝██║░░██║██████╔╝╚██████╔╝███████╗██║░░██║░░
░░╚═════╝░╚═╝░░╚═╝╚═════╝░░╚═════╝░╚══════╝╚═╝░░╚═╝░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░██╗░░░██╗░█████╗░████████╗███████╗██████╗░░░░░░░░░░
░░██║░░░██║██╔══██╗╚══██╔══╝██╔════╝██╔══██╗░░░░░░░░░
░░╚██╗░██╔╝██║░░██║░░░██║░░░█████╗░░██████╔╝░░░░░░░░░
░░░╚████╔╝░██║░░██║░░░██║░░░██╔══╝░░██╔══██╗░░░░░░░░░
░░░░╚██╔╝░░╚█████╔╝░░░██║░░░███████╗██║░░██║░░░░░░░░░
░░░░░╚═╝░░░░╚════╝░░░░╚═╝░░░╚══════╝╚═╝░░╚═╝░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
`