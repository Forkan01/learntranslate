/**
 * A single magic-link email should only be requested after the browser's
 * existing server session has been checked conclusively.
 * Invalid responses, service outages, or ambiguous status MUST NOT send mail.
 */
export function decideMagicLinkEmailSend(httpStatus, result) {
  if (httpStatus !== 200 || !result || typeof result !== "object" ||
      Array.isArray(result) || typeof result.signedIn !== "boolean")
    return "uncertain";
  return result.signedIn ? "already-signed-in" : "may-send";
}
