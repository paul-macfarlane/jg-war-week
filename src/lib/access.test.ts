import { describe, expect, it } from "vitest";

import {
  type Actor,
  type OrganizerListAction,
  type SelfAction,
  type WarWeekAction,
  adminEditions,
  can,
  canUseMcp,
  defaultAdminWarWeek,
  isJahnelGroupEmail,
  isPublicPath,
  safeCallbackPath,
} from "@/lib/access";
import { type AttemptLogFacet, NOT_YOURS } from "@/lib/best-score/log-rule";
import {
  ENROLL_CLOSED_BUILT,
  ENROLL_OFF,
  type EnrollFacet,
} from "@/lib/bracket/enroll-rule";
import {
  ALREADY_CHECKED_IN,
  CHECK_IN_OFF,
  type CheckInFacet,
  MARKED_BY_HOST,
  NOT_CHECKED_IN,
  NOT_PARTICIPATION,
  PARTICIPATION_CLOSED,
  notOnATeam,
} from "@/lib/participation/check-in-rule";
import {
  COMPETITION_CLOSED,
  NOT_AN_ENTRANT,
  NOT_A_PLAYER,
  NOT_LINKED,
  SELF_REPORT_OFF,
  type SeriesLogFacet,
} from "@/lib/series/log-rule";

describe("isJahnelGroupEmail", () => {
  it.each([
    "pmacfarlane@jahnelgroup.com",
    "PMacfarlane@JahnelGroup.com",
    "  someone@jahnelgroup.com  ",
    "first.last+tag@jahnelgroup.com",
  ])("accepts %j", (email) => {
    expect(isJahnelGroupEmail(email)).toBe(true);
  });

  it.each([
    "someone@gmail.com",
    "someone@jahnelgroup.co",
    "someone@evil-jahnelgroup.com",
    "someone@jahnelgroup.com.evil.com",
    "someone@mail.jahnelgroup.com",
    "a@evil.com@jahnelgroup.com",
    "jahnelgroup.com",
    "@jahnelgroup.com",
    "someone@",
    "",
    null,
    undefined,
  ])("rejects %j", (email) => {
    expect(isJahnelGroupEmail(email)).toBe(false);
  });
});

// War Week XI holds Catan and MTG; War Week XII holds its own Catan.
const XI = "war-week-xi";
const XII = "war-week-xii";
const CATAN = "catan-xi";
const MTG = "mtg-xi";
const CATAN_XII = "catan-xii";

const ACTORS = {
  organizer: {
    email: "jason@jahnelgroup.com",
    isOrganizer: true,
    hosts: [],
  },
  host: {
    email: "tony@jahnelgroup.com",
    isOrganizer: false,
    hosts: [{ competitionId: CATAN, warWeekId: XI }],
  },
  otherHost: {
    email: "tom@jahnelgroup.com",
    isOrganizer: false,
    hosts: [{ competitionId: MTG, warWeekId: XI }],
  },
  namesakeHost: {
    email: "casey@jahnelgroup.com",
    isOrganizer: false,
    hosts: [{ competitionId: CATAN_XII, warWeekId: XII }],
  },
  participant: {
    email: "someone@jahnelgroup.com",
    isOrganizer: false,
    hosts: [],
  },
  anonymous: null,
} satisfies Record<string, Actor>;

type ActorName = keyof typeof ACTORS;

const SIGN_IN = "Sign in to continue.";
const NOT_HOST = "You're not a Host of that Competition.";

/** Expected results per actor; `null` means allowed. */
type Expected = Record<ActorName, string | null>;

/** Only an Organizer may: everyone else signed in gets `message`. */
const organizerOnly = (message: string): Expected => ({
  organizer: null,
  host: message,
  otherHost: message,
  namesakeHost: message,
  participant: message,
  anonymous: SIGN_IN,
});

/** An Organizer, or the Host of Catan in XI. */
const catanHostOr = (refusal: string = NOT_HOST): Expected => ({
  organizer: null,
  host: null,
  otherHost: refusal,
  namesakeHost: refusal,
  participant: refusal,
  anonymous: SIGN_IN,
});

function cases(
  rows: [WarWeekAction, Parameters<typeof can>[2], Expected][],
): [
  string,
  WarWeekAction,
  Parameters<typeof can>[2],
  ActorName,
  string | null,
][] {
  return rows.flatMap(([action, target, expected]) =>
    (Object.keys(ACTORS) as ActorName[]).map(
      (actor) =>
        [
          `${action} ${JSON.stringify(target)} as ${actor}`,
          action,
          target,
          actor,
          expected[actor],
        ] as [
          string,
          WarWeekAction,
          Parameters<typeof can>[2],
          ActorName,
          string | null,
        ],
    ),
  );
}

