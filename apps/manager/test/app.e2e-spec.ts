import { Test, type TestingModule } from '@nestjs/testing'
import { type INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { ManagerModule } from './../src/manager.module'

describe('ManagerController (e2e)', () => {
    let app: INestApplication

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [ManagerModule]
        }).compile()

        app = moduleFixture.createNestApplication()
        await app.init()
    })

    it('/ (GET)', async () => {
        return await request(app.getHttpServer())
            .get('/')
            .expect(200)
            .expect('Hello World!')
    })
})
