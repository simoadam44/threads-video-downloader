/**
 * Server-side entry point for the contact form rules.
 *
 * The rules themselves live in src/lib/contact-rules.ts because the browser
 * form needs the exact same limits and messages (a client-side copy would
 * drift). This file only re-exports them so Worker code imports from the
 * server layer, as every other endpoint does.
 */
export {
  cleanText,
  validateContact,
  CONTACT_LIMITS,
  type ContactInput,
  type ContactField,
  type ContactValidation,
  type ContactErrorCode,
  type ContactFailure,
  type ContactAvailability,
} from "../lib/contact-rules";
