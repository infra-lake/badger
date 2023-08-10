import { BadRequestError } from "../exceptions/bad-request.error";
import { UnsupportedOperationError } from "../exceptions/unsupported-operation.error";
import { ApplicationHelper, ApplicationMode } from "../helpers/application.helper";
import { HTTPHelper } from "../helpers/http.helper";
import { Regex } from "../regex";
import { ExportTaskStartInput, ExportTaskStartService } from "../services/export/task/start.service";
import { WorkerService } from "../services/worker.service";

export class WorkerHTTPClient {

    public async start(input: ExportTaskStartInput) {

        if (![ApplicationMode.VOTER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${WorkerHTTPClient.name}.start()`)
        }

        const create = Regex.inject(ExportTaskStartService)

        await create.validate(input)

        const { context, id, document } = input
        const { worker } = document

        const workers = Regex.inject(WorkerService)
        const { url } = workers.get({ id: { name: worker } })

        const options = {
            method: 'POST',
            headers: HTTPHelper.headers({ authenticated: true })
        }

        const response = await HTTPHelper.request({
            logger: context.logger,
            url: `${url}/start`,
            options,
            body: id
        })

        if (!response.ok()) {
            const body = await response.body()
            throw new BadRequestError(`${response.statusCode} - ${response.statusMessage}`, body)
        }


    }

}