import { Controller } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { TransactionHelper } from '@badger/common/transaction'
import { WorkerService } from '@badger/workload'

@Controller()
export class WorkerController {
    constructor(private readonly workerService: WorkerService) { }

    @Cron(CronExpression.EVERY_MINUTE)
    public async handle() {
        const context = TransactionHelper.newTransactionalContext()
        await this.workerService.handle(context)
    }
}
