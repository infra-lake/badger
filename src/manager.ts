import { ManagerExploreHTTPController } from './controllers/manager/explore.http.controller'
import { ManageExportCheckHTTPController } from './controllers/manager/export/check.http.controller'
import { ManageExportCleanupHTTPController } from './controllers/manager/export/cleanup.http.controller'
import { ManagerExportCreateHTTPController } from './controllers/manager/export/create.http.controller'
import { ManageExportFindHTTPController } from './controllers/manager/export/find.http.controller'
import { ManagerExportRetryHTTPController } from './controllers/manager/export/retry.http.controller'
import { ManagerExportStopHTTPController } from './controllers/manager/export/stop.http.controller'
import { ManagerExportTaskHTTPController } from './controllers/manager/export/task.http.controller'
import { ManagerSourceHTTPController } from './controllers/manager/source.http.controller'
import { ManagerTargetHTTPController } from './controllers/manager/target.http.controller'

import { ManagerWorkerHTTPController } from './controllers/manager/worker.http.controller'
import { ApplicationHelper } from './helpers/application.helper'
import { EnvironmentHelper } from './helpers/environment.helper'
import { MetricHelper } from './helpers/metric.helper'
import { Regex, RegexApplication, StartupInput } from './regex'
import { SettingsService } from './services/settings.service'

Regex.controller(ManagerExploreHTTPController)
Regex.controller(ManagerSourceHTTPController)
Regex.controller(ManagerTargetHTTPController)
Regex.controller(ManagerWorkerHTTPController)
Regex.controller(ManageExportCheckHTTPController)
Regex.controller(ManageExportCleanupHTTPController)
Regex.controller(ManagerExportCreateHTTPController)
Regex.controller(ManageExportFindHTTPController)
Regex.controller(ManagerExportRetryHTTPController)
Regex.controller(ManagerExportStopHTTPController)
Regex.controller(ManagerExportTaskHTTPController)

export async function startup({ logger, http }: StartupInput) {

    const settings = Regex.inject(SettingsService)
    await settings.migrate()

    const port = ApplicationHelper.PORT
    http?.server.listen(port, () => {
        const version = RegexApplication.version()
        logger.log(LOGO)
        logger.log(`badger ${ApplicationHelper.MODE} v${version} was successfull started on port`, port)
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
            default_stamp_dataset_name_prefix: EnvironmentHelper.get('DEFAULT_STAMP_DATASET_NAME_PREFIX'),
            voter_url: EnvironmentHelper.get('VOTER_URL')
        }
        MetricHelper.service_state_up.set(labels, 1)
        logger.log('environments:', Object.keys(labels).map(key => `${key.toLocaleUpperCase()}: "${labels[key]}"`))
    })

}

const LOGO = `\n
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░██████╗░░█████╗░██████╗░░██████╗░███████╗██████╗░░░░░░░░░░░░░░░
░░██╔══██╗██╔══██╗██╔══██╗██╔════╝░██╔════╝██╔══██╗░░░░░░░░░░░░░░
░░██████╦╝███████║██║░░██║██║░░██╗░█████╗░░██████╔╝░░░░░░░░░░░░░░
░░██╔══██╗██╔══██║██║░░██║██║░░╚██╗██╔══╝░░██╔══██╗░░░░░░░░░░░░░░
░░██████╦╝██║░░██║██████╔╝╚██████╔╝███████╗██║░░██║░░░░░░░░░░░░░░
░░╚═════╝░╚═╝░░╚═╝╚═════╝░░╚═════╝░╚══════╝╚═╝░░╚═╝░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░███╗░░░███╗░█████╗░███╗░░██╗░█████╗░░██████╗░███████╗██████╗░░░
░░████╗░████║██╔══██╗████╗░██║██╔══██╗██╔════╝░██╔════╝██╔══██╗░░
░░██╔████╔██║███████║██╔██╗██║███████║██║░░██╗░█████╗░░██████╔╝░░
░░██║╚██╔╝██║██╔══██║██║╚████║██╔══██║██║░░╚██╗██╔══╝░░██╔══██╗░░
░░██║░╚═╝░██║██║░░██║██║░╚███║██║░░██║╚██████╔╝███████╗██║░░██║░░
░░╚═╝░░░░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚═╝░░╚═╝░╚═════╝░╚══════╝╚═╝░░╚═╝░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
`