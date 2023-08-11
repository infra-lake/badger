import { RequestOptions } from 'http'
import { BadRequestError } from '../exceptions/bad-request.error'
import { UnsupportedOperationError } from '../exceptions/unsupported-operation.error'
import { ApplicationHelper, ApplicationMode } from '../helpers/application.helper'
import { EnvironmentHelper } from "../helpers/environment.helper"
import { HTTPHelper } from '../helpers/http.helper'
import { QueryStringHelper } from "../helpers/querystring.helper"
import { StringHelper } from "../helpers/string.helper"
import { WorkerServiceListInput, WorkerServiceListOutput } from "../services/worker.service"


export class VoterHTTPClient {

    public async workers({ context, filter }: WorkerServiceListInput) {

        if (![ApplicationMode.MANAGER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${VoterHTTPClient.name}.workers()`)
        }

        const { name, status } = filter ?? {}

        const qs = QueryStringHelper.stringify({ filter: { name, status } }, 'qs')
        const url = `${EnvironmentHelper.get('VOTER_URL')}/voter/worker${StringHelper.empty(qs) ? '' : `?${qs}`}`

        const options: RequestOptions = {
            method: 'GET',
            headers: HTTPHelper.headers({ authenticated: true })

        }

        const response = await HTTPHelper.request({
            logger: context.logger,
            url,
            options
        })

        if (!response.ok()) {
            throw new BadRequestError(`${response.statusCode} - ${response.statusMessage}`)
        }

        const result = await response.json<WorkerServiceListOutput>()

        return result

    }

}