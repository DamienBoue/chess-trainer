// Opening the concept modal from anywhere (StudyHint, motif chip, plan
// item) without importing the component: a window event, carrying the
// concept id or alias, that ConceptModal listens to.

export const OPEN_CONCEPT = 'concept:open'

export function openConcept(idOrAlias: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_CONCEPT, { detail: { id: idOrAlias } }))
}
