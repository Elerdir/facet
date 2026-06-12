import type { FileTypeRule } from "../domain/fileTypes";

// User-defined file-type rules, populated at startup from the config file.
// Kept as a tiny module-level store so the highlighting resolver can consult it
// synchronously; the merge logic itself lives in the pure domain layer.
let userRules: FileTypeRule[] = [];

export function getUserFileTypes(): FileTypeRule[] {
  return userRules;
}

export function setUserFileTypes(rules: FileTypeRule[]): void {
  userRules = rules;
}
