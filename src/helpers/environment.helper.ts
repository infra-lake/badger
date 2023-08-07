import dotenv from 'dotenv'
import fs from 'fs'
import { StringHelper } from './string.helper'

export class EnvironmentHelper {

    private static configured = false

    public static get(name: string, _default?: string): string {

        const result =
            StringHelper.empty(process.env[name])
                ? _default ?? ''
                : process.env[name]?.trim() as string

        return result

    }

    public static list(regex: string): Array<{ key: string, value: string }> {

        const result =
            Object
                .keys(process.env)
                .filter(key => !StringHelper.empty(key))
                .filter(key => key.match(regex) ?? key === regex)
                .map(key => ({ key, value: process.env[key] }))
                .filter(({ value }) => !StringHelper.empty(value))

        return result as Array<{ key: string, value: string }>

    }

    public static set(name: string, value?: string) {
        process.env[name] = value?.trim()
    }

    public static config() {

        if (this.configured) {
            return
        }

        dotenv.config()

        const { name, version, description } = JSON.parse(fs.readFileSync('package.json').toString())
        EnvironmentHelper.set('PROJECT_NAME', name)
        EnvironmentHelper.set('PROJECT_VERSION', version)
        EnvironmentHelper.set('PROJECT_DESCRIPTION', description)

        this.configured = true

    }

}