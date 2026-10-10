# TeamFrame Retired and Temporary Resources

This registry prevents historical identifiers from being mistaken for current infrastructure. It is not deletion authority.

Last reconciled: 2026-10-10. Read [CURRENT-STATE.md](CURRENT-STATE.md) before using this historical/retirement registry.

## GitHub

| Resource | Current state | Recommendation | Reason |
| --- | --- | --- | --- |
| `takaven/teamframe` | ACTIVE canonical repository | KEEP | Only canonical TeamFrame source |
| `takaven/hirepass` | ACTIVE separate product repository | KEEP | Canonical HirePass source; do not merge into or retire with TeamFrame |
| `takaven/teamframe-site` | ACTIVE separate commercial website | KEEP | Website source, not application source |
| branch `main` | ACTIVE protected Production/default branch; verified at `f7e9a42b0bfe7c21abe48722b2c01f82d2a0c8f9` on 2026-10-10 | KEEP | Canonical current source |
| branch `launch/managed-people-ops-45-day` | MERGED historical evidence branch; temporarily retained only because Founder Review still has a known Preview fallback dependency | RETIRE after stable Founder Review current-main login passes repeat-login acceptance | Not current Production or product authority |
| branch `brand/apply-final-takaven-logos` | DELETED 2026-09-28; merged in PR #1; had 0 unique commits | RETIRED; never recreate for active work | Merged stale branch |
| branch `codex/market-ready-implementation` | DELETED 2026-09-28; had 0 unique commits | RETIRED; never recreate for active work | Historical release branch |
| `ismaelloveexcel/TeamFrame` | Public, unarchived, last pushed 2026-08-13; its old Vercel `teamframe` project is deleted | ARCHIVE after one final independent-reference check and approval | Historical source easily confused with canonical repo |
| `ismaelloveexcel/teamframe.v2` | Public, unarchived; connected to `mockup-sandbox` | ARCHIVE after confirming it is no longer an independently maintained product | Separate historical simulation, not canonical TeamFrame |
| `ismaelloveexcel/people-ops-platform` | Public, unarchived, default `master`, last pushed 2026-04-28 | REVIEW then likely ARCHIVE | Related name, but not established as a TeamFrame deployment source |
| archived personal HR/ESS prototypes including `HR-Portal-Demo` | Already archived; not established as TeamFrame deployment sources | LEAVE ARCHIVED | Historical prototypes are outside the canonical footprint and already visually retired |

## Vercel

| Resource | Current state | Recommendation | Reason |
| --- | --- | --- | --- |
| `teamframe-founder-review` | ACTIVE synthetic Review/demo project; durable stable-login acceptance still open | KEEP | Prospect demo/screenshots; separate from Production |
| `teamframe-production` | ACTIVE Production; current protected `main` deployed at `app.takaven.com` | KEEP | Authoritative Production application; real customer data remains gated by MA-001/003/009/010 |
| `teamframe-visual-review-20260814061335` (`prj_WpAud4aQp2XGjmQ0zAZb8dS63lPs`) | DELETED 2026-09-28; historical unconnected project | RETIRED; never reuse | Superseded visual review; variable names and domain were recorded before deletion |
| `teamframe` (`prj_sgOeDDOVf1pSdrsRQgU3iuZuXt7t`) | DELETED 2026-09-28; was connected to `ismaelloveexcel/TeamFrame` | RETIRED; never recreate as an ambiguous duplicate | Old project/source pair was not canonical TeamFrame |
| `mockup-sandbox` | Historical, connected to `ismaelloveexcel/teamframe.v2`, one variable | DELETE after approval if V2 is closed | Not canonical TeamFrame |
| `api-server` | Unconnected; three Production variables; relationship to TeamFrame V2 not proven | REVIEW | Generic name and unclear consumer dependencies |

Old deployments inside retained projects need not be deleted for cosmetic reasons. Founder Review already has Vercel Deployment Retention enabled. Remove aliases/domains or deployments only where they create a genuine routing or operational ambiguity.

## Supabase — current organisation inventory

