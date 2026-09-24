import { Question, Requirement } from "../shared/types";

/**
 * Deterministically finds must-have requirements that have zero questions mapped to them.
 */
export function findUncoveredRequirements(requirements: Requirement[], questions: Question[]): string[] {
  // Collect all requirement IDs mapped across all questions
  const coveredReqIdSet = new Set<string>();
  for (const q of questions) {
    if (Array.isArray(q.requirement_ids)) {
      for (const reqId of q.requirement_ids) {
        coveredReqIdSet.add(reqId);
      }
    }
  }

  // Filter requirements with priority === "must" that are missing in coveredReqIdSet
  const uncoveredMustReqs: string[] = [];
  for (const req of requirements) {
    if (req.priority === "must") {
      if (!coveredReqIdSet.has(req.id)) {
        uncoveredMustReqs.push(req.id);
      }
    }
  }

  return uncoveredMustReqs;
}
