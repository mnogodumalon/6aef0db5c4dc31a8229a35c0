import type { EnrichedAntworten, EnrichedTeilnehmer, EnrichedTermine, EnrichedUmfragen } from '@/types/enriched';
import type { Antworten, Teilnehmer, Termine, Umfragen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface UmfragenMaps {
  termineMap: Map<string, Termine>;
}

export function enrichUmfragen(
  umfragen: Umfragen[],
  maps: UmfragenMaps
): EnrichedUmfragen[] {
  return umfragen.map(r => ({
    ...r,
    finaler_terminName: resolveDisplay(r.fields.finaler_termin, maps.termineMap, 'umfrage'),
  }));
}

interface TermineMaps {
  umfragenMap: Map<string, Umfragen>;
}

export function enrichTermine(
  termine: Termine[],
  maps: TermineMaps
): EnrichedTermine[] {
  return termine.map(r => ({
    ...r,
    umfrageName: resolveDisplay(r.fields.umfrage, maps.umfragenMap, 'titel'),
  }));
}

interface TeilnehmerMaps {
  umfragenMap: Map<string, Umfragen>;
}

export function enrichTeilnehmer(
  teilnehmer: Teilnehmer[],
  maps: TeilnehmerMaps
): EnrichedTeilnehmer[] {
  return teilnehmer.map(r => ({
    ...r,
    umfrageName: resolveDisplay(r.fields.umfrage, maps.umfragenMap, 'titel'),
  }));
}

interface AntwortenMaps {
  teilnehmerMap: Map<string, Teilnehmer>;
  termineMap: Map<string, Termine>;
}

export function enrichAntworten(
  antworten: Antworten[],
  maps: AntwortenMaps
): EnrichedAntworten[] {
  return antworten.map(r => ({
    ...r,
    teilnehmerName: resolveDisplay(r.fields.teilnehmer, maps.teilnehmerMap, 'name'),
    terminName: resolveDisplay(r.fields.termin, maps.termineMap, 'umfrage'),
  }));
}
