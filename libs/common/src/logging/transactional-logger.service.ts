/* eslint-disable @typescript-eslint/naming-convention */
import { Injectable, Logger } from '@nestjs/common'
import { ObjectHelper, StringHelper } from '../helper'
import { LoggingHelper } from './logging.helper'
import { TransactionHelper, type TransactionalContext } from '../transaction'

@Injectable()
export class TransactionalLoggerService {

    public constructor(private readonly logger: Logger) { }

    public log(clazz: string, context: TransactionalContext, value: string, details?: Record<string, any>) {

        const blocked = ['error', 'warn'].includes(LoggingHelper.getLoggerLevel())
        if (blocked) return

        const transaction = TransactionHelper.getTransactionIDFrom(context)

        const message: any = { transaction, value }

        if (!ObjectHelper.isEmpty(details)) {
            message.details = details
        }

        this.logger.log(message, clazz)

    }

    public error(clazz: string, context: TransactionalContext, value: string, error?: Error, details?: Record<string, any>) {

        const transaction = TransactionHelper.getTransactionIDFrom(context)

        const message: any = { transaction, value }

        if (!ObjectHelper.isEmpty(details)) {

            message.error = {}

            const errorName = error?.name
            if (!StringHelper.isEmpty(errorName)) {
                message.error.name = errorName
            }

            const errorMessage = error?.message
            if (!StringHelper.isEmpty(errorMessage)) {
                message.error.message = errorMessage
            }

            const errorDetails = (error as any)?.details
            if (!StringHelper.isEmpty(errorDetails)) {
                message.error.details = errorDetails
            }

            const errorStack = (error as any)?.stack
            if (!StringHelper.isEmpty(errorStack)) {
                message.error.stack = errorStack
            }

        }

        if (!ObjectHelper.isEmpty(details)) {
            message.details = details
        }

        this.logger.error(message, clazz)

    }

    public warn(clazz: string, context: TransactionalContext, value: string, details?: Record<string, any>) {

        const blocked = ['error'].includes(LoggingHelper.getLoggerLevel())
        if (blocked) return

        const transaction = TransactionHelper.getTransactionIDFrom(context)

        const message: any = { transaction, value }

        if (!ObjectHelper.isEmpty(details)) {
            message.details = details
        }

        this.logger.warn(message, clazz)

    }

    public debug?(clazz: string, context: TransactionalContext, value: string, details?: Record<string, any>) {

        const blocked = [
            'error',
            'warn',
            'info',
            'http',
            'verbose'
        ].includes(LoggingHelper.getLoggerLevel())

        if (blocked) return

        const transaction = TransactionHelper.getTransactionIDFrom(context)

        const message: any = { transaction, value }

        if (!ObjectHelper.isEmpty(details)) {
            message.details = details
        }

        this.logger.debug?.(message, clazz)

    }

    public verbose?(clazz: string, context: TransactionalContext, value: string, details?: Record<string, any>) {

        const blocked = [
            'error',
            'warn',
            'info',
            'http'
        ].includes(LoggingHelper.getLoggerLevel())

        if (blocked) return

        const transaction = TransactionHelper.getTransactionIDFrom(context)

        const message: any = { transaction, value }

        if (!ObjectHelper.isEmpty(details)) {
            message.details = details
        }

        this.logger.debug?.(message, clazz)

    }

}
