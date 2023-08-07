import { readFileSync } from 'fs'
import path from 'path'
import { InvalidParameterError } from '../exceptions/invalid-parameter.error'
import { HTTP, HTTPBootstrapOutput } from './http'
import { Regex } from './ioc'
import { Logger } from './logger'
import { Batch, BatchBootstrapOutput, BatchManager } from './batch'

export type Settings = { http?: boolean, batch?: boolean }
export type StartupInput = ({ logger: Logger, http?: HTTPBootstrapOutput, batch?: BatchBootstrapOutput })
export type Startup = ((input: StartupInput) => Promise<void>) | ((input: StartupInput) => void) | { module: string }
export type Shutdown = (() => Promise<void>) | (() => void) | { module: string } | undefined
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

            logger.log({ settings })

            const { http = false, batch = false } = settings

            const input: StartupInput = { logger }

            if (http) {
                input.http = await HTTP.bootstrap()
            }

            if (batch) {
                input.batch = await Batch.bootstrap()
            }

            process.on('SIGILL', exit(input, shutdown))
            process.on('SIGTERM', exit(input, shutdown))
            process.on('SIGINT', exit(input, shutdown))

            if (typeof startup === 'function') {
                await startup(input)
            } else {
                const { startup: _startup } = await import(startup.module)
                await _startup(input)
            }

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

function exit({ batch }: StartupInput, shutdown: Shutdown) {

    return async () => {
        
        await batch?.manager.stop()
        
        if (shutdown) {
            if (typeof shutdown === 'function') {
                await shutdown()
            } else {
                const { shutdown: _shutdown } = await import(shutdown.module)
                await _shutdown()
            }
        }

        process.exit(0)
    
    }

}