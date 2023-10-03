import { type Document as MongoDocument } from 'mongodb'
import { Document as MongooseDocument } from 'mongoose'
import { type IEntity } from '../types'

export abstract class MongoDBDocument<T extends MongoDBDocument<T, K>, K extends keyof T>
    extends MongooseDocument
    implements IEntity<T, K>, MongoDocument { }
