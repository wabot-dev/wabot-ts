await import('reflect-metadata')
export const { injectable, container, singleton, inject } = await import('tsyringe')
export type { DependencyContainer } from 'tsyringe'
export * from './types'
