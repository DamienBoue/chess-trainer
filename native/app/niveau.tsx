// Mon niveau: the Elo bracket (auto-detected or declared) and the modules to
// master for it, checked off and persisted as on the website (localStorage).
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Stack } from 'expo-router'
import {
  BRACKETS, bracketForElo, effectiveElo, inferEloFromGames, loadEloPreference,
  saveEloPreference, suggestBracketChange, type SkillBracket,
} from '@shared/skill/elo'
import { loadModuleProgress, modulesForBracket, toggleModuleDone, type ModuleArea, type RoadmapModule } from '@shared/skill/roadmap'
import NiveauModuleRow from '@/components/NiveauModuleRow'
import { Card, Screen, T } from '@/components/ui'
import { useAppData } from '@/lib/appData'
import { C, TOUCH } from '@/constants/theme'

const BRACKET_COLORS: Record<SkillBracket['id'], string> = {
  beginner: '#9b9b9b', casual: '#7aa6ee', club: '#5fa052', tournament: '#ef9a3a', expert: '#c47aee', master: '#d04a4a',
}
const AREA_LABELS: Record<ModuleArea, string> = {
  tactics: 'Tactique', endgame: 'Finale', opening: 'Ouverture', middlegame: 'Milieu', calculation: 'Calcul', mindset: 'Mental',
}
const AREA_COLORS: Record<ModuleArea, string> = {
  tactics: '#fdba74', endgame: '#fde68a', opening: '#93c5fd', middlegame: '#86efac', calculation: '#d8b4fe', mindset: '#f9a8d4',
}
const SURFACE_LABELS: Record<NonNullable<RoadmapModule['surface']>, string> = {
  exercises: 'Exercices', blunder: 'Réflexe', calc: 'Calcul', repertoire: 'Répertoire', library: 'Bibliothèque', play: 'Jouer', stats: 'Stats', book: 'Livre',
}

