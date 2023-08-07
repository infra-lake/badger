import { randomUUID } from 'crypto'
import { EnvironmentHelper } from '../helpers/environment.helper'
import { TransactionalContext } from './context'
import { HTTPIncomingMessage } from './http'

export enum LogMode {
    DEBUG = 'debug',
    INFO = 'info'
}

export class Logger implements TransactionalContext {

    public static get regex() { return '{random}' }

    private _transaction: string

    constructor(__transaction?: string) {
        this._transaction = __transaction ?? randomUUID()
    }

    public static from(request: HTTPIncomingMessage) {
        return request.logger as Logger
    }

    public get logger() { return this }
    
    public get transaction() { return this._transaction }
    public set transaction(transaction: string) { this._transaction = transaction }

    public get mode() { return (LogMode as any)[EnvironmentHelper.get('LOG_MODE', 'info')] as LogMode }

    public error(message: any, ...fields: any[]) { console.error(this.transaction, message, ...fields) }
    public warn(message: any, ...fields: any[]) { console.warn(this.transaction, message, ...fields) }
    public log(message: any, ...fields: any[]) { console.log(this.transaction, message, ...fields) }
    public info(message: any, ...fields: any[]) { console.info(this.transaction, message, ...fields) }
    public debug(message: any, ...fields: any[]) {
        if (this.mode === LogMode.DEBUG) {
            console.debug(this.transaction, message, ...fields)
        }
    }

}