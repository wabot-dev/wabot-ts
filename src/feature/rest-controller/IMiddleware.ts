import { Request, Response } from 'express'
import { DependencyContainer } from 'tsyringe'

export interface IMiddleware {
  handle(req: Request, res: Response, container: DependencyContainer): Promise<void>
}
