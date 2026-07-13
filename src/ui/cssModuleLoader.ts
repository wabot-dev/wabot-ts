// Entry point for `node --import @wabot-dev/framework/ui/css-loader`.
//
// Registers the CSS module hooks so that `import styles from './x.module.css'`
// works under SSR / dev / tests, producing the same scoped class names as the
// island client bundle. Module hooks must be registered before app code loads,
// which is why this is used via `--import` rather than from run().

import { register } from 'node:module'

register('./cssModuleHooks.js', import.meta.url)
