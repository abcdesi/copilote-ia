import { reserveUsage } from "@/lib/billing/usage-policy";

function envNumber(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function reserveActionExecution(companyId: string) {
  return reserveUsage({
    companyId,
    kind: "action",
    credits: envNumber("PILOTZIA_ACTION_EXECUTION_CREDITS", 1),
    reservedCostEur: envNumber("PILOTZIA_ACTION_EXECUTION_RESERVE_EUR", 0.01),
  });
}

export function reserveAutomationExecution(companyId: string) {
  return reserveUsage({
    companyId,
    kind: "automation",
    credits: envNumber("PILOTZIA_AUTOMATION_RUN_CREDITS", 1),
    reservedCostEur: envNumber("PILOTZIA_AUTOMATION_RUN_RESERVE_EUR", 0.02),
  });
}
