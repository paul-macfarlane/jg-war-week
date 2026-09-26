# 19: Themed Participant portraits and bios (post-hackathon, needs refinement)

**What to build:** Extend the **Avatar** from ticket 16 into a portrait. Use each person's headshot, optionally restyled with AI to match the War Week's Appearance Theme (knight, pirate, house crest), paired with a one- or two-line theme-flavored bio. Show it wherever Avatars appear.

**Blocked by:** 16

**Status:** needs-info

> Split out of ticket 16 on 2026-09-24. It didn't fit the Fri 2026-09-25 10:00 AM deadline. Grill it again before it moves to `ready-for-agent`.

## Already decided

- **Consent:** AI-altered likenesses of coworkers are acceptable (Paul, 2026-09-24). Other JG hackathon projects already use coworkers' faces.
- Every page requires a JG sign-in, so faces are never shown to anonymous visitors.
- Initials Avatars (ticket 16) remain the fallback for anyone without a portrait.

## Candidate ideas (not commitments)

- Match Participants to jahnelgroup.com team-page entries by name, or by the Participant's optional email
- Plain headshots first, AI theme restyling as a second step
- AI-generated theme bios from the person's public title plus the year's Story Theme
- Organizer review before anything shows: approve, regenerate or replace per person

## Open questions to grill

- Is scraping the public site acceptable, or should Organizers upload photos or paste URLs? How are name mismatches and people not on the site (contractors, LTI/IL Company Tags) handled?
- Which image model, what does it cost for about 100 people, and is it a one-off batch script or an in-app action?
- Where do images live (Vercel Blob, Neon, committed static files)? The spec cuts image uploads, so this reopens that decision. How small do they need to be for phones on conference Wi-Fi?
- Bios: AI-generated, Organizer-written, or an AI draft plus an Organizer edit? What keeps them kind and not embarrassing?
- One portrait per War Week (restyled per theme) or one per person reused across years? History War Weeks likely stay on initials.
- Does the MCP server expose portraits or bios?

## Comments

- 2026-09-26: Now a phase 3 candidate (`.scratch/hardening/issues/17`). It still needs its own grilling before any build.
