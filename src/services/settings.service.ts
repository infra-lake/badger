import { MongoClient } from 'mongodb'
import { EnvironmentHelper } from '../helpers/environment.helper'
import { Regex, RegexApplication } from '../regex'
import { SourceService } from './source.service'
import { TargetService } from './target.service'
import { ExportService } from './export.service'
import { TempService } from './temp.service'
import { ApplicationHelper } from '../helpers/application.helper'

export class SettingsService {

    public get database() { 
        return EnvironmentHelper.get('MONGODB_DATABASE') as string 
    }

    public async migrate() {

        const mongodb = Regex.inject(MongoClient)
        
        const _database = mongodb.db(this.database)

        const collections = await _database.collections()
        
        const source = SourceService.COLLECTION
        const target = TargetService.COLLECTION
        const _export = ExportService.COLLECTION
        const temp = TempService.COLLECTION
        
        if (collections.filter(({ collectionName }) => collectionName === source).length <= 0) {
            await _database.createCollection(source)
        }
        
        if (collections.filter(({ collectionName }) => collectionName === target).length <= 0) {
            await _database.createCollection(target)
        }
        
        if (collections.filter(({ collectionName }) => collectionName === _export).length <= 0) {
            await _database.createCollection(_export)
        }

        if (RegexApplication.version() === '1.0.8' && collections.filter(({ collectionName }) => collectionName === 'ingesteds').length > 0) {
            await _database.dropCollection('ingesteds')
        }

        if (collections.filter(({ collectionName }) => collectionName === temp).length <= 0) {
            await _database.createCollection(temp)
        }

    }

}