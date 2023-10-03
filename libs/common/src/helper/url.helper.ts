import { InvalidParameterException } from '../exception'
import { ObjectHelper } from './object.helper'
import { StringHelper } from './string.helper'
import { join } from 'path'

export class URLHelper {

    private constructor() { }

    public static validate(url?: string) {

        if (StringHelper.isEmpty(url)) {
            throw new InvalidParameterException('url', url)
        }

        // eslint-disable-next-line no-new
        new URL(url as string)

    }

    public static join<T extends string | URL>(url: T, ...paths: string[]): T extends string ? string : URL {

        const isURLString = StringHelper.isString(url)
        const isURLInvalid = (isURLString && StringHelper.isEmpty(url as string)) || ObjectHelper.isEmpty(url)

        if (isURLInvalid) {
            throw new InvalidParameterException('url', url)
        }

        const _url = isURLString
            ? new URL(url)
            : url as URL

        _url.pathname = join(...paths)

        return (isURLString ? _url.toString() : _url) as T extends string ? string : URL

    }

}
