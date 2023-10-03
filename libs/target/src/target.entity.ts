import { MongoDBDocument } from '@badger/common/mongodb'
import { Prop, Schema } from '@nestjs/mongoose'
import { IsDefined, IsNotEmpty, IsString, MinLength } from 'class-validator'
import { SchemaTypes } from 'mongoose'

@Schema({ collection: 'targets' })
export class Target extends MongoDBDocument<Target, 'name'> {

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    @Prop()
    public name: string

    @IsDefined()
    @Prop({ type: SchemaTypes.Mixed })
    public credentials: object

}
