import { IStorableData, Storable } from '@/core/storable'
import { Big } from 'big.js'

Big.strict = true

export interface IMoneyData extends IStorableData {
  amount: string
  currency: string
}

export class Money extends Storable<IMoneyData> {
  getData() {
    return { ...this.data }
  }

  get amount() {
    return Big(this.data.amount)
  }

  get currency() {
    return this.data.currency
  }

  plus(money: Money): Money {
    this.validateEqualCurrencies(this.data.currency, money.data.currency)

    return new Money({
      amount: this.amount.plus(money.amount).toFixed(6),
      currency: this.currency,
    })
  }

  minus(money: Money): Money {
    this.validateEqualCurrencies(this.data.currency, money.data.currency)

    return new Money({
      amount: this.amount.minus(money.amount).toFixed(6),
      currency: this.currency,
    })
  }

  times(value: bigint | string) {
    return new Money({
      amount: this.amount.times(new Big(String(value))).toFixed(6),
      currency: this.currency,
    })
  }

  div(value: bigint | string) {
    return new Money({
      amount: this.amount.div(new Big(String(value))).toFixed(6),
      currency: this.currency,
    })
  }

  negative() {
    return new Money({
      amount: new Big('0').minus(this.amount).toFixed(6),
      currency: this.currency,
    })
  }

  isGretterThan(money: Money): boolean {
    this.validateEqualCurrencies(this.data.currency, money.data.currency)
    return this.amount.gt(money.amount)
  }

  protected validateEqualCurrencies(left: string, right: string) {
    if (left !== right) {
      throw new Error(`Is not posible operate with diferent currencies: '${left}' and '${right}'`)
    }
  }

  static zero(currency: string): Money {
    return new Money({ currency, amount: '0' })
  }
}
