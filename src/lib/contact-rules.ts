/**
 * Contact form rules shared by the browser form and the Worker endpoint.
 *
 * Pure TypeScript with no I/O and no server imports, so it can be bundled into
 * the client without pulling server code in. src/server/contact.ts re-exports
 * these symbols; the Worker never duplicates the limits.
 */

export interface ContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export type ContactField = keyof ContactInput;

export type ContactValidation =
  | { ok: true; value: ContactInput }
  | { ok: false; field: ContactField; message: string };

export const CONTACT_LIMITS = {
  name: { min: 2, max: 80 },
  email: { max: 254 },
  subject: { min: 3, max: 120 },
  message: { min: 20, max: 4000 },
} as const;

/** Conservative address check: one @, a dot in the domain, no spaces. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

/**
 * Remove control characters (which can corrupt storage / previews) while
 * keeping newlines, then trim and cap the length. Never throws.
 */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max);
}

export function validateContact(input: unknown): ContactValidation {
  const body = (input ?? {}) as Record<string, unknown>;

  const name = cleanText(body["name"], CONTACT_LIMITS.name.max);
  if (name.length < CONTACT_LIMITS.name.min) {
    return { ok: false, field: "name", message: "Please enter your name (at least 2 characters)." };
  }

  const email = cleanText(body["email"], CONTACT_LIMITS.email.max);
  if (!EMAIL_RE.test(email)) {
    return { ok: false, field: "email", message: "Please enter a valid email address so we can reply." };
  }

  const subject = cleanText(body["subject"], CONTACT_LIMITS.subject.max);
  if (subject.length < CONTACT_LIMITS.subject.min) {
    return { ok: false, field: "subject", message: "Please add a short subject (at least 3 characters)." };
  }

  const message = cleanText(body["message"], CONTACT_LIMITS.message.max);
  if (message.length < CONTACT_LIMITS.message.min) {
    return {
      ok: false,
      field: "message",
      message: `Please describe your request in at least ${CONTACT_LIMITS.message.min} characters.`,
    };
  }

  return { ok: true, value: { name, email, subject, message } };
}

export type ContactErrorCode = "CONTACT_INVALID" | "CONTACT_UNAVAILABLE" | "RATE_LIMITED" | "UNKNOWN_ERROR";

export interface ContactFailure {
  success: false;
  error: { code: ContactErrorCode; message: string; field?: ContactField };
}

export interface ContactAvailability {
  accepting: boolean;
  email: string | null;
}
