import { QAMatrixEntry, Status } from "@/types/qaMatrix";

const sumNonNull = (values: (number | null)[]): number =>
  values.reduce<number>((acc, v) => acc + (v ?? 0), 0);

// Recalculate control ratings and statuses
export function recalculateStatuses(entry: QAMatrixEntry): QAMatrixEntry {
  const dr = entry.defectRating;
  const hasRecurrence = entry.weeklyRecurrence.some(w => w > 0);
  const recurrence = entry.weeklyRecurrence.reduce((a, b) => a + b, 0);
  const recurrenceCountPlusDefect = dr + recurrence;

  // MFG Control Rating: sum of all non-null scores from T10 to FPQG (trim + chassis + final, excluding ResidualTorque)
  const trimValues = Object.values(entry.trim);
  const chassisValues = Object.values(entry.chassis);
  const { ResidualTorque, ...finalWithoutRT } = entry.final;
  const finalValues = Object.values(finalWithoutRT);
  const mfgRating = sumNonNull([...trimValues, ...chassisValues, ...finalValues]);

  // Quality Control Rating: sum of Q'Control scores (1.1-5.3)
  const qControlValues = Object.values(entry.qControl);
  const qualityRating = sumNonNull(qControlValues);

  // Plant Control Rating: sum of ResidualTorque + Q'Control (1.1-5.3) + Q'Control Detail (CVT, SHOWER, Dynamic/UB, CC4)
  const qControlDetailValues = Object.values(entry.qControlDetail);
  const plantRating = sumNonNull([ResidualTorque, ...qControlValues, ...qControlDetailValues]);

  // Workstation status: if any recurrence in last 6 weeks, auto NG
  const wsStatus: Status = hasRecurrence ? "NG" : (mfgRating >= dr ? "OK" : "NG");
  // MFG status: mfgRating >= defectRating
  const mfgStatus: Status = mfgRating >= dr ? "OK" : "NG";
  // Plant status: plantRating >= defectRating
  const plantStatus: Status = plantRating >= dr ? "OK" : "NG";

  return {
    ...entry,
    recurrence,
    recurrenceCountPlusDefect,
    controlRating: { MFG: mfgRating, Quality: qualityRating, Plant: plantRating },
    workstationStatus: wsStatus,
    mfgStatus,
    plantStatus,
  };
}