describe("can: the Organizer list", () => {
  it.each<[OrganizerListAction, string]>([
    ["organizers.view", "Only an Organizer can see the Organizer list."],
    ["organizers.add", "Only an Organizer can add an Organizer."],
    ["organizers.remove", "Only an Organizer can remove an Organizer."],
  ])("%s is Organizer-only", (action, message) => {
    const expected = organizerOnly(message);
    for (const name of Object.keys(ACTORS) as ActorName[]) {
      expect(can(ACTORS[name], action), name).toBe(expected[name]);
    }
  });
});

describe("can: self actions (your own Profile and account)", () => {
  it.each<SelfAction>(["profile.save", "account.delete"])(
    "%s is allowed for anyone signed in, Organizer or not",
    (action) => {
      for (const name of Object.keys(ACTORS) as ActorName[]) {
        expect(can(ACTORS[name], action), name).toBe(
          name === "anonymous" ? SIGN_IN : null,
        );
      }
    },
  );

  it.each<SelfAction>(["profile.save", "account.delete"])(
    "%s is refused to a non-JG session",
    (action) => {
      expect(
        can(
          { email: "someone@example.com", isOrganizer: false, hosts: [] },
          action,
        ),
      ).toBe(SIGN_IN);
      expect(
        can(
          {
            email: "jason@jahnelgroup.com.evil.example",
            isOrganizer: true,
            hosts: [],
          },
          action,
        ),
      ).toBe(SIGN_IN);
    },
  );
});

describe("can: Organizer-only War Week families", () => {
  const xi = { warWeekId: XI, competitionId: CATAN };
  it.each(
    cases(
      (
        [
          ["settings.save", "change War Week settings"],
          ["lifecycle.start", "start a War Week"],
          ["lifecycle.end", "end a War Week"],
          ["lifecycle.reopen", "reopen a War Week"],
          ["lifecycle.unstart", "unstart a War Week"],
          ["lifecycle.create-next", "create the next War Week"],
          ["day.create", "add Days"],
          ["day.edit", "change Days"],
          ["day.delete", "delete Days"],
          ["team.create", "add Teams"],
          ["team.edit", "change Teams"],
          ["team.delete", "delete Teams"],
          ["participant.create", "add Participants"],
          ["participant.edit", "change Participants"],
          ["participant.delete", "delete Participants"],
          ["participant.import", "import Participants"],
          ["faq-item.create", "add FAQ Items"],
          ["faq-item.edit", "change FAQ Items"],
          ["faq-item.delete", "delete FAQ Items"],
          ["faq-item.move", "move FAQ Items"],
          ["finale-slide.move", "reorder Finale slides"],
          ["finale-slide.hide", "hide Finale slides"],
          ["finale-slide.create", "add Custom Finale slides"],
          ["finale-slide.update", "change Custom Finale slides"],
          ["finale-slide.delete", "delete Custom Finale slides"],
          ["award.create", "give Awards"],
          ["award.edit", "change Awards"],
          ["award.delete", "delete Awards"],
          ["competition.create", "add Competitions"],
          ["competition.delete", "delete Competitions"],
          ["competition.assign-hosts", "assign Hosts"],
          ["announcement.pin", "pin Announcements"],
          ["announcement.unpin", "unpin Announcements"],
        ] as [WarWeekAction, string][]
      ).map(([action, what]) => [
        action,
        xi,
        organizerOnly(`Only an Organizer can ${what}.`),
      ]),
    ),
  )("%s", (_, action, target, actor, expected) => {
    expect(can(ACTORS[actor], action, target)).toBe(expected);
  });
});

describe("can: a Competition's setup and Bracket", () => {
  it.each(
    cases(
      (
        [
          "competition.edit",
          "bracket.entrants",
          "bracket.generate",
          "bracket.match-result",
          "bracket.close",
          "bracket.reopen",
        ] as WarWeekAction[]
      ).map((action) => [
        action,
        { warWeekId: XI, competitionId: CATAN },
        catanHostOr(),
      ]),
    ),
  )("%s", (_, action, target, actor, expected) => {
    expect(can(ACTORS[actor], action, target)).toBe(expected);
  });

  it("refuses a Host whose Competition id is claimed for another War Week", () => {
    expect(
      can(ACTORS.host, "competition.edit", {
        warWeekId: XII,
        competitionId: CATAN,
      }),
    ).toBe(NOT_HOST);
  });
});

describe("can: Squads and the self-report toggle", () => {
  it.each(
    cases(
      (
        [
          "bracket.squads",
          "competition.self-report",
          "bracket.match-result",
        ] as WarWeekAction[]
      ).map((action) => [
        action,
        { warWeekId: XI, competitionId: CATAN },
        catanHostOr(),
      ]),
    ),
  )("%s", (_, action, target, actor, expected) => {
    expect(can(ACTORS[actor], action, target)).toBe(expected);
  });
});

