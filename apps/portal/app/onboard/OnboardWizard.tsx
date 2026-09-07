"use client";

import { useState } from "react";
import type { DraftQuestion } from "./core-api";
import { IntelligenceStep } from "./IntelligenceStep";
import { PlaceStep, type Zone } from "./PlaceStep";
import { AiDraftedQuestionStep, ManualQuestionStep } from "./QuestionStep";
import { AiReviewStep, ManualReviewStep } from "./ReviewStep";
import { StrategyStep, type Category } from "./StrategyStep";

type WizardStep =
  | { step: 1 }
  | { step: 2; zoneId: string; zoneName: string }
  | { step: 3; zoneId: string | null; zoneName: string; hasUnderstanding: boolean }
  | { step: 4; zoneId: string | null; strategy: "manual"; categoryId: number }
  | { step: 4; strategy: "ai"; runId: number; questionsGenerated: number }
  | { step: 5; strategy: "manual" }
  | { step: 5; strategy: "ai"; drafts: DraftQuestion[] };

const STEP_LABELS = ["Place", "Intelligence", "Strategy", "Question", "Review"];

export function OnboardWizard({ zones, categories }: { zones: Zone[]; categories: Category[] }): JSX.Element {
  const [state, setState] = useState<WizardStep>({ step: 1 });

  const stepNumber = state.step;

  return (
    <div className="wizard">
      <div className="onboardProgress">
        {STEP_LABELS.map((label, i) => (
          <span key={label} className={`onboardProgressStep ${i + 1 === stepNumber ? "onboardProgressStepOn" : ""} ${i + 1 < stepNumber ? "onboardProgressStepDone" : ""}`}>
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {state.step === 1 && (
        <PlaceStep
          zones={zones}
          onSelected={(zoneId, zoneName) =>
            setState(
              zoneId
                ? { step: 2, zoneId, zoneName }
                : { step: 3, zoneId: null, zoneName: "Global", hasUnderstanding: false }
            )
          }
        />
      )}

      {state.step === 2 && (
        <IntelligenceStep
          zoneId={state.zoneId}
          zoneName={state.zoneName}
          onDone={(hasUnderstanding) =>
            setState({ step: 3, zoneId: state.zoneId, zoneName: state.zoneName, hasUnderstanding })
          }
        />
      )}

      {state.step === 3 && (
        <StrategyStep
          categories={categories}
          zoneId={state.zoneId}
          hasUnderstanding={state.hasUnderstanding}
          onBackToIntelligence={() =>
            state.zoneId && setState({ step: 2, zoneId: state.zoneId, zoneName: state.zoneName })
          }
          onManual={(categoryId) => setState({ step: 4, zoneId: state.zoneId, strategy: "manual", categoryId })}
          onAiGenerated={(_categoryId, _categoryName, runId, questionsGenerated) =>
            setState({ step: 4, strategy: "ai", runId, questionsGenerated })
          }
        />
      )}

      {state.step === 4 && state.strategy === "manual" && (
        <ManualQuestionStep
          zoneId={state.zoneId}
          categoryId={state.categoryId}
          onCreated={() => setState({ step: 5, strategy: "manual" })}
        />
      )}

      {state.step === 4 && state.strategy === "ai" && (
        <AiDraftedQuestionStep
          runId={state.runId}
          questionsGenerated={state.questionsGenerated}
          onContinue={(drafts) => setState({ step: 5, strategy: "ai", drafts })}
        />
      )}

      {state.step === 5 && state.strategy === "manual" && (
        <ManualReviewStep onRestart={() => setState({ step: 1 })} />
      )}

      {state.step === 5 && state.strategy === "ai" && (
        <AiReviewStep drafts={state.drafts} onRestart={() => setState({ step: 1 })} />
      )}
    </div>
  );
}
