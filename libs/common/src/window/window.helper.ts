import { DateHelper, ObjectHelper } from '../helper'
import { type WindowDTO } from './window.dto'
import { type IWindow } from './window.contract'

export class WindowHelper {

    private constructor() { }

    public static extract(object: any, attribute: string = '__window'): IWindow {

        const window = (object?.[attribute] ?? {}) as WindowDTO
        delete object?.[attribute]

        window.begin = ObjectHelper.isEmpty(window?.begin) ? window?.begin : DateHelper.parse(window.begin as any)
        window.end = ObjectHelper.isEmpty(window?.end) ? window?.end : DateHelper.parse(window.end as any)

        return window

    }

}