describe("can: reporting a Match's result (self-report)", () => {
  const RED = "team-red";
  const BLUE = "team-blue";
  const RED_ALPHA = "squad-red-alpha";
  const RED_BRAVO = "squad-red-bravo";
  const ME = "participant-me";
  const OFF = "Self-report is off for this Competition.";
  const NOT_LINKED =
    "Your sign-in doesn't match a Participant of this War Week.";
  const NOT_IN_MATCH = "You're not in this Match.";
  const ADMIN = "Organizers and Hosts only.";

  type Facet = NonNullable<
    NonNullable<Parameters<typeof can>[2]>["matchReport"]
  >;
  const teamMatch = [
    { teamId: RED, participantId: null, squadId: null },
    { teamId: BLUE, participantId: null, squadId: null },
  ];
  const sameTeamSquadMatch = [
    { teamId: null, participantId: null, squadId: RED_ALPHA },
    { teamId: null, participantId: null, squadId: RED_BRAVO },
  ];
  const linkedRed = { participantId: ME, teamId: RED, squadId: null };
  /** An open Red vs Blue Match of Catan, self-report on, linked to Red. */
  const facet = (over: Partial<Facet> = {}): Facet => ({
    selfReport: true,
    match: "open",
    linked: linkedRed,
    entrants: teamMatch,
    ...over,
  });
  const target = (over: Partial<Facet> = {}) => ({
    warWeekId: XI,
    competitionId: CATAN,
    matchReport: facet(over),
  });

  it.each<[string, Partial<Facet>, string | null]>([
    ["self-report off", { selfReport: false }, OFF],
    ["not linked to any Participant", { linked: null }, NOT_LINKED],
    [
      "linked but on none of the Entrants",
      { linked: { participantId: ME, teamId: "team-gold", squadId: null } },
      NOT_IN_MATCH,
    ],
    [
      "linked as the Participant Entrant",
      {
        linked: { participantId: ME, teamId: null, squadId: null },
        entrants: [
          { teamId: null, participantId: ME, squadId: null },
          { teamId: null, participantId: "participant-other", squadId: null },
        ],
      },
      null,
    ],
    ["linked through their Team", {}, null],
    [
      "linked through their Squad",
      {
        linked: { participantId: ME, teamId: RED, squadId: RED_ALPHA },
        entrants: [
          { teamId: null, participantId: null, squadId: RED_ALPHA },
          { teamId: null, participantId: null, squadId: "squad-blue-alpha" },
        ],
      },
      null,
    ],
    [
      "on the Squads' Team but in neither Squad of Red Alpha vs Red Bravo",
      { linked: linkedRed, entrants: sameTeamSquadMatch },
      NOT_IN_MATCH,
    ],
    [
      "in the opposing same-Team Squad (Red Bravo) of Red Alpha vs Red Bravo",
      {
        linked: { participantId: ME, teamId: RED, squadId: RED_BRAVO },
        entrants: sameTeamSquadMatch,
      },
      null,
    ],
    ["a decided Match, to edit it (D1d)", { match: "decided" }, null],
    [
      "a Match whose result a later Match used (D1c)",
      { match: "used-later" },
      "A later Match already used this result. Change that Match first.",
    ],
    [
      "an unfilled Match",
      { match: "unfilled" },
      "This Match is still waiting for its Entrants.",
    ],
    ["a bye", { match: "bye" }, "A bye isn't played."],
    [
      "a missing Match",
      { match: "missing", entrants: [] },
      "That Match no longer exists.",
    ],
  ])("a Participant: %s", (_, over, expected) => {
    expect(can(ACTORS.participant, "bracket.match-report", target(over))).toBe(
      expected,
    );
  });

  it("refuses an anonymous visitor", () => {
    expect(can(null, "bracket.match-report", target())).toBe(SIGN_IN);
  });

  it("refuses a non-JG email even with a matching linked Participant", () => {
    const outsider = {
      email: "someone@gmail.com",
      isOrganizer: false,
      hosts: [],
    };
    // The facet alone would allow it: the domain rule refuses, not linkage.
    expect(
      can(ACTORS.participant, "bracket.match-report", target()),
    ).toBeNull();
    expect(can(outsider, "bracket.match-report", target())).toBe(SIGN_IN);
  });

  it("refuses when the Match facts weren't loaded, whoever asks", () => {
    for (const actor of [ACTORS.participant, ACTORS.organizer, ACTORS.host]) {
      expect(
        can(actor, "bracket.match-report", {
          warWeekId: XI,
          competitionId: CATAN,
        }),
      ).toBe(ADMIN);
    }
  });

  it("binds an Organizer and the Host by the Match facts too", () => {
    for (const actor of [ACTORS.organizer, ACTORS.host]) {
      expect(can(actor, "bracket.match-report", target({ linked: null }))).toBe(
        NOT_LINKED,
      );
      expect(
        can(actor, "bracket.match-report", target({ match: "used-later" })),
      ).toBe(
        "A later Match already used this result. Change that Match first.",
      );
      expect(
        can(actor, "bracket.match-report", target({ selfReport: false })),
      ).toBe(OFF);
      expect(can(actor, "bracket.match-report", target())).toBeNull();
    }
  });

  it("never lets a Participant in the Match change a result or the toggle", () => {
    // The facet says they're in this open Match; the direct paths ignore it.
    for (const action of [
      "bracket.match-result",
      "competition.self-report",
      "bracket.squads",
    ] as WarWeekAction[]) {
      expect(can(ACTORS.participant, action, target())).toBe(NOT_HOST);
      expect(can(ACTORS.otherHost, action, target())).toBe(NOT_HOST);
      expect(can(ACTORS.host, action, target())).toBeNull();
      expect(can(ACTORS.organizer, action, target())).toBeNull();
    }
  });
});

