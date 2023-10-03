import { type TransactionalLoggerService } from '../logging'
import { type TransactionalContext } from '../transaction'

export abstract class StateService<K, V, R = void> {

    public constructor(protected readonly logger: TransactionalLoggerService) { }

    public abstract apply(context: TransactionalContext, key: K, value: V): Promise<R>
    protected abstract validate(context: TransactionalContext, key: K, value: V): Promise<void>

}
