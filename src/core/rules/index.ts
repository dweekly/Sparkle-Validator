import type { ValidationRule } from "../types.js";
import { structureRules } from "./structure.js";
import { versionRules } from "./version.js";
import { enclosureRules } from "./enclosure.js";
import { dateRules } from "./dates.js";
import { urlRules } from "./urls.js";
import { systemRequirementRules } from "./system-requirements.js";
import { releaseNotesRules } from "./release-notes.js";
import { channelRules } from "./channels.js";
import { rolloutRules } from "./rollout.js";
import { bestPracticeRules } from "./best-practices.js";
import { infoRules } from "./info.js";

/**
 * All validation rules, in order of execution.
 * Structure rules run first since other rules depend on having a valid structure.
 */
export const allRules: ValidationRule[] = [
  structureRules,
  versionRules,
  enclosureRules,
  dateRules,
  urlRules,
  systemRequirementRules,
  releaseNotesRules,
  channelRules,
  rolloutRules,
  bestPracticeRules,
  infoRules,
];
