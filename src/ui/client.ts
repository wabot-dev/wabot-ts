// Client-safe UI entry. Resolved by the island bundler (and the package's
// "browser" export condition) so island bundles never pull in server code.
// Contains only pure/browser-safe symbols: island(), Preact primitives, hooks
// and signals. No decorators, no renderer registration, no Node imports.

export { island, getIslandMeta, isIsland, setIslandId } from '@/feature/ui-controller/island/island'
export { actionUrl, callAction } from '@/feature/ui-controller/actions'
export type { ICallActionOptions } from '@/feature/ui-controller/actions'
export { Outlet } from '@/addon/ui/preact/outlet'

export {
  Fragment,
  createContext,
  cloneElement,
  createRef,
  isValidElement,
  toChildArray,
  h,
  h as createElement,
} from 'preact'
export type { ComponentChildren, ComponentChild, VNode, RefObject } from 'preact'

export * from 'preact/hooks'

export {
  signal,
  computed,
  effect,
  batch,
  untracked,
  createModel,
  Signal,
  action as signalAction,
  useSignal,
  useComputed,
  useSignalEffect,
  useModel,
} from '@preact/signals'
export type { ReadonlySignal, Model, ModelConstructor } from '@preact/signals'
