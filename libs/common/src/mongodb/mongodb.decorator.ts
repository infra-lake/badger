import { getModelToken } from '@nestjs/mongoose'
import { type TransactionOptions } from 'mongodb'
import { type ClientSession, type Model } from 'mongoose'
import { NestHelper } from '../helper'
import { type MongoDBDocument } from './mongodb.entity'
import { MongoDBHelper } from './mongodb.helper'

export function WithTransaction<T extends MongoDBDocument<T, K>, K extends keyof T, N>(model: string, options?: TransactionOptions, connectionName?: string): MethodDecorator {
    return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
        const method = descriptor.value
        descriptor.value = async function (...args: any[]) {
            const callback = async (session: ClientSession) => {
                args.push(session)
                return method.apply(this, args)
            }
            const connection = NestHelper.get<Model<T>>(getModelToken(model, connectionName))
            const result = await MongoDBHelper.withTransaction<T, K, N>(connection, callback.bind(this), options)
            return result
        }
        return descriptor
    }
}
