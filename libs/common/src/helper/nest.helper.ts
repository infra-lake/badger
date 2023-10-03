import { type INestApplication, type Type } from '@nestjs/common'
import { ObjectHelper } from './object.helper'

export class NestHelper {

    private static singleton?: NestHelper

    private constructor(private readonly _app: Readonly<INestApplication>) { }

    public static register(app: Readonly<INestApplication>) {
        NestHelper.singleton = new NestHelper(app)
    }

    public static getApp({ getOrThrow }: { getOrThrow: boolean } = { getOrThrow: true }): Readonly<INestApplication> {

        if (getOrThrow && ObjectHelper.isNullOrUndefined(this.singleton)) {
            throw new Error('app is not registered')
        }

        return this.singleton?._app as Readonly<INestApplication>

    }

    public static getOrThrow<T>(type: Type<T> | string | symbol): T {
        return NestHelper.getApp({ getOrThrow: true }).get(type)
    }

    public static get<T>(type: Type<T> | string | symbol, replace?: T): T {
        return NestHelper.getApp({ getOrThrow: false }).get(type) ?? replace as T
    }

}
