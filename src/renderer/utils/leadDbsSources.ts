/**
 * Return a copy of a Lead-DBS source without electrode contact fields.
 *
 * Export starts from an imported/template S structure so settings such as
 * frequency and pulse width survive. Contact fields must be rebuilt for the
 * currently selected electrode, otherwise kN entries from a previous model can
 * remain active beyond the new electrode's contact count.
 */
export const LEAD_DBS_SOURCE_INDICES = [1, 2, 3, 4] as const;

export default function withoutStimulationContacts<
  T extends Record<string, any>,
>(source: T | null | undefined): T {
  return Object.fromEntries(
    Object.entries(source || {}).filter(([key]) => !/^k\d+$/.test(key)),
  ) as T;
}
