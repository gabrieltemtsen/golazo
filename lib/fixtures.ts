/**
 * World Cup 2026 — Round of 32 (live fixtures, June 28 – 30).
 *
 * `ref` is the canonical fixture id; matchId on-chain is keccak256(utf8(ref)),
 * computed identically here and in scripts/openMatches.ts so the app and the
 * contract never drift. Only confirmed Round-of-32 matchups are listed; later
 * fixtures are added once the bracket sets. The contract only cares about
 * ref + kickoff + signed result, never these labels.
 *
 * Kickoffs are in UTC.
 */
export type Team = { name: string; flag: string; code: string };

export type Fixture = {
  ref: string;
  home: Team;
  away: Team;
  venue: string;
  kickoff: string; // ISO (UTC)
  group: string;
};

const T = (name: string, flag: string, code: string): Team => ({ name, flag, code });

export const FIXTURES: Fixture[] = [
  {
    ref: 'WC2026-R32-RSACAN',
    home: T('South Africa', '🇿🇦', 'RSA'),
    away: T('Canada', '🇨🇦', 'CAN'),
    venue: 'Inglewood',
    kickoff: '2026-06-28T19:00:00Z',
    group: 'Round of 32',
  },
  {
    ref: 'WC2026-R32-BRAJPN',
    home: T('Brazil', '🇧🇷', 'BRA'),
    away: T('Japan', '🇯🇵', 'JPN'),
    venue: 'Houston',
    kickoff: '2026-06-29T17:00:00Z',
    group: 'Round of 32',
  },
  {
    ref: 'WC2026-R32-GERPAR',
    home: T('Germany', '🇩🇪', 'GER'),
    away: T('Paraguay', '🇵🇾', 'PAR'),
    venue: 'Foxborough',
    kickoff: '2026-06-29T20:30:00Z',
    group: 'Round of 32',
  },
  {
    ref: 'WC2026-R32-NEDMAR',
    home: T('Netherlands', '🇳🇱', 'NED'),
    away: T('Morocco', '🇲🇦', 'MAR'),
    venue: 'Monterrey',
    kickoff: '2026-06-30T01:00:00Z',
    group: 'Round of 32',
  },
  {
    ref: 'WC2026-R32-CIVNOR',
    home: T('Ivory Coast', '🇨🇮', 'CIV'),
    away: T('Norway', '🇳🇴', 'NOR'),
    venue: 'Arlington',
    kickoff: '2026-06-30T17:00:00Z',
    group: 'Round of 32',
  },
  {
    ref: 'WC2026-R32-FRASWE',
    home: T('France', '🇫🇷', 'FRA'),
    away: T('Sweden', '🇸🇪', 'SWE'),
    venue: 'East Rutherford',
    kickoff: '2026-06-30T20:30:00Z',
    group: 'Round of 32',
  },
];

export function fixtureByRef(ref: string): Fixture | undefined {
  return FIXTURES.find((f) => f.ref === ref);
}
