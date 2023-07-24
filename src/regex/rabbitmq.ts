import { Channel, Options } from 'amqplib'
import { ObjectHelper } from '../helpers/object.helper'
import { RabbitMQHelper, RabbitMQIncomingMessage } from '../helpers/rabbitmq.helper'
import { RegexApplication } from './app'
import { Regex, RegexField } from './ioc'
import { Logger } from './logger'

export type RabbitMQBootstrapOutput = { rabbitmq: RabbitMQHelper }

export type MessageControl = Pick<Channel, 'ack' | 'ackAll' | 'nack' | 'nackAll'>
export type RegexRabbitMQControllerConfig = {
    options?: Options.Consume
}
export interface RegexRabbitMQController {
    get config(): RegexRabbitMQControllerConfig
    handle(queue: string, message: RabbitMQIncomingMessage, control: MessageControl): void | Promise<void>
}

export class RabbitMQ {

    public static async bootstrap(): Promise<RabbitMQBootstrapOutput> {

        const rabbitmq = RabbitMQHelper.connect()

        setInterval(async () => {

            let logger = undefined

            try {

                logger = Regex.register(Logger)

                const queues = await rabbitmq.queues({ logger })

                const bindings = queues
                    .map(({ name }) => {

                        const result = Regex.inject<RegexRabbitMQController | Array<RegexRabbitMQController>>(name, 'rabbitmq')

                        return {
                            queue: name,
                            controllers:
                                !ObjectHelper.has(result)
                                    ? []
                                    : Array.isArray(result) ? result : [result]
                        }

                    })
                    .filter(({ controllers }) => controllers.length > 0)

                await Promise.all(bindings.flatMap(async ({ queue, controllers }) =>
                    await Promise.all(controllers.flatMap(async controller => {

                        const id = (controller as any)[RegexField.ID]

                        const { handle, config } = controller
                        const { options } = config

                        await rabbitmq.consume({
                            consumer: id,
                            queue,
                            handle: handle.bind(controller),
                            options
                        })

                    }))
                ))

            } catch (error) {
                logger?.error('Error when retrieve queues:', error)
            } finally {
                Regex.unregister(logger)
            }

        }, RegexApplication.TICK)


        return { rabbitmq }
    }

}