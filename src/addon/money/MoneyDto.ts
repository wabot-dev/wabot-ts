import { isNotEmpty, isString } from "../validation"


export class MoneyDto {
  @isString()
  @isNotEmpty()
  amount: string = ''

  @isString()
  @isNotEmpty()
  currency: string = ''
}
