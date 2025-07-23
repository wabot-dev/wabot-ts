export type IWhatsAppTemplateParameter =
  | {
      type: 'text'
      text: string
      parameter_name?: string
    }
  | {
      type: 'currency'
      currency: {
        fallback_value: string
        code: string
        amount_1000: number
      }
    }
  | {
      type: 'date_time'
      date_time: {
        fallback_value: string
      }
    }

export interface IWhatsAppTemplateMessage {
  templateName: string
  languageCode: string
  parameters: IWhatsAppTemplateParameter[]
}
