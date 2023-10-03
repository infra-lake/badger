import { MongoDBDocument } from '@badger/common/mongodb'
import { WindowDTO } from '@badger/common/window/window.dto'
import { Prop, Schema } from '@nestjs/mongoose'
import { IsDefined, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator'
import { Export, ExportStatus } from '../export/export.entity'
import { SchemaTypes } from 'mongoose'

@Schema({ collection: 'tasks' })
export class Task extends MongoDBDocument<Task, 'transaction' | '_export' | '_collection'> {

    @IsUUID()
    @IsDefined()
    @IsNotEmpty()
    @Prop()
    public transaction: string

    @IsDefined()
    @IsNotEmpty()
    @Prop({ type: SchemaTypes.ObjectId, ref: Export.name })
    public _export: Export

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    @Prop()
    public _collection: string

    @IsEnum(ExportStatus)
    @IsDefined()
    @IsNotEmpty()
    @Prop({ type: String, enum: ExportStatus })
    public status: ExportStatus

    @IsString()
    @MinLength(2)
    @Prop()
    public worker?: string

    @IsOptional()
    @Prop({ type: SchemaTypes.Mixed })
    error?: any

    @IsOptional()
    @Prop()
    count?: number

    @IsOptional()
    @Prop({ type: WindowDTO })
    window?: WindowDTO

}
