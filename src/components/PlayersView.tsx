import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlayerProfile } from '../players/storage'
import { listPlayers, savePlayer, deletePlayer } from '../players/storage'
import { buildPlayerProfiles } from '../players/import'
import { scoutingProfile, type ScoutingProfile, type OpeningStat } from '../analysis/scouting'
import { compareProfiles, type OpeningOpportunity } from '../analysis/playerCompare'

export default function PlayersView() {
  const [profiles, setProfiles] = useState<PlayerProfile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [importPreview, setImportPreview] = useState<PlayerProfile[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement | null>(null)

  async function refresh() {
    setProfiles(await listPlayers())
  }
  useEffect(() => { refresh() }, [])

  async function onFile(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      let combined = ''
      for (const f of Array.from(files)) {
        combined += '\n\n' + await f.text()
      }
      const found = buildPlayerProfiles(combined, 3)
      if (found.length === 0) {
        setError("Aucun joueur avec ≥3 parties trouvé dans le PGN.")
        return
      }
      setImportPreview(found)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function saveSelected(ids: Set<string>) {
    if (!importPreview) return
    setBusy(true)
    try {
      for (const p of importPreview) {
        if (!ids.has(p.id)) continue
        // Merge with existing profile of same id (append games).
        const existing = profiles?.find(e => e.id === p.id)
        if (existing) {
          const seen = new Set(existing.games.map(g => g.url))
          const merged = [...existing.games, ...p.games.filter(g => !seen.has(g.url))]
          await savePlayer({ ...existing, games: merged, importedAt: new Date().toISOString() })
        } else {
          await savePlayer(p)
        }
      }
      setImportPreview(null)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`Supprimer le profil "${name}" ?`)) return
    await deletePlayer(id)
    await refresh()
    setSelectedIds(ids => ids.filter(i => i !== id))
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) :
      prev.length >= 2 ? [prev[1], id] : [...prev, id])
  }

  const a = profiles?.find(p => p.id === selectedIds[0]) ?? null
  const b = profiles?.find(p => p.id === selectedIds[1]) ?? null

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Joueurs (PGN / OTB)</h2>
          <p className="text-sm text-neutral-400">
            Importe les parties d'un ou plusieurs joueurs via un fichier PGN (TWIC, pgnmentor, export ChessBase).
            Coche deux profils pour les comparer.
          </p>
        </div>
        <label className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium cursor-pointer">
          {busy ? 'Import…' : '＋ Importer PGN'}
          <input
            ref={fileRef}
            type="file"
            accept=".pgn,application/x-chess-pgn,text/plain"
            multiple
            onChange={e => onFile(e.target.files)}
            className="hidden"
            disabled={busy}
          />
        </label>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded p-3 text-sm text-red-300">{error}</div>
      )}

      {importPreview && (
        <ImportPreview
          profiles={importPreview}
          onCancel={() => setImportPreview(null)}
          onConfirm={saveSelected}
          busy={busy}
        />
      )}

      {!profiles ? (
        <p className="text-neutral-400 text-sm">Chargement…</p>
      ) : profiles.length === 0 ? (
        <details className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded p-4 text-sm">
          <summary className="cursor-pointer">D'où télécharger des PGN ?</summary>
          <ul className="mt-3 text-neutral-400 space-y-1 list-disc pl-5">
            <li>
              <a className="underline text-neutral-200" href="https://theweekinchess.com/twic" target="_blank" rel="noopener">TWIC</a> — archive hebdo de tous les opens majeurs depuis 1994 (PGN zippé).
            </li>
            <li>
              <a className="underline text-neutral-200" href="https://www.pgnmentor.com/files.html" target="_blank" rel="noopener">PGN Mentor</a> — un fichier par grand joueur.
            </li>
            <li>
              <a className="underline text-neutral-200" href="https://lichess.org/broadcast" target="_blank" rel="noopener">Lichess Broadcasts</a> — bouton "PGN" sur chaque tournoi.
            </li>
          </ul>
        </details>
      ) : (
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md">
          <div className="px-3 py-2 text-xs text-neutral-500 border-b border-[var(--color-border)]">
            Coche jusqu'à 2 profils pour la comparaison ({selectedIds.length}/2)
          </div>
          <ul>
            {profiles.map(p => {
              const selected = selectedIds.includes(p.id)
              return (
                <li
                  key={p.id}
                  className={`px-3 py-2 flex items-center gap-3 border-b border-[var(--color-border)]/40 last:border-0 ${
                    selected ? 'bg-[var(--color-accent)]/10' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelect(p.id)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-neutral-100 truncate">{p.name}</div>
                    <div className="text-xs text-neutral-500">{p.games.length} parties · importé {new Date(p.importedAt).toLocaleDateString()}</div>
                  </div>
                  <button
                    onClick={() => onDelete(p.id, p.name)}
                    className="text-xs text-neutral-400 hover:text-red-300 px-2"
                    title="Supprimer le profil"
                  >✕</button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {a && b && <ComparisonPanel a={a} b={b} />}
      {a && !b && <ProfileSingle profile={a} />}
    </div>
  )
}

function ImportPreview({
  profiles, onCancel, onConfirm, busy,
}: {
  profiles: PlayerProfile[]
  onCancel: () => void
  onConfirm: (ids: Set<string>) => void
  busy: boolean
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(profiles.map(p => p.id)))
  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-accent)] rounded-md p-4 space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-semibold">{profiles.length} profils détectés</h3>
        <span className="text-xs text-neutral-500">Décoche pour ignorer.</span>
      </div>
      <div className="max-h-64 overflow-auto border border-[var(--color-border)] rounded">
        {profiles.map(p => (
          <label key={p.id} className="flex items-center gap-3 px-3 py-1.5 hover:bg-neutral-900/50 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={checked.has(p.id)}
              onChange={() => toggle(p.id)}
              className="w-4 h-4"
            />
            <span className="flex-1">{p.name}</span>
            <span className="text-xs text-neutral-500">{p.games.length} parties</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded bg-neutral-800 hover:bg-neutral-700">Annuler</button>
        <button
          onClick={() => onConfirm(checked)}
          disabled={busy || checked.size === 0}
          className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white disabled:opacity-50"
        >Importer {checked.size}</button>
      </div>
    </div>
  )
}

function ProfileSingle({ profile }: { profile: PlayerProfile }) {
  const sp = useMemo(() => scoutingProfile(profile.name, profile.games), [profile])
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
      <h3 className="font-semibold mb-2">{profile.name}</h3>
      <SimpleScout p={sp} />
      <p className="text-xs text-neutral-500 mt-3">Coche un deuxième profil pour activer la comparaison.</p>
    </div>
  )
}

function ComparisonPanel({ a, b }: { a: PlayerProfile; b: PlayerProfile }) {
  const spA = useMemo(() => scoutingProfile(a.name, a.games), [a])
  const spB = useMemo(() => scoutingProfile(b.name, b.games), [b])
  const cmp = useMemo(() => compareProfiles(spA, spB), [spA, spB])

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{a.name} <span className="text-neutral-500">vs</span> {b.name}</h3>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
          <h4 className="font-semibold mb-2 text-sm">{a.name}</h4>
          <SimpleScout p={spA} />
        </div>
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
          <h4 className="font-semibold mb-2 text-sm">{b.name}</h4>
          <SimpleScout p={spB} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <OpportunityCard
          title={`Si ${a.name} joue Blancs, jouer…`}
          subtitle={`Ouvertures où ${b.name} est faible en Noirs`}
          opps={cmp.meVsOpp.asWhite}
          metricColor="white"
        />
        <OpportunityCard
          title={`Si ${a.name} joue Noirs, exploiter…`}
          subtitle={`Ouvertures où ${b.name} est faible en Blancs`}
          opps={cmp.meVsOpp.asBlack}
          metricColor="black"
        />
        <OpportunityCard
          title={`Si ${b.name} joue Blancs, jouer…`}
          subtitle={`Ouvertures où ${a.name} est faible en Noirs`}
          opps={cmp.oppVsMe.asWhite}
          metricColor="white"
        />
        <OpportunityCard
          title={`Si ${b.name} joue Noirs, exploiter…`}
          subtitle={`Ouvertures où ${a.name} est faible en Blancs`}
          opps={cmp.oppVsMe.asBlack}
          metricColor="black"
        />
      </div>

      {cmp.notes.length > 0 && (
        <div className="bg-orange-900/20 border border-orange-700/40 rounded p-3 text-xs text-orange-200">
          {cmp.notes.map((n, i) => <div key={i}>• {n}</div>)}
        </div>
      )}
    </div>
  )
}

function OpportunityCard({
  title, subtitle, opps, metricColor,
}: {
  title: string; subtitle: string; opps: OpeningOpportunity[]; metricColor: 'white' | 'black'
}) {
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md p-4">
      <h4 className="font-semibold text-sm">{title}</h4>
      <p className="text-xs text-neutral-500 mb-2">{subtitle}</p>
      {opps.length === 0 ? (
        <p className="text-sm text-neutral-500">Pas d'opportunité claire avec les données actuelles.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {opps.map((o, i) => {
            const stat = metricColor === 'white' ? o.asBlack : o.asWhite
            const pct = stat ? (stat.winRate * 100).toFixed(0) : '?'
            return (
              <li key={i} className="flex items-baseline gap-2">
                <span className="text-neutral-500 w-4 text-right">{i + 1}.</span>
                <span className="flex-1 truncate">{o.opening}</span>
                <span className="text-xs text-red-300 font-mono">{pct}%</span>
                <span className="text-[10px] text-neutral-500">/{stat?.played ?? 0}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SimpleScout({ p }: { p: ScoutingProfile }) {
  return (
    <div className="text-xs text-neutral-400 space-y-1">
      <div>
        <span className="text-neutral-300">{p.games}</span> parties · score global{' '}
        <span className="text-neutral-300">
          {((p.whiteSide.wins + p.blackSide.wins + 0.5 * (p.whiteSide.draws + p.blackSide.draws)) / Math.max(1, p.games) * 100).toFixed(0)}%
        </span>
      </div>
      <div>Blancs : <span className="text-neutral-300">{(p.whiteSide.winRate * 100).toFixed(0)}%</span> · Noirs : <span className="text-neutral-300">{(p.blackSide.winRate * 100).toFixed(0)}%</span></div>
      <details>
        <summary className="cursor-pointer">Top ouvertures</summary>
        <div className="mt-1 space-y-0.5">
          <strong>Avec Blancs :</strong>
          {topOpenings(p.whiteSide.openings, 4).map(o => (
            <div key={o.name} className="ml-3">{o.name} <span className="text-neutral-500">{o.played}× · {(o.winRate * 100).toFixed(0)}%</span></div>
          ))}
          <strong>Avec Noirs :</strong>
          {topOpenings(p.blackSide.openings, 4).map(o => (
            <div key={o.name} className="ml-3">{o.name} <span className="text-neutral-500">{o.played}× · {(o.winRate * 100).toFixed(0)}%</span></div>
          ))}
        </div>
      </details>
    </div>
  )
}

function topOpenings(list: OpeningStat[], n: number): OpeningStat[] {
  return [...list].sort((a, b) => b.played - a.played).slice(0, n)
}
