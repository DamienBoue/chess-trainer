// Elo-bracketed curriculum. Each bracket has a set of "modules" (skills
// to master). Modules surface as recommendations in the dashboard and
// drive plan-item priorities.
//
// Based loosely on the de-facto curriculum used by IM Andras Toth / NM Heisman /
// chess.com lessons by rating: tactics + don't-hang-pieces at the bottom,
// pawn structures + prophylaxis at the top.

import type { SkillBracket } from './elo'
import { loadJson, saveJson } from '../storage/json'
import { KEYS } from '../storage/keys'

export type ModuleArea = 'tactics' | 'endgame' | 'opening' | 'middlegame' | 'mindset' | 'calculation'

export interface RoadmapModule {
  id: string
  area: ModuleArea
  title: string
  why: string
  /** Which existing view/tool best addresses this. */
  surface?: 'exercises' | 'blunder' | 'calc' | 'repertoire' | 'library' | 'play' | 'stats' | 'book'
  /** Concrete study hint for topics where the app has no dedicated
   *  content yet (no in-app deep-link). Shown instead of an "Aller →"
   *  button so the user gets actionable guidance, not a dead link. */
  studyHint?: string
  /** Id of a concept in the concepts catalog — adds a "📖 Lire" chip on
   *  the module so the user can dig deeper without leaving the roadmap. */
  conceptId?: string
}

