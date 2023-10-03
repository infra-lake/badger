/* eslint-disable no-case-declarations */
import { type ArgumentsHost, type ExecutionContext } from '@nestjs/common'
import { type HttpArgumentsHost } from '@nestjs/common/interfaces'
import { randomUUID } from 'crypto'
import { type Request } from 'express'
import { type TransactionalContext } from './transactional.context'
import { StringHelper } from '../helper'

export class TransactionHelper {

    public static readonly HEADER_TRANSACTION_ID: string = 'x-badger-transaction-id'

    private constructor() { }

    public static newTransactionalContext(): TransactionalContext {
        return randomUUID()
    }

    public static getTransactionIDFrom(context: TransactionalContext) {

        if (context === null || context === undefined) {
            return randomUUID()
        }

        if (typeof context === 'string') {
            return StringHelper.isEmpty(context)
                ? randomUUID()
                : context
        }

        if ('getClass' in context) {
            return TransactionHelper.getTransactionIDFromExecutionContext(context)
        }

        if ('getType' in context) {
            return TransactionHelper.getTransactionIDFromArgumentHost(context)
        }

        if ('getRequest' in context) {
            return TransactionHelper.getTransactionIDFromHTTPArgumentHost(context)
        }

        if ('headers' in context) {
            return TransactionHelper.getTransactionIDFromHTTPRequest(context)
        }

        throw new Error('parameter "context" is invalid')

    }

    private static getTransactionIDFromArgumentHost(context: ArgumentsHost) {

        const type = context.getType()

        switch (type) {
            case 'http':
                const http = context.switchToHttp()
                return TransactionHelper.getTransactionIDFromHTTPArgumentHost(http)

        }

        throw new Error(`the type "${context.getType()}" is invalid valid`)

    }

    private static getTransactionIDFromExecutionContext(context: ExecutionContext): string {
        return TransactionHelper.getTransactionIDFromArgumentHost(context)
    }

    private static getTransactionIDFromHTTPArgumentHost(context: HttpArgumentsHost) {
        const request = context.getRequest<Request>()
        return TransactionHelper.getTransactionIDFromHTTPRequest(request)
    }

    private static getTransactionIDFromHTTPRequest(context: Request) {
        const headers = context.headers
        headers[TransactionHelper.HEADER_TRANSACTION_ID] = headers[TransactionHelper.HEADER_TRANSACTION_ID] as string ?? randomUUID()
        return headers[TransactionHelper.HEADER_TRANSACTION_ID] as string
    }

}
