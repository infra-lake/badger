import { Regex } from '../regex'
import { EnvironmentHelper } from './environment.helper'

export enum ApplicationMode {
    MANAGER = 'manager',
    WORKER = 'worker',
    VOTER = 'voter',
    MONOLITH = 'monolith'
}

export class ApplicationHelper {

    public static get MODE() {
        return (ApplicationMode as any)[EnvironmentHelper.get('MODE', 'WORKER').toUpperCase()] as ApplicationMode
    }

    public static get PORT(): number {
        return parseInt(EnvironmentHelper.get('PORT', '4000'))
    }

    public static get IGNORE() {

        const COLLECTIONS =
            EnvironmentHelper.get('IGNORE_COLLECTIONS', '')
                .trim()
                .split(',')
                .map(stream => stream.trim())
                .filter(stream => stream)

        return { COLLECTIONS }

    }

    public static paths() {
        const controllers = Regex.controllers()
        const results =
            controllers
                .map(({ constructor }) => constructor)
                .map(({ path }) => ({ path }))
        return { metadata: { count: controllers.length }, results }
    }

}