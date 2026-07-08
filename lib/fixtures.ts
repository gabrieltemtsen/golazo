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
  {
    ref: 'WC2026-R32-USABIH',
    home: T('USA', '🇺🇸', 'USA'),
    away: T('Bosnia & Herzegovina', '🇧🇦', 'BIH'),
    venue: 'Santa Clara',
    kickoff: '2026-07-02T00:00:00Z',
    group: 'Round of 32',
  },
  {
    ref: 'WC2026-R32-ESPAUT',
    home: T('Spain', '🇪🇸', 'ESP'),
    away: T('Austria', '🇦🇹', 'AUT'),
    venue: 'Inglewood',
    kickoff: '2026-07-02T19:00:00Z',
    group: 'Round of 32',
  },
  {
    ref: 'WC2026-R32-PORCRO',
    home: T('Portugal', '🇵🇹', 'POR'),
    away: T('Croatia', '🇭🇷', 'CRO'),
    venue: 'Toronto',
    kickoff: '2026-07-02T23:00:00Z',
    group: 'Round of 32',
  },
  {
    ref: 'WC2026-R32-SUIALG',
    home: T('Switzerland', '🇨🇭', 'SUI'),
    away: T('Algeria', '🇩🇿', 'ALG'),
    venue: 'Vancouver',
    kickoff: '2026-07-03T03:00:00Z',
    group: 'Round of 32',
  },
  {
    ref: 'WC2026-R32-AUSEGY',
    home: T('Australia', '🇦🇺', 'AUS'),
    away: T('Egypt', '🇪🇬', 'EGY'),
    venue: 'Arlington',
    kickoff: '2026-07-03T18:00:00Z',
    group: 'Round of 32',
  },
  {
    ref: 'WC2026-R32-ARGCPV',
    home: T('Argentina', '🇦🇷', 'ARG'),
    away: T('Cape Verde', '🇨🇻', 'CPV'),
    venue: 'Miami',
    kickoff: '2026-07-03T22:00:00Z',
    group: 'Round of 32',
  },
  {
    ref: 'WC2026-R32-COLGHA',
    home: T('Colombia', '🇨🇴', 'COL'),
    away: T('Ghana', '🇬🇭', 'GHA'),
    venue: 'Kansas City',
    kickoff: '2026-07-04T01:30:00Z',
    group: 'Round of 32',
  },
  {
    ref: 'WC2026-R16-CANMAR',
    home: T('Canada', '🇨🇦', 'CAN'),
    away: T('Morocco', '🇲🇦', 'MAR'),
    venue: 'Houston',
    kickoff: '2026-07-04T17:00:00Z',
    group: 'Round of 16',
  },
  {
    ref: 'WC2026-R16-BRANOR',
    home: T('Brazil', '🇧🇷', 'BRA'),
    away: T('Norway', '🇳🇴', 'NOR'),
    venue: 'East Rutherford',
    kickoff: '2026-07-04T20:00:00Z',
    group: 'Round of 16',
  },
  {
    ref: 'WC2026-R16-PARFRA',
    home: T('Paraguay', '🇵🇾', 'PAR'),
    away: T('France', '🇫🇷', 'FRA'),
    venue: 'Philadelphia',
    kickoff: '2026-07-04T21:00:00Z',
    group: 'Round of 16',
  },
  {
    ref: 'WC2026-R16-MEXENG',
    home: T('Mexico', '🇲🇽', 'MEX'),
    away: T('England', '🏴', 'ENG'),
    venue: 'Mexico City',
    kickoff: '2026-07-05T00:00:00Z',
    group: 'Round of 16',
  },
  {
    ref: 'WC2026-R16-PORESP',
    home: T('Portugal', '🇵🇹', 'POR'),
    away: T('Spain', '🇪🇸', 'ESP'),
    venue: 'Dallas',
    kickoff: '2026-07-05T19:00:00Z',
    group: 'Round of 16',
  },
  {
    ref: 'WC2026-R16-USABEL',
    home: T('USA', '🇺🇸', 'USA'),
    away: T('Belgium', '🇧🇪', 'BEL'),
    venue: 'Seattle',
    kickoff: '2026-07-06T00:00:00Z',
    group: 'Round of 16',
  },
  {
    ref: 'WC2026-R16-ARGEGY',
    home: T('Argentina', '🇦🇷', 'ARG'),
    away: T('Egypt', '🇪🇬', 'EGY'),
    venue: 'Atlanta',
    kickoff: '2026-07-05T16:00:00Z',
    group: 'Round of 16',
  },
  {
    ref: 'WC2026-R16-SUICOL',
    home: T('Switzerland', '🇨🇭', 'SUI'),
    away: T('Colombia', '🇨🇴', 'COL'),
    venue: 'Vancouver',
    kickoff: '2026-07-05T20:00:00Z',
    group: 'Round of 16',
  },
  {
    ref: 'WC2026-QF-FRAMAR',
    home: T('France', '🇫🇷', 'FRA'),
    away: T('Morocco', '🇲🇦', 'MAR'),
    venue: 'Foxborough',
    kickoff: '2026-07-09T20:00:00Z',
    group: 'Quarter-final',
  },
  {
    ref: 'WC2026-QF-ESPBEL',
    home: T('Spain', '🇪🇸', 'ESP'),
    away: T('Belgium', '🇧🇪', 'BEL'),
    venue: 'Inglewood',
    kickoff: '2026-07-10T19:00:00Z',
    group: 'Quarter-final',
  },
  {
    ref: 'WC2026-QF-NORENG',
    home: T('Norway', '🇳🇴', 'NOR'),
    away: T('England', '🏴', 'ENG'),
    venue: 'Miami',
    kickoff: '2026-07-11T21:00:00Z',
    group: 'Quarter-final',
  },
  {
    ref: 'WC2026-QF-ARGSUI',
    home: T('Argentina', '🇦🇷', 'ARG'),
    away: T('Switzerland', '🇨🇭', 'SUI'),
    venue: 'Kansas City',
    kickoff: '2026-07-12T01:00:00Z',
    group: 'Quarter-final',
  },
];

export function fixtureByRef(ref: string): Fixture | undefined {
  return FIXTURES.find((f) => f.ref === ref);
}
