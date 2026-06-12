/** Encodings offered for "convert encoding". Ids are valid encoding labels
 * understood by the Rust side (encode_text). */
export interface EncodingInfo {
  id: string;
  label: string;
}

export const ENCODINGS: EncodingInfo[] = [
  { id: "utf-8", label: "UTF-8" },
  { id: "utf-8-bom", label: "UTF-8 s BOM" },
  { id: "utf-16le", label: "UTF-16 LE" },
  { id: "utf-16be", label: "UTF-16 BE" },
  { id: "windows-1250", label: "Windows-1250 (střední Evropa)" },
  { id: "iso-8859-2", label: "ISO-8859-2 (Latin-2)" },
];
