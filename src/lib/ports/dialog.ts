/**
 * Port for native file/folder dialogs. Returns the chosen path, or null when
 * the user cancels.
 */
export interface DialogPort {
  openFile(): Promise<string | null>;
  saveFile(defaultName?: string): Promise<string | null>;
  openFolder(): Promise<string | null>;
  /** Yes/No confirmation; resolves true when the user confirms. */
  confirm(message: string): Promise<boolean>;
}
