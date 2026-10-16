// "Puzzle du jour": one deterministic exercise per day out of your pool, and
// a streak of consecutive days solved (storage: @shared/storage/daily).
// Like the website, it does not feed the spaced repetition.
import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Stack, router } from 'expo-router'
import {
  type DailyState, todayString, loadDaily, saveDaily, pickDaily, bumpStreak, decayStreakIfMissed,
} from '@shared/storage/daily'
import { Button, Card, H1, Screen, T } from '@/components/ui'
import ExerciseSolverPanel from '@/components/ExerciseSolverPanel'
import { useAppData } from '@/lib/appData'
import { C } from '@/constants/theme'

export default function DailyPuzzleScreen() {
  const { exercises } = useAppData()
  const today = todayString()
  const [saved, setSaved] = useState<DailyState | null>(() => decayStreakIfMissed(loadDaily(), today))

  const exercise = useMemo(() => {
    if (saved && saved.date === today && saved.exerciseId) {
      const e = exercises.find(x => x.id === saved.exerciseId)
      if (e) return e
    }
    return pickDaily(exercises, today)
  }, [exercises, saved, today])

  const title = <Stack.Screen options={{ title: 'Puzzle du jour' }} />

  if (!exercise) {
    return (
      <Screen>
        {title}
        <H1>Pas encore de puzzle quotidien</H1>
        <T tone="muted">Le quotidien tire chaque jour un exercice déterministe depuis ton pool. Il faut au moins un exercice généré pour qu'il s'active.</T>
        <T>1. Va dans Parties.{'\n'}2. Analyse au moins une partie.{'\n'}3. Reviens demain pour démarrer ta série.</T>
        <Button label="Voir mes parties" onPress={() => router.push('/parties')} />
      </Screen>
    )
  }

  // Today's state, with the picked puzzle adopted (and stored) if needed.
  const state: DailyState = saved && saved.date === today && saved.exerciseId === exercise.id
    ? saved
    : {
        date: today,
        exerciseId: exercise.id,
        solved: saved?.date === today ? !!saved.solved : false,
        streak: saved?.streak ?? 0,
        lastSolvedDate: saved?.lastSolvedDate ?? null,
      }
  if (state !== saved) saveDaily(state)
  const alreadySolved = state.solved && state.date === today
  const streak = state.streak

  return (
    <Screen>
      {title}
      <View style={styles.head}>
        <T tone="faint">{today}</T>
        <View style={styles.streak}>
          <T style={{ color: '#fdba74', fontSize: 13 }}>🔥 Série : {streak} jour{streak > 1 ? 's' : ''}</T>
        </View>
      </View>
      {alreadySolved && <Card><T tone="win">✓ Déjà résolu aujourd'hui — reviens demain pour le suivant.</T></Card>}
      <ExerciseSolverPanel
        key={exercise.id + today}
        exercise={exercise}
        singleMove
        // Already solved today: open on the solution, nothing left to report.
        initialSolved={alreadySolved}
        onOutcome={o => {
          // Only a found move counts for the streak, not "Voir la solution".
          if (o === 'revealed') return
          const next: DailyState = { date: today, exerciseId: exercise.id, solved: true, streak: bumpStreak(state, today), lastSolvedDate: today }
          saveDaily(next)
          setSaved(next)
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  streak: { backgroundColor: 'rgba(249,115,22,0.15)', borderColor: 'rgba(249,115,22,0.4)', borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
})
