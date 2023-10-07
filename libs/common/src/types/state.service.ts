import { type TransactionalLoggerService } from '../logging'
import { type TransactionalContext } from '../transaction'

export abstract class StateService<K = undefined, V = undefined, R = void> {

    public constructor(protected readonly logger: TransactionalLoggerService) { }

    public async apply(context: TransactionalContext, key: K, value: V): Promise<R> {

        this.logger.log(this.constructor.name, context, 'changing state')

        await this.before(context, key, value)

        const result = await this.change(context, key, value)

        await this.after(context, result)

        this.logger.log(this.constructor.name, context, 'state changed')

        return result

    }

    protected abstract validate(context: TransactionalContext, key: K, value: V): Promise<void>
    protected abstract change(context: TransactionalContext, key: K, value: V): Promise<R>
    protected abstract before(context: TransactionalContext, key: K, value: V): Promise<void>
    protected abstract after(context: TransactionalContext, result: R): Promise<void>

}
