import { ObjectHelper } from './object.helper'

export class DeserializationHelper {

    private constructor() { }

    public static fix(object: any): any {

        if (ObjectHelper.isEmpty(object)) {
            return object
        }

        if (Array.isArray(object)) {
            return object.map(item => this.fix(item))
        }

        if (typeof object === 'object') {

            Object.keys(object).forEach(key => {

                if (key.trim() === '') {
                    const value = object[key]
                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                    delete object[key]
                    object.__empty__ = this.fix(value)
                    return
                }

                object[key] = this.fix(object[key])

            })

            return object

        }

        return object

    }

}
