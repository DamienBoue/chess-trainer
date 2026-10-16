// "Exercices": spaced-repetition drills taken from your own mistakes. It
// opens on today's session (20 at most, current mistakes and reviews, see
// @shared/analysis/dailyQueue): a goal you can reach. The board comes first,
// the filters sit behind one compact line.
import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Stack, router } from 'expo-router'
import type { CategoryFilter, DifficultyFilter, FilterCounts, StatusFilter } from '@shared/analysis/exerciseFilters'
import { Button, Card, H1, Screen, T } from '@/components/ui'
import ExerciseFiltersFold from '@/components/ExerciseFiltersFold'
import ExerciseSolverPanel from '@/components/ExerciseSolverPanel'
import { useAppData } from '@/lib/appData'

export default function ExercisesScreen() {
  const { analyses, progress, recordAttempt, exercises, daily, extendDaily } = useAppData()
  const [status, setStatus] = useState<StatusFilter>('today')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all')
  const [activeId, setActiveId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const byId = new Map(exercises.map(e => [e.id, e]))
    const pick = (ids: string[]) => ids.flatMap(id => byId.get(id) ?? [])
    let list = status === 'today' ? pick(daily.remaining) : status === 'due' ? pick(daily.currentDue) : exercises
    if (category !== 'all') list = list.filter(e => e.category === category)
    if (difficulty !== 'all') list = list.filter(e => e.difficulty === difficulty)
    if (status === 'solved') list = list.filter(e => (progress[e.id]?.successes ?? 0) > 0)
    else if (status === 'unseen') list = list.filter(e => !progress[e.id])
    return list
  }, [exercises, category, difficulty, status, progress, daily])

  // The active exercise stays pinned even after it drops out of the filter
  // (solved today, it leaves the session): it would otherwise be replaced
  // at once by the next one, before the solved move is even seen.
  const active = (activeId ? exercises.find(e => e.id === activeId) : null) ?? filtered[0] ?? null
  // Another filter: start from its first exercise.
  const pickFilter = <V,>(set: (v: V) => void) => (v: V) => { setActiveId(null); set(v) }

  const counts = useMemo<FilterCounts>(() => ({
    today: daily.remaining.length,
    all: exercises.length,
    due: daily.currentDue.length,
    solved: exercises.filter(e => (progress[e.id]?.successes ?? 0) > 0).length,
    unseen: exercises.filter(e => !progress[e.id]).length,
    missed: exercises.filter(e => e.category === 'missed').length,
    punishment: exercises.filter(e => e.category === 'punishment').length,
    defense: exercises.filter(e => e.category === 'defense').length,
    easy: exercises.filter(e => e.difficulty === 'easy').length,
    medium: exercises.filter(e => e.difficulty === 'medium').length,
    hard: exercises.filter(e => e.difficulty === 'hard').length,
  }), [exercises, progress, daily])

  const title = <Stack.Screen options={{ title: 'Exercices' }} />

  if (Object.keys(analyses).length === 0) {
    return (
      <Screen>
        {title}
        <H1>Pas encore d'exercices</H1>
        <T tone="muted">Les exercices sont générés depuis tes coups-clés (gaffes, punitions, défenses) repérés par Stockfish dans tes parties analysées.</T>
        <T>1. Va dans Parties pour voir tes dernières parties chess.com.{'\n'}2. Analyse-en quelques-unes.{'\n'}3. Reviens ici : les exercices apparaissent automatiquement.</T>
        <Button label="Voir mes parties" onPress={() => router.push('/parties')} />
      </Screen>
    )
  }
  if (exercises.length === 0) {
    return (
      <Screen>
        {title}
        <H1>Aucun coup-clé détecté</H1>
        <T tone="muted">Tes parties analysées n'ont pas (encore) produit d'erreur assez nette pour générer un exercice. Analyse plus de parties pour alimenter le pool.</T>
        <Button label="Voir mes parties" onPress={() => router.push('/parties')} />
      </Screen>
    )
  }

  const idx = active ? filtered.findIndex(e => e.id === active.id) : -1
  const offList = active != null && idx === -1
  const step = (d: 1 | -1) => {
    if (filtered.length === 0) return
    const n = idx >= 0 ? (idx + d + filtered.length) % filtered.length : d === 1 ? 0 : filtered.length - 1
    setActiveId(filtered[n].id)
  }

  return (
    <Screen>
      {title}
      <ExerciseFiltersFold
        status={status} onStatus={pickFilter(setStatus)}
        category={category} onCategory={pickFilter(setCategory)}
        difficulty={difficulty} onDifficulty={pickFilter(setDifficulty)}
        counts={counts} shown={filtered.length}
      />
      {status === 'today' && daily.total > 0 && (
        <T tone="muted" style={styles.session}>
          Séance du jour · {daily.done}/{daily.total} faits{daily.archived > 0 ? ` · ${daily.archived} anciennes erreurs archivées` : ''}
        </T>
      )}
      {status === 'today' && daily.total > 0 && daily.remaining.length === 0 && (
        <Card highlight>
          <T tone="win" style={styles.bold}>✓ Séance du jour terminée</T>
          <T tone="muted">Reviens demain : tes erreurs récentes et tes révisions t'attendront.</T>
          {daily.reserve > 0 && <Button label="Encore 10 exercices" onPress={extendDaily} />}
          {daily.reserve > 0 && <Button label={`Voir la réserve (${daily.reserve})`} kind="secondary" onPress={() => pickFilter(setStatus)('due')} />}
        </Card>
      )}
      {active ? (
        <>
          <View style={styles.nav}>
            <Button label="←" onPress={() => step(-1)} disabled={filtered.length <= 1} kind="secondary" style={styles.arrow} />
            <T tone="muted" style={styles.count}>
              {offList ? `✓ Fait · encore ${filtered.length}` : `Exercice ${idx + 1} / ${filtered.length}`}
            </T>
            <Button label="→" onPress={() => step(1)} disabled={filtered.length === 0} kind="secondary" style={styles.arrow} />
          </View>
          <ExerciseSolverPanel
            key={active.id}
            exercise={active}
            progress={progress[active.id]}
            onOutcome={o => { setActiveId(active.id); recordAttempt(active.id, o) }}
            onNext={() => step(1)}
          />
        </>
      ) : !(status === 'today' && daily.total > 0) && (
        <Card><T tone="muted">Aucun exercice dans cette sélection.</T></Card>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  arrow: { minWidth: 56 },
  count: { flex: 1, textAlign: 'center' },
  session: { fontSize: 13 },
  bold: { fontWeight: '600' },
})
