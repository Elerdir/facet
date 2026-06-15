/** Local lexical (BM25) codebase retrieval — no embeddings, runs on-device. */

/** Tokenize code/text into lowercased terms, splitting camelCase and snake_case. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const word of text.split(/[^A-Za-z0-9]+/)) {
    if (word === "") continue;
    for (const part of word.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/\s+/)) {
      const t = part.toLowerCase();
      if (t.length >= 2) out.push(t);
    }
  }
  return out;
}

export interface Chunk {
  path: string;
  startLine: number;
  text: string;
}

/** Split a file into line-windowed chunks (skips blank chunks). */
export function chunkFile(path: string, content: string, linesPerChunk = 40): Chunk[] {
  const lines = content.split("\n");
  const chunks: Chunk[] = [];
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    const text = lines.slice(i, i + linesPerChunk).join("\n");
    if (text.trim() !== "") chunks.push({ path, startLine: i + 1, text });
  }
  return chunks;
}

interface IndexedChunk {
  chunk: Chunk;
  tf: Map<string, number>;
  length: number;
}

export interface CodebaseIndex {
  docs: IndexedChunk[];
  df: Map<string, number>;
  avgdl: number;
}

export function buildIndex(chunks: Chunk[]): CodebaseIndex {
  const docs: IndexedChunk[] = [];
  const df = new Map<string, number>();
  let totalLen = 0;
  for (const chunk of chunks) {
    const terms = tokenize(chunk.text);
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    docs.push({ chunk, tf, length: terms.length });
    totalLen += terms.length;
  }
  return { docs, df, avgdl: docs.length > 0 ? totalLen / docs.length : 0 };
}

/** BM25 search over the index; returns the top scoring chunks. */
export function bm25Search(
  index: CodebaseIndex,
  query: string,
  topK: number,
): { chunk: Chunk; score: number }[] {
  const k1 = 1.5;
  const b = 0.75;
  const n = index.docs.length;
  const qterms = [...new Set(tokenize(query))];

  const scored = index.docs.map((doc) => {
    let score = 0;
    for (const t of qterms) {
      const f = doc.tf.get(t);
      if (!f) continue;
      const nq = index.df.get(t) ?? 0;
      const idf = Math.log(1 + (n - nq + 0.5) / (nq + 0.5));
      const denom = f + k1 * (1 - b + (b * doc.length) / (index.avgdl || 1));
      score += (idf * (f * (k1 + 1))) / denom;
    }
    return { chunk: doc.chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, topK);
}
