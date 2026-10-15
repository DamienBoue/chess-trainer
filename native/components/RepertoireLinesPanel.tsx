// "Lignes" tab of the repertoire: pick an opening + colour, then read the
// main line (most played move at each step) with counts, results, CPL,
// what Stockfish preferred and the alternatives you tried.
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { alternativesAt, rollupString, topLines, type RepertoireRoot } from '@shared/analysis/repertoire'
import { OpeningChips, cplColor } from '@/components/OpeningKit'
import { Card, T } from '@/components/ui'
import { C, TOUCH } from '@/constants/theme'

export const rootKeyOf = (r: RepertoireRoot) => `${r.parent}::${r.color}`

export default function RepertoireLinesPanel({ roots }: { roots: RepertoireRoot[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const active = roots.find(r => rootKeyOf(r) === activeKey) ?? roots[0]
  return (
    <View style={{ gap: 12 }}>
      <OpeningChips
        items={roots.map(r => ({ key: rootKeyOf(r), label: `${r.color === 'white' ? '♔' : '♚'} ${r.parent}`, badge: `${r.total}×` }))}
        activeKey={active ? rootKeyOf(active) : null}
        onPick={setActiveKey}
      />
      {active && <RootDetail key={rootKeyOf(active)} root={active} />}
    </View>
  )
}

function RootDetail({ root }: { root: RepertoireRoot }) {
  const main = useMemo(() => topLines(root, 8), [root])
  const [openAt, setOpenAt] = useState<number | null>(null)
  return (
    <Card style={{ gap: 8 }}>
      <T tone="strong" style={{ fontSize: 17, fontWeight: '700' }}>{root.parent}</T>
      <T tone="faint" style={{ fontSize: 12 }}>
        {root.total} partie{root.total > 1 ? 's' : ''} avec les {root.color === 'white' ? 'Blancs' : 'Noirs'}
      </T>
      <T tone="muted" style={{ fontSize: 13 }}>
        Ligne principale (la plus jouée à chaque coup). Tes coups habituels, pas forcément les meilleurs. La couleur signale la qualité moyenne (CPL) selon Stockfish.
      </T>
      {main.moves.length === 0 && <T tone="faint">Pas assez de données.</T>}
      {main.moves.map((m, i) => {
        const path = main.moves.slice(0, i + 1).map(x => x.san)
        const alts = alternativesAt(root, path).filter(a => a.san !== m.san)
        const isOpen = openAt === i
        const color = cplColor(m.avgCpLoss)
        const sfDisagrees = !!m.engineSuggestion && m.engineSuggestion.san !== m.san
        return (
          <View key={i}>
            <Pressable
              onPress={() => alts.length > 0 && setOpenAt(isOpen ? null : i)}
              accessibilityRole="button"
              style={styles.row}
            >
              <T tone="faint" style={styles.num}>{i + 1}.</T>
              {/* Each item wraps as a whole unit, never in the middle of "O-O" or "⌀ 3 cp". */}
              <View style={styles.items}>
                <T style={{ color, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{m.san}</T>
                <T tone="faint" style={styles.small}>×{m.count}</T>
                <T tone="faint" style={styles.small}>{rollupString({ wins: m.w, losses: m.l, draws: m.d })}</T>
                <T style={[styles.small, { color }]}>⌀ {m.avgCpLoss.toFixed(0)} cp</T>
                {sfDisagrees && <T style={[styles.small, { color: '#fdba74' }]}>⚠ SF préfère {m.engineSuggestion!.san}</T>}
                {alts.length > 0 && (
                  <T style={[styles.small, { color: '#60a5fa' }]}>
                    {isOpen ? '▾' : '▸'} {alts.length} alternative{alts.length > 1 ? 's' : ''}
                  </T>
                )}
              </View>
            </Pressable>
            {isOpen && alts.slice(0, 6).map(a => {
              const aCp = a.count > 0 ? a.cpLossSum / a.count : 0
              return (
                <View key={a.san} style={[styles.items, { marginLeft: 36, minHeight: 28 }]}>
                  <T style={{ color: cplColor(aCp), fontSize: 13 }}>{a.san}</T>
                  <T tone="faint" style={styles.small}>×{a.count}</T>
                  <T tone="faint" style={styles.small}>{rollupString(a)}</T>
                  <T style={[styles.small, { color: cplColor(aCp) }]}>⌀ {aCp.toFixed(0)} cp</T>
                </View>
              )
            })}
          </View>
        )
      })}
    </Card>
  )
}

const styles = StyleSheet.create({
  row: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  num: { width: 26, textAlign: 'right' },
  items: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10, rowGap: 2 },
  small: { fontSize: 12, lineHeight: 18 },
})
