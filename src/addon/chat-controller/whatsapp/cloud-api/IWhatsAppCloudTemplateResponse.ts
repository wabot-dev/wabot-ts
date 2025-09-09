export interface IWhatsAppCloudTemplateResponse {
  data: IWhatsAppCloudTemplate[]
  paging: IWhatsAppCloudApiPaging
}

export interface IWhatsAppCloudTemplate {
  name: string
  parameter_format: 'POSITIONAL' | 'OTHER' // extend as needed
  components: IWhatsAppCloudTemplateComponent[]
  language: string
  status: string
  category: string
  id: string
}

export interface IWhatsAppCloudTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER'
  format?: 'TEXT'
  text?: string
}

interface IWhatsAppCloudApiPaging {
  cursors: IWhatsAppCloudApiCursors
}

interface IWhatsAppCloudApiCursors {
  before: string
  after: string
}
