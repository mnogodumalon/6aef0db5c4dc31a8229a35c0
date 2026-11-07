import type { Antworten, Teilnehmer, Termine, Umfragen } from './app';

export type EnrichedUmfragen = Umfragen & {
  finaler_terminName: string;
};

export type EnrichedTermine = Termine & {
  umfrageName: string;
};

export type EnrichedTeilnehmer = Teilnehmer & {
  umfrageName: string;
};

export type EnrichedAntworten = Antworten & {
  teilnehmerName: string;
  terminName: string;
};
