/**
 * Umfrage abschließen — 3-Schritt-Wizard.
 * Steps: 1) Offene Umfrage wählen → 2) Finalen Termin dieser Umfrage wählen → 3) Prüfen & schließen.
 * Reads: umfragen, termine. Writes: umfragen (finaler_termin, status=geschlossen) via useUmfrageAbschliessenFlow.
 * Composes: IntentWizardShell, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldDate, fieldRef, fieldLookup } from '@/lib/journey';
import { useUmfrageAbschliessenFlow } from '@/lib/journey/flows/UmfrageAbschliessen';
import { tx } from '@/i18n';

function terminLabel(iso: string | null): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'dd.MM.yyyy HH:mm');
  } catch {
    return iso;
  }
}

export default function UmfrageAbschliessenPage() {
  const [step, setStep] = useState(1);
  const umfrageIdRef = useRef<string | null>(null);

  const flow = useUmfrageAbschliessenFlow({
    steps: { umfragen: 1, finaler_termin: 2 },
    items: {
      umfragen: r => ({
        id: r.id,
        title: fieldText(r, 'titel'),
        subtitle: fieldText(r, 'ort') || undefined,
        status: fieldLookup(r, 'status') ?? undefined,
      }),
      finaler_termin: r => {
        const start = terminLabel(fieldDate(r, 'start'));
        const ende = terminLabel(fieldDate(r, 'ende'));
        return { id: r.id, title: start, subtitle: ende ? tx`bis ${ende}` : undefined };
      },
    },
    where: {
      umfragen: r => fieldLookup(r, 'status')?.key !== 'geschlossen',
    },
  });

  const umfragePick = flow.pick('umfragen');
  umfrageIdRef.current = umfragePick.selectedId ?? null;
  const umfrageId = umfragePick.selectedId ?? null;

  return (
    <IntentWizardShell
      title={tx('Umfrage abschließen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{ description: tx('Einen Termin als finalen Termin festlegen und die Umfrage schließen.'), needs: [tx('Eine offene Umfrage')] }}
    >
      <WizardStep label={tx('Umfrage')} description={tx('Welche offene Umfrage möchtest du schließen?')}>
        <EntitySelectStep
          {...flow.picks.umfragen.select}
          {...umfragePick}
          searchPlaceholder={tx('Titel suchen …')}
          emptyText={tx('Es gibt keine offene Umfrage.')}
        />
      </WizardStep>
      <WizardStep label={tx('Finaler Termin')} description={tx('Welcher Termin dieser Umfrage soll gelten?')}>
        {umfrageId ? (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-secondary/50 p-3 overflow-hidden">
              <p className="text-xs text-muted-foreground">{tx('Gewählte Umfrage')}</p>
              <p className="font-medium truncate">{flow.picks.umfragen.labelOf(umfrageId) ?? umfrageId}</p>
            </div>
            <EntitySelectStep
              {...flow.picks.finaler_termin.select}
              {...flow.pick('finaler_termin')}
            />
            <StepNav
              onBack={() => setStep(1)}
              onNext={() => flow.validateStep(2)}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
          </StepNav>
        )}
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status', label: tx('Status'), value: tx('Geschlossen') }]}
            whatHappensNext={tx('Die Umfrage wird geschlossen, niemand kann mehr abstimmen.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          undo={flow.undo}
          next={[
            { label: tx('Umfrage mit Terminen anlegen'), href: '#/intents/umfrage-anlegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
