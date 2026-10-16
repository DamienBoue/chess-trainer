// The strategy trainer: short positional drills built from the player's games
// ("Quel plan ?", "Case forte", "Nomme la structure"), with score and streak.
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { router, type Href } from 'expo-router'
import { gameSlug } from '@shared/nav/gameSlug'
import { type Drill, type DrillKind, DRILL_LABELS, buildDrillSet, isCorrectSquare } from '@shared/strategy/trainer'
import { sqName } from '@shared/strategy/board'
import { loadTrainerScore, recordTrainerAnswer, type TrainerScore } from '@shared/storage/strategyPrefs'
import type { GameAnalysis } from '@shared/types'
import type { BoardArrow } from '@/components/Board'
import SquarePickerBoard from '@/components/SquarePickerBoard'
import { Button, Card, T } from '@/components/ui'
import { strategyReviewOf } from '@/lib/analysis'
import { C, TOUCH } from '@/constants/theme'

type KindFilter = 'all' | DrillKind
const FILTERS: KindFilter[] = ['all', 'plan', 'square', 'structure']
// Same overlay colours as the website (strategyBoard.ts, which is DOM code).
const STRONG = 'rgba(45, 212, 191, 0.45)'
const WEAK = 'rgba(245, 158, 11, 0.5)'
const PLAN = 'rgba(56, 132, 255, 0.85)'

