export interface IWhatsAppTemplateResponse {
  data: IWhatsAppTemplate[]
  paging: IWhatsAppApiPaging
}

export interface IWhatsAppTemplate {
  name: string
  parameter_format: 'POSITIONAL' | 'OTHER' // extend as needed
  components: IWhatsAppTemplateComponent[]
  language: string
  status: string
  category: string
  id: string
}

export interface IWhatsAppTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER'
  format?: 'TEXT'
  text?: string
}

interface IWhatsAppApiPaging {
  cursors: IWhatsAppApiCursors
}

interface IWhatsAppApiCursors {
  before: string
  after: string
}
