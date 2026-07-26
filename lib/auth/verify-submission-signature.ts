import { keccak256, recoverMessageAddress, toBytes } from "viem";

// Canonical signed payload for answer submission (no sessions): each submit
// proves wallet ownership by signing (questionId, keccak256(body)). This
// module is isomorphic on purpose - the client builds the exact same message
// it signs, and the SERVER recomputes the content hash from the raw body and
// recovers the signer itself. The client-claimed address is only a cross-
// check; the stored answerer_address is ALWAYS the recovered signer (R5).

export function contentHashOf(body: string): `0x${string}` {
  return keccak256(toBytes(body));
}

export function buildAnswerMessage(
  questionId: string,
  contentHash: `0x${string}`,
): string {
  return `AskBounty answer\nquestion:${questionId}\nhash:${contentHash}`;
}

export type SubmissionAuth =
  | { ok: true; recovered: `0x${string}`; contentHash: `0x${string}` }
  | { ok: false; reason: string; contentHash: `0x${string}` };

// Verify BEFORE any DB write. Recover-then-compare: a signature over a
// tampered body recovers to a different address than claimed, so both body
// tampering and address spoofing land in the same rejection.
export async function verifySubmission(args: {
  questionId: string;
  body: string;
  address: string;
  signature: string;
}): Promise<SubmissionAuth> {
  const contentHash = contentHashOf(args.body);
  const message = buildAnswerMessage(args.questionId, contentHash);
  try {
    const recovered = await recoverMessageAddress({
      message,
      signature: args.signature as `0x${string}`,
    });
    if (recovered.toLowerCase() !== args.address.toLowerCase()) {
      return {
        ok: false,
        reason: "signature does not match the claimed address",
        contentHash,
      };
    }
    return { ok: true, recovered, contentHash };
  } catch {
    return { ok: false, reason: "invalid signature", contentHash };
  }
}
