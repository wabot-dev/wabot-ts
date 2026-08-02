// UI entrypoint: import from '@wabot-dev/framework/ui'.
//
// Importing this module registers Preact + @preact/signals as the default UI
// renderer. Configure your tsconfig with:
//   "jsx": "react-jsx", "jsxImportSource": "@wabot-dev/framework/ui"

import { container } from '@/core/injection'
import { UiRendererRegistry } from '@/feature/ui-controller'
import { PreactRenderer } from '@/addon/ui/preact'

container.resolve(UiRendererRegistry).setDefault(new PreactRenderer())

// Server + authoring surface: @uiController/@view/@action/@uiMiddleware,
// island(), redirect(), renderDocument(), the renderer registry and all types.
export * from '@/feature/ui-controller'

// Layout <Outlet/> for `app: true` controllers (boosted navigation).
export { Outlet } from '@/addon/ui/preact/outlet'

// Plain-CSS assets registered by `import href from './x.css'`. Also published
// as `@wabot-dev/framework/ui/css-runtime`, which is what the generated CSS
// modules import; re-exported here so app code has a typed path to it.
export { getCssAsset } from '@/ui/cssRegistry'

// Preact rendering primitives.
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

// Hooks: useState, useEffect, useRef, useMemo, useCallback, useContext, ...
export * from 'preact/hooks'

// Signals: signal, computed, effect, batch, useSignal, useComputed, ...
// `action` is re-exported as `signalAction` to avoid clashing with the @action
// controller decorator from @wabot-dev/framework/ui.
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
