import { type LoggerService } from '@nestjs/common'
import { WinstonModule, type WinstonModuleOptions } from 'nest-winston'
import { config, format, transports } from 'winston'
import { Environment, EnvironmentHelper } from '../helper'

export const DEFAULT_LOG_LEVEL_LOCAL = 'verbose'
export const DEFAULT_LOG_LEVEL_DEVELOPMENT = 'verbose'
export const DEFAULT_LOG_LEVEL_STAGING = 'http'
export const DEFAULT_LOG_LEVEL_PRODUCTION = 'error'

export type LoggerLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly'

export class LoggingHelper {

    private static singleton: LoggerService

    private constructor() { }

    public static getDefaultLoggerService(): LoggerService {

        if (LoggingHelper.singleton === null || LoggingHelper.singleton === undefined) {
            const options = LoggingHelper.getDefaultLoggerOptions()
            LoggingHelper.singleton = WinstonModule.createLogger(options)
        }

        return LoggingHelper.singleton

    }

    private static getDefaultLoggerOptions(): WinstonModuleOptions {

        const level = LoggingHelper.getLoggerLevel()

        return {
            level,
            levels: config.npm.levels,
            transports: [
                new transports.Console({
                    format: format.json()
                })
            ]
        }

    }

    public static getLoggerLevel(): LoggerLevel {

        const environment = EnvironmentHelper.ENVIRONMENT
        const level: LoggerLevel = process.env.LOG_LEVEL?.trim().toLowerCase() as LoggerLevel

        switch (environment) {
            case Environment.LOCAL: return level ?? DEFAULT_LOG_LEVEL_LOCAL
            case Environment.DEVELOPMENT: return level ?? DEFAULT_LOG_LEVEL_DEVELOPMENT
            case Environment.STAGING: return level ?? DEFAULT_LOG_LEVEL_STAGING
            case Environment.PRODUCTION: return level ?? DEFAULT_LOG_LEVEL_PRODUCTION
            default: return level ?? DEFAULT_LOG_LEVEL_LOCAL
        }

    }

}
