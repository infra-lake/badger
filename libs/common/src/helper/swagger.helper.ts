import { type App } from '../types'
import * as project from '../../../../package.json'
import { type INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AuthConfigService, AuthStrategyType } from '../auth'

export class SwaggerHelper {

    private constructor() { }

    public static setup(app: INestApplication, type: App) {

        const path = (app as any)?.config?.globalPrefix ?? ''

        const builder = new DocumentBuilder()
            .setTitle(`${project.name}-${type}`)
            .setDescription(project.description)
            .setVersion(project.version)

        if (AuthConfigService.STRATEGY === AuthStrategyType.BASIC) {
            builder.addBasicAuth()
        }

        const config = builder.build()

        const document = SwaggerModule.createDocument(app, config)

        SwaggerModule.setup(path, app, document)

    }
}
