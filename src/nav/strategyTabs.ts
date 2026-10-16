// The three strategy pages (profile in Progrès, trainer in Entraînement,
// atlas in Théorie). Its own module so that the navigation model doesn't
// pull the StrategyView component (the phone app shares navModel).
export type StrategyTab = 'profile' | 'trainer' | 'atlas'
