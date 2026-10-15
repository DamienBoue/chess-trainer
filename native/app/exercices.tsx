// "Exercices": spaced-repetition drills taken from your own mistakes. Same
// filters and rules as the website's ExercisesView; the board comes first,
// the filters sit behind one compact line.
import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Stack, router } from 'expo-router'
import { extractExercises } from '@shared/analysis/exercises'
import { isDue } from '@shared/storage/persist'
import type { CategoryFilter, DifficultyFilter, FilterCounts, StatusFilter } from '@shared/components/exerciseFilters'
import { Button, Card, H1, Screen, T } from '@/components/ui'
import ExerciseFiltersFold from '@/components/ExerciseFiltersFold'
import ExerciseSolverPanel from '@/components/ExerciseSolverPanel'
import { useAppData } from '@/lib/appData'

export default function ExercisesScreen() {
  const { analyses, progress, recordAttempt } = useAppData()
  const exercises = useMemo(() => extractExercises(Object.values(analyses)), [analyses])
  const [status, setStatus] = useState<StatusFilter>('due')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all')
  const [activeId, setActiveId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = exercises
    if (category !== 'all') list = list.filter(e => e.category === category)
    if (difficulty !== 'all') list = list.filter(e => e.difficulty === difficulty)
    if (status === 'due') list = list.filter(e => isDue(progress[e.id]))
    else if (status === 'solved') list = list.filter(e => (progress[e.id]?.successes ?? 0) > 0)
    else if (status === 'unseen') list = list.filter(e => !progress[e.id])
    return list
  }, [exercises, category, difficulty, status, progress])

  // The active exercise stays pinned even after it drops out of the filter
  // (solved under "À réviser"): it would otherwise look like an auto-advance.
  const active = (activeId ? exercises.find(e => e.id === activeId) : null) ?? filtered[0] ?? null

  const counts = useMemo<FilterCounts>(() => ({
    all: exercises.length,
    due: exercises.filter(e => isDue(progress[e.id])).length,
    solved: exercises.filter(e => (progress[e.id]?.successes ?? 0) > 0).length,
    unseen: exercises.filter(e => !progress[e.id]).length,
    missed: exercises.filter(e => e.category === 'missed').length,
    punishment: exercises.filter(e => e.category === 'punishment').length,
    defense: exercises.filter(e => e.category === 'defense').length,
    easy: exercises.filter(e => e.difficulty === 'easy').length,
    medium: exercises.filter(e => e.difficulty === 'medium').length,
    hard: exercises.filter(e => e.difficulty === 'hard').length,
  }), [exercises, progress])

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
        status={status} onStatus={setStatus}
        category={category} onCategory={setCategory}
        difficulty={difficulty} onDifficulty={setDifficulty}
        counts={counts} shown={filtered.length}
      />
      {active ? (
        <>
          <View style={styles.nav}>
            <Button label="←" onPress={() => step(-1)} disabled={filtered.length <= 1} kind="secondary" style={styles.arrow} />
            <T tone="muted" style={styles.count}>
              {offList ? `✓ Hors filtre · ${filtered.length} restant${filtered.length > 1 ? 's' : ''}` : `Exercice ${idx + 1} / ${filtered.length}`}
            </T>
            <Button label="→" onPress={() => step(1)} disabled={filtered.length === 0} kind="secondary" style={styles.arrow} />
          </View>
          <ExerciseSolverPanel
            key={active.id}
            exercise={active}
            progress={progress[active.id]}
            onOutcome={o => recordAttempt(active.id, o)}
            onNext={() => step(1)}
          />
        </>
      ) : (
        <Card><T tone="muted">Aucun exercice dans cette sélection.</T></Card>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  arrow: { minWidth: 56 },
  count: { flex: 1, textAlign: 'center' },
})
