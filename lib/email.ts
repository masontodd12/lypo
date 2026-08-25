/**
 * Who notification email comes from.
 *
 * resend.dev is Resend's shared testing domain: it only ever delivers to the
 * address that owns the Resend account. Every form notification sent to a
 * site owner from it is silently dropped, which looks exactly like nobody
 * filling the form in.
 *
 * Set RESEND_FROM to an address on a domain verified in Resend, for example
 * "Lypo <notifications@lypo.dev>". The test domain stays as the fallback so
 * local development still works without any DNS.
 */
export const RESEND_FROM =
  process.env.RESEND_FROM || "Lypo <notifications@resend.dev>";

/** Whether mail will actually reach anyone other than the account owner. */
export const RESEND_FROM_IS_TEST = /resend\.dev/.test(RESEND_FROM);