export default function StrategyDrillSession({ analyses }: { analyses: GameAnalysis[] }) {
  const { width } = useWindowDimensions()
  const [filter, setFilter] = useState<KindFilter>('all')
  const [seed, setSeed] = useState(() => Date.now() % 100000)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<string | null>(null)
  const [session, setSession] = useState({ answered: 0, correct: 0, streak: 0, best: 0 })
  const [total, setTotal] = useState<TrainerScore>(() => loadTrainerScore())

  const drills = useMemo<Drill[]>(() => {
    const reviews = new Map<string, NonNullable<ReturnType<typeof strategyReviewOf>>>()
    for (const a of analyses) {
      const r = strategyReviewOf(a)
      if (r) reviews.set(a.url, r)
    }
    return buildDrillSet(analyses, reviews, { size: 10, seed, kinds: filter === 'all' ? undefined : [filter] })
  }, [analyses, seed, filter])

  const drill = drills[index]
  const isRight = (d: Drill, v: string) => (d.kind === 'square' ? isCorrectSquare(d, v) : d.answer.includes(v))

  function restart(next: KindFilter = filter) {
    setFilter(next)
    setSeed(s => s + 1)
    setIndex(0)
    setAnswer(null)
    setSession({ answered: 0, correct: 0, streak: 0, best: 0 })
  }

  function submit(value: string) {
    if (!drill || answer !== null) return
    const ok = isRight(drill, value)
    setAnswer(value)
    setSession(s => {
      const streak = ok ? s.streak + 1 : 0
      return { answered: s.answered + 1, correct: s.correct + (ok ? 1 : 0), streak, best: Math.max(s.best, streak) }
    })
    setTotal(recordTrainerAnswer(drill.kind, ok))
  }

  const boardSize = Math.min(width - 32, 560)
  const correct = !!drill && answer !== null && isRight(drill, answer)
  const highlights: Record<string, string> = {}
  const arrows: BoardArrow[] = []
  if (drill && answer !== null) {
    for (const sq of drill.squares) highlights[sqName(sq)] = STRONG
    for (const [from, to] of drill.arrows) arrows.push({ from: sqName(from), to: sqName(to), color: PLAN })
    if (drill.kind === 'square' && !correct) highlights[answer] = WEAK
  }

  return (
    <View style={styles.gap}>
      <View style={styles.filters} accessibilityRole="tablist">
        {FILTERS.map(k => (
          <Pressable
            key={k}
            onPress={() => restart(k)}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === k }}
            style={[styles.chip, filter === k && styles.chipOn]}
          >
            <T style={[styles.chipText, filter === k && { color: C.strong }]}>{k === 'all' ? 'Tout' : DRILL_LABELS[k]}</T>
          </Pressable>
        ))}
      </View>
      <T tone="muted" style={styles.small}>
        Série : <T tone="strong" style={styles.small}>{session.correct}/{session.answered}</T>
        {session.streak > 1 ? ` · 🔥 ${session.streak} d'affilée` : ''}
        {total.answered > 0 ? ` · Total : ${Math.round((total.correct / total.answered) * 100)} % sur ${total.answered}` : ''}
      </T>

      {!drill ? (
        <Card>
          {drills.length === 0 ? (
            <T tone="muted">Pas encore d'exercice de ce type dans tes parties : analyse plus de parties, ou choisis « Tout ».</T>
          ) : (
            <>
              <T tone="strong">Série terminée : {session.correct}/{session.answered}</T>
              {session.best > 1 && <T tone="muted" style={styles.small}>Meilleure série : {session.best} bonnes réponses d'affilée.</T>}
            </>
          )}
          <Button label="Nouvelle série" onPress={() => restart()} style={styles.mt} />
        </Card>
      ) : (
        <>
          <T tone="faint" style={styles.small}>Question {index + 1}/{drills.length} · {DRILL_LABELS[drill.kind]}</T>
          <View style={styles.boardWrap}>
            <SquarePickerBoard
              fen={drill.fen}
              size={boardSize}
              orientation={drill.side === 'w' ? 'white' : 'black'}
              highlights={highlights}
              arrows={arrows}
              onPick={drill.kind === 'square' && answer === null ? submit : undefined}
            />
          </View>
          <T tone="strong">{drill.prompt}</T>
          {drill.kind === 'square' && answer === null && <T tone="faint" style={styles.small}>Touche directement une case de l'échiquier.</T>}

          {drill.choices?.map(c => {
            const isAnswer = drill.answer.includes(c.id)
            const picked = answer === c.id
            const state = answer === null ? 'idle' : isAnswer ? 'ok' : picked ? 'ko' : 'dim'
            return (
              <Pressable
                key={c.id}
                onPress={() => submit(c.id)}
                disabled={answer !== null}
                accessibilityRole="button"
                style={({ pressed }) => [styles.choice, state === 'ok' && styles.ok, state === 'ko' && styles.ko, pressed && { opacity: 0.7 }]}
              >
                <T tone={state === 'ok' ? 'win' : state === 'ko' ? 'loss' : state === 'dim' ? 'faint' : 'text'} style={styles.small}>{c.label}</T>
              </Pressable>
            )
          })}

          {answer !== null && (
            <Card>
              <T tone={correct ? 'win' : 'loss'} style={styles.bold}>
                {correct ? '✓ Bien vu !' : drill.kind === 'square' ? `✗ ${answer} n'est pas la meilleure case (réponse : ${drill.answer.join(' ou ')})` : '✗ Pas tout à fait'}
              </T>
              <T tone="muted" style={styles.small}>{drill.explanation}</T>
              {drill.source && (
                <Button
                  label={`Voir dans la partie (${drill.source.label})`}
                  kind="secondary"
                  onPress={() => router.push(`/partie/${gameSlug(drill.source!.url)}` as Href)}
                  style={styles.mt}
                />
              )}
              <Button label="Suivant →" onPress={() => { setIndex(i => i + 1); setAnswer(null) }} style={styles.mt} />
            </Card>
          )}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  small: { fontSize: 13, lineHeight: 18 },
  bold: { fontWeight: '600' },
  mt: { marginTop: 8 },
  boardWrap: { alignItems: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: TOUCH, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 8, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.border },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { fontSize: 13, color: C.muted },
  choice: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel },
  ok: { borderColor: C.win, backgroundColor: 'rgba(74,222,128,0.1)' },
  ko: { borderColor: C.loss, backgroundColor: 'rgba(248,113,113,0.1)' },
})
