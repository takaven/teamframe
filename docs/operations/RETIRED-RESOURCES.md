# TeamFrame Retired and Temporary Resources

This registry prevents historical identifiers from being mistaken for current infrastructure. It is not deletion authority.

Last verified against the accessible provider accounts: 2026-09-29.

## GitHub

| Resource | Current state | Recommendation | Reason |
| --- | --- | --- | --- |
| `takaven/teamframe` | ACTIVE canonical repository | KEEP | Only canonical TeamFrame source |
| `takaven/hirepass` | ACTIVE separate product repository | KEEP | Canonical HirePass source; do not merge into or retire with TeamFrame |
| `takaven/teamframe-site` | ACTIVE separate commercial website | KEEP | Website source, not application source |
| branch `main` | ACTIVE protected default at accepted SHA `0216b7711bbc9d09a944f96f5f0d186a4d6dbf6f` | KEEP | Canonical Production/default branch after PR #6 launch consolidation |
| branch `launch/managed-people-ops-45-day` | ACTIVE retained evidence/Founder Review branch; PR #6 merged | KEEP until Production acceptance; delete only after no deployment or rollback evidence depends on it | Accepted launch source retained deliberately |
| branch `brand/apply-final-takaven-logos` | DELETED 2026-09-28; merged in PR #1; had 0 unique commits | RETIRED; never recreate for active work | Merged stale branch |
| branch `codex/market-ready-implementation` | DELETED 2026-09-28; had 0 unique commits | RETIRED; never recreate for active work | Historical release branch |
| `ismaelloveexcel/TeamFrame` | Public, unarchived, last pushed 2026-08-13; its old Vercel `teamframe` project is deleted | ARCHIVE after one final independent-reference check and approval | Historical source easily confused with canonical repo |
| `ismaelloveexcel/teamframe.v2` | Public, unarchived; connected to `mockup-sandbox` | ARCHIVE after confirming it is no longer an independently maintained product | Separate historical simulation, not canonical TeamFrame |
| `ismaelloveexcel/people-ops-platform` | Public, unarchived, default `master`, last pushed 2026-04-28 | REVIEW then likely ARCHIVE | Related name, but not established as a TeamFrame deployment source |
| archived personal HR/ESS prototypes including `HR-Portal-Demo` | Already archived; not established as TeamFrame deployment sources | LEAVE ARCHIVED | Historical prototypes are outside the canonical footprint and already visually retired |

## Vercel

| Resource | Current state | Recommendation | Reason |
| --- | --- | --- | --- |
| `teamframe-founder-review` | ACTIVE authoritative Review; connected to `takaven/teamframe` | KEEP | Required until Production is live and accepted |
| `teamframe-production` | Historical shell; no Git connection; historical deployment/env configuration | KEEP / REBUILD | Reserved authoritative Production project, but not launch-ready |
| `teamframe-visual-review-20260814061335` (`prj_WpAud4aQp2XGjmQ0zAZb8dS63lPs`) | DELETED 2026-09-28; historical unconnected project | RETIRED; never reuse | Superseded visual review; variable names and domain were recorded before deletion |
| `teamframe` (`prj_sgOeDDOVf1pSdrsRQgU3iuZuXt7t`) | DELETED 2026-09-28; was connected to `ismaelloveexcel/TeamFrame` | RETIRED; never recreate as an ambiguous duplicate | Old project/source pair was not canonical TeamFrame |
| `mockup-sandbox` | Historical, connected to `ismaelloveexcel/teamframe.v2`, one variable | DELETE after approval if V2 is closed | Not canonical TeamFrame |
| `api-server` | Unconnected; three Production variables; relationship to TeamFrame V2 not proven | REVIEW | Generic name and unclear consumer dependencies |

Old deployments inside retained projects need not be deleted for cosmetic reasons. Founder Review already has Vercel Deployment Retention enabled. Remove aliases/domains or deployments only where they create a genuine routing or operational ambiguity.

## Supabase — current organisation inventory

All projects below are in `Takaven` (`jdlcphgoqpnztlbklkpc`), Free plan. `NANO` on the dashboard indicates an active compute project; absence of it on 2026-09-28 corresponded to paused state.

| Project / ref | Status | Known synthetic footprint | Recommendation |
| --- | --- | --- | --- |
| `teamframe-founder-review-20260924` / `dcfxyjrfsrkibhpbmjnw` | ACTIVE | Northstar synthetic fixture; 17 employees at original bootstrap; current Review accounts/workflows | KEEP |
| `teamframe-operator-repeat-rehearsal-2-20260928` / `drohdttbgekrmwubhala` | ACTIVE, replay locked | Current 45-table/RLS/no-anon proof; synthetic Crescent Ridge 50-person setup and four review identities | KEEP TEMPORARILY; DELETE after Production acceptance and approval |
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
5. Merge the launch branch through the approved PR, then retire it only when no Preview dependency remains.
