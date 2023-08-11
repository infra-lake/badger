import { RequestOptions } from 'http'
import { EnvironmentHelper } from "../helpers/environment.helper"
import { QueryStringHelper } from "../helpers/querystring.helper"
import { StringHelper } from "../helpers/string.helper"
import { WorkerServiceListInput, WorkerServiceListOutput } from "../services/worker.service"
import { HTTPHelper } from '../helpers/http.helper'
import { BadRequestError } from '../exceptions/bad-request.error'
import { ApplicationHelper, ApplicationMode } from '../helpers/application.helper'
import { UnsupportedOperationError } from '../exceptions/unsupported-operation.error'


export class VoterHTTPClient {

    public async workers({ context, filter }: WorkerServiceListInput) {

        if (![ApplicationMode.MANAGER, ApplicationMode.MONOLITH].includes(ApplicationHelper.MODE)) {
            throw new UnsupportedOperationError(`${VoterHTTPClient.name}.workers()`)
        }

        const { name, status } = filter ?? {}

        const qs = QueryStringHelper.stringify({ name, status }, 'qs')
        const url = `${EnvironmentHelper.get('VOTER_URL')}/voter/worker${StringHelper.empty() ? '' : `?${qs}`}`

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