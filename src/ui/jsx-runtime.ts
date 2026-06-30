// Re-exported so consumers can set tsconfig "jsxImportSource":
// "@wabot-dev/framework/ui". Swapping the default renderer means pointing
// jsxImportSource at that framework's runtime instead.
export * from 'preact/jsx-runtime'
