// Phones: the hidden WebView in which Stockfish runs (React Native has no
// Web Workers). Mounted once at the root; @shared/engine/transport routes
// each engine's UCI lines through it. The WASM build comes from the
// website, so the first analysis needs the network (cached afterwards).
import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView as RNWebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview'
import { attachEngineHost, receiveFromEngineHost, type ToEnginePage } from '@shared/engine/transport'

// The class component's typings don't match React 19's JSX types.
const WebView = RNWebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<RNWebView> }>

const ENGINE_ORIGIN = 'https://damienboue.github.io/chess-trainer/'

const PAGE = `<!doctype html><html><body><script>
const workers = {}
const send = m => window.ReactNativeWebView.postMessage(JSON.stringify(m))
window.__engine = m => {
  if (m.type === 'create') {
    const w = new Worker('stockfish.js')
    w.onmessage = e => send({ id: m.id, line: String(e.data) })
    w.onerror = e => send({ id: m.id, error: e.message || 'worker error' })
    workers[m.id] = w
  } else if (m.type === 'cmd') {
    if (workers[m.id]) workers[m.id].postMessage(m.cmd)
  } else if (m.type === 'terminate') {
    if (workers[m.id]) { workers[m.id].terminate(); delete workers[m.id] }
  }
}
send({ type: 'ready' })
</script></body></html>`

export default function EngineHost() {
  const ref = useRef<RNWebView>(null)
  useEffect(() => () => attachEngineHost(null), [])
  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={ref}
        source={{ html: PAGE, baseUrl: ENGINE_ORIGIN }}
        originWhitelist={['*']}
        onMessage={(e: WebViewMessageEvent) => {
          const data = e.nativeEvent.data
          if (data === '{"type":"ready"}') {
            attachEngineHost({
              send: (msg: ToEnginePage) => ref.current?.injectJavaScript(`window.__engine(${JSON.stringify(msg)});true;`),
            })
          } else {
            receiveFromEngineHost(data)
          }
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
})
