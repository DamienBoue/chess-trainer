// "Calcul de séquence": visualise the engine's forced line without moving a
// piece, type it in algebraic notation, and see where it first goes wrong.
import { useMemo, useState } from 'react'
import { StyleSheet, TextInput, useWindowDimensions, View } from 'react-native'
import { Chess } from 'chess.js'
import type { GameAnalysis } from '@shared/types'
import { extractExercises } from '@shared/analysis/exercises'
import Board from '@/components/Board'
import DrillStatTile from '@/components/DrillStatTile'
import { Button, Card, T } from '@/components/ui'
import { C } from '@/constants/theme'

const MIN_LINE_PLIES = 4

interface Puzzle {
  id: string
  fen: string
  userColor: 'white' | 'black'
  expectedLine: string[]  // SAN, the user's move first
  context: { opponent: string; ply: number; moveLabel: string }
  cpSwing: number
}

interface Attempt {
  played: string[]
  divergedAt: number  // index of the first wrong move (length if none)
  expected: string[]
  parseFen: string    // position reached up to the first wrong move
}

// Same tolerant SAN reader as the website: drop move numbers and !? marks.
const SAN_RE = /(O-O(?:-O)?[+#]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)/g
function parseUserInput(raw: string): string[] {
  const cleaned = raw.replace(/\b\d+\.\.?\.?/g, ' ').replace(/[!?]+/g, '')
  return cleaned.match(SAN_RE) ?? []
}

function buildPool(analyses: GameAnalysis[]): Puzzle[] {
  const out: Puzzle[] = []
  for (const e of extractExercises(analyses, { minMissedCpLoss: 180, maxPerGame: 3 })) {
    if (!e.bestLineSan) continue
    const moves = e.bestLineSan.trim().split(/\s+/).filter(Boolean)
    if (moves.length < MIN_LINE_PLIES) continue
    out.push({ id: e.id, fen: e.fen, userColor: e.userColor, expectedLine: moves, context: e.context, cpSwing: e.cpSwing })
  }
  // Biggest swing first: usually the clearest tactics.
  return out.sort((a, b) => b.cpSwing - a.cpSwing)
}

const stripMarks = (s: string) => s.replace(/[+#]+$/, '').replace(/[!?]+$/, '')

function check(puzzle: Puzzle, input: string): { attempt: Attempt; ok: boolean } | null {
  const played = parseUserInput(input)
  if (played.length === 0) return null
  const expected = puzzle.expectedLine
  const board = new Chess(puzzle.fen)
  let diverge = played.length
  let lastValidFen = board.fen()
  for (let i = 0; i < played.length; i++) {
    let mv
    try { mv = board.move(played[i]) } catch { mv = null }
    if (!mv) { diverge = i; break }
    lastValidFen = board.fen()
    if (stripMarks(played[i]) !== stripMarks(expected[i] ?? '')) { diverge = i; break }
  }
  const ok = diverge >= Math.min(expected.length, played.length) && played.length >= MIN_LINE_PLIES
  return { attempt: { played, divergedAt: diverge, expected, parseFen: lastValidFen }, ok }
}

export default function CalcSequenceSession({ analyses }: { analyses: GameAnalysis[] }) {
  const { width } = useWindowDimensions()
  const pool = useMemo(() => buildPool(analyses), [analyses])
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [result, setResult] = useState<Attempt | null>(null)
  const [score, setScore] = useState({ solved: 0, attempts: 0 })

  if (pool.length === 0) {
    return (
      <Card>
        <T tone="strong" style={styles.bold}>🧮 Pas encore de séquence à calculer</T>
        <T tone="muted">
          Aucune de tes positions n'a une ligne du moteur d'au moins {MIN_LINE_PLIES} demi-coups. Les meilleures sources
          sont les gaffes forcées sur lesquelles Stockfish a calculé une suite nette.
        </T>
      </Card>
    )
  }

  const current = pool[idx]
  if (!current) {
    const acc = score.attempts > 0 ? (score.solved / score.attempts) * 100 : 0
    return (
      <View style={styles.gap}>
        <T tone="strong" style={styles.bold}>Session terminée</T>
        <View style={styles.tiles}>
          <DrillStatTile label="Résolus" value={score.solved} />
          <DrillStatTile label="Tentés" value={score.attempts} />
          <DrillStatTile label="Précision" value={`${acc.toFixed(0)}%`} />
        </View>
        <Button label="Rejouer" onPress={() => { setIdx(0); setInput(''); setResult(null); setScore({ solved: 0, attempts: 0 }) }} />
      </View>
    )
  }

  function submit() {
    if (!current || result) return
    const r = check(current, input)
    if (!r) return
    setScore(s => ({ solved: s.solved + (r.ok ? 1 : 0), attempts: s.attempts + 1 }))
    setResult(r.attempt)
  }

  function next() {
    setIdx(i => i + 1)
    setInput('')
    setResult(null)
  }

  const perfect = !!result && result.divergedAt >= result.played.length && result.played.length >= result.expected.length
  const side = current.userColor === 'white' ? 'Blancs' : 'Noirs'
  return (
    <View style={styles.gap}>
      <T tone="muted" style={styles.small}>
        <T tone="win" style={styles.small}>{score.solved}</T> / {score.attempts} · puzzle {idx + 1}/{pool.length}
      </T>
      <View style={styles.center}>
        <Board
          fen={result ? result.parseFen : current.fen}
          size={Math.min(width - 32, 560)}
          orientation={current.userColor}
        />
      </View>
      <T tone="faint" style={[styles.small, styles.centerText]}>
        {result ? 'Position atteinte après tes coups corrects.' : `Visualise ${current.expectedLine.length} demi-coups dans ta tête. Trait aux ${side}.`}
      </T>

      <T tone="strong" style={styles.bold}>Calcul en tête</T>
      <T tone="muted" style={styles.small}>
        Écris la séquence en notation algébrique : le tien, puis la réponse adverse, ton suivant, etc.
        Séparé par des espaces ou des virgules. Les annotations !? sont ignorées.
      </T>
      <TextInput
        value={input}
        onChangeText={setInput}
        editable={!result}
        placeholder="ex: 1.Rxh2+ Kxh2 2.Rh8#"
        placeholderTextColor={C.faint}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        accessibilityLabel="Séquence de coups"
        style={[styles.input, !!result && { opacity: 0.5 }]}
      />
      {!result && <Button label="Vérifier" onPress={submit} disabled={!input.trim()} />}

      {result && (
        <Card style={{ borderColor: perfect ? C.win : C.warn }}>
          <T tone={perfect ? 'win' : 'strong'} style={styles.bold}>
            {perfect ? '✓ Calcul parfait !' : `${Math.min(result.divergedAt, result.played.length)} / ${result.expected.length} demi-coups corrects`}
          </T>
          <T tone="faint" style={styles.small}>Tu as écrit :</T>
          <T style={styles.mono}>
            {result.played.map((m, i) => (
              <T key={i} tone={i < result.divergedAt ? 'win' : 'loss'} style={styles.mono}>{m} </T>
            ))}
          </T>
          <T tone="faint" style={styles.small}>Ligne attendue :</T>
          <T style={styles.mono}>
            {result.expected.map((m, i) => (
              <T
                key={i}
                tone={i < result.divergedAt ? 'win' : i === result.divergedAt ? 'accent' : 'faint'}
                style={[styles.mono, i === result.divergedAt && styles.underline]}
              >{m} </T>
            ))}
          </T>
          <Button label={idx + 1 < pool.length ? 'Suivant →' : 'Voir le bilan'} onPress={next} style={styles.mt} />
        </Card>
      )}

      {!result && (
        <T tone="faint" style={styles.small}>
          Indice contexte : {current.context.moveLabel} vs {current.context.opponent}. Pas le droit de bouger les pièces.
        </T>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  gap: { gap: 10 },
  small: { fontSize: 13, lineHeight: 18 },
  bold: { fontWeight: '600' },
  mt: { marginTop: 8 },
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  input: {
    minHeight: 88, textAlignVertical: 'top', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.panel, color: C.strong, fontSize: 16, fontFamily: 'Menlo',
  },
  mono: { fontFamily: 'Menlo', fontSize: 14, lineHeight: 22 },
  underline: { textDecorationLine: 'underline', fontWeight: '700' },
})
