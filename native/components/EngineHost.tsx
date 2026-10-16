// Phones: the hidden WebView in which Stockfish runs (React Native has no
// Web Workers). Mounted once at the root; @shared/engine/transport routes
// each engine's UCI lines through it. The WASM build ships inside the app
// (offline); the website's copy is only a fallback. If the OS kills the
// page, it is reloaded and the engines start over (transport.native.ts).
import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView as RNWebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview'
import { Asset } from 'expo-asset'
import { File } from 'expo-file-system'
import { attachEngineHost, receiveFromEngineHost, type ToEnginePage } from '@shared/engine/transport'
import { engineStatus } from '@/lib/engineStatus'
import engineJs from '@/assets/engine/stockfish-loader.sfjs'
import engineWasm from '@/assets/engine/stockfish.wasm'

// The class component's typings don't match React 19's JSX types.
const WebView = RNWebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<RNWebView> }>

// The page's origin, and where the fallback engine is served from.
const ENGINE_ORIGIN = 'https://damienboue.github.io/chess-trainer/'

// The page asks for the engine ("page"), gets it as a loader + WASM bytes,
// turns them into blob URLs for its workers (the loader reads the WASM's
// URL from its own #hash), then says "ready".
const PAGE = `<!doctype html><html><body><script>
const workers = {}
let workerUrl = 'stockfish.js'
const send = m => window.ReactNativeWebView.postMessage(JSON.stringify(m))
window.__boot = (js, wasmBase64) => {
  try {
    const bin = atob(wasmBase64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const wasmUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/wasm' }))
    workerUrl = URL.createObjectURL(new Blob([js], { type: 'text/javascript' })) + '#' + encodeURIComponent(wasmUrl)
    send({ type: 'ready', bundled: true })
  } catch (e) {
    send({ type: 'ready', bundled: false, error: String(e) })
  }
}
window.__fallback = () => send({ type: 'ready', bundled: false })
window.__engine = m => {
  if (m.type === 'create') {
    const w = new Worker(workerUrl)
    w.onmessage = e => send({ id: m.id, line: String(e.data) })
    w.onerror = e => send({ id: m.id, error: e.message || 'worker error' })
    workers[m.id] = w
  } else if (m.type === 'cmd') {
    if (workers[m.id]) workers[m.id].postMessage(m.cmd)
  } else if (m.type === 'terminate') {
    if (workers[m.id]) { workers[m.id].terminate(); delete workers[m.id] }
  }
}
send({ type: 'page' })
</script></body></html>`

type Bundle = { js: string; wasm: string } | null

async function loadBundle(): Promise<Bundle> {
  try {
    const [js, wasm] = await Asset.loadAsync([engineJs, engineWasm])
    if (!js.localUri || !wasm.localUri) return null
    return { js: await new File(js.localUri).text(), wasm: await new File(wasm.localUri).base64() }
  } catch {
    return null
  }
}

export default function EngineHost() {
  const ref = useRef<RNWebView>(null)
  // Loaded once, kept for page reloads.
  const bundle = useRef<Promise<Bundle> | null>(null)
  useEffect(() => () => attachEngineHost(null), [])

  function boot() {
    bundle.current ??= loadBundle()
    void bundle.current.then(b => {
      ref.current?.injectJavaScript(b
        ? `window.__boot(${JSON.stringify(b.js)}, ${JSON.stringify(b.wasm)});true;`
        : 'window.__fallback();true;')
    })
  }

  function lost() {
    attachEngineHost(null)
    ref.current?.reload()
  }

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={ref}
        source={{ html: PAGE, baseUrl: ENGINE_ORIGIN }}
        originWhitelist={['*']}
        onContentProcessDidTerminate={lost}
        onRenderProcessGone={lost}
        onMessage={(e: WebViewMessageEvent) => {
          const data = e.nativeEvent.data
          let m: { type?: string; error?: string; bundled?: boolean } = {}
          try { m = JSON.parse(data) } catch { /* engine lines are JSON too */ }
          if (m.type === 'page') boot()
          else if (m.type === 'ready') {
            engineStatus.source = m.bundled ? 'bundled' : 'website'
            if (m.error) console.warn('[stockfish] bundled engine unavailable, using the website copy:', m.error)
            attachEngineHost({
              send: (msg: ToEnginePage) => ref.current?.injectJavaScript(`window.__engine(${JSON.stringify(msg)});true;`),
            })
          } else receiveFromEngineHost(data)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
})
