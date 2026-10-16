// How the engines talk to Stockfish: UCI commands in, UCI lines out. The
// transport hides where Stockfish runs (a Web Worker on the web, a Worker
// inside a hidden WebView on phones — see transport*.ts).

export interface EngineTransport {
  post(cmd: string): void
  /** Every line Stockfish prints; returns the unsubscribe function. */
  onLine(listener: (line: string) => void): () => void
  /** Phones: Stockfish was restarted under us (the WebView's process died
   *  and was reloaded) — a fresh engine that saw none of our commands. */
  onReset?(listener: () => void): () => void
  terminate(): void
}
