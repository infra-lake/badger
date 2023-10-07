import { type TransactionalLoggerService } from '../logging'
import { type TransactionalContext } from '../transaction'

export abstract class ConverterService<Source = undefined, Target = undefined> {

    public constructor(protected readonly logger: TransactionalLoggerService) { }

    public abstract convert(context: TransactionalContext, input: Source): Promise<Target>

    protected abstract validate(context: TransactionalContext, input: Source): Promise<void>

}
