export interface IPageOptions {
  /** Max items to return in this page. */
  limit: number
  /** Opaque cursor from a previous page's `nextCursor`. Omit for the first page. */
  cursor?: string
}

export interface IPage<T> {
  items: T[]
  /** Present when more items follow — pass it back as `cursor` for the next page. */
  nextCursor?: string
}
