import path from 'path'
import { readFileSync } from 'fs'
import { InvalidParameterError } from '../exceptions/invalidparameter.error'
import { HTTP, HTTPBootstrapOutput } from './http'
import { Regex } from './ioc'
import { Logger } from './logger'
import { RabbitMQ, RabbitMQBootstrapOutput } from './rabbitmq'

export type Settings = { http?: boolean, rabbitmq?: boolean }
export type StartupInput = ({ logger: Logger, http?: HTTPBootstrapOutput, rabbitmq?: RabbitMQBootstrapOutput })
export type Startup = ((input: StartupInput) => Promise<void>) | ((input: StartupInput) => void)
export type Shutdown = (() => Promise<void>) | (() => void) | undefined
export type RegexAppCreateInput = { settings: Settings, startup: Startup, shutdown?: Shutdown }

export class RegexApplication {

    private static _TICK = 5000
    public static get TICK() { return RegexApplication._TICK }
    public static set TICK(value: number) {
        if ((value ?? 0) <= 0) {
            throw new InvalidParameterError('tick', 'must be greater than zero')
        }
        RegexApplication._TICK = value
    }

    public static async create({ settings, startup, shutdown }: RegexAppCreateInput) {

        const logger = Regex.register(Logger)

        try {

            logger.log(`\n
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░██████╗░███████╗░██████╗░███████╗██╗░░██╗░░███████╗██████╗░░█████╗░███╗░░░███╗███████╗░██╗░░░░░░░██╗░█████╗░██████╗░██╗░░██╗░░
░░██╔══██╗██╔════╝██╔════╝░██╔════╝╚██╗██╔╝░░██╔════╝██╔══██╗██╔══██╗████╗░████║██╔════╝░██║░░██╗░░██║██╔══██╗██╔══██╗██║░██╔╝░░
░░██████╔╝█████╗░░██║░░██╗░█████╗░░░╚███╔╝░░░█████╗░░██████╔╝███████║██╔████╔██║█████╗░░░╚██╗████╗██╔╝██║░░██║██████╔╝█████═╝░░░
░░██╔══██╗██╔══╝░░██║░░╚██╗██╔══╝░░░██╔██╗░░░██╔══╝░░██╔══██╗██╔══██║██║╚██╔╝██║██╔══╝░░░░████╔═████║░██║░░██║██╔══██╗██╔═██╗░░░
░░██║░░██║███████╗╚██████╔╝███████╗██╔╝╚██╗░░██║░░░░░██║░░██║██║░░██║██║░╚═╝░██║███████╗░░╚██╔╝░╚██╔╝░╚█████╔╝██║░░██║██║░╚██╗░░
░░╚═╝░░╚═╝╚══════╝░╚═════╝░╚══════╝╚═╝░░╚═╝░░╚═╝░░░░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░░░░╚═╝╚══════╝░░░╚═╝░░░╚═╝░░░╚════╝░╚═╝░░╚═╝╚═╝░░╚═╝░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
            `)

            process.on('SIGILL', exit(shutdown))
            process.on('SIGTERM', exit(shutdown))
            process.on('SIGINT', exit(shutdown))

            const { http = false, rabbitmq = false } = settings

            const input: StartupInput = { logger }

            if (http) {
                input.http = await HTTP.bootstrap()
            }

            if (rabbitmq) {
                input.rabbitmq = await RabbitMQ.bootstrap()
            }

            await startup(input)

        } catch (error) {
            logger.error('unexpected error:', error)
        } finally {
            Regex.unregister(logger)
        }

    }

    public static version() {
        const { version } = JSON.parse(readFileSync(path.join(`${__dirname}/../../package.json`)).toString('utf-8'))
        return version
    }

}

function exit(shutdown: Shutdown) {
    return async () => {
        if (shutdown) {
            await shutdown()
        }
        process.exit(0)
    }
}