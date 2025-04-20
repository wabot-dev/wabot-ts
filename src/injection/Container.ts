import { DependencyContainer, InjectionToken } from "tsyringe"
import { InterceptionOptions } from "tsyringe/dist/typings/types"
import { PostResolutionInterceptorCallback, PreResolutionInterceptorCallback } from "tsyringe/dist/typings/types/dependency-container"

export class Container implements DependencyContainer {
  register(token: unknown, provider: unknown, options?: unknown): DependencyContainer {
    throw new Error('Method not implemented.')
  }
  registerSingleton(from: unknown, to?: unknown): DependencyContainer {
    throw new Error('Method not implemented.')
  }
  registerType<T>(from: InjectionToken<T>, to: InjectionToken<T>): DependencyContainer {
    throw new Error('Method not implemented.')
  }
  registerInstance<T>(token: InjectionToken<T>, instance: T): DependencyContainer {
    throw new Error('Method not implemented.')
  }
  resolve<T>(token: InjectionToken<T>): T {
    throw new Error('Method not implemented.')
  }
  resolveAll<T>(token: InjectionToken<T>): T[] {
    throw new Error('Method not implemented.')
  }
  isRegistered<T>(token: InjectionToken<T>, recursive?: boolean): boolean {
    throw new Error('Method not implemented.')
  }
  reset(): void {
    throw new Error('Method not implemented.')
  }
  clearInstances(): void {
    throw new Error('Method not implemented.')
  }
  createChildContainer(): DependencyContainer {
    throw new Error('Method not implemented.')
  }
  beforeResolution<T>(token: InjectionToken<T>, callback: PreResolutionInterceptorCallback<T>, options?: InterceptionOptions): void {
    throw new Error('Method not implemented.')
  }
  afterResolution<T>(token: InjectionToken<T>, callback: PostResolutionInterceptorCallback<T>, options?: InterceptionOptions): void {
    throw new Error('Method not implemented.')
  }
  dispose(): Promise<void> | void {
    throw new Error('Method not implemented.')
  }
}
