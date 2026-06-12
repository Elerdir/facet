import type { DiffRow } from "../domain/diff";

/** Port for computing a side-by-side diff of two files. */
export interface DiffPort {
  diffFiles(left: string, right: string): Promise<DiffRow[]>;
}
