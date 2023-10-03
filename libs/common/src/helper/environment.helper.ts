export enum Environment {
    LOCAL = 'LOCAL',
    DEVELOPMENT = 'DEVELOPMENT',
    STAGING = 'STAGING',
    PRODUCTION = 'PRODUCTION'
}

export const DEFAULT_ENVIRONMENT = 'LOCAL'

export class EnvironmentHelper {

    private constructor() { }

    public static get ENVIRONMENT(): Environment {
        const result: Environment = Environment[process.env.ENVIRONMENT ?? DEFAULT_ENVIRONMENT]
        return result ?? Environment[DEFAULT_ENVIRONMENT]
    }

}
