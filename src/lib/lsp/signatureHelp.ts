/** Pure parsing of LSP `textDocument/signatureHelp` responses. */

export interface SigParam {
  label: string;
}

export interface SigInfo {
  label: string;
  parameters: SigParam[];
  /** Per-signature active parameter index, when the server provides one. */
  activeParameter?: number;
}

export interface SignatureHelp {
  signatures: SigInfo[];
  activeSignature: number;
  activeParameter: number;
}

/** Resolve a ParameterInformation label (string or [start,end] into the sig). */
function paramLabel(raw: unknown, sigLabel: string): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length === 2 && typeof raw[0] === "number") {
    return sigLabel.slice(raw[0], raw[1]);
  }
  return "";
}

export function parseSignatureHelp(res: unknown): SignatureHelp | null {
  if (!res || typeof res !== "object") return null;
  const o = res as Record<string, unknown>;
  const rawSigs = Array.isArray(o.signatures) ? o.signatures : [];
  if (rawSigs.length === 0) return null;

  const signatures: SigInfo[] = (rawSigs as Record<string, unknown>[]).map((s) => {
    const label = typeof s.label === "string" ? s.label : "";
    const parameters = Array.isArray(s.parameters)
      ? (s.parameters as Record<string, unknown>[]).map((p) => ({
          label: paramLabel(p.label, label),
        }))
      : [];
    return {
      label,
      parameters,
      activeParameter: typeof s.activeParameter === "number" ? s.activeParameter : undefined,
    };
  });

  return {
    signatures,
    activeSignature: typeof o.activeSignature === "number" ? o.activeSignature : 0,
    activeParameter: typeof o.activeParameter === "number" ? o.activeParameter : 0,
  };
}
