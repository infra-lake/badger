import { ObjectHelper } from './object.helper'

export class CollectionHelper {

    private constructor() { }

    public static isEmpty(value?: any[]): boolean {
        return ObjectHelper.isNullOrUndefined(value) || (value?.length ?? 0) <= 0
    }
}
