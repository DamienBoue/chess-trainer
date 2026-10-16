// A game's analysis, phone-first like the website: the board up top, the
// current move explained right under it, the curve and the move list
// below, and a move bar pinned under the thumb.
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Stack, router, useLocalSearchParams, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { findGameBySlug } from '@shared/nav/gameSlug'
import { CLASSIFICATION_COLORS, CLASSIFICATION_LABELS } from '@shared/analysis/classify'
import Board, { type BoardArrow } from '@/components/Board'
import EvalGraph from '@/components/EvalGraph'
import MoveList from '@/components/MoveList'
import StrategyNotes from '@/components/StrategyNotes'
import GameSummaryCard from '@/components/GameSummaryCard'
import { Button, Card, SectionLabel, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'
import { keyMomentsOf, moveLabel, squaresOf } from '@/lib/analysis'
import { retryItemsFor } from '@/lib/retry'
import Svg, { Path } from 'react-native-svg'
import { C, TOUCH } from '@/constants/theme'

// Drawn icons: iOS shows ⏮ and ⏭ as blue emoji.
const ICONS = {
  start: 'M6 5v14M19 5l-10 7 10 7z',
  prev: 'M17 5l-11 7 11 7z',
  next: 'M7 5l11 7-11 7z',
  end: 'M18 5v14M5 5l10 7-10 7z',
  key: 'M6 21V4M6 4h11l-2.5 4 2.5 4H6',
} as const

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const RESULT_FR = { win: 'Victoire', loss: 'Défaite', draw: 'Nulle' } as const

export default function AnalysisScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { analyses } = useAppData()
  const allAnalyses = useMemo(() => Object.values(analyses), [analyses])
  const analysis = useMemo(() => findGameBySlug(allAnalyses, slug ?? ''), [allAnalyses, slug])
  const [ply, setPly] = useState(0)
  const [showBest, setShowBest] = useState(false)
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const keyMoments = useMemo(() => (analysis ? keyMomentsOf(analysis) : []), [analysis])
  const retryCount = useMemo(() => (analysis ? retryItemsFor(analysis).length : 0), [analysis])

  if (!analysis) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ title: 'Analyse' }} />
        <View style={styles.pad}><T tone="muted">Cette partie n'est pas (encore) analysée.</T></View>
      </View>
    )
  }

  const moves = analysis.moves
  const n = moves.length
  const m = ply > 0 ? moves[ply - 1] : null
  const better = !!m?.bestMoveSan && m.bestMoveSan !== m.san
  const showingBest = showBest && better && m
  const fen = !m ? moves[0]?.fenBefore ?? START : showingBest ? m.fenBefore : m.fenAfter
  const played = m ? squaresOf(m.fenBefore, m.san) : null
  const best = showingBest ? squaresOf(m.fenBefore, m.bestMoveSan) : null
  const arrows: BoardArrow[] = showingBest
    ? [...(played ? [{ ...played, color: '#e05252' }] : []), ...(best ? [{ ...best, color: '#5aa55a' }] : [])]
    : []
  const nextKey = keyMoments.find(k => k > ply)
  const boardSize = Math.min(width - 24, 560)
  const go = (p: number) => { setShowBest(false); setPly(Math.max(0, Math.min(n, p))) }
  const userSide = analysis.userColor === 'white' ? 'w' : 'b'

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: `vs ${analysis.opponent}` }} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 96 + insets.bottom }]}>
        <T tone="muted" numberOfLines={1} style={styles.small}>
          {analysis.userColor === 'white' ? 'Blancs' : 'Noirs'} · {RESULT_FR[analysis.result]}{analysis.opening ? ` · ${analysis.opening}` : ''}
        </T>
        <View style={styles.boardWrap}>
          <Board
            fen={fen}
            size={boardSize}
            orientation={analysis.userColor}
            lastMove={showingBest ? null : played}
            arrows={arrows}
          />
        </View>

        {!m && <GameSummaryCard analysis={analysis} all={allAnalyses} />}

        <Card>
          {!m ? (
            <T tone="muted">Avance avec ▶, le drapeau va au moment clé suivant, ou touche un coup de la liste.</T>
          ) : (
            <>
              <T tone="strong" style={styles.bold}>
                {moveLabel(m.ply, m.san)} · <Text style={{ color: CLASSIFICATION_COLORS[m.classification] }}>{CLASSIFICATION_LABELS[m.classification]}</Text>
                {m.cpLoss > 0 ? <T tone="faint" style={styles.small}> −{Math.round(m.cpLoss)} cp</T> : null}
              </T>
              {better && <T tone="muted">Le moteur préférait <T tone="strong">{m.bestMoveSan}</T>{m.bestLineSan ? ` (${m.bestLineSan})` : ''}.</T>}
              {better && (
                <Button
                  label={showBest ? 'Revenir au coup joué' : 'Voir le meilleur coup'}
                  kind="secondary"
                  onPress={() => setShowBest(s => !s)}
                />
              )}
            </>
          )}
        </Card>

        {retryCount > 0 && (
          <Button
            label={`🎯 Revoir mes erreurs (${retryCount})`}
            onPress={() => router.push(`/partie/revue/${slug}` as Href)}
          />
        )}

        <StrategyNotes fen={fen} userSide={userSide} />

        <SectionLabel>Évaluation</SectionLabel>
        <EvalGraph moves={moves} ply={ply} userColor={analysis.userColor} onSeek={go} />

        <SectionLabel>Coups</SectionLabel>
        <Card><MoveList moves={moves} ply={ply} onSeek={go} /></Card>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
        <BarButton icon="start" a11y="Début" onPress={() => go(0)} disabled={ply === 0} />
        <BarButton icon="prev" a11y="Coup précédent" onPress={() => go(ply - 1)} disabled={ply === 0} />
        <Text style={styles.barLabel} numberOfLines={1}>{m ? moveLabel(m.ply, m.san) : 'Départ'}</Text>
        <BarButton icon="next" a11y="Coup suivant" onPress={() => go(ply + 1)} disabled={ply === n} />
        <BarButton icon="end" a11y="Fin" onPress={() => go(n)} disabled={ply === n} />
        <BarButton icon="key" a11y="Moment clé suivant" onPress={() => nextKey && go(nextKey)} disabled={!nextKey} accent />
      </View>
    </View>
  )
}

function BarButton({ icon, a11y, onPress, disabled, accent }: { icon: keyof typeof ICONS; a11y: string; onPress: () => void; disabled?: boolean; accent?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.barBtn, pressed && { opacity: 0.6 }, disabled && { opacity: 0.3 }]}
    >
      <Svg width={24} height={24} viewBox="0 0 24 24" fill={icon === 'key' ? 'none' : accent ? C.accentHover : C.text} stroke={accent ? C.accentHover : C.text} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
        <Path d={ICONS[icon]} />
      </Svg>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  pad: { padding: 12, gap: 12 },
  boardWrap: { alignItems: 'center' },
  bold: { fontWeight: '600' },
  small: { fontSize: 13 },
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.panel, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 4,
  },
  barBtn: { minWidth: TOUCH, height: 52, alignItems: 'center', justifyContent: 'center' },
  barLabel: { flex: 1, textAlign: 'center', color: C.strong, fontFamily: 'Menlo', fontSize: 15 },
})
