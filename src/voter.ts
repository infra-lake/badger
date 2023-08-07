import { VoterBatchController } from './controllers/voter/batch.controller'
import { ApplicationHelper } from './helpers/application.helper'
import { Regex, RegexApplication, StartupInput } from './regex'
import { SettingsService } from './services/settings.service'

Regex.controller(VoterBatchController)

export async function startup({ logger, http, batch }: StartupInput) {

    const settings = Regex.inject(SettingsService)
    await settings.migrate()

    const port = ApplicationHelper.PORT
    http?.server.listen(port, async () => {
        const version = RegexApplication.version()
        logger.log(LOGO)
        logger.log(`badger v${version} was successfull started on port`, port)
        await batch?.manager.start()
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