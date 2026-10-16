// Central registry of every localStorage key the app uses.
//
// Why centralise: makes "what's in my localStorage?" answerable in one
// place, makes migrations (rename, bump version, deprecate) a single
// edit, and lets the compiler catch a typo'd or duplicate key.
//
// To bump a key version: update the constant here AND write a one-shot
// migrator (see daily.ts / persist.ts for the lazy-migration pattern).

export const KEYS = {
  // User identity / API tokens
  username:        'chess.username',
  lichessToken:    'chess.lichess.token',

  // UI preferences
  boardTheme:      'chess.board.theme',
  engineDepth:     'chess.engine.depth',
  sounds:          'chess.sounds',
  filterTimeClass: 'chess.filter.tc',
  filterColor:     'chess.filter.color',
  statsFilter:     'chess.stats.filter.v1',   // period + time control of Statistiques
  debugStockfish:  'sf.debug',
  strategyOverlays: 'chess.strategy.overlays.v1',
  strategyTrainer: 'chess.strategy.trainer.v1',

  // UI tour
  onboardingDone:  'chess.onboarding.completed',

  // Domain state
  daily:           'chess.daily.v1',
  dailyExercises:  'chess.daily-exercises.v1',   // today's exercise session
  plan:            'chess.plan.v1',
  notes:           'chess.notes.v1',
  exerciseProgress: 'chess.progress.v1',      // SRS data per exercise id
  repertoireProgress: 'chess.repertoire.progress',
  elo:             'chess.elo.v1',
  roadmapProgress: 'chess.roadmap.v1',
  llmConfig:       'chess.llm.v1',
} as const

export type KeyName = keyof typeof KEYS
