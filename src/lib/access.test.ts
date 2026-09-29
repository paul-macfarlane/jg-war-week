import { describe, expect, it } from "vitest";

import {
  type Actor,
  type OrganizerListAction,
  type WarWeekAction,
  adminEditions,
  can,
  canUseMcp,
  defaultAdminWarWeek,
  isJahnelGroupEmail,
  isPublicPath,
  safeCallbackPath,
} from "@/lib/access";
import {
  ENROLL_CLOSED_BUILT,
  ENROLL_OFF,
  type EnrollFacet,
} from "@/lib/games/enroll-rule";
import {
  COMPETITION_CLOSED,
  type GameLogFacet,
  NOT_A_PLAYER,
  NOT_LINKED,
  NOT_THE_LOGGER,
} from "@/lib/games/log-rule";

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
          ["faq-item.create", "add FAQ Items"],
          ["faq-item.edit", "change FAQ Items"],
          ["faq-item.delete", "delete FAQ Items"],
          ["faq-item.move", "move FAQ Items"],
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
          "bracket.heat-result",
          "bracket.heat-schedule",
          "bracket.finalize",
          "bracket.unfinalize",
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
          "bracket.heat-result",
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

describe("can: reporting a Heat's result (self-report)", () => {
  const RED = "team-red";
  const BLUE = "team-blue";
  const RED_ALPHA = "squad-red-alpha";
  const RED_BRAVO = "squad-red-bravo";
  const ME = "participant-me";
  const OFF = "Self-report is off for this Competition.";
  const NOT_LINKED =
    "Your sign-in doesn't match a Participant of this War Week.";
  const NOT_IN_HEAT = "You're not in this Heat.";
  const ADMIN = "Organizers and Hosts only.";

  type Facet = NonNullable<
    NonNullable<Parameters<typeof can>[2]>["heatReport"]
  >;
  const teamHeat = [
    { teamId: RED, participantId: null, squadId: null },
    { teamId: BLUE, participantId: null, squadId: null },
  ];
  const sameTeamSquadHeat = [
    { teamId: null, participantId: null, squadId: RED_ALPHA },
    { teamId: null, participantId: null, squadId: RED_BRAVO },
  ];
  const linkedRed = { participantId: ME, teamId: RED, squadId: null };
  /** An open Red vs Blue Heat of Catan, self-report on, linked to Red. */
  const facet = (over: Partial<Facet> = {}): Facet => ({
    selfReport: true,
    heat: "open",
    linked: linkedRed,
    entrants: teamHeat,
    ...over,
  });
  const target = (over: Partial<Facet> = {}) => ({
    warWeekId: XI,
    competitionId: CATAN,
    heatReport: facet(over),
  });

  it.each<[string, Partial<Facet>, string | null]>([
    ["self-report off", { selfReport: false }, OFF],
    ["not linked to any Participant", { linked: null }, NOT_LINKED],
    [
      "linked but on none of the Entrants",
      { linked: { participantId: ME, teamId: "team-gold", squadId: null } },
      NOT_IN_HEAT,
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
      { linked: linkedRed, entrants: sameTeamSquadHeat },
      NOT_IN_HEAT,
    ],
    [
      "in the opposing same-Team Squad (Red Bravo) of Red Alpha vs Red Bravo",
      {
        linked: { participantId: ME, teamId: RED, squadId: RED_BRAVO },
        entrants: sameTeamSquadHeat,
      },
      null,
    ],
    ["a decided Heat", { heat: "decided" }, "This Heat already has a result."],
    [
      "an unfilled Heat",
      { heat: "unfilled" },
      "This Heat is still waiting for its Entrants.",
    ],
    ["a bye", { heat: "bye" }, "A bye isn't played."],
    [
      "a missing Heat",
      { heat: "missing", entrants: [] },
      "That Heat no longer exists.",
    ],
  ])("a Participant: %s", (_, over, expected) => {
    expect(can(ACTORS.participant, "bracket.heat-report", target(over))).toBe(
      expected,
    );
  });

  it("refuses an anonymous visitor", () => {
    expect(can(null, "bracket.heat-report", target())).toBe(SIGN_IN);
  });

  it("refuses a non-JG email even with a matching linked Participant", () => {
    const outsider = {
      email: "someone@gmail.com",
      isOrganizer: false,
      hosts: [],
    };
    // The facet alone would allow it: the domain rule refuses, not linkage.
    expect(can(ACTORS.participant, "bracket.heat-report", target())).toBeNull();
    expect(can(outsider, "bracket.heat-report", target())).toBe(SIGN_IN);
  });

  it("refuses when the Heat facts weren't loaded, whoever asks", () => {
    for (const actor of [ACTORS.participant, ACTORS.organizer, ACTORS.host]) {
      expect(
        can(actor, "bracket.heat-report", {
          warWeekId: XI,
          competitionId: CATAN,
        }),
      ).toBe(ADMIN);
    }
  });

  it("binds an Organizer and the Host by the Heat facts too", () => {
    for (const actor of [ACTORS.organizer, ACTORS.host]) {
      expect(can(actor, "bracket.heat-report", target({ linked: null }))).toBe(
        NOT_LINKED,
      );
      expect(
        can(actor, "bracket.heat-report", target({ heat: "decided" })),
      ).toBe("This Heat already has a result.");
      expect(
        can(actor, "bracket.heat-report", target({ selfReport: false })),
      ).toBe(OFF);
      expect(can(actor, "bracket.heat-report", target())).toBeNull();
    }
  });

  it("never lets a Participant in the Heat change a result or the toggle", () => {
    // The facet says they're in this open Heat; the direct paths ignore it.
    for (const action of [
      "bracket.heat-result",
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

describe("can: running a games Competition and the enroll switch", () => {
  it.each(
    cases(
      (
        [
          "games.settings",
          "games.entrants",
          "games.close",
          "games.reopen",
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

describe("can: logging, editing and deleting a Game (ADR 0006)", () => {
  const ME = "participant-me";
  const RIVAL = "participant-rival";
  const THIRD = "participant-third";
  const ADMIN = "Organizers and Hosts only.";
  const player = (participantId: string) => ({ teamId: null, participantId });

  type Facet = GameLogFacet;
  /** Open, individual scoring; I'm linked, a player, and logged the Game. */
  const facet = (over: Partial<Facet> = {}): Facet => ({
    runs: false,
    closed: false,
    loggingOpen: true,
    bestOfDecided: false,
    linked: { participantId: ME, teamId: null },
    scoring: "individual",
    entrantsOpen: true,
    entrants: [],
    players: [player(ME), player(RIVAL)],
    game: { loggedByParticipantId: ME, players: [player(ME), player(RIVAL)] },
    ...over,
  });
  const target = (over: Partial<Facet> = {}) => ({
    warWeekId: XI,
    competitionId: CATAN,
    gameLog: facet(over),
  });
  const writes = ["games.log", "games.edit", "games.delete"] as const;

  it("lets a linked Participant who is a player log the Game", () => {
    expect(can(ACTORS.participant, "games.log", target())).toBeNull();
  });

  it('the "Which one is you?" pick grants nothing: no linked Participant', () => {
    for (const action of writes) {
      expect(
        can(ACTORS.participant, action, target({ linked: null })),
        action,
      ).toBe(NOT_LINKED);
    }
  });

  it("refuses a Participant who isn't a player in the Game", () => {
    expect(
      can(
        ACTORS.participant,
        "games.log",
        target({ players: [player(RIVAL), player(THIRD)] }),
      ),
    ).toBe(NOT_A_PLAYER);
  });

  it("lets the logger edit or delete their own Game until close", () => {
    expect(can(ACTORS.participant, "games.edit", target())).toBeNull();
    expect(
      can(ACTORS.participant, "games.delete", target({ players: [] })),
    ).toBeNull();
    for (const action of ["games.edit", "games.delete"] as const) {
      expect(
        can(ACTORS.participant, action, target({ closed: true })),
        action,
      ).toBe(COMPETITION_CLOSED);
    }
  });

  it("refuses another player in the Game an edit or delete", () => {
    const game = {
      loggedByParticipantId: RIVAL,
      players: [player(ME), player(RIVAL)],
    };
    for (const action of ["games.edit", "games.delete"] as const) {
      expect(can(ACTORS.participant, action, target({ game })), action).toBe(
        NOT_THE_LOGGER,
      );
    }
  });

  it("refuses an edit that moves the Game off its logger", () => {
    expect(
      can(
        ACTORS.participant,
        "games.edit",
        target({ players: [player(RIVAL), player(THIRD)] }),
      ),
    ).toBe(NOT_A_PLAYER);
  });

  it("lets a Host or Organizer who runs it log, edit or delete any Game", () => {
    const game = {
      loggedByParticipantId: RIVAL,
      players: [player(RIVAL), player(THIRD)],
    };
    for (const actor of [ACTORS.organizer, ACTORS.host]) {
      for (const action of writes) {
        expect(
          can(
            actor,
            action,
            target({ runs: true, linked: null, game, loggingOpen: false }),
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
      can(ACTORS.organizer, "games.log", target({ linked: null, runs: false })),
    ).toBe(NOT_LINKED);
  });

  it("refuses when the Game facts weren't loaded, whoever asks", () => {
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

  it("never lets a player change the settings, the list or close it", () => {
    for (const action of [
      "games.settings",
      "games.entrants",
      "games.close",
      "games.reopen",
    ] as WarWeekAction[]) {
      expect(can(ACTORS.participant, action, target()), action).toBe(NOT_HOST);
    }
  });
});

describe("can: enrolling and withdrawing (ADR 0006)", () => {
  const ME = "participant-me";
  const RED = "team-red";
  const ADMIN = "Organizers and Hosts only.";
  const NOW = new Date("2027-02-22T15:00:00Z");

  type Facet = EnrollFacet;
  /** Individual scoring, switch on, open; I'm linked and not entered. */
  const facet = (over: Partial<Facet> = {}): Facet => ({
    selfEnroll: true,
    closed: false,
    built: false,
    hasGames: false,
    entrantLimit: null,
    entrantCount: 0,
    enrollClosesAt: null,
    now: NOW,
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

  it("the pick grants nothing: no linked Participant", () => {
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

describe("can: Points Entries", () => {
  it.each(
    cases([
      [
        "points-entry.create",
        { warWeekId: XI, postedCompetitionId: CATAN },
        catanHostOr(),
      ],
      [
        "points-entry.edit",
        { warWeekId: XI, competitionId: CATAN, postedCompetitionId: CATAN },
        catanHostOr(),
      ],
      [
        "points-entry.delete",
        { warWeekId: XI, competitionId: CATAN },
        catanHostOr(),
      ],
      // Moving an entry off their Competition, or onto it: both must be theirs.
      [
        "points-entry.edit",
        { warWeekId: XI, competitionId: CATAN, postedCompetitionId: MTG },
        { ...catanHostOr(), host: NOT_HOST },
      ],
      [
        "points-entry.edit",
        { warWeekId: XI, competitionId: MTG, postedCompetitionId: CATAN },
        { ...catanHostOr(), host: NOT_HOST },
      ],
    ]),
  )("%s", (_, action, target, actor, expected) => {
    expect(can(ACTORS[actor], action, target)).toBe(expected);
  });
});

describe("can: Schedule Items", () => {
  const LINK = "Link the Schedule Item to a Competition you host.";
  const UNLINK =
    "Only an Organizer can unlink a Schedule Item from its Competition.";
  it.each(
    cases([
      [
        "schedule-item.create",
        { warWeekId: XI, postedCompetitionId: CATAN },
        catanHostOr(),
      ],
      [
        "schedule-item.create",
        { warWeekId: XI, postedCompetitionId: null },
        {
          organizer: null,
          host: LINK,
          otherHost: LINK,
          namesakeHost: LINK,
          participant: LINK,
          anonymous: SIGN_IN,
        },
      ],
      [
        "schedule-item.edit",
        { warWeekId: XI, competitionId: CATAN, postedCompetitionId: CATAN },
        catanHostOr(),
      ],
      [
        "schedule-item.edit",
        { warWeekId: XI, competitionId: CATAN, postedCompetitionId: MTG },
        { ...catanHostOr(), host: NOT_HOST },
      ],
      [
        "schedule-item.edit",
        { warWeekId: XI, competitionId: MTG, postedCompetitionId: CATAN },
        { ...catanHostOr(), host: NOT_HOST },
      ],
      [
        "schedule-item.edit",
        { warWeekId: XI, competitionId: CATAN, postedCompetitionId: null },
        { ...catanHostOr(), host: UNLINK },
      ],
      [
        "schedule-item.edit",
        { warWeekId: XI, competitionId: null, postedCompetitionId: CATAN },
        { ...catanHostOr(), host: NOT_HOST },
      ],
      [
        "schedule-item.delete",
        { warWeekId: XI, competitionId: CATAN },
        catanHostOr(),
      ],
      [
        "schedule-item.delete",
        { warWeekId: XI, competitionId: null },
        { ...catanHostOr(), host: NOT_HOST },
      ],
    ]),
  )("%s", (_, action, target, actor, expected) => {
    expect(can(ACTORS[actor], action, target)).toBe(expected);
  });
});

describe("can: Announcements", () => {
  const POST =
    "Only an Organizer or a Host of this War Week can post Announcements.";
  const OTHERS = "Only an Organizer can change someone else's Announcement.";
  const NO_LONGER =
    "Only an Organizer or a Host of this War Week can change Announcements.";
  it.each(
    cases([
      [
        "announcement.create",
        { warWeekId: XI },
        {
          organizer: null,
          host: null,
          otherHost: null,
          namesakeHost: POST,
          participant: POST,
          anonymous: SIGN_IN,
        },
      ],
      ...(["announcement.edit", "announcement.delete"] as const).flatMap(
        (action): [WarWeekAction, Parameters<typeof can>[2], Expected][] => [
          // Written by the Host of Catan.
          [
            action,
            { warWeekId: XI, authorEmail: "Tony@JahnelGroup.com" },
            {
              organizer: null,
              host: null,
              otherHost: OTHERS,
              namesakeHost: OTHERS,
              participant: OTHERS,
              anonymous: SIGN_IN,
            },
          ],
          // Written by the namesake Host, who hosts nothing in XI.
          [
            action,
            { warWeekId: XI, authorEmail: "casey@jahnelgroup.com" },
            {
              organizer: null,
              host: OTHERS,
              otherHost: OTHERS,
              namesakeHost: NO_LONGER,
              participant: OTHERS,
              anonymous: SIGN_IN,
            },
          ],
        ],
      ),
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
