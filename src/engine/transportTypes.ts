// How the engines talk to Stockfish: UCI commands in, UCI lines out. The
// transport hides where Stockfish runs (a Web Worker on the web, a Worker
// inside a hidden WebView on phones — see transport*.ts).

export interface EngineTransport {
  post(cmd: string): void
  /** Every line Stockfish prints; returns the unsubscribe function. */
  onLine(listener: (line: string) => void): () => void
  terminate(): void
}
