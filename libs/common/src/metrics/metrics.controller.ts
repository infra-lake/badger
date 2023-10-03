import { Controller, Get, Res } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { PrometheusController } from '@willsoto/nestjs-prometheus'
import { Response } from 'express'

@Controller()
@ApiExcludeController()
export class MetricsController extends PrometheusController {

    public constructor() {
        super()
    }

    @Get()
    public async index(@Res() response: Response) {
        return await super.index(response)
    }

}
