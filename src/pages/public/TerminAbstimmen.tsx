import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconCheck, IconHelp, IconX, IconTrophy } from '@tabler/icons-react';
import { PublicShell } from '@/components/PublicShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/blocks/Field';
import { LoadProblem } from '@/components/blocks/LoadProblem';
import { tx } from '@/i18n';
import {
  loadPublicPagesConfig, PageUnavailableError,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import {
  useLiveList, useStepForm, useJourneySubmit, type PlanStep, fieldRef, fieldText, fieldDate, fieldLookup,
  type JourneyRecord, type JourneyPort,
} from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';

const SLUG = 'termin-abstimmen';
// Placeholder while the page config loads — the plan never runs without a real port.
const NO_PORT = { door: 'public' } as unknown as JourneyPort;
type Wert = 'ja' | 'vielleicht' | 'nein';
const WERTE: Wert[] = ['ja', 'vielleicht', 'nein'];

// A random private edit code (128 bit), new for every submission.
function newToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function WertIcon({ w, size = 16 }: { w: Wert; size?: number }) {
  if (w === 'ja') return <IconCheck size={size} className="shrink-0" />;
  if (w === 'vielleicht') return <IconHelp size={size} className="shrink-0" />;
  return <IconX size={size} className="shrink-0" />;
}

const ACTIVE: Record<Wert, string> = {
  ja: 'bg-emerald-600 text-white border-emerald-600',
  vielleicht: 'bg-amber-500 text-white border-amber-500',
  nein: 'bg-rose-600 text-white border-rose-600',
};
const SOFT: Record<Wert, string> = {
  ja: 'bg-emerald-100 text-emerald-800',
  vielleicht: 'bg-amber-100 text-amber-800',
  nein: 'bg-rose-100 text-rose-800',
};

export default function TerminAbstimmen() {
  const [params] = useSearchParams();
  const linkedId = params.get('umfrage');
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [picks, setPicks] = useState<Record<string, Wert>>({});
  const [message, setMessage] = useState<string | null>(null);
  const tForm = useStepForm('teilnehmer', {
    fields: ['umfrage', 'name', 'bearbeitungstoken'],
    required: { umfrage: false, name: true, bearbeitungstoken: false },
    autoComplete: true,
  });

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setLoading(false);
      })
      .catch(e => {
        if (e instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  const port = useMemo(() => (cfg && page ? createPublicPort(cfg, page) : null), [cfg, page]);
  const enabled = !!port && !!linkedId;
  const umfragenLive = useLiveList(port, 'umfragen', { enabled });
  const termineLive = useLiveList(port, 'termine', { enabled });
  const teilnehmerLive = useLiveList(port, 'teilnehmer', { enabled });
  const antwortenLive = useLiveList(port, 'antworten', { enabled });

  const umfrage = useMemo(
    () => umfragenLive.records.find(r => r.id === linkedId) ?? null,
    [umfragenLive.records, linkedId],
  );
  const termine = useMemo(
    () => termineLive.records
      .filter(r => fieldRef(r, 'umfrage') === linkedId)
      .sort((a, b) => (fieldDate(a, 'start') ?? '').localeCompare(fieldDate(b, 'start') ?? '')),
    [termineLive.records, linkedId],
  );
  const teilnehmer = useMemo(
    () => teilnehmerLive.records
      .filter(r => fieldRef(r, 'umfrage') === linkedId)
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')),
    [teilnehmerLive.records, linkedId],
  );
  const teilnehmerIds = useMemo(() => new Set(teilnehmer.map(r => r.id)), [teilnehmer]);
  const antworten = useMemo(
    () => antwortenLive.records.filter(r => {
      const t = fieldRef(r, 'teilnehmer');
      return !!t && teilnehmerIds.has(t);
    }),
    [antwortenLive.records, teilnehmerIds],
  );

  // answer lookup: teilnehmer → termin → wert
  const grid = useMemo(() => {
    const m = new Map<string, Map<string, Wert>>();
    for (const a of antworten) {
      const t = fieldRef(a, 'teilnehmer');
      const d = fieldRef(a, 'termin');
      const w = fieldLookup(a, 'wert')?.key as Wert | undefined;
      if (!t || !d || !w) continue;
      if (!m.has(t)) m.set(t, new Map());
      m.get(t)!.set(d, w);
    }
    return m;
  }, [antworten]);

  const sums = useMemo(() => {
    const s = new Map<string, { ja: number; vielleicht: number }>();
    for (const d of termine) {
      let ja = 0;
      let vielleicht = 0;
      for (const row of grid.values()) {
        const w = row.get(d.id);
        if (w === 'ja') ja += 1;
        else if (w === 'vielleicht') vielleicht += 1;
      }
      s.set(d.id, { ja, vielleicht });
    }
    return s;
  }, [termine, grid]);

  const bestId = useMemo(() => {
    let best: string | null = null;
    let bj = 0;
    let bv = 0;
    for (const d of termine) {
      const v = sums.get(d.id);
      if (!v || v.ja === 0) continue;
      if (v.ja > bj || (v.ja === bj && v.vielleicht > bv)) {
        best = d.id;
        bj = v.ja;
        bv = v.vielleicht;
      }
    }
    return best;
  }, [termine, sums]);

  const plan = useMemo<PlanStep[]>(() => [
    {
      key: 'teilnehmer',
      entity: 'teilnehmer',
      form: tForm,
      primary: true,
      values: () => ({ umfrage: linkedId ?? '', bearbeitungstoken: newToken() }),
    },
    ...termine.map<PlanStep>(d => ({
      key: `antwort-${d.id}`,
      entity: 'antworten',
      values: { termin: d.id, wert: picks[d.id] ?? '' },
      link: { teilnehmer: 'teilnehmer' },
      needs: ['teilnehmer'],
    })),
  ], [tForm, linkedId, termine, picks]);

  const submit = useJourneySubmit(port ?? NO_PORT, plan, {
    draftKey: `termin-abstimmen-${linkedId ?? 'ohne'}`,
    check: async ctx => {
      // Send-time check: the poll must still be open, the name still free.
      const fresh = await ctx.port.get('umfragen', linkedId ?? '');
      if (!fresh || fieldLookup(fresh, 'status')?.key === 'geschlossen') {
        return tx('Diese Umfrage ist inzwischen geschlossen — deine Antwort wurde nicht gespeichert.');
      }
      const own = ctx.done['teilnehmer']?.id;
      const wanted = String(tForm.get('name') ?? '').trim().toLocaleLowerCase();
      const all = await ctx.port.list('teilnehmer');
      const taken = all.some(r => r.id !== own && fieldRef(r, 'umfrage') === linkedId
        && fieldText(r, 'name').trim().toLocaleLowerCase() === wanted);
      return taken ? tx('Dieser Name ist in der Umfrage schon vergeben. Bitte wähle einen anderen.') : null;
    },
    onSuccess: () => { void Promise.all([teilnehmerLive.reload(), antwortenLive.reload()]); },
  });

  if (loading || !cfg || !page || unavailable) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }

  if (!linkedId) {
    return (
      <PublicShell title={page.title} description={page.description} wide>
        <p className="text-sm text-muted-foreground">
          {tx('Dieser Link ist unvollständig. Öffne bitte den Link oder scanne den QR-Code, den du für die Terminumfrage bekommen hast.')}
        </p>
      </PublicShell>
    );
  }

  const allLoaded = umfragenLive.loaded && termineLive.loaded && teilnehmerLive.loaded && antwortenLive.loaded;
  if (!allLoaded) {
    const failed = umfragenLive.error || termineLive.error || teilnehmerLive.error || antwortenLive.error;
    if (failed) {
      return (
        <PublicShell title={page.title} description={page.description} wide>
          <LoadProblem onRetry={async () => {
            await Promise.all([umfragenLive.reload(), termineLive.reload(), teilnehmerLive.reload(), antwortenLive.reload()]);
          }} />
        </PublicShell>
      );
    }
    return <PublicShell loading />;
  }

  if (!umfrage) {
    return (
      <PublicShell title={page.title} description={page.description} wide>
        <p className="text-sm text-muted-foreground">
          {tx('Dieser Link passt zu keiner Umfrage. Scanne bitte den QR-Code noch einmal.')}
        </p>
      </PublicShell>
    );
  }

  const closed = fieldLookup(umfrage, 'status')?.key === 'geschlossen';
  const finalId = fieldRef(umfrage, 'finaler_termin');
  const finalTermin = finalId ? termine.find(t => t.id === finalId) ?? null : null;
  const beschreibung = fieldText(umfrage, 'beschreibung');
  const ort = fieldText(umfrage, 'ort');

  const dateLabel = (d: JourneyRecord) => {
    const s = fieldText(d, 'start');
    const e = fieldText(d, 'ende');
    return { s, e };
  };

  const send = async () => {
    const name = String(tForm.get('name') ?? '').trim();
    if (!name) { setMessage(tx('Bitte trage deinen Namen ein.')); tForm.validate(['name']); return; }
    if (name.length > 60) { setMessage(tx('Der Name darf höchstens 60 Zeichen lang sein.')); return; }
    if (termine.some(d => !picks[d.id])) { setMessage(tx('Bitte antworte bei jedem Termin mit Ja, Vielleicht oder Nein.')); return; }
    setMessage(null);
    const res = await submit.run();
    if (!res) setMessage(tx('Das Senden hat nicht geklappt. Bitte versuche es noch einmal — bereits gespeicherte Antworten bleiben erhalten.'));
  };

  const colHead = (d: JourneyRecord) => {
    const { s, e } = dateLabel(d);
    return (
      <div className="space-y-0.5 text-left">
        <div className="text-sm font-semibold">{s}</div>
        {e && <div className="text-xs font-normal text-muted-foreground">{tx('bis')} {e}</div>}
      </div>
    );
  };

  return (
    <PublicShell title={fieldText(umfrage, 'titel') || page.title} description={beschreibung || page.description} wide>
      <div className="space-y-5">
        {ort && <p className="text-sm text-muted-foreground">{tx('Ort')}: {ort}</p>}

        {closed && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="flex items-center gap-2 font-semibold">
              <IconTrophy size={18} className="shrink-0" />
              {tx('Diese Umfrage ist geschlossen.')}
            </div>
            <p className="mt-1">
              {finalTermin
                ? tx`Der finale Termin ist: ${dateLabel(finalTermin).s}${dateLabel(finalTermin).e ? ` – ${dateLabel(finalTermin).e}` : ''}`
                : tx('Ein finaler Termin wurde noch nicht festgelegt.')}
            </p>
          </div>
        )}

        {termine.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tx('Für diese Umfrage gibt es noch keine Termine.')}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-medium">{tx('Name')}</th>
                  {termine.map(d => {
                    const isBest = closed ? d.id === finalId : d.id === bestId;
                    return (
                      <th key={d.id} className={`px-3 py-2 align-bottom ${isBest ? 'bg-emerald-100' : ''}`}>
                        {colHead(d)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {teilnehmer.map(t => (
                  <tr key={t.id} className="border-t">
                    <td className="sticky left-0 z-10 bg-background px-3 py-2 font-medium">{fieldText(t, 'name')}</td>
                    {termine.map(d => {
                      const w = grid.get(t.id)?.get(d.id);
                      const isBest = closed ? d.id === finalId : d.id === bestId;
                      return (
                        <td key={d.id} className={`px-3 py-2 text-center ${isBest ? 'bg-emerald-50' : ''}`}>
                          {w ? (
                            <span
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${SOFT[w]}`}
                              title={w}
                              aria-label={w === 'ja' ? tx('Ja') : w === 'vielleicht' ? tx('Vielleicht') : tx('Nein')}
                            >
                              <WertIcon w={w} size={14} />
                            </span>
                          ) : <span className="text-muted-foreground">–</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!closed && (
                  <tr className="border-t bg-muted/20">
                    <td className="sticky left-0 z-10 bg-muted/60 px-3 py-2">
                      <Field form={tForm} name="name" label={tx('Dein Name')} hideLabel>
                        <Input
                          {...tForm.field('name')}
                          placeholder={tx('Dein Name')}
                          maxLength={60}
                          aria-label={tx('Dein Name')}
                          className="min-w-36"
                        />
                      </Field>
                    </td>
                    {termine.map(d => (
                      <td key={d.id} className="px-2 py-2 text-center">
                        <div className="inline-flex gap-1" role="group">
                          {WERTE.map(w => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => { setPicks(p => ({ ...p, [d.id]: w })); }}
                              aria-pressed={picks[d.id] === w}
                              aria-label={w === 'ja' ? tx('Ja') : w === 'vielleicht' ? tx('Vielleicht') : tx('Nein')}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                                picks[d.id] === w ? ACTIVE[w] : 'bg-background text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              <WertIcon w={w} />
                            </button>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <th className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-medium">{tx('Ja')}</th>
                  {termine.map(d => {
                    const isBest = closed ? d.id === finalId : d.id === bestId;
                    return (
                      <td key={d.id} className={`px-3 py-2 text-center font-semibold ${isBest ? 'bg-emerald-100 text-emerald-800' : ''}`}>
                        {sums.get(d.id)?.ja ?? 0}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <th className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-medium">{tx('Vielleicht')}</th>
                  {termine.map(d => {
                    const isBest = closed ? d.id === finalId : d.id === bestId;
                    return (
                      <td key={d.id} className={`px-3 py-2 text-center ${isBest ? 'bg-emerald-100 text-emerald-800' : ''}`}>
                        {sums.get(d.id)?.vielleicht ?? 0}
                      </td>
                    );
                  })}
                </tr>
                {!closed && bestId && (
                  <tr>
                    <th className="sticky left-0 z-10 bg-background px-3 py-1" />
                    {termine.map(d => (
                      <td key={d.id} className="px-3 pb-2 text-center">
                        {d.id === bestId && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
                            <IconTrophy size={12} className="shrink-0" />{tx('Bester Termin')}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        )}

        {!closed && termine.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {tx('Trage deinen Namen in der letzten Zeile ein und antworte bei jedem Termin mit Ja (Haken), Vielleicht (Fragezeichen) oder Nein (Kreuz).')}
            </p>
            {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
            {submit.done && !message && (
              <p role="status" className="text-sm text-emerald-700">{tx('Danke! Deine Antworten sind gespeichert.')}</p>
            )}
            <Button type="button" onClick={send} disabled={submit.submitting} className="w-full sm:w-auto">
              {submit.submitting ? tx('Wird gesendet …') : tx('Antworten absenden')}
            </Button>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