All projects below are in the TAKAVEN Supabase organisation. The authoritative Production project remains on the accepted Free pre-revenue posture and contains no real customer data; upgrade/backup activation is intentionally deferred to the first-paying-customer window.

| Project / ref | Status | Known synthetic footprint | Recommendation |
| --- | --- | --- | --- |
| `teamframe-founder-review-20260924` / `dcfxyjrfsrkibhpbmjnw` | ACTIVE | Northstar synthetic fixture; 17 employees at original bootstrap; current Review accounts/workflows | KEEP |
| `teamframe-production-uae` / `ttwsczpzjdjzuhchbyjx` | ACTIVE, accepted Free pre-revenue posture | Authoritative Production data platform: 45/45 tables and RLS, zero anon table access, private `documents` bucket, no real customer data | KEEP; complete MA-001/003/009/010 before customer data |
| `teamframe-operator-repeat-rehearsal-2-20260928` / `drohdttbgekrmwubhala` | PAUSED, preserved, replay locked | Current 45-table/RLS/no-anon proof; synthetic Crescent Ridge 50-person setup and four review identities | KEEP TEMPORARILY; DELETE after Production acceptance and approval |
| `teamframe-s3-restore-proof-2-disposable-20260923` / `zdwhsxhpireckvqdqdkh` | PAUSED | Restore-proof purpose; final counts not present in canonical repository evidence inspected | REVIEW, then delete after exact data/reference check and approval |
| `teamframe-northstar-demo-persistent-20260923` / `sgndpkvjrqsffwclrujp` | PAUSED | Older Northstar synthetic demo; final counts not present in canonical repository evidence inspected | REVIEW; likely delete after confirming Founder Review supersedes it |

## Already retired / outside current organisation

| Resource | Retired state | Date / rule |
| --- | --- | --- |
| Vercel `teamframe-visual-review-20260814061335` | DELETED after configuration/domain inventory; no canonical dependency | 2026-09-28; never reuse |
| Vercel `teamframe` | DELETED after source/domain/configuration inventory; duplicate historical deployment | 2026-09-28; never recreate as canonical TeamFrame |
| Supabase `tosrbylwchodbeaculgi` | DELETED; synthetic 50-person first-customer rehearsal | 2026-09-28; evidence retained in repository docs |
| Supabase `haxtsdnlcbhmwwwzjncd` | DELETED; quarantined failed fresh-install environment | 2026-09-28; never reuse |
| Supabase `jxiiinglydqqhwjglxtg` | DELETED; synthetic API-grant proof | 2026-09-28; never reuse |
| Supabase `wafkfvpsdhjfrxrmgksl` | DELETED; synthetic F2 baseline proof | 2026-09-28; never reuse |
| Supabase `euhvgedjldqzfczkzjqi` | DELETED; synthetic H2 proof with historical privileged-key exposure | 2026-09-28; never reuse |
| Supabase `nvuijkgiqqhqeqduqqgm` | DELETED; quarantined historical 39-table proof | 2026-09-28; never reuse |
| Supabase `xjdobcfzwluozumhnjng` | DELETED; historical 39-table restore proof | 2026-09-28; never reuse |
| Supabase `syytforaidoorrvrbqwz` | DELETED; empty launch-test proof | 2026-09-28; never reuse |
| Supabase `xqiamhwkuogcgucwmlxy` | DELETED after six zero-data checks | 2026-09-27; never reuse |
| Supabase `zylllrvcmockvfcfubkp` | ABANDONED FOR LAUNCH; inaccessible and not in current organisation | Do not restore, reuse, or infer authority; no deletion authorised |

## Safe cleanup sequence after approval

1. Review `mockup-sandbox` and `api-server` together with the historical V2 source before any action.
2. Review the two remaining paused Supabase projects without resuming them solely for cleanup.
3. Archive historical personal repositories only after their remaining deployment dependencies are closed.
4. Delete the final repeat-rehearsal project only after Production acceptance and explicit approval.
5. The launch branch is already merged; retire it only after stable Founder Review no longer depends on its Preview fallback.