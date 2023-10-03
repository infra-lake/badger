import { MongoDBDocument } from '@badger/common/mongodb'
import { Source } from '@badger/source'
import { Target } from '@badger/target'
import { Prop, Schema } from '@nestjs/mongoose'
import { IsDefined, IsEnum, IsNotEmpty, IsString, IsUUID, MinLength } from 'class-validator'

export enum ExportStatus {
    CREATED = 'created',
    RUNNING = 'running',
    TERMINATED = 'terminated',
    PAUSED = 'paused',
    ERROR = 'error'
}

@Schema({ collection: 'exports' })
export class Export extends MongoDBDocument<Export, 'transaction' | 'source' | 'target' | 'database'> {

    @IsUUID()
    @IsDefined()
    @IsNotEmpty()
    @Prop()
    public transaction: string

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    @Prop({ type: Source, _id: false })
    public source: Source

    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    @Prop({ type: Target, _id: false })
    public target: Target

    @IsString()
    @IsDefined()
    @IsNotEmpty()
    @MinLength(2)
    @Prop()
    public database: string

    @IsEnum(ExportStatus)
    @IsDefined()
    @IsNotEmpty()
    @Prop({ type: String, enum: ExportStatus })
    public status: ExportStatus

}