export const MODULES_BY_BRACKET: Record<SkillBracket['id'], RoadmapModule[]> = {
  beginner: [
    { id: 'beg-piece-safety',   area: 'tactics',    title: 'Ne pas laisser de pièce en prise', why: 'À ce niveau la majorité des pertes sont des pièces hangées en un coup.', surface: 'blunder' },
    { id: 'beg-basic-mates',    area: 'endgame',    title: 'Mater Roi+Dame vs Roi, Roi+Tour vs Roi', why: 'Sans cela tu nullaras des parties gagnantes.', surface: 'play', conceptId: 'kqk-mate' },
    { id: 'beg-1move-tactics',  area: 'tactics',    title: 'Tactiques à un coup (fourchette, pin)', why: 'Le motif le plus rentable à ce niveau.', surface: 'exercises', conceptId: 'fork' },
    { id: 'beg-opening-rules',  area: 'opening',    title: 'Principes : centre, développement, roi en sécurité', why: 'Une ouverture solide évite les drames du milieu de jeu.', surface: 'repertoire' },
  ],
  casual: [
    { id: 'cas-2move-tactics',  area: 'tactics',    title: 'Tactiques à deux coups (double menace, déflexion)', why: 'Le jump de rating principal vient d\'ici.', surface: 'exercises', conceptId: 'deflection' },
    { id: 'cas-back-rank',      area: 'tactics',    title: 'Mat de couloir et défenses', why: 'Le pattern le plus puni à 1000-1400.', surface: 'exercises', conceptId: 'back-rank-mate' },
    { id: 'cas-pawn-endgame',   area: 'endgame',    title: 'Finales de pion : opposition, règle du carré', why: 'Les finales à pion gagnent ou perdent la moitié des parties à ce niveau.', surface: 'library', conceptId: 'opposition' },
    { id: 'cas-opening-choice', area: 'opening',    title: 'Choisir un répertoire cohérent (2-3 ouvertures)', why: 'Mieux vaut maîtriser 3 ouvertures que jouer 20 fois superficiellement.', surface: 'repertoire' },
    { id: 'cas-checks-captures',area: 'mindset',    title: 'Réflexe "checks, captures, menaces"', why: 'Avant chaque coup, lister ces 3 catégories supprime 80% des gaffes.', surface: 'blunder', conceptId: 'checks-captures-threats' },
  ],
  club: [
    { id: 'club-calculation-3', area: 'calculation',title: 'Calcul à 3-4 coups sans bouger les pièces', why: 'Le déclic visuel pour passer 1500.', surface: 'calc' },
    { id: 'club-prophylaxis',   area: 'middlegame', title: 'Prophylaxie : "que veut faire l\'adversaire ?"', why: 'Stoppe les contre-jeux avant qu\'ils ne démarrent.', surface: 'stats', conceptId: 'prophylaxis' },
    { id: 'club-rook-endgame',  area: 'endgame',    title: 'Finales de tour : Philidor, Lucena, position active', why: '50% des finales de jeu compétitif sont des finales de tour.', surface: 'library', conceptId: 'rook-endgame' },
    { id: 'club-pawn-structure',area: 'middlegame', title: 'Comprendre les structures de pions courantes', why: 'Le plan en milieu de jeu découle de la structure.', studyHint: 'Lire « Pawn Structure Chess » (Soltis) ou les Lichess studies sur les structures Caro / Karlsbad / Stonewall. Coche quand tu peux nommer la structure et un plan typique pour chaque camp.', conceptId: 'pawn-structure' },
    { id: 'club-isolated-pawn', area: 'middlegame', title: 'Pion isolé : forces et faiblesses', why: 'Une des structures les plus fréquentes — savoir l\'attaquer et la défendre.', studyHint: 'Joue 3-5 parties en attaquant un IQP (sicilienne anti-IQP, QGD échange) et 3-5 en défendant. Identifie : case forte d4/d5, manœuvre du cavalier sur le bord faible, jeu pour l\'attaque kingside. Coche quand tu sais expliquer les 3 plans typiques.', conceptId: 'isolated-queen-pawn' },
  ],
  tournament: [
    { id: 'tour-opening-prep',  area: 'opening',    title: 'Préparer 5-6 coups d\'écart contre tes adversaires', why: 'Le bénéfice marginal d\'une préparation ciblée explose à partir d\'ici.', surface: 'repertoire' },
    { id: 'tour-deep-calc',     area: 'calculation',title: 'Calcul profond avec arbres de variantes', why: 'Tactiques 5+ coups ; sacrifices à long terme.', surface: 'calc' },
    { id: 'tour-strategic-imb', area: 'middlegame', title: 'Déséquilibres stratégiques (Silman)', why: 'Cadre formel pour choisir un plan en milieu de jeu.', studyHint: 'Lire « How to Reassess Your Chess » (Silman). Sur 5 parties analysées, applique sa grille : pièce mineure, pions, espace, structures, roi, initiative — et identifie le déséquilibre clé avant de choisir un plan.', conceptId: 'silmans-imbalances' },
    { id: 'tour-minor-endgame', area: 'endgame',    title: 'Finales de pièces mineures (fous, cavaliers)', why: 'Plus subtiles que les finales de tour, souvent décisives.', surface: 'library' },
  ],
  expert: [
    { id: 'exp-master-games',   area: 'middlegame', title: 'Étudier des parties modèles (Capablanca, Karpov)', why: 'L\'absorbtion de schémas positionnels passe par l\'imitation consciente.', studyHint: 'Importe les PGN de Capablanca (collection chessgames) via la vue Joueurs PGN, puis annote 10 parties commentées. Note 1 schéma positionnel par partie (mineure forte, paire de fous, prophylaxie).' },
    { id: 'exp-complex-endgame',area: 'endgame',    title: 'Finales complexes (déséquilibres matériels)', why: 'À 2000+, la conversion technique fait la différence.', surface: 'library' },
    { id: 'exp-prep-depth',     area: 'opening',    title: 'Préparation niveau base de données', why: 'Connaître les coups jusqu\'au coup 15 dans tes lignes.', surface: 'repertoire' },
  ],
  master: [
    { id: 'mas-novelty',        area: 'opening',    title: 'Trouver des nouveautés théoriques (TN)', why: 'L\'avantage théorique se gagne sur des détails inconnus.', surface: 'repertoire' },
    { id: 'mas-prophylaxis-pro',area: 'middlegame', title: 'Prophylaxie avancée à la Karpov', why: 'Anticiper plusieurs idées adverses sur un même coup.', surface: 'stats', conceptId: 'prophylaxis' },
    { id: 'mas-tournament',     area: 'mindset',    title: 'Gestion psychologique de tournoi', why: 'À ce niveau le facteur humain pèse autant que la théorie.', studyHint: 'Lire « The Inner Game of Chess » (Soltis) ou « Pump Up Your Rating » (Smith). Tiens un journal d\'erreurs en tournoi (fatigue, temps, blunders post-pause) sur 5 événements. Coche quand tu peux identifier 3 patterns spécifiques à toi.' },
  ],
}

export function modulesForBracket(bracket: SkillBracket): RoadmapModule[] {
  return MODULES_BY_BRACKET[bracket.id] ?? []
}

export interface ModuleProgress {
  /** Module ids the user has marked as "done". */
  completed: string[]
}

const PROGRESS_KEY = KEYS.roadmapProgress

export function loadModuleProgress(): ModuleProgress {
  return loadJson<ModuleProgress>(PROGRESS_KEY, { completed: [] })
}

export function saveModuleProgress(p: ModuleProgress): void {
  saveJson(PROGRESS_KEY, p)
}

export function toggleModuleDone(id: string): ModuleProgress {
  const cur = loadModuleProgress()
  const next = cur.completed.includes(id)
    ? { completed: cur.completed.filter(x => x !== id) }
    : { completed: [...cur.completed, id] }
  saveModuleProgress(next)
  return next
}
