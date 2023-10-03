import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-custom'
import { AuthStrategyType } from './auth.strategy.dto'

@Injectable()
export class NoAuthStrategy extends PassportStrategy(Strategy, AuthStrategyType.NO) {

    public validate() {
        return true
    }

}
