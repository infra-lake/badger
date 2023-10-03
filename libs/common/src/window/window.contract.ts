import * as joi from 'joi'

export interface IWindow {
    get begin(): Date
    get end(): Date
}

export const IWindowSchema = joi.object<IWindow>().keys({
    begin: joi.date().required(),
    end: joi.date().required()
})
