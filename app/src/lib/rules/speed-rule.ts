import { RuleConfiguration, ViolationLevel } from "@/lib/types";

export const speedRule: RuleConfiguration = {
  defaultRoadLimit: 80,
  tolerance: 6,
  triggerSpeed: 86,
  minimumViolationDuration: 10,
  ruleVersion: "KL_SPEED_RULE_2026_01",
};

export function getViolationLevel(speed: number): ViolationLevel {
  if (speed <= speedRule.triggerSpeed) return "L0";
  if (speed <= 95) return "L1";
  if (speed <= 110) return "L2";
  if (speed > 110) return "L3";
  return "L4";
}
