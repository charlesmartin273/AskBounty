// Short, URL-safe question id — also written onchain as the job `description`
// (keep it short: description costs calldata). ~57 bits of entropy.
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateQuestionId(): string {
  const bytes = new Uint8Array(11);
  crypto.getRandomValues(bytes);
  let id = "q";
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length];
  return id;
}

export function isQuestionId(v: unknown): v is string {
  return typeof v === "string" && /^q[a-z0-9]{11}$/.test(v);
}
