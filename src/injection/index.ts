await import('reflect-metadata')
export const { injectable, container, singleton, inject } = await import('tsyringe')
export { Container } from './Container'
export type { DependencyContainer } from 'tsyringe'