describe("can: running a Head-to-head or Best score Competition and the enroll switch", () => {
  it.each(
    cases(
      (
        [
          "results.close",
          "results.reopen",
          "competition.self-enroll",
        ] as WarWeekAction[]
      ).map((action) => [
        action,
        { warWeekId: XI, competitionId: CATAN },
        catanHostOr(),
      ]),
    ),
  )("%s", (_, action, target, actor, expected) => {
    expect(can(ACTORS[actor], action, target)).toBe(expected);
  });
});

describe("can: logging, editing and deleting a Head-to-head Match (ADR 0011)", () => {
  const ME = "participant-me";
  const RIVAL = "participant-rival";
  const THIRD = "participant-third";
  const ADMIN = "Organizers and Hosts only.";
  const player = (participantId: string) => ({ teamId: null, participantId });

  type Facet = SeriesLogFacet;
  /** Open, individual scoring; I'm an Entrant, a player, and logged the Match. */
  const facet = (over: Partial<Facet> = {}): Facet => ({
    runs: false,
    closed: false,
    selfReport: true,
    decided: false,
    played: 0,
    bestOf: 3,
    linked: { participantId: ME, teamId: null },
    scoring: "individual",
    entrants: [player(ME), player(RIVAL)],
    players: [player(ME), player(RIVAL)],
    match: { players: [player(ME), player(RIVAL)] },
    ...over,
  });
  const target = (over: Partial<Facet> = {}) => ({
    warWeekId: XI,
    competitionId: CATAN,
    seriesLog: facet(over),
  });
  const writes = ["series.log", "series.edit", "series.delete"] as const;

  it("lets a linked Participant who is a player log the Match", () => {
    expect(can(ACTORS.participant, "series.log", target())).toBeNull();
  });

  it("no linked Participant grants nothing", () => {
    for (const action of writes) {
      expect(
        can(ACTORS.participant, action, target({ linked: null })),
        action,
      ).toBe(NOT_LINKED);
    }
  });

  it("refuses a Participant who isn't an Entrant, and a non-Entrant posted", () => {
    expect(
      can(
        ACTORS.participant,
        "series.log",
        target({ linked: { participantId: THIRD, teamId: null } }),
      ),
    ).toBe(NOT_A_PLAYER);
    expect(
      can(
        ACTORS.participant,
        "series.log",
        target({ players: [player(ME), player(THIRD)] }),
      ),
    ).toBe(NOT_AN_ENTRANT);
  });

  it("lets the logger edit or delete their own Match until close", () => {
    expect(can(ACTORS.participant, "series.edit", target())).toBeNull();
    expect(
      can(ACTORS.participant, "series.delete", target({ players: [] })),
    ).toBeNull();
    for (const action of ["series.edit", "series.delete"] as const) {
      expect(
        can(ACTORS.participant, action, target({ closed: true })),
        action,
      ).toBe(COMPETITION_CLOSED);
    }
  });

  it("with self-report off, refuses a player every write", () => {
    for (const action of writes) {
      expect(
        can(ACTORS.participant, action, target({ selfReport: false })),
        action,
      ).toBe(SELF_REPORT_OFF);
    }
  });

  it("lets a Host or Organizer who runs it log, edit or delete any Match, with self-report off", () => {
    const match = { players: [player(RIVAL), player(THIRD)] };
    for (const actor of [ACTORS.organizer, ACTORS.host]) {
      for (const action of writes) {
        expect(
          can(
            actor,
            action,
            target({ runs: true, linked: null, match, selfReport: false }),
          ),
          action,
        ).toBeNull();
      }
    }
  });

  it("a closed Competition refuses everyone, an Organizer included", () => {
    for (const actor of [ACTORS.organizer, ACTORS.host, ACTORS.participant]) {
      for (const action of writes) {
        expect(
          can(actor, action, target({ runs: true, closed: true })),
          action,
        ).toBe(COMPETITION_CLOSED);
      }
    }
  });

  it("binds an Organizer by the facet: `runs` is the caller's to load", () => {
    expect(
      can(
        ACTORS.organizer,
        "series.log",
        target({ linked: null, runs: false }),
      ),
    ).toBe(NOT_LINKED);
  });

  it("refuses when the Match facts weren't loaded, whoever asks", () => {
    for (const actor of [ACTORS.participant, ACTORS.organizer, ACTORS.host]) {
      for (const action of writes) {
        expect(
          can(actor, action, { warWeekId: XI, competitionId: CATAN }),
          action,
        ).toBe(ADMIN);
      }
    }
  });

  it("refuses an anonymous visitor and a non-JG email", () => {
    const outsider = {
      email: "someone@gmail.com",
      isOrganizer: false,
      hosts: [],
    };
    for (const action of writes) {
      expect(can(null, action, target()), action).toBe(SIGN_IN);
      expect(can(outsider, action, target()), action).toBe(SIGN_IN);
    }
  });

  it("never lets a player close or reopen it", () => {
    for (const action of [
      "results.close",
      "results.reopen",
    ] as WarWeekAction[]) {
      expect(can(ACTORS.participant, action, target()), action).toBe(NOT_HOST);
    }
  });
});

