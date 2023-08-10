import { AuthHelper } from '../../helpers/auth.helper'
import { HTTPIncomingMessage, HTTPServerResponse, Regex, RegexHTTPController } from '../../regex'
import { ExportTaskStartInput, ExportTaskStartService } from '../../services/export/task/start.service'
import { WorkerService } from '../../services/worker.service'

export class WorkerHTTPController implements RegexHTTPController {

    public static readonly path = '^/start$'

    public async post(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) { return }

        const body = await request.json<ExportTaskStartInput['id']>()
        request.transaction = body.transaction

        const { transaction, source, target, database, collection } = body
        const id = { transaction, source, target, database, collection }

        const workers = Regex.inject(WorkerService)
        const worker = workers.name()

        const document = { worker }

        const input = { context: request, id, document }

        const service = Regex.inject(ExportTaskStartService)

        await service.apply(input)

        response.setStatusCode(200)
        response.end()

    }

}
