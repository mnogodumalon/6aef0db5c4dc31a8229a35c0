/**
 * Umfrage anlegen — 3-Schritt-Wizard plus Prüfen.
 * Steps: 1) Titel, Beschreibung, Ort → 2) Löschfrist → 3) Terminvorschläge erfassen → 4) Prüfen & anlegen.
 * Reads: — (nur über den Flow-Hook). Writes: umfragen (status fix „offen“), termine (ein Datensatz je Eintrag).
 * Composes: IntentWizardShell, Bound, ListEntries, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { Bound } from '@/components/blocks/Bound';
import { ListEntries } from '@/components/blocks/ListEntries';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useUmfrageAnlegenFlow } from '@/lib/journey/flows/UmfrageAnlegen';
import { tx } from '@/i18n';

export default function UmfrageAnlegenPage() {
  const [step, setStep] = useState(1);
  const flow = useUmfrageAnlegenFlow({
    steps: { titel: 1, beschreibung: 1, ort: 1, loeschfrist_tage: 2, start: 3, ende: 3 },
    initial: { loeschfrist_tage: 90 },
  });

  const endeFehler = tx('Das Ende muss nach dem Start liegen.');
  const editor = flow.forms.termine;

  const validateTermine = () => {
    const start = editor.get('start');
    const ende = editor.get('ende');
    if (typeof start === 'string' && typeof ende === 'string' && start && ende && ende < start) {
      return endeFehler;
    }
    if (!flow.validateStep(3)) return false;
    const bad = flow.lists.termine.entries.some(e => {
      const s = e.values.start;
      const en = e.values.ende;
      return typeof s === 'string' && typeof en === 'string' && en < s;
    });
    return bad ? endeFehler : true;
  };

  return (
    <IntentWizardShell
      title={tx('Umfrage anlegen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Lege eine Umfrage mit mehreren Terminvorschlägen in einem Zug an.'),
        needs: [tx('Titel der Umfrage'), tx('Mögliche Termine mit Start und Ende')],
      }}
    >
      <WizardStep label={tx('Umfrage')} description={tx('Gib der Umfrage einen Titel und sage, worum es geht.')}>
        <div className="space-y-4">
          <Bound form={flow.forms.umfragen} name="titel" />
          <Bound form={flow.forms.umfragen} name="beschreibung" />
          <Bound form={flow.forms.umfragen} name="ort" />
          <StepNav onNext={() => flow.validateStep(1)} nextStepLabel={tx('Löschfrist')} />
        </div>
      </WizardStep>
      <WizardStep label={tx('Löschfrist')} description={tx('Nach wie vielen Tagen nach dem letzten Termin sollen die Daten gelöscht werden?')}>
        <div className="space-y-4">
          <Bound form={flow.forms.umfragen} name="loeschfrist_tage" hint={tx('Standard: 90 Tage')} />
          <StepNav onBack={() => setStep(1)} onNext={() => flow.validateStep(2)} nextStepLabel={tx('Termine')} />
        </div>
      </WizardStep>
      <WizardStep label={tx('Termine')} description={tx('Erfasse alle Terminvorschläge mit Start und Ende.')}>
        <div className="space-y-4">
          <ListEntries list={flow.lists.termine}>
            <Bound form={flow.forms.termine} name="start" />
            <Bound form={flow.forms.termine} name="ende" />
          </ListEntries>
          <StepNav onBack={() => setStep(2)} onNext={validateTermine} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status', label: tx('Status'), value: tx('Offen') }]}
            whatHappensNext={tx('Die Umfrage wird mit allen Terminvorschlägen angelegt und ist sofort offen.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Umfrage schließen'), href: '#/intents/umfrage-abschliessen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
