import { RabbitMQIncomingMessage } from '../helpers/rabbitmq.helper'
import { Regex } from '../regex'
import { MessageControl, RegexRabbitMQController, RegexRabbitMQControllerConfig } from '../regex/rabbitmq'
import { ExportService } from '../services/export.service'


export class ExportWorkerController implements RegexRabbitMQController {

    public static readonly pattern = '^export:'

    public get config(): RegexRabbitMQControllerConfig { return {} }

    public async handle(queue: string, message: RabbitMQIncomingMessage, control: MessageControl) {
        const { transaction } = message.json<{ transaction: string }>()
        const service = Regex.inject(ExportService)
        await service.process(message, queue, transaction)
        control.ack(message)
    }

}