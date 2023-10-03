import { BigQueryHelper } from '@badger/common/bigquery'
import { InvalidParameterException } from '@badger/common/exception'
import { ClassValidatorHelper, FileSystemHelper, ObjectHelper, ThreadHelper } from '@badger/common/helper'
import { TransactionalLoggerService } from '@badger/common/logging'
import { MongoDBHelper } from '@badger/common/mongodb'
import { StampsHelper } from '@badger/common/stamps'
import { TransactionHelper, type TransactionalContext } from '@badger/common/transaction'
import { type BigQuery, type Table } from '@google-cloud/bigquery'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { TargetConfigService } from './target.config.service'
import { type Target4SearchDTO, type Target4UploadDocumentsDTO, type TargetDTO, type TargetKeyDTO } from './target.dto'
import { Target } from './target.entity'

@Injectable()
export class TargetService {

    public constructor(
        private readonly logger: TransactionalLoggerService,
        private readonly config: TargetConfigService,
        @InjectModel(Target.name) private readonly model: Model<Target>
    ) { }

    public async save(context: TransactionalContext, dto: TargetDTO) {

        if (ObjectHelper.isEmpty(context)) { throw new InvalidParameterException('context', context) }

        try {
            await ClassValidatorHelper.validate('dto', dto)
        } catch (error) {
            throw new BadRequestException(error)
        }

        const { name, credentials } = dto

        try {
            await BigQueryHelper.ping(credentials)
        } catch (error) {
            throw new BadRequestException([
                'unable to connect to bigquery using the provided credentials', error.message
            ])
        }

        await MongoDBHelper.save<Target, 'name'>(context, this.model, { name }, { credentials })

        return { transaction: TransactionHelper.getTransactionIDFrom(context) }

    }

    public async get(key: TargetKeyDTO) {
        return await MongoDBHelper.get<Target, 'name', Model<Target>>(this.model, key)
    }

    public async list(filter: Target4SearchDTO) {
        return await MongoDBHelper.list<Target, 'name', Model<Target>>(this.model, filter)
    }

    public async uploadDocuments(context: TransactionalContext, dto: Target4UploadDocumentsDTO) {

        if (ObjectHelper.isEmpty(context)) { throw new InvalidParameterException('context', context) }

        await ClassValidatorHelper.validate('dto', dto)

        const client = await this.connect(dto)

        const temporaryTable = await this.getOrCreateTable(context, client, dto, true)
        const mainTable = await this.getOrCreateTable(context, client, dto, false)

        const fullTempFilePath = `${dto.tempDir}/${dto.tempFile}`

        this.logger.debug?.(TargetService.name, context, 'loading documents on temp file to bigquery')
        await temporaryTable.load(fullTempFilePath, temporaryTable.metadata)
        this.logger.debug?.(TargetService.name, context, 'documents load to bigquery successfully!')

        FileSystemHelper.removeFileOrDirectory(context, fullTempFilePath)

        await this.consolidate(context, client, mainTable, temporaryTable)

        await this.cleanup(context, temporaryTable)

    }

    private async connect(dto: Target4UploadDocumentsDTO) {
        const client = BigQueryHelper.client(dto.credentials)
        if (ObjectHelper.isEmpty(client)) {
            throw new InvalidParameterException('dto', dto)
        }
        return client
    }

    private async getOrCreateTable(context: TransactionalContext, client: BigQuery, dto: Target4UploadDocumentsDTO, isTemporaryTable: boolean) {

        const dataset = BigQueryHelper.sanitize(`${this.config.getTargetDataSetNamePrefix()}${dto.dataset}`)

        const name =
            isTemporaryTable
                ? BigQueryHelper.sanitize(`${dto.table}_${dto.transaction}_temp`)
                : BigQueryHelper.sanitize(dto.table)

        const table = {
            sourceFormat: 'NEWLINE_DELIMITED_JSON',
            name,
            fields: [
                { name: StampsHelper.DEFAULT_STAMP_ID, type: 'STRING', mode: 'REQUIRED' },
                { name: StampsHelper.DEFAULT_STAMP_INSERT, type: 'TIMESTAMP', mode: 'REQUIRED' },
                { name: 'data', type: 'JSON', mode: 'REQUIRED' },
                { name: 'hash', type: 'STRING', mode: 'REQUIRED' }
            ]
        }

        const result = await BigQueryHelper.getOrCreateTable(context, client, dataset, table)

        return result

    }

    private async consolidate(context: TransactionalContext, client: BigQuery, mainTable: Table, temporaryTable: Table) {

        this.logger.log(TargetService.name, context, `consolidating temporary data to table "${mainTable.metadata.id}"...`)

        const mainTableName = `\`${mainTable.metadata.id.replace(/:/g, '.').replace(/\./g, '`.`')}\``
        const temporaryTableName = `\`${temporaryTable.metadata.id.replace(/:/g, '.').replace(/\./g, '`.`')}\``

        await client.query(`
            INSERT ${mainTableName} (${StampsHelper.DEFAULT_STAMP_ID}, ${StampsHelper.DEFAULT_STAMP_INSERT}, data, \`hash\`)
            WITH
                temporary AS (
                    SELECT ${StampsHelper.DEFAULT_STAMP_ID}, ${StampsHelper.DEFAULT_STAMP_INSERT}, data, \`hash\`
                    FROM ${temporaryTableName}
                ),
                main AS (
                    SELECT ${StampsHelper.DEFAULT_STAMP_ID}, MAX(${StampsHelper.DEFAULT_STAMP_INSERT}) AS ${StampsHelper.DEFAULT_STAMP_INSERT}
                    FROM ${mainTableName}
                    GROUP BY ${StampsHelper.DEFAULT_STAMP_ID}
                )
            SELECT temporary.${StampsHelper.DEFAULT_STAMP_ID}, temporary.${StampsHelper.DEFAULT_STAMP_INSERT}, temporary.data, temporary.\`hash\`
            FROM temporary
            WHERE temporary.${StampsHelper.DEFAULT_STAMP_ID} NOT IN (SELECT main.${StampsHelper.DEFAULT_STAMP_ID} FROM main)
                OR \`hash\` <> (
                    SELECT \`hash\`
                    FROM main AS B
                    INNER JOIN ${mainTableName} AS C
                            ON C.${StampsHelper.DEFAULT_STAMP_ID} = B.${StampsHelper.DEFAULT_STAMP_ID}
                            AND C.${StampsHelper.DEFAULT_STAMP_INSERT} = B.${StampsHelper.DEFAULT_STAMP_INSERT}
                    WHERE B.${StampsHelper.DEFAULT_STAMP_ID} = temporary.${StampsHelper.DEFAULT_STAMP_ID}
                        AND C.${StampsHelper.DEFAULT_STAMP_ID} = temporary.${StampsHelper.DEFAULT_STAMP_ID}
                )
        `)

        await ThreadHelper.sleep(10000)

        this.logger.log(TargetService.name, context, `temporary data was consolidated to table "${mainTable.metadata.id}" successfully!!!`)

    }

    private async cleanup(context: TransactionalContext, temporaryTable: Table) {

        let exists = false
        try {
            exists = (await temporaryTable.exists())[0]
        } catch (error) {
            exists = false
        }

        if (exists) {
            try { await temporaryTable.delete() } catch (error) { }
            await ThreadHelper.sleep(1000)
            await this.cleanup(context, temporaryTable)
        }

    }

}
