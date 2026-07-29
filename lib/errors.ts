/** Erreur de règle métier générique, partagée par tous les modules
 * lib/*.ts — extraite dans son propre fichier pour éviter les imports
 * circulaires (plusieurs modules, dont lib/rectoratContacts.ts, doivent
 * pouvoir la lever sans dépendre de lib/tickets.ts). Toujours réexportée
 * depuis lib/tickets.ts pour ne pas casser les imports existants. */
export class RegleMetierError extends Error {}
