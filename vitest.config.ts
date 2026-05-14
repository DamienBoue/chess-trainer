import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Coverage focuses on pure logic. Components (need React Testing
      // Library) and network/worker layers (chesscom, stockfish, IDB
      // stores) are tested differently.
      include: [
        'src/analysis/**/*.ts',
        'src/skill/**/*.ts',
        'src/storage/**/*.ts',
        'src/api/share.ts',
        'src/api/lichess.ts',
        'src/coach/config.ts',
        'src/coach/coach.ts',
        'src/utils/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts',
        // Internal test fixtures, not production code.
        '**/__fixtures__*',
        // IDB-backed stores require IndexedDB; covered via integration
        // when we wire fake-indexeddb (out of scope for this pass).
        'src/storage/db.ts',
        'src/storage/games.ts',
        'src/storage/analyses.ts',
        'src/storage/exportImport.ts',
        // Depends on the Stockfish Worker — not unit-testable in node.
        'src/analysis/analyze.ts',
        // Network-only (HTTP wrappers); the dispatcher logic is too thin.
        'src/coach/client.ts',
      ],
      thresholds: {
        lines:     80,
        functions: 80,
        branches:  75,
        statements:80,
      },
    },
  },
})
