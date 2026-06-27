/**
 * Circles host helpers. The Circles app embeds a mini app via the playground:
 *   https://circles.gnosis.io/playground?url=<your-app-url>
 * We wrap our invite links through it so a tapped invite opens Golazo already
 * inside the Circles host, ready to create/connect a wallet in one tap.
 */
export const CIRCLES_PLAYGROUND = 'https://circles.gnosis.io/playground';

export function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
}

/** Invite link: opens Golazo embedded in Circles, carrying the referrer. */
export function inviteLink(referrer: string): string {
  const target = `${appUrl()}?ref=${referrer}`;
  return `${CIRCLES_PLAYGROUND}?url=${encodeURIComponent(target)}`;
}
