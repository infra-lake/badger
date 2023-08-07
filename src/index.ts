import { MongoClient } from 'mongodb'
import { HealthController } from './controllers/common/health.controller'
import { MetricsController } from './controllers/common/metrics.controller'
import { NotFoundController } from './controllers/common/not-found.controller'
import { ApplicationHelper, ApplicationMode } from './helpers/application.helper'
import { EnvironmentHelper } from './helpers/environment.helper'
import { MetricHelper } from './helpers/metric.helper'
import { Regex, RegexApplication } from './regex'
import { ExportService } from './services/export.service'
import { ExportTaskService } from './services/export.task.service'
import { SettingsService } from './services/settings.service'
import { SourceService } from './services/source.service'
import { TargetService } from './services/target.service'
import { WorkerService } from './services/worker.service'

EnvironmentHelper.config()
MetricHelper.config()

Regex.register(MongoClient, EnvironmentHelper.get('MONGODB_URL'))
Regex.register(SettingsService)
Regex.register(ExportService)
Regex.register(ExportTaskService)
Regex.register(SourceService)
Regex.register(TargetService)
Regex.register(WorkerService)

Regex.controller(NotFoundController)
Regex.controller(HealthController)
Regex.controller(MetricsController)

RegexApplication.create({
    settings: { http: true, batch: [ApplicationMode.MONOLITH, ApplicationMode.VOTER, ApplicationMode.WORKER].includes(ApplicationHelper.MODE) },
    startup: { module: `${__dirname}/${ApplicationHelper.MODE}` }
})
