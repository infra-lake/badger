import { MongoClient } from 'mongodb'
import { EnvironmentHelper } from '../helpers/environment.helper'
import { Regex } from '../regex'
import { ExportService } from './export/service'
import { ExportTaskService } from './export/task/service'
import { SourceService } from './source.service'
import { TargetService } from './target.service'

export class SettingsService {

    public static get DATABASE() { return EnvironmentHelper.get('MONGODB_DATABASE', '').trim() as string }

    public async migrate() {

        const mongodb = Regex.inject(MongoClient)

        const database = mongodb.db(SettingsService.DATABASE)

        const collections = await database.collections()

        const sources = Regex.inject(SourceService).collection
        const targets = Regex.inject(TargetService).collection
        const exports = Regex.inject(ExportService).collection
        const tasks = Regex.inject(ExportTaskService).collection

        if (collections.filter(({ collectionName }) => collectionName === 'temps').length > 0) {
            await database.dropCollection('temps')
        }

        if (collections.filter(({ collectionName }) => collectionName === sources).length <= 0) {
            await database.createCollection(sources)
        }

        if (collections.filter(({ collectionName }) => collectionName === exports).length <= 0) {
            await database.createCollection(exports)
        }

        if (collections.filter(({ collectionName }) => collectionName === tasks).length <= 0) {
            await database.createCollection(tasks)
        }

        if (collections.filter(({ collectionName }) => collectionName === targets).length <= 0) {
            await database.createCollection(targets)
        }

    }

}