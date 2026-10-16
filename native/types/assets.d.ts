// Bundled engine files (see metro.config.js): require() gives an asset id.
declare module '*.wasm' {
  const asset: number
  export default asset
}
declare module '*.sfjs' {
  const asset: number
  export default asset
}
