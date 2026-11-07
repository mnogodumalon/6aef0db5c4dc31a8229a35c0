import type { Umfragen, Termine, Teilnehmer } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';

export interface UmfragenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Umfragen;
  /** N:1-Ziel „Termine": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  termineList: Termine[];
  /** Klick auf die Termine-Relation → overlay.push auf dessen Detail. */
  onOpenTermine?: (record: Termine) => void;
  /** 1:N „Termine" (umfrage): VOLLE Liste — der Block filtert auf diesen Record. */
  termineUmfrageList: Termine[];
  /** Zeilen-Klick → overlay.push auf das Termine-Detail (nie der Edit-Dialog). */
  onOpenTermineUmfrage: (record: Termine) => void;
  /** Kontextuelles „+": öffnet den Termine-Dialog mit diesem Record vorgesetzt. */
  onAddTermineUmfrage?: () => void;
  /** 1:N „Teilnehmer" (umfrage): VOLLE Liste — der Block filtert auf diesen Record. */
  teilnehmerList: Teilnehmer[];
  /** Zeilen-Klick → overlay.push auf das Teilnehmer-Detail (nie der Edit-Dialog). */
  onOpenTeilnehmer: (record: Teilnehmer) => void;
  /** Kontextuelles „+": öffnet den Teilnehmer-Dialog mit diesem Record vorgesetzt. */
  onAddTeilnehmer?: () => void;
}

export function UmfragenDetails({
  record,
  termineList,
  onOpenTermine,
  termineUmfrageList,
  onOpenTermineUmfrage,
  onAddTermineUmfrage,
  teilnehmerList,
  onOpenTeilnehmer,
  onAddTeilnehmer,
}: UmfragenDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  const finaler_terminTarget = termineList.find(r => r.record_id === extractRecordId(record.fields.finaler_termin));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('umfragen', 'titel')} value={record.fields.titel} format="text" />
        <RecordField label={fieldLabel('umfragen', 'beschreibung')} value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('umfragen', 'ort')} value={record.fields.ort} format="text" />
        <RecordField label={fieldLabel('umfragen', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('umfragen', 'zugriffstoken')} value={record.fields.zugriffstoken} format="text" />
        <RecordField label={fieldLabel('umfragen', 'loeschfrist_tage')} value={record.fields.loeschfrist_tage} format="text" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('umfragen', 'finaler_termin')}
          name={finaler_terminTarget?.fields.umfrage ?? '—'}
          meta={undefined}
          onClick={finaler_terminTarget && onOpenTermine ? () => onOpenTermine!(finaler_terminTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={`${appLabel('termine')} · ${fieldLabel('termine', 'umfrage')}`}
        items={termineUmfrageList.filter(r => extractRecordId(r.fields.umfrage) === record.record_id)}
        map={r => ({ name: appLabel('termine'), meta: r.fields.start })}
        onOpen={onOpenTermineUmfrage}
        onAdd={onAddTermineUmfrage}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('teilnehmer')}
        items={teilnehmerList.filter(r => extractRecordId(r.fields.umfrage) === record.record_id)}
        map={r => ({ name: r.fields.name ?? appLabel('teilnehmer'), meta: undefined })}
        onOpen={onOpenTeilnehmer}
        onAdd={onAddTeilnehmer}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.UMFRAGEN} recordId={record.record_id} readOnly={!perms.canWrite('umfragen')} />
    </>
  );
}
