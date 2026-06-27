/**
 * World Cup 2026 — Round of 32 fixtures (June 28 – July 3).
 *
 * `ref` is the canonical fixture id; matchId on-chain is keccak256(utf8(ref)),
 * computed identically here and in scripts/openMatches.ts so the app and the
 * contract never drift. Teams are seeded for the demo and reconciled to the
 * official bracket by the oracle as group results finalise — the contract only
 * cares about ref + kickoff + result, never the labels.
 */
export type Team = { name: string; flag: string; code: string };

export type Fixture = {
  ref: string;
  home: Team;
  away: Team;
  venue: string;
  kickoff: string; // ISO
  group: string;
};

const T = (name: string, flag: string, code: string): Team => ({ name, flag, code });

export const FIXTURES: Fixture[] = [
  {
    ref: 'WC2026-R32-M01',
    home: T('Argentina', '🇦🇷', 'ARG'),
    away: T('Uzbekistan', '🇺🇿', 'UZB'),
    venue: 'Dallas',
    kickoff: '2026-06-28T16:00:00Z',
    group: 'Winner J vs Runner-up K',
  },
  {
    ref: 'WC2026-R32-M02',
    home: T('Spain', '🇪🇸', 'ESP'),
    away: T('Ghana', '🇬🇭', 'GHA'),
    venue: 'Los Angeles',
    kickoff: '2026-06-28T20:00:00Z',
    group: 'Winner H vs Runner-up L',
  },
  {
    ref: 'WC2026-R32-M03',
    home: T('France', '🇫🇷', 'FRA'),
    away: T('Croatia', '🇭🇷', 'CRO'),
    venue: 'Atlanta',
    kickoff: '2026-06-29T16:00:00Z',
    group: 'Winner I vs Runner-up L',
  },
  {
    ref: 'WC2026-R32-M04',
    home: T('Portugal', '🇵🇹', 'POR'),
    away: T('Egypt', '🇪🇬', 'EGY'),
    venue: 'Miami',
    kickoff: '2026-06-29T20:00:00Z',
    group: 'Winner K vs Runner-up G',
  },
  {
    ref: 'WC2026-R32-M05',
    home: T('Belgium', '🇧🇪', 'BEL'),
    away: T('Iran', '🇮🇷', 'IRN'),
    venue: 'Seattle',
    kickoff: '2026-06-30T16:00:00Z',
    group: 'Winner G vs Runner-up J',
  },
  {
    ref: 'WC2026-R32-M06',
    home: T('England', '🏴', 'ENG'),
    away: T('Senegal', '🇸🇳', 'SEN'),
    venue: 'New York / NJ',
    kickoff: '2026-06-30T20:00:00Z',
    group: 'Winner L vs Runner-up E',
  },
  {
    ref: 'WC2026-R32-M07',
    home: T('Brazil', '🇧🇷', 'BRA'),
    away: T('Norway', '🇳🇴', 'NOR'),
    venue: 'Kansas City',
    kickoff: '2026-07-01T16:00:00Z',
    group: 'Winner C vs Runner-up A',
  },
  {
    ref: 'WC2026-R32-M08',
    home: T('USA', '🇺🇸', 'USA'),
    away: T('Mexico', '🇲🇽', 'MEX'),
    venue: 'Inglewood',
    kickoff: '2026-07-01T20:00:00Z',
    group: 'Winner D vs Runner-up B',
  },
  {
    ref: 'WC2026-R32-M09',
    home: T('Germany', '🇩🇪', 'GER'),
    away: T('Cabo Verde', '🇨🇻', 'CPV'),
    venue: 'Philadelphia',
    kickoff: '2026-07-02T16:00:00Z',
    group: 'Winner F vs Runner-up H',
  },
  {
    ref: 'WC2026-R32-M10',
    home: T('Netherlands', '🇳🇱', 'NED'),
    away: T('Japan', '🇯🇵', 'JPN'),
    venue: 'Houston',
    kickoff: '2026-07-02T20:00:00Z',
    group: 'Winner E vs Runner-up I',
  },
  {
    ref: 'WC2026-R32-M11',
    home: T('Colombia', '🇨🇴', 'COL'),
    away: T('Austria', '🇦🇹', 'AUT'),
    venue: 'Toronto',
    kickoff: '2026-07-03T16:00:00Z',
    group: 'Winner K vs Runner-up F',
  },
  {
    ref: 'WC2026-R32-M12',
    home: T('Morocco', '🇲🇦', 'MAR'),
    away: T('Uruguay', '🇺🇾', 'URU'),
    venue: 'Guadalajara',
    kickoff: '2026-07-03T20:00:00Z',
    group: 'Winner B vs Runner-up H',
  },
];

export function fixtureByRef(ref: string): Fixture | undefined {
  return FIXTURES.find((f) => f.ref === ref);
}
