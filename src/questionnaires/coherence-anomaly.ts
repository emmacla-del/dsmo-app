// src/questionnaires/coherence-anomaly.ts
//
// One definition of how a coherence flag (checkCoherence / checkVtCoherence
// in questionnaires.service.ts) is stored as an OnefopAnomaly.
//
// Coherence flags are advisory (CLAUDE.md §7): real establishments have
// legitimate exceptions, so a flag is a WARNING that a reviewer sees, never a
// blocking anomaly. A blocking anomaly keeps a dossier from being approved
// and from every export, so treating an arithmetic disagreement as one
// silently removed real declarations from the statistical base.
//
// Previously each writer decided `isBlocking` by searching the code for
// "MISMATCH" or "BLOCKING", which made every VT coherence rule and the
// employer S22Q03 / S3 rules blocking. Where the respondent must correct a
// disagreement, the wizard now refuses to move on
// (react-web/src/lib/vt-cross-table.ts), before submission, not after it.
import { AnomalySeverity, AnomalyStatus } from '@prisma/client';

export interface CoherenceFlag {
  code?: string | null;
  message?: string | null;
}

export function coherenceFlagToAnomaly(submissionId: string, flag: CoherenceFlag) {
  const code = flag.code || 'COHERENCE_MISMATCH';
  return {
    submissionId,
    ruleCode: code,
    ruleFamily: code.startsWith('VT_') ? 'VT_COHERENCE' : 'COHERENCE',
    severity: AnomalySeverity.WARNING,
    isBlocking: false,
    status: AnomalyStatus.OPEN,
    description: flag.message || 'Incohérence statistique détectée',
    observedValue: 'Incohérence détectée',
    expectedValue: 'Égalité requise',
  };
}
