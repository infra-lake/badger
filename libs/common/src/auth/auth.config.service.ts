import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthStrategyType } from './strategies/auth.strategy.dto'
import { ObjectHelper } from '../helper'

export interface BasicDTO {
    username: string
    password: string
}

@Injectable()
export class AuthConfigService {

    public constructor(private readonly config: ConfigService) { }

    public static get STRATEGY(): AuthStrategyType {
        const result: AuthStrategyType = AuthStrategyType[process.env.AUTH_STRATEGY as string]
        return result
    }

    private _basic?: BasicDTO = undefined
    public get basic() {
        if (ObjectHelper.isNullOrUndefined(this._basic)) {
            this._basic = {
                username: this.config.getOrThrow('AUTH_BASIC_USERNAME'),
                password: this.config.getOrThrow('AUTH_BASIC_PASSWORD')
            }
        }
        return this._basic as BasicDTO
    }

}
