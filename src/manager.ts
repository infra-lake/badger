import { ManagerExploreHTTPController } from './controllers/manager/explore.http.controller'
import { ManagerCommandExportHTTPController } from './controllers/manager/export.command.http.controller'
import { ManagerQueryExportHTTPController } from './controllers/manager/export.query.http.controller'
import { ManagerHTTPController } from './controllers/manager/http.controller'
import { ManagerWorkerHTTPController } from './controllers/manager/worker.http.controller'
import { ApplicationHelper } from './helpers/application.helper'
import { Regex, RegexApplication, StartupInput } from './regex'
import { SettingsService } from './services/settings.service'

Regex.controller(ManagerWorkerHTTPController)
Regex.controller(ManagerHTTPController)
Regex.controller(ManagerExploreHTTPController)
Regex.controller(ManagerCommandExportHTTPController)
Regex.controller(ManagerQueryExportHTTPController)

export async function startup({ logger, http }: StartupInput) {

    const settings = Regex.inject(SettingsService)
    await settings.migrate()

    const port = ApplicationHelper.PORT
    http?.server.listen(port, () => {
        const version = RegexApplication.version()
        logger.log(LOGO)
        logger.log(`badger ${ApplicationHelper.MODE} v${version} was successfull started on port`, port)
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