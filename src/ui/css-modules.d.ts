// Ambient declarations so islands/components can import stylesheets. The island
// bundler (esbuild) turns `*.module.css` into locally-scoped class maps and
// bundles plain `*.css` as side-effecting global styles.
//
// Consumers: add `"types": ["@wabot-dev/framework/ui/css"]` or a
// /// <reference> to pick these up.

declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.css' {
  const css: string
  export default css
}
