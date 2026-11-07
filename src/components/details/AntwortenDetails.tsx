import type { Antworten, Teilnehmer, Termine } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { usePermissions } from '@/lib/permissions';

export interface AntwortenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Antworten;
  /** N:1-Ziel „Teilnehmer": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  teilnehmerList: Teilnehmer[];
  /** Klick auf die Teilnehmer-Relation → overlay.push auf dessen Detail. */
  onOpenTeilnehmer?: (record: Teilnehmer) => void;
  /** N:1-Ziel „Termine": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  termineList: Termine[];
  /** Klick auf die Termine-Relation → overlay.push auf dessen Detail. */
  onOpenTermine?: (record: Termine) => void;
}

export function AntwortenDetails({
  record,
  teilnehmerList,
  onOpenTeilnehmer,
  termineList,
  onOpenTermine,
}: AntwortenDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  const teilnehmerTarget = teilnehmerList.find(r => r.record_id === extractRecordId(record.fields.teilnehmer));
  const terminTarget = termineList.find(r => r.record_id === extractRecordId(record.fields.termin));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('antworten', 'wert')} value={record.fields.wert} format="pill" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('antworten', 'teilnehmer')}
          name={teilnehmerTarget?.fields.name ?? '—'}
          meta={[teilnehmerTarget?.fields.bearbeitungstoken].filter(Boolean).join(' · ') || undefined}
          onClick={teilnehmerTarget && onOpenTeilnehmer ? () => onOpenTeilnehmer!(teilnehmerTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('antworten', 'termin')}
          name={terminTarget?.fields.umfrage ?? '—'}
          meta={undefined}
          onClick={terminTarget && onOpenTermine ? () => onOpenTermine!(terminTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.ANTWORTEN} recordId={record.record_id} readOnly={!perms.canWrite('antworten')} />
    </>
  );
}