describe("can: logging, editing and deleting a Best score Attempt (ADR 0011)", () => {
  const ME = "participant-me";
  const RIVAL = "participant-rival";
  const ADMIN = "Organizers and Hosts only.";

  /** Open, individual scoring; I'm linked, posting and owning my Attempt. */
  const facet = (over: Partial<AttemptLogFacet> = {}): AttemptLogFacet => ({
    runs: false,
    closed: false,
    selfReport: true,
    linked: { participantId: ME, teamId: null },
    scoring: "individual",
    participantId: ME,
    attempt: { participantId: ME },
    maxAttempts: null,
    attemptsSoFar: 0,
    ...over,
  });
  const target = (over: Partial<AttemptLogFacet> = {}) => ({
    warWeekId: XI,
    competitionId: CATAN,
    attemptLog: facet(over),
  });
  const writes = ["attempts.log", "attempts.edit", "attempts.delete"] as const;

  it("lets a linked Participant log, edit and delete their own Attempt", () => {
    for (const action of writes) {
      expect(can(ACTORS.participant, action, target()), action).toBeNull();
    }
  });

  it("refuses an Attempt for someone else, and someone else's Attempt", () => {
    expect(
      can(ACTORS.participant, "attempts.log", target({ participantId: RIVAL })),
    ).toBe(NOT_YOURS);
    expect(
      can(
        ACTORS.participant,
        "attempts.edit",
        target({ attempt: { participantId: RIVAL } }),
      ),
    ).toBe(NOT_YOURS);
  });

  it("lets a Host or Organizer who runs it log for anyone, until Closed", () => {
    for (const actor of [ACTORS.organizer, ACTORS.host]) {
      for (const action of writes) {
        expect(
          can(
            actor,
            action,
            target({ runs: true, linked: null, participantId: RIVAL }),
          ),
          action,
        ).toBeNull();
        expect(
          can(actor, action, target({ runs: true, closed: true })),
          action,
        ).toBe(COMPETITION_CLOSED);
      }
    }
  });

  it("refuses when the Attempt facts weren't loaded, and an anonymous visitor", () => {
    for (const action of writes) {
      expect(
        can(ACTORS.organizer, action, { warWeekId: XI, competitionId: CATAN }),
        action,
      ).toBe(ADMIN);
      expect(can(null, action, target()), action).toBe(SIGN_IN);
    }
  });
});

describe("can: enrolling and withdrawing (ADR 0006)", () => {
  const ME = "participant-me";
  const RED = "team-red";
  const ADMIN = "Organizers and Hosts only.";

  type Facet = EnrollFacet;
  /** An individual Bracket, switch on, open; I'm linked and not entered. */
  const facet = (over: Partial<Facet> = {}): Facet => ({
    format: "bracket",
    selfEnroll: true,
    closed: false,
    built: false,
    entrantLimit: null,
    entrantCount: 0,
    scoring: "individual",
    linked: { participantId: ME, teamId: RED, squadId: null },
    entrants: [],
    hasSquads: false,
    squad: null,
    ...over,
  });
  const entered = { entrants: [{ teamId: null, participantId: ME }] };
  const target = (over: Partial<Facet> = {}) => ({
    warWeekId: XI,
    competitionId: CATAN,
    enroll: facet(over),
  });

  it("lets a linked Participant enroll, then withdraw before close", () => {
    expect(can(ACTORS.participant, "competition.enroll", target())).toBeNull();
    expect(
      can(ACTORS.participant, "competition.withdraw", target(entered)),
    ).toBeNull();
  });

  it("refuses a withdrawal after enrollment closes: the Host removes them", () => {
    expect(
      can(
        ACTORS.participant,
        "competition.withdraw",
        target({ ...entered, built: true }),
      ),
    ).toBe(ENROLL_CLOSED_BUILT);
  });

  it("no linked Participant grants nothing", () => {
    for (const action of [
      "competition.enroll",
      "competition.withdraw",
    ] as const) {
      expect(
        can(ACTORS.participant, action, target({ linked: null })),
        action,
      ).toBe(NOT_LINKED);
    }
  });

  it("binds an Organizer and the Host too: switch off refuses", () => {
    for (const actor of [ACTORS.organizer, ACTORS.host]) {
      expect(
        can(actor, "competition.enroll", target({ selfEnroll: false })),
      ).toBe(ENROLL_OFF);
    }
  });

  it("refuses when the enrollment facts weren't loaded, whoever asks", () => {
    for (const actor of [ACTORS.participant, ACTORS.organizer]) {
      for (const action of [
        "competition.enroll",
        "competition.withdraw",
      ] as const) {
        expect(
          can(actor, action, { warWeekId: XI, competitionId: CATAN }),
          action,
        ).toBe(ADMIN);
      }
    }
  });

  it("refuses an anonymous visitor", () => {
    expect(can(null, "competition.enroll", target())).toBe(SIGN_IN);
  });

  it("never lets a Participant flip the enroll switch", () => {
    expect(can(ACTORS.participant, "competition.self-enroll", target())).toBe(
      NOT_HOST,
    );
  });
});

