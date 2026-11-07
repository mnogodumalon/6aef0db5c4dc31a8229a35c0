// Auto-generated. Per-entity form-enhancements config for "Termine".
// Written by the backend form polish (app/services/form_polish.py) from the
// generator's manifest; scripts/parse-formulas.mjs expands the formula strings.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ["umfrage", {"row": ["start", "ende"]}],
  defaults: {
    'start': { kind: 'today', withTime: true },
  },
  computed: {
    '_termin_dauer_stunden': { kind: 'dateDiff', from: 'start', to: 'ende', unit: 'hours' },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
