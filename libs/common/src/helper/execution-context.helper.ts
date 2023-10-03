import { type ExecutionContext } from '@nestjs/common'

export class ExecutionContextHelper {

    private constructor() { }

    public static getControllerFrom(executionContext: ExecutionContext) {
        return executionContext.getClass().name
    }

    public static getFunctionFrom(executionContext: ExecutionContext) {
        return `${executionContext.getHandler().name}()`
    }

}
