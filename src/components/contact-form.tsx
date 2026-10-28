import { useEffect, useId, useRef, useState } from "react";
import {
  CONTACT_LIMITS,
  validateContact,
  type ContactAvailability,
  type ContactFailure,
  type ContactField,
  type ContactInput,
} from "../lib/contact-rules";

const EMPTY: ContactInput = { name: "", email: "", subject: "", message: "" };

type Availability = { kind: "probing" } | { kind: "ready"; email: string | null } | { kind: "unavailable"; email?: string | null };

type SubmitState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "failed"; message: string; field?: ContactField };

/**
 * Contact form.
 *
 * Real behaviour, no theatre: GET /api/contact reports whether the inbox can
 * accept messages (database reachable and migration applied). When it cannot,
 * the form is replaced by a plain notice instead of pretending to send.
 * Submissions go to POST /api/contact, which validates again server-side and
 * stores the message in the site database; the operator reads it in the admin
 * area. No email provider, no client-visible secret.
 */
export function ContactForm() {
  const uid = useId();
  const [availability, setAvailability] = useState<Availability>({ kind: "probing" });
  const [values, setValues] = useState<ContactInput>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const [honeypot, setHoneypot] = useState("");
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/contact", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { success?: boolean; data?: ContactAvailability } | null) => {
        if (cancelled) return;
        if (j?.success && j.data) {
          setAvailability({ kind: j.data.accepting ? "ready" : "unavailable", email: j.data.email });
        } else {
          setAvailability({ kind: "unavailable" });
        }
      })
      .catch(() => {
        if (!cancelled) setAvailability({ kind: "unavailable" });
      });    return () => {
      cancelled = true;
    };
  }, []);

  function field(name: ContactField) {
    return {
      id: `${uid}-${name}`,
      name,
      value: values[name],
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": errors[name] ? `${uid}-${name}-error` : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setValues((v) => ({ ...v, [name]: e.target.value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
      },
    };
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "sending") return;
    const parsed = validateContact(values);
    if (!parsed.ok) {
      setErrors({ [parsed.field]: parsed.message });
      setState({ kind: "failed", message: parsed.message, field: parsed.field });
      const el = document.getElementById(`${uid}-${parsed.field}`);
      if (el) el.focus();
      return;
    }
    setErrors({});
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ ...parsed.value, website: honeypot }),
      });
      if (res.status === 201) {
        setState({ kind: "sent" });
        setValues(EMPTY);
        return;
      }
      const body = (await res.json().catch(() => null)) as ContactFailure | null;
      const message =
        res.status === 429
          ? "Too many messages were sent from this network. Please wait a few minutes and try again."
          : body?.error?.message || "Your message could not be sent. Please try again in a moment.";
      if (body?.error?.field) setErrors({ [body.error.field]: message });
      setState({ kind: "failed", message, field: body?.error?.field });
    } catch {
      setState({
        kind: "failed",
        message: "The message could not be sent. Check your connection and try again.",
      });
    }
  }

  if (availability.kind === "probing") {
    return (
      <div className="card prose-card">
        <p className="example" role="status">
          Loading the contact form…
        </p>
      </div>
    );
  }

  if (availability.kind === "unavailable") {
    return (
      <div className="card prose-card">
        <h2>Contact form temporarily unavailable</h2>
        <p>
          The message inbox is not reachable right now, so the form is disabled rather than accepting messages that
          nobody would read. Please try again later.
        </p>
        {availability.email && (
          <p>
            You can also write to <a href={`mailto:${availability.email}`}>{availability.email}</a>.
          </p>
        )}
        <p className="example">
          If this notice stays for more than a day, the site operator needs to finish the contact inbox setup
          (database migration for the messages table).
        </p>
      </div>
    );
  }

  if (state.kind === "sent") {
    return (
      <div className="card prose-card">
        <h2>Message sent</h2>
        <p role="status">
          Thank you — your message has been stored and will be read by the site operator. Replies go to the email
          address you provided.
        </p>
        <p className="example">
          Messages are kept until the request is handled and for a reasonable follow-up period, then deleted. See the{" "}
          <a href="/privacy">privacy policy</a> for details.
        </p>
        <button className="btn btn-ghost" type="button" onClick={() => setState({ kind: "idle" })}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form className="card contact-form" onSubmit={onSubmit} noValidate>
      <h2>Send a message</h2>
      <p className="example">
        Fields marked with an asterisk are required. Please include the post URL if your message is about a specific
        link.
      </p>

      <div className="field">
        <label htmlFor={`${uid}-name`}>
          Your name <span aria-hidden="true">*</span>
        </label>
        <input
          ref={firstFieldRef}
          type="text"
          autoComplete="name"
          required
          maxLength={CONTACT_LIMITS.name.max}
          {...field("name")}
        />
        {errors.name && (
          <p className="field-error" id={`${uid}-name-error`}>
            {errors.name}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${uid}-email`}>
          Your email <span aria-hidden="true">*</span>
        </label>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={CONTACT_LIMITS.email.max}
          {...field("email")}
        />
        {errors.email && (
          <p className="field-error" id={`${uid}-email-error`}>
            {errors.email}
          </p>
        )}
        <p className="hint">Used only to reply to this message. No newsletter, no marketing.</p>
      </div>

      <div className="field">
        <label htmlFor={`${uid}-subject`}>
          Subject <span aria-hidden="true">*</span>
        </label>
        <input type="text" required maxLength={CONTACT_LIMITS.subject.max} {...field("subject")} />
        {errors.subject && (
          <p className="field-error" id={`${uid}-subject-error`}>
            {errors.subject}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${uid}-message`}>
          Message <span aria-hidden="true">*</span>
        </label>
        <textarea
          required
          rows={7}
          maxLength={CONTACT_LIMITS.message.max}
          {...field("message")}
          aria-describedby={
            errors.message ? `${uid}-message-hint ${uid}-message-error` : `${uid}-message-hint`
          }
        />
        <p className="hint" id={`${uid}-message-hint`}>
          At least {CONTACT_LIMITS.message.min} characters. Do not include passwords, identity documents or payment
          details.
        </p>
        {errors.message && (
          <p className="field-error" id={`${uid}-message-error`}>
            {errors.message}
          </p>
        )}
      </div>

      {/* Honeypot: hidden from people, filled by bots. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor={`${uid}-website`}>Website</label>
        <input
          id={`${uid}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div className="form-actions">
        <button className="btn" type="submit" disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "Sending…" : "Send message"}
        </button>
        <p className="example" style={{ margin: 0 }}>
          By sending this form you agree to the{" "}
          <a href="/privacy">privacy notice</a> and the <a href="/terms">terms of use</a>.
        </p>
      </div>

      {state.kind === "failed" && (
        <p className="status" role="alert">
          {state.message}
        </p>
      )}
      <div role="status" aria-live="polite">
        {state.kind === "sending" && <p className="example">Sending your message…</p>}
      </div>
    </form>
  );
}
