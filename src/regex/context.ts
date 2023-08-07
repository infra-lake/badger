import { Logger } from "./logger"

export interface TransactionalContext {
    get transaction(): string
    set transaction(value: string)
    logger: Logger
}