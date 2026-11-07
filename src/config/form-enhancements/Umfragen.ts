// Auto-generated. Per-entity form-enhancements config for "Umfragen".
// Written by the backend form polish (app/services/form_polish.py) from the
// generator's manifest; scripts/parse-formulas.mjs expands the formula strings.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ["titel", {"row": ["status", "zugriffstoken"], "cols": "1fr 1fr"}, "ort", "finaler_termin", "loeschfrist_tage", "beschreibung"],
  defaults: {
    'status': { kind: 'lookup', key: 'offen', label: 'Offen' },
    'loeschfrist_tage': { kind: 'literal', value: 90 },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
