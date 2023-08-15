import { MongoClient } from 'mongodb'
import { HealthController } from './controllers/common/health.controller'
import { MetricsController } from './controllers/common/metrics.controller'
import { NotFoundController } from './controllers/common/not-found.controller'
import { ApplicationHelper, ApplicationMode } from './helpers/application.helper'
import { EnvironmentHelper } from './helpers/environment.helper'
import { MetricHelper } from './helpers/metric.helper'
import { Regex, RegexApplication } from './regex'
import { ExportService } from './services/export/service'
import { SettingsService } from './services/settings.service'
import { SourceService } from './services/source.service'
import { TargetService } from './services/target.service'
import { WorkerService } from './services/worker.service'
import { VoterHTTPClient } from './clients/voter.http.client'
import { WorkerHTTPClient } from './clients/worker.http.client'
import { WorkloadService } from './services/workload.service'
import { ExportCreateService } from './services/export/create.service'
import { ExportErrorService } from './services/export/error.service'
import { ExportFinishService } from './services/export/finish.service'
import { ExportRetryService } from './services/export/retry.service'
import { ExportStartService } from './services/export/start.service'
import { ExportStopService } from './services/export/stop.service'
import { ExportTaskService } from './services/export/task/service'
import { ExportTaskCreateService } from './services/export/task/create.service'
import { ExportTaskErrorService } from './services/export/task/error.service'
import { ExportTaskFinishService } from './services/export/task/finish.service'
import { ExportTaskRetryService } from './services/export/task/retry.service'
import { ExportTaskStartService } from './services/export/task/start.service'
import { ExportTaskStopService } from './services/export/task/stop.service'
import { ExportPlayService } from './services/export/play.service'
import { ExportTaskPlayService } from './services/export/task/play.service'

EnvironmentHelper.config()
MetricHelper.config()

Regex.register(MongoClient, EnvironmentHelper.get('MONGODB_URL'))
Regex.register(SettingsService)
Regex.register(SourceService)
Regex.register(TargetService)
Regex.register(WorkerService)
Regex.register(WorkloadService)
Regex.register(ExportService)
Regex.register(ExportCreateService)
Regex.register(ExportErrorService)
Regex.register(ExportFinishService)
Regex.register(ExportPlayService)
Regex.register(ExportRetryService)
Regex.register(ExportStartService)
Regex.register(ExportStopService)
Regex.register(ExportTaskService)
Regex.register(ExportTaskCreateService)
Regex.register(ExportTaskErrorService)
Regex.register(ExportTaskFinishService)
Regex.register(ExportTaskPlayService)
Regex.register(ExportTaskRetryService)
Regex.register(ExportTaskStartService)
Regex.register(ExportTaskStopService)

Regex.register(VoterHTTPClient)
Regex.register(WorkerHTTPClient)

Regex.controller(NotFoundController)
Regex.controller(HealthController)
Regex.controller(MetricsController)

RegexApplication.create({
    settings: { http: true, batch: [ApplicationMode.MONOLITH, ApplicationMode.VOTER, ApplicationMode.WORKER].includes(ApplicationHelper.MODE) },
    startup: { module: `${__dirname}/${ApplicationHelper.MODE}` }
})