describe("can: running a participation Competition", () => {
  it.each(
    cases(
      (
        [
          "participation.settings",
          "participation.mark",
          "participation.close",
          "participation.reopen",
        ] as WarWeekAction[]
      ).map((action) => [
        action,
        { warWeekId: XI, competitionId: CATAN },
        catanHostOr(),
      ]),
    ),
  )("%s", (_, action, target, actor, expected) => {
    expect(can(ACTORS[actor], action, target)).toBe(expected);
  });
});

describe("can: recording a Placement Competition's placements", () => {
  // An Organizer and Catan's Host may; a Host of another Competition (in
  // this War Week or a namesake in another), a Participant and anonymous
  // are refused.
  it.each(
    cases(
      (
        [
          "placement.edit",
          "placement.close",
          "placement.reopen",
        ] as WarWeekAction[]
      ).map((action) => [
        action,
        { warWeekId: XI, competitionId: CATAN },
        catanHostOr(),
      ]),
    ),
  )("%s", (_, action, target, actor, expected) => {
    expect(can(ACTORS[actor], action, target)).toBe(expected);
  });
});

describe("can: checking in and out (ADR 0009)", () => {
  const ME = "participant-me";
  const RED = "team-red";
  const ADMIN = "Organizers and Hosts only.";

  /** Individual scoring, check-in on and open; I'm linked and not in. */
  const facet = (over: Partial<CheckInFacet> = {}): CheckInFacet => ({
    isParticipation: true,
    closed: false,
    selfCheckIn: true,
    scoring: "individual",
    teamLabel: "House",
    linked: { participantId: ME, teamId: RED },
    mark: null,
    ...over,
  });
  const checkedIn = { mark: { checkedIn: true } };
  const target = (over: Partial<CheckInFacet> = {}) => ({
    warWeekId: XI,
    competitionId: CATAN,
    checkIn: facet(over),
  });

  it("lets a linked Participant check in, then check out", () => {
    expect(
      can(ACTORS.participant, "participation.check-in", target()),
    ).toBeNull();
    expect(
      can(ACTORS.participant, "participation.check-out", target(checkedIn)),
    ).toBeNull();
  });

  it("refuses checking in twice, and checking out when not in", () => {
    expect(
      can(ACTORS.participant, "participation.check-in", target(checkedIn)),
    ).toBe(ALREADY_CHECKED_IN);
    expect(can(ACTORS.participant, "participation.check-out", target())).toBe(
      NOT_CHECKED_IN,
    );
  });

  it("refuses checking out of a mark the Host made", () => {
    expect(
      can(
        ACTORS.participant,
        "participation.check-out",
        target({ mark: { checkedIn: false } }),
      ),
    ).toBe(MARKED_BY_HOST);
  });

  it("refuses with check-in off and once closed: nothing closes it by time", () => {
    for (const action of [
      "participation.check-in",
      "participation.check-out",
    ] as const) {
      const over = action === "participation.check-out" ? checkedIn : {};
      expect(
        can(
          ACTORS.participant,
          action,
          target({ ...over, selfCheckIn: false }),
        ),
        action,
      ).toBe(CHECK_IN_OFF);
      expect(
        can(ACTORS.participant, action, target({ ...over, closed: true })),
        action,
      ).toBe(PARTICIPATION_CLOSED);
    }
  });

  it("refuses a Competition that isn't run as Participation", () => {
    expect(
      can(
        ACTORS.participant,
        "participation.check-in",
        target({ isParticipation: false }),
      ),
    ).toBe(NOT_PARTICIPATION);
  });

  it("in team scoring, refuses a Participant on no Team", () => {
    expect(
      can(
        ACTORS.participant,
        "participation.check-in",
        target({
          scoring: "team",
          linked: { participantId: ME, teamId: null },
        }),
      ),
    ).toBe(notOnATeam("House"));
    expect(notOnATeam("House")).toBe(
      "Only Participants on a House can take part in a team Competition.",
    );
    expect(
      can(
        ACTORS.participant,
        "participation.check-in",
        target({ scoring: "team" }),
      ),
    ).toBeNull();
  });

  it("no linked Participant grants nothing", () => {
    for (const action of [
      "participation.check-in",
      "participation.check-out",
    ] as const) {
      expect(
        can(ACTORS.participant, action, target({ linked: null })),
        action,
      ).toBe(NOT_LINKED);
    }
  });

  it("binds an Organizer and the Host too", () => {
    for (const actor of [ACTORS.organizer, ACTORS.host]) {
      expect(
        can(actor, "participation.check-in", target({ selfCheckIn: false })),
      ).toBe(CHECK_IN_OFF);
      expect(can(actor, "participation.check-in", target())).toBeNull();
    }
  });

  it("refuses when the check-in facts weren't loaded, whoever asks", () => {
    for (const actor of [ACTORS.participant, ACTORS.organizer]) {
      for (const action of [
        "participation.check-in",
        "participation.check-out",
      ] as const) {
        expect(
          can(actor, action, { warWeekId: XI, competitionId: CATAN }),
          action,
        ).toBe(ADMIN);
      }
    }
  });

  it("refuses an anonymous visitor", () => {
    expect(can(null, "participation.check-in", target())).toBe(SIGN_IN);
  });

  it("never lets a Participant mark someone", () => {
    expect(can(ACTORS.participant, "participation.mark", target())).toBe(
      NOT_HOST,
    );
  });
});

