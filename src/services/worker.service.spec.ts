import { ApplicationMode } from "../helpers/application.helper";
import { EnvironmentHelper } from "../helpers/environment.helper";
import { Logger, Regex } from "../regex";
import { ExportTaskService } from "./export/task/service";
import { Worker, WorkerService, WorkerTestInput } from "./worker.service";


describe('WorkerService', () => {

    describe('list()', () => {
    
        test('expect return workers according to filter', async () => {

            EnvironmentHelper.set('MODE', ApplicationMode.MONOLITH)

            const url = 'http://www.google.com.br'

            const busy: Array<Worker> = [
                { name: '1', url, status: 'busy' } as any
            ]

            const free: Array<Worker> = [
                { name: '2', url, status: 'free' } as any,
                { name: '3', url, status: 'free' } as any
            ]

            class Mock extends ExportTaskService {
                public static regex = `^${ExportTaskService.name}$`
                public async busy(): Promise<Array<Pick<Worker, 'name'>>> {
                    return busy
                }
            }

            Regex.register(Mock);

            ([...free, ...busy]).forEach(({ name, url }) => {
                EnvironmentHelper.set(`WORKER_${name}_URL`, url)
            })

            const context = new Logger()

            const service = new class extends WorkerService {
                public test({ context, worker }: WorkerTestInput): Promise<void> {
                    return Promise.resolve()
                }
            }

            await service.load(context)

            const _free = await service.list({ context, filter: { status: 'free' } })
            expect(_free).toStrictEqual(free)

            const _busy = await service.list({ context, filter: { status: 'busy' } })
            expect(_busy).toStrictEqual(busy)

        })

    })

})