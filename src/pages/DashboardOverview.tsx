import { useMemo, useState } from 'react';
import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import { IconAlertTriangle, IconCalendarEvent, IconCheck, IconClockHour4, IconCopy, IconLock, IconPlus, IconQrcode, IconTrash, IconUsers } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor, countOf } from '@/config/plan';
import { lookupKey, formatDate } from '@/lib/formatters';
import { appLabel, dateFnsLocale, tx } from '@/i18n';
import { extractRecordId } from '@/services/livingAppsService';
import { gruss, namen, undoToast, useClock } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { PublicPageQr, usePublicPageLink } from '@/components/widgets/PublicPageQr';
import { qrSvgString } from '@/components/widgets/QrCode';
import type { Umfragen } from '@/types/app';

type Filter = 'all' | 'offen' | 'geschlossen' | 'bald';

const WARN_DAYS = 30;

function parse(s?: string): Date | null {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
}

function download(name: string, href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

function SharePanel({ recordId, title }: { recordId: string; title: string }) {
  const { link } = usePublicPageLink('umfragen', recordId);
  const base = title.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40) || 'umfrage';
  const svg = () => {
    if (!link) return;
    const blob = new Blob([qrSvgString(link)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    download(`${base}.svg`, url);
    URL.revokeObjectURL(url);
  };
  const png = () => {
    if (!link) return;
    const url = URL.createObjectURL(new Blob([qrSvgString(link, { pixelSize: 1024 })], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 1024;
      c.getContext('2d')?.drawImage(img, 0, 0, 1024, 1024);
      download(`${base}.png`, c.toDataURL('image/png'));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };
  return (
    <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl bg-muted/40 p-4">
      <PublicPageQr entity="umfragen" recordId={recordId} size={160} title={tx('QR-Code zur Umfrage')} />
      {link && (
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(link); undoToast(tx('Link kopiert')); }}>
            <IconCopy size={16} className="shrink-0" /> {tx('Link kopieren')}
          </Button>
          <Button size="sm" variant="outline" onClick={png}>{tx('QR als PNG')}</Button>
          <Button size="sm" variant="outline" onClick={svg}>{tx('QR als SVG')}</Button>
        </div>
      )}
    </div>
  );
}

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { umfragen, fetchAll } = data;
  const clock = useClock();
  const [filter, setFilter] = useState<Filter>('all');
  const [shareId, setShareId] = useState<string | null>(null);

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type !== 'umfragen') return undefined;
      if (lookupKey(top.record.fields.status) === 'geschlossen') return undefined;
      const go = flowActionFor('umfragen', 'status', top.record.record_id, 'geschlossen');
      return go ? { label: tx('Umfrage schließen'), onClick: go } : undefined;
    },
  });
  const enrichedTermine = crud.enriched.termine;
  const enrichedTeilnehmer = crud.enriched.teilnehmer;
  const enrichedAntworten = crud.enriched.antworten;

  const todayKey = format(clock, 'yyyy-MM-dd');
  const nowKey = format(clock, "yyyy-MM-dd'T'HH:mm");

  const stats = useMemo(() => {
    return umfragen.map(u => {
      const termine = enrichedTermine.filter(t => extractRecordId(t.fields.umfrage) === u.record_id);
      const teil = enrichedTeilnehmer.filter(t => extractRecordId(t.fields.umfrage) === u.record_id);
      const terminIds = new Set(termine.map(t => t.record_id));
      const answers = enrichedAntworten.filter(a => terminIds.has(extractRecordId(a.fields.termin) ?? ''));
      let best: { id: string; ja: number; vielleicht: number } | null = null;
      for (const t of termine) {
        const mine = answers.filter(a => extractRecordId(a.fields.termin) === t.record_id);
        const ja = mine.filter(a => lookupKey(a.fields.wert) === 'ja').length;
        const vielleicht = mine.filter(a => lookupKey(a.fields.wert) === 'vielleicht').length;
        if (!best || ja > best.ja || (ja === best.ja && vielleicht > best.vielleicht)) best = { id: t.record_id, ja, vielleicht };
      }
      const ends = termine.map(t => t.fields.ende ?? t.fields.start).filter((x): x is string => !!x).sort();
      const last = parse(ends[ends.length - 1]);
      const deleteOn = last ? addDays(last, u.fields.loeschfrist_tage ?? 90) : null;
      const daysLeft = deleteOn ? differenceInCalendarDays(deleteOn, clock) : null;
      const bestT = best && best.ja + best.vielleicht > 0 ? termine.find(t => t.record_id === best!.id) : undefined;
      const finalT = u.fields.finaler_termin ? enrichedTermine.find(t => t.record_id === extractRecordId(u.fields.finaler_termin)) : undefined;
      const open = lookupKey(u.fields.status) !== 'geschlossen';
      const pastLast = !!last && format(last, "yyyy-MM-dd'T'HH:mm") < nowKey;
      return { u, open, termine, teilCount: teil.length, best, bestT, finalT, daysLeft, deleteOn, pastLast };
    });
  }, [umfragen, enrichedTermine, enrichedTeilnehmer, enrichedAntworten, clock, nowKey]);

  const offene = stats.filter(s => s.open);
  const geschlossene = stats.filter(s => !s.open);
  const bald = stats.filter(s => s.daysLeft !== null && s.daysLeft <= WARN_DAYS);
  const abgelaufen = offene.filter(s => s.pastLast);

  const closeAction = (u: Umfragen) => {
    const go = flowActionFor('umfragen', 'status', u.record_id, 'geschlossen');
    return go ?? (() => crud.umfragen.openDetail(u));
  };

  const byDate = (a: { u: Umfragen }, b: { u: Umfragen }) => (b.u.createdat ?? '').localeCompare(a.u.createdat ?? '');
  const showOpen = filter === 'all' || filter === 'offen' || filter === 'bald';
  const showClosed = filter === 'all' || filter === 'geschlossen' || filter === 'bald';
  const pick = (list: typeof stats) => (filter === 'bald' ? list.filter(s => bald.includes(s)) : list).slice().sort(byDate);

  const nextTermine = enrichedTermine
    .filter(t => (t.fields.start ?? '') >= nowKey)
    .sort((a, b) => (a.fields.start ?? '').localeCompare(b.fields.start ?? ''));

  const fmtRange = (s?: string, e?: string) => {
    const a = parse(s);
    if (!a) return '—';
    const b = parse(e);
    const loc = { locale: dateFnsLocale() };
    if (!b) return format(a, 'dd.MM.yyyy HH:mm', loc);
    return format(a, 'yyyy-MM-dd', loc) === format(b, 'yyyy-MM-dd', loc)
      ? `${format(a, 'dd.MM.yyyy HH:mm', loc)}–${format(b, 'HH:mm', loc)}`
      : `${format(a, 'dd.MM. HH:mm', loc)} – ${format(b, 'dd.MM.yyyy HH:mm', loc)}`;
  };

  const renderCard = (s: (typeof stats)[number]) => {
    const { u } = s;
    const soon = s.daysLeft !== null && s.daysLeft <= WARN_DAYS;
    return (
      <li key={u.record_id} className="rounded-2xl border border-border bg-background p-4 overflow-hidden">
        <div className="flex flex-wrap items-start gap-3">
          <button type="button" onClick={() => crud.umfragen.openDetail(u)} className="min-w-0 flex-1 text-left">
            <span className="block truncate text-base font-semibold">{u.fields.titel ?? '—'}</span>
            {u.fields.ort ? <span className="block truncate text-xs text-muted-foreground">{u.fields.ort}</span> : null}
          </button>
          <div className="flex shrink-0 items-center gap-2">
            {s.open && crud.umfragen.canWrite && (
              <Button size="sm" variant="outline" onClick={closeAction(u)}>
                <IconLock size={16} className="shrink-0" /> {tx('Schließen')}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setShareId(id => (id === u.record_id ? null : u.record_id))} aria-expanded={shareId === u.record_id}>
              <IconQrcode size={16} className="shrink-0" /> {tx('Link & QR')}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5"><IconUsers size={16} className="shrink-0 text-muted-foreground" />{countOf('teilnehmer', s.teilCount, appLabel('teilnehmer'))}</span>
          <span className="inline-flex items-center gap-1.5"><IconCalendarEvent size={16} className="shrink-0 text-muted-foreground" />{countOf('termine', s.termine.length, appLabel('termine'))}</span>
          {soon && s.deleteOn && (
            <span className="inline-flex items-center gap-1.5 text-amber-700"><IconClockHour4 size={16} className="shrink-0" />{tx`Löschung am ${format(s.deleteOn, 'dd.MM.yyyy')}`}</span>
          )}
        </div>
        {s.open ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {s.bestT && s.best
              ? tx`Bester Termin: ${fmtRange(s.bestT.fields.start, s.bestT.fields.ende)} — ${s.best.ja} Ja, ${s.best.vielleicht} Vielleicht`
              : tx('Noch keine Antworten')}
          </p>
        ) : (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium">
            <IconCheck size={16} className="shrink-0 text-emerald-600" />
            {s.finalT ? tx`Finaler Termin: ${fmtRange(s.finalT.fields.start, s.finalT.fields.ende)}` : tx('Kein finaler Termin festgelegt')}
          </p>
        )}
        {shareId === u.record_id && <SharePanel recordId={u.record_id} title={u.fields.titel ?? ''} />}
      </li>
    );
  };

  const section = (title: string, icon: React.ReactNode, list: typeof stats, emptyText: string) => (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}{title}<span className="rounded-full bg-muted px-2 py-0.5 text-[11px] normal-case tracking-normal">{list.length}</span>
      </h3>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">{emptyText}</p> : <ul className="space-y-3">{list.map(renderCard)}</ul>}
    </div>
  );

  const firstOpen = offene.slice().sort(byDate)[0];
  const context = umfragen.length === 0
    ? tx('Lege deine erste Umfrage an und teile den Link.')
    : offene.length > 0
      ? tx`Offen: ${namen(offene.map(s => s.u.fields.titel ?? ''), 3)}.`
      : tx`Alle Umfragen sind geschlossen — zuletzt ${firstOpen?.u.fields.titel ?? geschlossene[0]?.u.fields.titel ?? ''}.`;

  const hero = abgelaufen.length > 0 && (
    <HeroBanner
      icon={<IconAlertTriangle size={18} />}
      action={{ label: tx('Jetzt schließen'), onClick: closeAction(abgelaufen[0].u) }}
    >
      <b>{namen(abgelaufen.map(s => s.u.fields.titel ?? ''), 3)}</b> {tx('ist noch offen, obwohl alle Termine vorbei sind.')}
    </HeroBanner>
  );

  const primary = (
    <section className="rounded-[27px] bg-card p-5 shadow-lg overflow-hidden space-y-6">
      {showOpen && section(tx('Offene Umfragen'), <IconCalendarEvent size={16} />, pick(offene), tx('Keine offenen Umfragen.'))}
      {showClosed && section(tx('Geschlossene Umfragen'), <IconLock size={16} />, pick(geschlossene), tx('Noch keine geschlossenen Umfragen.'))}
    </section>
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{context}</p>
        </div>
        {crud.umfragen.canWrite && (
          <Button onClick={() => crud.umfragen.openCreate({ status: 'offen', loeschfrist_tage: 90 })}>
            <IconPlus size={16} className="shrink-0" /> {tx('Neue Umfrage')}
          </Button>
        )}
      </header>
      <DashboardGrid
        variant="split"
        hero={hero || undefined}
        kpis={
          <StatStrip>
            <StatStripItem title={tx('Offen')} value={offene.length} tone={offene.length > 0 ? 'primary' : 'default'} onClick={() => setFilter(f => (f === 'offen' ? 'all' : 'offen'))} active={filter === 'offen'} />
            <StatStripItem title={tx('Geschlossen')} value={geschlossene.length} onClick={() => setFilter(f => (f === 'geschlossen' ? 'all' : 'geschlossen'))} active={filter === 'geschlossen'} />
            <StatStripItem title={tx('Löschung bald')} value={bald.length} tone={bald.length > 0 ? 'warning' : 'default'} onClick={() => setFilter(f => (f === 'bald' ? 'all' : 'bald'))} active={filter === 'bald'} />
          </StatStrip>
        }
        aside={
          <>
            <WorkList
              title={tx('Löschfrist läuft ab')}
              icon={<IconTrash size={16} />}
              items={bald.slice().sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0)).map(s => ({
                id: s.u.record_id,
                title: s.u.fields.titel ?? '—',
                secondLine: (
                  <span className="font-medium text-amber-700">
                    {(s.daysLeft ?? 0) < 0 ? tx('Löschung fällig') : tx`in ${s.daysLeft} Tagen`}
                    {s.deleteOn ? <span className="font-normal text-muted-foreground"> · {formatDate(format(s.deleteOn, 'yyyy-MM-dd'))}</span> : null}
                  </span>
                ),
                action: s.open && crud.umfragen.canWrite ? { label: tx('Schließen'), onClick: closeAction(s.u) } : undefined,
              }))}
              onItemClick={id => { const u = umfragen.find(x => x.record_id === id); if (u) crud.umfragen.openDetail(u); }}
              empty={{ text: tx(tx`Keine Umfrage wird in den nächsten ${WARN_DAYS} Tagen gelöscht.`) }}
            />
            <WorkList
              title={tx('Nächste Termine')}
              icon={<IconCalendarEvent size={16} />}
              items={nextTermine.map(t => ({
                id: t.record_id,
                title: t.umfrageName || '—',
                secondLine: <span className="text-muted-foreground">{fmtRange(t.fields.start, t.fields.ende)}</span>,
              }))}
              onItemClick={id => { const t = enrichedTermine.find(x => x.record_id === id); if (t) crud.termine.openDetail(t); }}
              empty={{
                text: tx('Keine kommenden Termine.'),
                action: crud.termine.canWrite ? { label: tx('Termin anlegen'), onClick: () => crud.termine.openCreate({}) } : undefined,
              }}
            />
          </>
        }
        primary={primary}
      />
      <span className="sr-only" data-today={todayKey} onClick={() => void fetchAll()} />
      {crud.surfaces}
    </div>
  );
}
