import { isNotEmpty, isString } from "@/core/validation"


export class MoneyDto {
  @isString()
  @isNotEmpty()
  amount: string = ''

  @isString()
  @isNotEmpty()
  currency: string = ''
}
