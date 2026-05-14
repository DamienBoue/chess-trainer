import { useRef, useState } from 'react'
import { soundsEnabled, setSoundsEnabled } from '../audio/sounds'
import {
  getBoardTheme, setBoardTheme, type BoardTheme,
  getEngineDepth, setEngineDepth,
} from '../storage/settings'
import { exportAll, importAll, downloadJson, readJsonFile } from '../storage/exportImport'
import { toast } from './Toast'
import { resetOnboarding } from './Onboarding'

interface Props {
  username: string
  /** Removes all analysis cache for the current user. */
  onPurgeAnalyses: () => void
  /** Wipes ALL progress stores (exercises, repertoire, daily, rush). */
  onResetProgress: () => void
}

export default function SettingsView({ username, onPurgeAnalyses, onResetProgress }: Props) {
  const [sounds, setSounds] = useState(soundsEnabled())
  const [theme, setTheme] = useState<BoardTheme>(getBoardTheme())
  const [depth, setDepth] = useState(getEngineDepth())
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  async function doExport() {
    setBusy(true)
    try {
      const data = await exportAll()
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      downloadJson(data, `chess-trainer-${username || 'export'}-${stamp}.json`)
      toast.success('Sauvegarde téléchargée')
    } catch (e) {
      console.error('[settings] export failed:', e)
      toast.info('Export échoué')
    } finally {
      setBusy(false)
    }
  }

  async function doImport(file: File, merge: boolean) {
    setBusy(true)
    try {
      const data = await readJsonFile(file)
      await importAll(data, { merge })
      toast.success(merge ? 'Données fusionnées — recharge la page' : 'Données restaurées — recharge la page')
    } catch (e) {
      console.error('[settings] import failed:', e)
      toast.info(`Import échoué : ${e instanceof Error ? e.message : 'fichier invalide'}`)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function changeSounds(on: boolean) {
    setSounds(on)
    setSoundsEnabled(on)
    toast.info(on ? 'Sons activés' : 'Sons coupés')
  }
  function changeTheme(t: BoardTheme) {
    setTheme(t)
    setBoardTheme(t)
    toast.success(`Thème "${THEME_LABELS[t]}" appliqué`)
  }
  function changeDepth(n: number) {
    setDepth(n)
    setEngineDepth(n)
  }

  function resetProgress() {
    if (!confirm('Effacer TOUTE la progression (exercices SM-2, répertoire SRS, daily, rush) ? Les analyses Stockfish ne sont pas touchées.')) return
    onResetProgress()
    toast.success('Progression réinitialisée')
  }

  function purgeAnalyses() {
    if (!confirm(`Effacer les analyses Stockfish de @${username} ? Tu devras relancer "Tout analyser".`)) return
    onPurgeAnalyses()
    toast.success('Analyses purgées')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Préférences</h2>
        <p className="text-sm text-neutral-400">
          Réglages stockés en local (localStorage). Aucun envoi serveur.
        </p>
      </div>

      <section className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 space-y-3">
        <h3 className="font-semibold text-sm">Affichage</h3>

        <div>
          <label className="block text-sm text-neutral-300 mb-2">Thème d'échiquier</label>
          <div className="flex gap-2 flex-wrap">
            {(['green', 'brown', 'blue', 'gray'] as BoardTheme[]).map(t => (
              <button
                key={t}
                onClick={() => changeTheme(t)}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-sm ${
                  theme === t
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                    : 'border-[var(--color-border)] hover:bg-neutral-800'
                }`}
              >
                <ThemeSwatch theme={t} />
                {THEME_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 space-y-3">
        <h3 className="font-semibold text-sm">Son</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={sounds}
            onChange={e => changeSounds(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">Activer les sons (déplacements, capture, succès)</span>
        </label>
      </section>

      <section className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 space-y-3">
        <h3 className="font-semibold text-sm">Moteur Stockfish</h3>
        <div>
          <label className="block text-sm text-neutral-300 mb-2">
            Profondeur d'analyse : <span className="font-mono text-neutral-100">{depth}</span> plies
            <span className="text-xs text-neutral-500 ml-2">
              (~{depth <= 12 ? '30-60' : depth <= 18 ? '60-180' : '180s+'} par partie)
            </span>
          </label>
          <input
            type="range"
            min={8}
            max={22}
            step={1}
            value={depth}
            onChange={e => changeDepth(parseInt(e.target.value, 10))}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
            <span>8 (rapide, indicatif)</span>
            <span>14 (recommandé)</span>
            <span>22 (très profond, lent)</span>
          </div>
        </div>
      </section>

      <section className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 space-y-2">
        <h3 className="font-semibold text-sm">Aide</h3>
        <button
          onClick={resetOnboarding}
          className="text-left px-3 py-2 text-sm rounded bg-neutral-900 border border-[var(--color-border)] hover:bg-neutral-800 w-full"
        >
          <div className="font-medium text-neutral-200">Rejouer le tour d'onboarding</div>
          <div className="text-xs text-neutral-500">Recharge la page et affiche les 5 cartes d'introduction.</div>
        </button>
      </section>

      <section className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4 space-y-3">
        <h3 className="font-semibold text-sm">Sauvegarde / restauration</h3>
        <p className="text-xs text-neutral-500">
          Exporte parties analysées, progression SRS, répertoire, livres et préférences vers un fichier JSON. Sert de backup ou pour migrer d'un appareil à l'autre.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={doExport}
            disabled={busy}
            className="text-left px-3 py-2 text-sm rounded bg-neutral-900 border border-[var(--color-border)] hover:bg-neutral-800 disabled:opacity-50"
          >
            <div className="font-medium text-neutral-200">Exporter toutes les données</div>
            <div className="text-xs text-neutral-500">Télécharge un fichier JSON avec l'intégralité de ton état local.</div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async e => {
              const f = e.target.files?.[0]
              if (!f) return
              const merge = confirm(
                'Importer en fusionnant avec tes données actuelles ?\n\n' +
                '• OK → fusionner (garde tes données + ajoute celles du fichier)\n' +
                '• Annuler → remplacer (efface tes données actuelles d\'abord)',
              )
              await doImport(f, merge)
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="text-left px-3 py-2 text-sm rounded bg-neutral-900 border border-[var(--color-border)] hover:bg-neutral-800 disabled:opacity-50"
          >
            <div className="font-medium text-neutral-200">Importer depuis un fichier</div>
            <div className="text-xs text-neutral-500">Choisis un .json précédemment exporté. Tu choisis ensuite fusion ou remplacement.</div>
          </button>
        </div>
      </section>

      <section className="bg-red-900/10 border border-red-700/40 rounded-md p-4 space-y-3">
        <h3 className="font-semibold text-sm text-red-200">Zone dangereuse</h3>
        <div className="flex flex-col gap-2">
          <button
            onClick={purgeAnalyses}
            className="text-left px-3 py-2 text-sm rounded bg-neutral-900 border border-[var(--color-border)] hover:border-red-700 hover:bg-red-900/20"
          >
            <div className="font-medium text-neutral-200">Purger les analyses</div>
            <div className="text-xs text-neutral-500">Efface le cache Stockfish de @{username}. Les parties chess.com restent.</div>
          </button>
          <button
            onClick={resetProgress}
            className="text-left px-3 py-2 text-sm rounded bg-neutral-900 border border-[var(--color-border)] hover:border-red-700 hover:bg-red-900/20"
          >
            <div className="font-medium text-neutral-200">Réinitialiser la progression</div>
            <div className="text-xs text-neutral-500">Vide exercices SM-2, répertoire SRS, série quotidienne, Woodpecker rush.</div>
          </button>
        </div>
      </section>
    </div>
  )
}

const THEME_LABELS: Record<BoardTheme, string> = {
  green: 'Vert (chess.com)',
  brown: 'Marron (Lichess)',
  blue: 'Bleu',
  gray: 'Gris',
}

function ThemeSwatch({ theme }: { theme: BoardTheme }) {
  const palette = {
    green: ['#769656', '#eeeed2'],
    brown: ['#b58863', '#f0d9b5'],
    blue:  ['#5b88ba', '#c9d6e3'],
    gray:  ['#5e6266', '#cfd2d4'],
  }[theme]
  return (
    <span className="inline-flex w-6 h-6 rounded overflow-hidden border border-neutral-700">
      <span style={{ backgroundColor: palette[0], width: '50%' }} />
      <span style={{ backgroundColor: palette[1], width: '50%' }} />
    </span>
  )
}