export default function NiveauScreen() {
  const { analyses } = useAppData()
  const list = useMemo(() => Object.values(analyses), [analyses])
  const [pref, setPref] = useState(() => loadEloPreference())
  const [progress, setProgress] = useState(() => loadModuleProgress())
  const inferred = useMemo(() => inferEloFromGames(list), [list])
  const bracket = bracketForElo(effectiveElo(pref, list))
  // The ladder lets the user browse other brackets; null = follow the real one.
  const [previewId, setPreviewId] = useState<SkillBracket['id'] | null>(null)
  const viewBracket = BRACKETS.find(b => b.id === previewId) ?? bracket
  const isPreview = viewBracket.id !== bracket.id
  const modules = modulesForBracket(viewBracket)
  const suggestion = useMemo(() => suggestBracketChange(pref, list), [pref, list])
  const done = new Set(progress.completed)
  const doneCount = modules.filter(m => done.has(m.id)).length

  function updateDeclared(value: string) {
    const n = parseInt(value, 10)
    const next = { ...pref, declared: Number.isFinite(n) && n > 0 ? n : null }
    setPref(next)
    saveEloPreference(next)
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Mon niveau' }} />
      <T tone="muted">Les modules à maîtriser en priorité pour ton palier. Coche au fur et à mesure.</T>

      <Card style={styles.gap}>
        <T tone="strong" style={styles.bold}>Ton niveau</T>
        <View style={styles.eloRow}>
          <T tone="muted">Elo déclaré</T>
          <TextInput
            value={pref.declared != null ? String(pref.declared) : ''}
            onChangeText={updateDeclared}
            keyboardType="number-pad"
            maxLength={4}
            placeholder={inferred ? `auto : ${inferred}` : '1200'}
            placeholderTextColor={C.faint}
            accessibilityLabel="Elo déclaré"
            style={styles.input}
          />
          {pref.declared != null && (
            <Pressable onPress={() => updateDeclared('')} accessibilityRole="button" style={styles.clear}>
              <Text style={styles.clearText}>Effacer</Text>
            </Pressable>
          )}
        </View>
        {inferred != null && pref.declared == null && (
          <T tone="faint" style={styles.small}>Auto-détecté depuis tes parties analysées : {inferred}</T>
        )}

        <View style={styles.ladder}>
          {BRACKETS.map(b => {
            const viewing = b.id === viewBracket.id
            const real = b.id === bracket.id
            return (
              <Pressable
                key={b.id}
                onPress={() => setPreviewId(b.id === bracket.id ? null : b.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: viewing }}
                accessibilityLabel={`${b.label}, ${b.min} à ${b.max}${real ? ', ton palier' : ''}`}
                style={[styles.chip, viewing && { backgroundColor: BRACKET_COLORS[b.id], borderColor: BRACKET_COLORS[b.id] }, real && !viewing && styles.chipReal]}
              >
                <Text style={[styles.chipText, viewing && { color: C.strong }]}>{b.label}</Text>
              </Pressable>
            )
          })}
        </View>
        <T>
          <Text style={{ color: BRACKET_COLORS[viewBracket.id], fontWeight: '600' }}>{viewBracket.label}</Text>
          {' — '}{viewBracket.description}
        </T>

        {suggestion && (
          <View style={[styles.suggest, suggestion.kind === 'promote' ? styles.promote : styles.demote]}>
            <T style={styles.small}>
              {suggestion.kind === 'promote'
                ? `📈 Tes parties récentes pointent vers ${suggestion.inferred} (palier ${suggestion.nextBracket.label}). Mettre à jour ton Elo déclaré ?`
                : `📉 Tes parties récentes pointent vers ${suggestion.inferred} (palier ${suggestion.nextBracket.label}). Période difficile ? Tu peux revoir ton Elo à la baisse.`}
            </T>
            <Pressable onPress={() => updateDeclared(String(suggestion.inferred))} accessibilityRole="button" style={styles.apply}>
              <Text style={styles.applyText}>Appliquer {suggestion.inferred}</Text>
            </Pressable>
          </View>
        )}
      </Card>

      <Card>
        <View style={styles.between}>
          <T tone="strong" style={[styles.bold, { flex: 1 }]}>Modules · {viewBracket.label}</T>
          <T tone="muted">{doneCount}/{modules.length}</T>
        </View>
        {isPreview && (
          <View style={styles.between}>
            <Text style={styles.preview}>Aperçu</Text>
            <Pressable onPress={() => setPreviewId(null)} accessibilityRole="button" style={styles.clear}>
              <Text style={styles.clearText}>← Revenir à ton palier ({bracket.label})</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.track}>
          <View style={{ width: `${modules.length ? (doneCount / modules.length) * 100 : 0}%`, height: '100%', backgroundColor: C.accent }} />
        </View>
        {modules.map(m => (
          <NiveauModuleRow
            key={m.id}
            title={m.title}
            why={m.why}
            area={AREA_LABELS[m.area]}
            areaColor={AREA_COLORS[m.area]}
            hint={m.studyHint}
            surface={m.surface ? SURFACE_LABELS[m.surface] : undefined}
            done={done.has(m.id)}
            onToggle={() => setProgress(toggleModuleDone(m.id))}
          />
        ))}
      </Card>

      {!isPreview && bracket.id !== 'master' && (
        <T tone="faint" style={[styles.small, { textAlign: 'center' }]}>
          Quand tu auras coché tous les modules de ce palier, monte ton Elo déclaré : la roadmap se reconfigure.
        </T>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  bold: { fontWeight: '600' },
  small: { fontSize: 12, lineHeight: 17 },
  gap: { gap: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  eloRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  input: { minHeight: TOUCH, minWidth: 110, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#171717', borderWidth: 1, borderColor: C.border, color: C.strong, fontSize: 16 },
  clear: { minHeight: TOUCH, justifyContent: 'center' },
  clearText: { color: C.muted, fontSize: 13, textDecorationLine: 'underline' },
  ladder: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: TOUCH, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8, backgroundColor: '#171717', borderWidth: 1, borderColor: C.border },
  chipReal: { borderColor: C.muted },
  chipText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  suggest: { padding: 12, borderRadius: 8, borderWidth: 1, gap: 6 },
  promote: { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.4)' },
  demote: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.4)' },
  apply: { minHeight: TOUCH, justifyContent: 'center' },
  applyText: { color: C.strong, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  preview: { color: C.warn, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  track: { height: 6, borderRadius: 3, backgroundColor: '#171717', overflow: 'hidden', marginVertical: 8 },
})
