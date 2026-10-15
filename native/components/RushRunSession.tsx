// Puzzle Rush: as many of the player's own exercises as possible before the
// clock or the lives run out. One try per puzzle; results feed the usual
// exercise progress.
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { CATEGORY_COLORS, CATEGORY_LABELS, type Exercise } from '@shared/analysis/exercises'
import DrillStatTile from '@/components/DrillStatTile'
import RushPuzzleStage from '@/components/RushPuzzleStage'
import { Button, Card, T } from '@/components/ui'
import { C } from '@/constants/theme'

interface RushConfig { durationSec: number; maxStrikes: number; label: string }  // 0 = unlimited

const MODES: RushConfig[] = [
  { durationSec: 180, maxStrikes: 3, label: '3 minutes / 3 vies' },
  { durationSec: 300, maxStrikes: 3, label: '5 minutes / 3 vies' },
  { durationSec: 300, maxStrikes: 0, label: '5 minutes / illimité' },
  { durationSec: 0, maxStrikes: 3, label: '3 vies / pas de chrono' },
]

interface Run {
  queue: Exercise[]
  cursor: number
  score: number
  strikes: number
  streak: number
  bestStreak: number
  history: { category: Exercise['category']; correct: boolean }[]
  startedAt: number
  endsAt: number  // 0 = no clock
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function RushRunSession({ exercises, onAttempt }: {
  exercises: Exercise[]
  onAttempt: (id: string, outcome: 'first-try' | 'failed') => void
}) {
  const [config, setConfig] = useState(MODES[1])
  const [run, setRun] = useState<Run | null>(null)
  const [endedAt, setEndedAt] = useState<number | null>(null)  // set once the run is over
  const [now, setNow] = useState(0)
  // The web keeps no best score; this one lives as long as the screen.
  const [best, setBest] = useState(0)

  const running = run !== null && endedAt === null
  const endsAt = run?.endsAt ?? 0

  function finish(score: number) {
    setEndedAt(Date.now())
    setBest(b => Math.max(b, score))
  }

  // The clock: compare to a deadline rather than counting ticks, so a
  // backgrounded app doesn't gain time.
  useEffect(() => {
    if (!running || endsAt === 0) return
    const id = setInterval(() => {
      const t = Date.now()
      if (t >= endsAt) {
        clearInterval(id)
        setEndedAt(t)
        setBest(b => Math.max(b, run?.score ?? 0))
      } else setNow(t)
    }, 250)
    return () => clearInterval(id)
  }, [running, endsAt, run?.score])

  function start() {
    const t = Date.now()
    setRun({
      queue: shuffle(exercises), cursor: 0, score: 0, strikes: 0, streak: 0, bestStreak: 0, history: [],
      startedAt: t, endsAt: config.durationSec > 0 ? t + config.durationSec * 1000 : 0,
    })
    setNow(t)
    setEndedAt(null)
  }

  function onResult(correct: boolean) {
    if (!run || endedAt !== null) return
    const ex = run.queue[run.cursor]
    if (!ex) return
    onAttempt(ex.id, correct ? 'first-try' : 'failed')
    const streak = correct ? run.streak + 1 : 0
    const next: Run = {
      ...run,
      cursor: run.cursor + 1,
      score: run.score + (correct ? 1 : 0),
      strikes: run.strikes + (correct ? 0 : 1),
      streak,
      bestStreak: Math.max(run.bestStreak, streak),
      history: [...run.history, { category: ex.category, correct }],
    }
    setRun(next)
    const outOfLives = config.maxStrikes > 0 && next.strikes >= config.maxStrikes
    if (outOfLives || next.cursor >= next.queue.length) finish(next.score)
  }

  if (!run) {
    return (
      <View style={styles.gap}>
        <T tone="muted">Enchaîne le maximum d'exercices avant que le chrono ou les vies ne s'épuisent. Une seule tentative par puzzle.</T>
        {MODES.map(m => (
          <Card key={m.label} onPress={() => setConfig(m)} highlight={config.label === m.label}>
            <T tone="strong" style={styles.bold}>{m.label}</T>
            <T tone="faint" style={styles.small}>
              {m.durationSec > 0 ? `${m.durationSec}s` : 'pas de limite de temps'}
              {' · '}
              {m.maxStrikes > 0 ? `${m.maxStrikes} vies` : 'erreurs illimitées'}
            </T>
          </Card>
        ))}
        <Button label="C'est parti" onPress={start} />
        <T tone="faint" style={styles.small}>Pool : {exercises.length} puzzles · ordre aléatoire à chaque session</T>
        {best > 0 && <T tone="muted" style={styles.small}>Meilleur score de cette visite : {best}</T>}
      </View>
    )
  }

  if (endedAt !== null) {
    const total = run.history.length
    const correct = run.history.filter(a => a.correct).length
    const acc = total ? (correct / total) * 100 : 0
    return (
      <View style={styles.gap}>
        <View style={styles.tiles}>
          <DrillStatTile label="Score" value={run.score} />
          <DrillStatTile label="Précision" value={`${acc.toFixed(0)}%`} />
          <DrillStatTile label="Meilleure série" value={run.bestStreak} />
          <DrillStatTile label="Temps" value={`${Math.round((endedAt - run.startedAt) / 1000)}s`} />
        </View>
        {run.score > 0 && run.score >= best && <T tone="win" style={styles.bold}>Meilleur score de cette visite !</T>}
        <Card>
          <T tone="strong" style={styles.bold}>Par catégorie</T>
          {(['missed', 'punishment', 'defense'] as const).map(cat => {
            const list = run.history.filter(a => a.category === cat)
            return (
              <View key={cat} style={styles.catRow}>
                <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS[cat] }]} />
                <T style={styles.catLabel}>{CATEGORY_LABELS[cat]}</T>
                <T tone="muted">{list.filter(a => a.correct).length}/{list.length}</T>
              </View>
            )
          })}
        </Card>
        <Button label="Rejouer" onPress={() => { setRun(null); setEndedAt(null) }} />
      </View>
    )
  }

  const current = run.queue[run.cursor]
  const secondsLeft = Math.max(0, Math.ceil((run.endsAt - now) / 1000))
  return (
    <View style={styles.gap}>
      <View style={styles.hud}>
        <View style={styles.hudLeft}>
          <T style={[styles.score, { color: '#5fa052' }]}>{run.score}</T>
          <T tone="faint" style={styles.small}>SCORE</T>
          {run.streak >= 3 && <T style={[styles.small, { color: '#fb923c' }]}>🔥 série {run.streak}</T>}
        </View>
        <View style={styles.hudRight}>
          {run.endsAt > 0 && (
            <T tone={secondsLeft <= 10 ? 'danger' : 'strong'} style={styles.clock}>
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
            </T>
          )}
          {config.maxStrikes > 0 && (
            <T style={styles.hearts} >
              {Array.from({ length: config.maxStrikes }, (_, i) => (
                <T key={i} style={{ color: i < run.strikes ? C.border : C.loss, fontSize: 18 }}>♥</T>
              ))}
            </T>
          )}
        </View>
      </View>
      <RushPuzzleStage key={current.id} exercise={current} onResult={onResult} />
      <Button label="Arrêter" kind="ghost" onPress={() => finish(run.score)} />
    </View>
  )
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  small: { fontSize: 13, lineHeight: 18 },
  bold: { fontWeight: '600' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  catLabel: { flex: 1 },
  hud: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hudLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  hudRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  score: { fontSize: 32, fontWeight: '700', lineHeight: 38 },
  clock: { fontSize: 22, fontWeight: '600', fontVariant: ['tabular-nums'] },
  hearts: { flexDirection: 'row' },
})
