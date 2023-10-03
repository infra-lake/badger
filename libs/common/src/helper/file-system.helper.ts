import { appendFileSync, closeSync, existsSync, fstatSync, mkdirSync, openSync, rmSync } from 'fs'
import { InvalidParameterException } from '../exception'
import { TransactionalLoggerService } from '../logging'
import { NestHelper } from './nest.helper'
import { StringHelper } from './string.helper'
import { type TransactionalContext } from '../transaction'
import { ObjectHelper } from './object.helper'
import * as bytes from 'bytes'

export class FileSystemHelper {

    private constructor() { }

    public static assertDirectory(context: TransactionalContext, path: string, recreate: boolean = false) {

        if (StringHelper.isEmpty(path)) { throw new InvalidParameterException('path', path) }

        const logger = NestHelper.get(TransactionalLoggerService)

        if (existsSync(path)) {

            if (!recreate) { return }

            FileSystemHelper.removeFileOrDirectory(context, path)
        }

        logger.debug?.(FileSystemHelper.name, context, 'creating path', { path })
        mkdirSync(path, { recursive: true })

    }

    public static removeFileOrDirectory(context: TransactionalContext, path: string) {

        if (ObjectHelper.isEmpty(context)) { throw new InvalidParameterException('context', context) }
        if (StringHelper.isEmpty(path)) { throw new InvalidParameterException('path', path) }

        const logger = NestHelper.get(TransactionalLoggerService)
        logger.debug?.(FileSystemHelper.name, context, 'deleting path', { path })

        rmSync(path, { force: true, recursive: true })

    }

    public static openFileForAppendData(context: TransactionalContext, directory: string, file: string, recreate: boolean = false) {

        if (ObjectHelper.isEmpty(context)) { throw new InvalidParameterException('context', context) }
        if (StringHelper.isEmpty(directory)) { throw new InvalidParameterException('path', directory) }
        if (StringHelper.isEmpty(file)) { throw new InvalidParameterException('file', file) }

        FileSystemHelper.assertDirectory(context, directory, recreate)

        const _file = `${directory}/${file}`

        const logger = NestHelper.get(TransactionalLoggerService)
        logger.debug?.(FileSystemHelper.name, context, 'opening file', { file: _file })

        return openSync(_file, 'a')

    }

    public static appendRowOnFile(context: TransactionalContext, fileDescriptor: number, row: any) {

        if (ObjectHelper.isEmpty(context)) { throw new InvalidParameterException('context', context) }

        appendFileSync(fileDescriptor, `${JSON.stringify(row)}\n`, { encoding: 'utf-8' })

        const logger = NestHelper.get(TransactionalLoggerService)
        logger.debug?.(FileSystemHelper.name, context, 'append data to temp file')

    }

    public static closeFileForAppendData(context: TransactionalContext, fileDescriptor: number) {

        if (ObjectHelper.isNullOrUndefined(fileDescriptor)) { return }

        try {
            closeSync(fileDescriptor)
        } catch (error) {
            const logger = NestHelper.get(TransactionalLoggerService)
            logger.debug?.(FileSystemHelper.name, context, 'error', error)
        }

    }

    public static getFileSizeFrom(fileDescriptor: number) {
        const size = fstatSync(fileDescriptor).size
        return bytes(size)
    }

}
