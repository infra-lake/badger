import { Injectable } from '@nestjs/common'

@Injectable()
export class WorkloadService {

    public get() { return 'teste' }

}