describe("can: Discretionary points", () => {
  it.each(
    cases([
      [
        "discretionary.create",
        { warWeekId: XI },
        organizerOnly("Only an Organizer can give Discretionary points."),
      ],
      [
        "discretionary.edit",
        { warWeekId: XI, competitionId: null },
        organizerOnly("Only an Organizer can change Discretionary points."),
      ],
      [
        "discretionary.delete",
        { warWeekId: XI, competitionId: null },
        organizerOnly("Only an Organizer can delete Discretionary points."),
      ],
    ]),
  )("%s", (_, action, target, actor, expected) => {
    expect(can(ACTORS[actor], action, target)).toBe(expected);
  });

  it("refuses a Host of every Competition, whatever the target names", () => {
    for (const action of [
      "discretionary.create",
      "discretionary.edit",
      "discretionary.delete",
    ] as const) {
      expect(
        can(ACTORS.host, action, {
          warWeekId: XI,
          competitionId: CATAN,
          postedCompetitionId: CATAN,
        }),
        action,
      ).toMatch(/^Only an Organizer can /);
    }
  });
});

describe("can: Schedule Items and Announcements are Organizer-only (ADR 0012)", () => {
  const only = (what: string): Expected => {
    const refusal = `Only an Organizer can ${what}.`;
    return {
      organizer: null,
      host: refusal,
      otherHost: refusal,
      namesakeHost: refusal,
      participant: refusal,
      anonymous: SIGN_IN,
    };
  };
  it.each(
    cases([
      [
        "schedule-item.create",
        { warWeekId: XI, postedCompetitionId: CATAN },
        only("add Schedule Items"),
      ],
      [
        "schedule-item.edit",
        { warWeekId: XI, competitionId: CATAN, postedCompetitionId: CATAN },
        only("change Schedule Items"),
      ],
      [
        "schedule-item.delete",
        { warWeekId: XI, competitionId: CATAN },
        only("delete Schedule Items"),
      ],
      ["announcement.create", { warWeekId: XI }, only("post Announcements")],
      [
        "announcement.edit",
        { warWeekId: XI, authorEmail: "tony@jahnelgroup.com" },
        only("change Announcements"),
      ],
      [
        "announcement.delete",
        { warWeekId: XI, authorEmail: "tony@jahnelgroup.com" },
        only("delete Announcements"),
      ],
    ]),
  )("%s", (_, action, target, actor, expected) => {
    expect(can(ACTORS[actor], action, target)).toBe(expected);
  });
});

describe("can: the /admin pages", () => {
  const REFUSED = "Organizers and Hosts only.";
  it.each(
    cases([
      [
        "admin.view",
        { warWeekId: XI },
        {
          organizer: null,
          host: null,
          otherHost: null,
          namesakeHost: REFUSED,
          participant: REFUSED,
          anonymous: SIGN_IN,
        },
      ],
      [
        "admin.view",
        { warWeekId: XII },
        {
          organizer: null,
          host: REFUSED,
          otherHost: REFUSED,
          namesakeHost: null,
          participant: REFUSED,
          anonymous: SIGN_IN,
        },
      ],
    ]),
  )("%s", (_, action, target, actor, expected) => {
    expect(can(ACTORS[actor], action, target)).toBe(expected);
  });
});

