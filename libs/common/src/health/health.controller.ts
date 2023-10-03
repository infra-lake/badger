import { Controller, Get } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'

export const LIVENESS_PROBE_PATH = '/health/liveness'
export const READINESS_PROBE_PATH = '/health/readiness'

@Controller()
@ApiExcludeController()
export class HealthController {

    @Get(LIVENESS_PROBE_PATH)
    public liveness() {
        // this is intentional
    }

    @Get(READINESS_PROBE_PATH)
    public readiness() {
        // this is intentional
    }

}
