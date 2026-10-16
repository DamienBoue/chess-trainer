// The game at a glance, shown on the start position of an analysis: the
// website's summary text, the player's errors, the average loss of each
// side and the strategic lessons of the game.
import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { GameAnalysis } from '@shared/types'
import { generateGameSummary, summarizeMoves } from '@shared/analysis/summary'
import { buildRepertoire } from '@shared/analysis/repertoire'
import { CLASSIFICATION_COLORS } from '@shared/analysis/classify'
import { Card, SectionLabel, T } from '@/components/ui'
import { strategyReviewOf } from '@/lib/analysis'
import { C } from '@/constants/theme'

export default function GameSummaryCard({ analysis, all }: { analysis: GameAnalysis; all: GameAnalysis[] }) {
  const text = useMemo(() => {
    try { return generateGameSummary(analysis, buildRepertoire(all)) } catch { return null }
  }, [analysis, all])
  const s = summarizeMoves(analysis)
  const review = strategyReviewOf(analysis)
  return (
    <Card>
      <SectionLabel>Bilan</SectionLabel>
      {text && <T style={styles.small}>{text}</T>}
      <View style={styles.stats}>
        <Stat label="Gaffes" value={s.user.blunders} color={CLASSIFICATION_COLORS.blunder} />
        <Stat label="Erreurs" value={s.user.mistakes} color={CLASSIFICATION_COLORS.mistake} />
        <Stat label="Inexactitudes" value={s.user.inaccuracies} color={CLASSIFICATION_COLORS.inaccuracy} />
      </View>
      <T tone="faint" style={styles.small}>
        Perte moyenne : toi {s.user.avgCpLoss.toFixed(0)} cp/coup · adversaire {s.opp.avgCpLoss.toFixed(0)} cp/coup
      </T>
      {review?.mainStructure && <T tone="muted" style={styles.small}>Structure principale : {review.mainStructure.name}</T>}
      {review && review.lessons.length > 0 && (
        <>
          <SectionLabel>À retenir</SectionLabel>
          {review.lessons.slice(0, 3).map(l => <T key={l} style={styles.small}>• {l}</T>)}
        </>
      )}
    </Card>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  small: { fontSize: 13, lineHeight: 19 },
  stats: { flexDirection: 'row', gap: 8, marginVertical: 6 },
  stat: { flex: 1, backgroundColor: C.panel2, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  value: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 11, color: C.muted },
})
