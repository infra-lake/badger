import { type ArgumentsHost, type ExecutionContext } from '@nestjs/common'
import { type HttpArgumentsHost } from '@nestjs/common/interfaces'
import { type Request } from 'express'

export type TransactionalContext =
    ExecutionContext
    | ArgumentsHost
    | HttpArgumentsHost
    | Request
    | string
    | undefined
    | null
