import { DependencyContainer } from '@/core/injection'
import { Request, Response } from 'express'

export interface IMiddleware {
  handle(req: Request, res: Response, container: DependencyContainer): Promise<void>
}
