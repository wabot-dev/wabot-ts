// Ambient declarations so views/components/islands can import stylesheets. The
// island bundler (esbuild) and the SSR loader agree on these shapes:
//
//   import styles from './Card.module.css'  -> locally-scoped class map
//   import href from './app.css'            -> URL the stylesheet is served at
//
// Consumers pick these up with a triple-slash reference in any project file:
//
//   /// <reference types="@wabot-dev/framework/ui/css" />
//
// (`"types": ["@wabot-dev/framework/ui/css"]` in tsconfig also works, but that
// key replaces the default @types auto-inclusion — list "node" alongside it.)

declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.css' {
  /** URL the stylesheet is served at — pass it to `@uiController({ head: { stylesheets } })`. */
  const href: string
  export default href
}
