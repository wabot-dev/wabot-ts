await import('reflect-metadata')
export const { injectable, container, singleton, inject, scoped, Lifecycle } = await import('tsyringe')
export { Container } from './Container'
export type { DependencyContainer } from 'tsyringe'
