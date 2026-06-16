import { showTooltip, type Tooltip } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import type { SignatureHelp } from "../lsp/signatureHelp";

/**
 * A manually-driven signature-help tooltip: the editor requests help on `(` / `,`
 * and pushes the result through `setSignature`; clearing with `null` hides it.
 */
export const setSignature = StateEffect.define<{ pos: number; help: SignatureHelp } | null>();

function renderTooltip(help: SignatureHelp): HTMLElement {
  const dom = document.createElement("div");
  dom.className = "cm-signature";
  const sig = help.signatures[help.activeSignature] ?? help.signatures[0];
  if (!sig) return dom;

  const active = sig.activeParameter ?? help.activeParameter;
  const param = sig.parameters[active];
  const at = param ? sig.label.indexOf(param.label) : -1;

  if (param && at >= 0 && param.label !== "") {
    dom.appendChild(document.createTextNode(sig.label.slice(0, at)));
    const b = document.createElement("b");
    b.textContent = param.label;
    dom.appendChild(b);
    dom.appendChild(document.createTextNode(sig.label.slice(at + param.label.length)));
  } else {
    dom.textContent = sig.label;
  }
  return dom;
}

const signatureField = StateField.define<Tooltip | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setSignature)) {
        const v = e.value;
        value = v
          ? {
              pos: v.pos,
              above: true,
              arrow: false,
              create: () => ({ dom: renderTooltip(v.help) }),
            }
          : null;
      }
    }
    if (value && tr.docChanged) {
      value = { ...value, pos: tr.changes.mapPos(value.pos) };
    }
    return value;
  },
  provide: (f) => showTooltip.from(f),
});

export function signatureHelpExtension() {
  return [signatureField];
}