describe("defaultAdminWarWeek and adminEditions", () => {
  const edition = (
    n: number,
    roman: string,
    status: "upcoming" | "live" | "complete",
  ) => ({
    id: roman,
    edition: roman,
    editionNumber: n,
    status,
    startDate: `20${n + 15}-02-21`,
  });
  const ix = edition(9, "ix", "complete");
  const x = edition(10, "x", "complete");
  const xi = edition(11, "xi", "live");
  const xii = edition(12, "xii", "upcoming");
  const xiii = edition(13, "xiii", "upcoming");
  const all = [xiii, ix, xi, xii, x];

  const hostOf = (...warWeekIds: string[]): Actor => ({
    email: "tony@jahnelgroup.com",
    isOrganizer: false,
    hosts: warWeekIds.map((warWeekId) => ({
      competitionId: `catan-${warWeekId}`,
      warWeekId,
    })),
  });

  it("opens an Organizer on the current War Week", () => {
    expect(defaultAdminWarWeek(ACTORS.organizer, all, xi).edition).toBe("xi");
  });

  it("opens a Host on the current War Week when they host there", () => {
    expect(
      defaultAdminWarWeek(hostOf("x", "xi", "xiii"), all, xi).edition,
    ).toBe("xi");
  });

  it("opens a Host on their earliest upcoming edition, then their newest past one", () => {
    expect(
      defaultAdminWarWeek(hostOf("x", "xiii", "xii"), all, xi).edition,
    ).toBe("xii");
    expect(defaultAdminWarWeek(hostOf("ix", "x"), all, xi).edition).toBe("x");
  });

  it("leaves a Participant or anonymous visitor on the current War Week, where they're refused", () => {
    expect(defaultAdminWarWeek(ACTORS.participant, all, xi).edition).toBe("xi");
    expect(defaultAdminWarWeek(null, all, xi).edition).toBe("xi");
  });

  it("lists every edition for an Organizer, newest first", () => {
    expect(adminEditions(ACTORS.organizer, all, xi)).toEqual([
      { edition: "xiii", status: "upcoming", current: false },
      { edition: "xii", status: "upcoming", current: false },
      { edition: "xi", status: "live", current: true },
      { edition: "x", status: "complete", current: false },
      { edition: "ix", status: "complete", current: false },
    ]);
  });

  it("lists only the editions a Host hosts in", () => {
    expect(adminEditions(hostOf("ix", "xii"), all, xi)).toEqual([
      { edition: "xii", status: "upcoming", current: false },
      { edition: "ix", status: "complete", current: false },
    ]);
  });

  it("lists nothing for a Participant or anonymous visitor", () => {
    expect(adminEditions(ACTORS.participant, all, xi)).toEqual([]);
    expect(adminEditions(null, all, xi)).toEqual([]);
  });
});

describe("isPublicPath", () => {
  it.each([
    "/sign-in",
    "/api/auth",
    "/api/auth/callback/google",
    "/about",
    "/privacy",
    "/terms",
  ])("keeps %j public", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/xi",
    "/xi/leaderboard",
    "/admin",
    "/api/mcp",
    "/sign-in-other",
    "/api/authx",
    "/aboutx",
    "/about-anything",
    "/aboutx/y",
    "/About",
    "/about/",
    "/about/leaderboard",
    "/about/x",
    "/about%2Fxi",
    "/privacy/x",
    "/termsx",
    "/privacy/",
    "/Privacy",
    "/terms/leaderboard",
  ])("requires sign-in for %j", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});

describe("safeCallbackPath", () => {
  it.each([
    ["/admin", "/admin"],
    ["/xi/leaderboard?tab=team", "/xi/leaderboard?tab=team"],
  ])("keeps the same-origin path %j", (value, expected) => {
    expect(safeCallbackPath(value)).toBe(expected);
  });

  it.each([
    undefined,
    "",
    "admin",
    "//evil.com",
    "/\\evil.com",
    "https://evil.com/admin",
    "/%5Cevil.com",
    "javascript:alert(1)",
  ])("falls back to / for %j", (value) => {
    expect(safeCallbackPath(value)).toBe("/");
  });
});

describe("canUseMcp", () => {
  const token = "s3cret-token-value";
  const base = {
    hasSession: false,
    authorization: null,
    mcpToken: token,
  };

  it("lets a Jahnel Group session in without a token", () => {
    expect(canUseMcp({ ...base, hasSession: true })).toBe(true);
    expect(canUseMcp({ ...base, hasSession: true, mcpToken: "" })).toBe(true);
  });

  it("lets a correct bearer token in", () => {
    expect(canUseMcp({ ...base, authorization: `Bearer ${token}` })).toBe(true);
    expect(canUseMcp({ ...base, authorization: `bearer  ${token} ` })).toBe(
      true,
    );
  });

  it.each([
    ["a wrong token", "Bearer nope"],
    ["a token prefix", `Bearer ${token.slice(0, -1)}`],
    ["a longer token", `Bearer ${token}x`],
    ["a non-bearer scheme", `Basic ${token}`],
    ["the bare token", token],
    ["an empty bearer", "Bearer "],
    ["no header", null],
  ])("refuses %s", (_, authorization) => {
    expect(canUseMcp({ ...base, authorization })).toBe(false);
  });

  it.each([undefined, "", "   "])(
    "turns token auth off when MCP_TOKEN is %j",
    (mcpToken) => {
      expect(canUseMcp({ ...base, mcpToken, authorization: "Bearer " })).toBe(
        false,
      );
      expect(
        canUseMcp({ ...base, mcpToken, authorization: `Bearer ${token}` }),
      ).toBe(false);
    },
  );
});
