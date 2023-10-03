import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { BasicStrategy } from 'passport-http'
import { AuthConfigService } from '../auth.config.service'
import { AuthStrategyType } from './auth.strategy.dto'

@Injectable()
export class BasicAuthStrategy extends PassportStrategy(BasicStrategy, AuthStrategyType.BASIC) {

    public constructor(private readonly config: AuthConfigService) {
        super((username: string, password: string, done: (error: any, user?: any) => void) => {
            const { basic } = this.config
            if (basic.username === username && basic.password === password) {
                done(null, { username, password })
            } else {
                done(null, false)
            }
        })
    }

}
