import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { type MongooseModuleOptions, type MongooseOptionsFactory } from '@nestjs/mongoose'
import { type MongooseError } from 'mongoose'

export const DEFAULT_MONGODB_URL = 'mongodb://mongodb:mongodb@localhost:27017'
export const DEFAULT_MONGODB_DATABASE = 'settings'
export const DEFAULT_MONGODB_MIN_POOL_SIZE = 1
export const DEFAULT_MONGODB_MAX_POOL_SIZE = 5

@Injectable()
export class MongoDBConfigService implements MongooseOptionsFactory {

    constructor(private readonly config: ConfigService) { }

    private _connectionStatus = 'disconnected'
    public get connectionStatus() { return this._connectionStatus }

    public createMongooseOptions(): MongooseModuleOptions {

        const uri = this.config.get('MONGODB_URL', DEFAULT_MONGODB_URL)
        const database = this.config.get('MONGODB_DATABASE', DEFAULT_MONGODB_DATABASE)
        const minPoolSize = this.config.get<number>('MONGODB_MIN_POOL_SIZE', DEFAULT_MONGODB_MIN_POOL_SIZE)
        const maxPoolSize = this.config.get<number>('MONGODB_MAX_POOL_SIZE', DEFAULT_MONGODB_MAX_POOL_SIZE)

        return {
            uri,
            dbName: database,
            minPoolSize,
            maxPoolSize,
            connectionFactory: (connection: any) => {
                this._connectionStatus = 'connected'
                return connection
            },
            connectionErrorFactory: (error: MongooseError) => {
                Logger.error({
                    message: 'error on mongodb connection',
                    error: {
                        name: error?.name,
                        message: error?.message,
                        stack: error?.stack
                    }
                }, MongoDBConfigService.name)
                this._connectionStatus = 'disconnected'
                return error
            }
        }

    }

}
