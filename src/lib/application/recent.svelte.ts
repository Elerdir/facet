/** Recently opened workspace folders (most recent first, capped). */
export class RecentStore {
  folders = $state<string[]>([]);

  set(list: string[]): void {
    this.folders = list.filter((f) => typeof f === "string" && f !== "").slice(0, 10);
  }

  add(path: string): void {
    this.folders = [path, ...this.folders.filter((f) => f !== path)].slice(0, 10);
  }

  remove(path: string): void {
    this.folders = this.folders.filter((f) => f !== path);
  }
}
