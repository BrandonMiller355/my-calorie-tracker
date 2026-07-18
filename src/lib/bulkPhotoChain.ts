/**
 * Builds the context note that chains sequential bulk-photo identifications
 * together. The bulk flow photographs one dish as it is assembled (beans,
 * then cheese sauce, then salsa…), so each identify request after the first
 * must tell the model what the dish already contains and that only the new
 * addition is to be identified. The note rides in the identify-food request's
 * existing free-text `note` field; the Edge Function is unchanged.
 */

/** What one earlier photo in the sequence turned out to contain. */
export type ChainItem =
  | { kind: 'identified'; name: string; grams?: number }
  | { kind: 'unidentified' };

function describeItem(item: ChainItem): string {
  if (item.kind === 'unidentified') return 'an unidentified addition';
  return item.grams !== undefined
    ? `${item.name} (${item.grams} g)`
    : item.name;
}

/**
 * The chaining note for the next photo, given what the earlier photos in the
 * sequence contained. The first photo has no history and gets no note
 * (undefined), matching a plain single-photo identification.
 */
export function buildChainNote(history: ChainItem[]): string | undefined {
  if (history.length === 0) return undefined;
  return (
    'This photo is part of a sequence logging one meal, photographed as it was assembled. ' +
    `Earlier photos of this dish already contained: ${history.map(describeItem).join(', ')}. ` +
    'If this photo shows the same dish with something newly added, identify ONLY the new addition. ' +
    'The scale is tared before each addition, so a visible scale reading is the new item’s weight alone.'
  );
}
