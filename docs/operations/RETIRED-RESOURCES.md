# TeamFrame Retired and Temporary Resources

This registry prevents historical identifiers from being mistaken for current infrastructure. It is not deletion authority.

Last verified against the accessible provider accounts: 2026-09-28.

## GitHub

| Resource | Current state | Recommendation | Reason |
| --- | --- | --- | --- |
| `takaven/teamframe` | ACTIVE canonical repository | KEEP | Only canonical TeamFrame source |
| `takaven/hirepass` | ACTIVE separate product repository | KEEP | Canonical HirePass source; do not merge into or retire with TeamFrame |
| `takaven/teamframe-site` | ACTIVE separate commercial website | KEEP | Website source, not application source |
| branch `main` | ACTIVE default, behind launch branch | KEEP; merge through approved PR | Production/default branch |
| branch `launch/managed-people-ops-45-day` | ACTIVE; 121 commits ahead of `main`; PR #6 open | KEEP until merge/Production acceptance; delete after merge when no deployment depends on it | Current Review/release integration branch |
| branch `brand/apply-final-takaven-logos` | Merged in PR #1; 0 unique commits, 5 behind `main` | DELETE after approval | Merged stale branch |
| branch `codex/market-ready-implementation` | 0 unique commits, 7 behind `main`; old Vercel Preview exists | DELETE after approval after confirming no operational dependency | Historical release branch |
| `ismaelloveexcel/TeamFrame` | Public, unarchived, last pushed 2026-08-13; connected to old Vercel `teamframe` | ARCHIVE after Vercel retirement approval | Historical source easily confused with canonical repo |
| `ismaelloveexcel/teamframe.v2` | Public, unarchived; connected to `mockup-sandbox` | ARCHIVE after confirming it is no longer an independently maintained product | Separate historical simulation, not canonical TeamFrame |
| `ismaelloveexcel/people-ops-platform` | Public, unarchived, default `master`, last pushed 2026-04-28 | REVIEW then likely ARCHIVE | Related name, but not established as a TeamFrame deployment source |
| archived personal HR/ESS prototypes including `HR-Portal-Demo` | Already archived; not established as TeamFrame deployment sources | LEAVE ARCHIVED | Historical prototypes are outside the canonical footprint and already visually retired |

## Vercel

| Resource | Current state | Recommendation | Reason |
| --- | --- | --- | --- |
| `teamframe-founder-review` | ACTIVE authoritative Review; connected to `takaven/teamframe` | KEEP | Required until Production is live and accepted |
| `teamframe-production` | Historical shell; no Git connection; historical deployment/env configuration | KEEP / REBUILD | Reserved authoritative Production project, but not launch-ready |
| `teamframe-visual-review-20260814061335` | Historical, unconnected, 18 Production variables | DELETE after approval and final variable/domain/deployment export check | Superseded visual review |
| `teamframe` | Historical, connected to `ismaelloveexcel/TeamFrame`, five variables | DELETE after approval, then archive old repo | Ambiguous duplicate name/source |
| `mockup-sandbox` | Historical, connected to `ismaelloveexcel/teamframe.v2`, one variable | DELETE after approval if V2 is closed | Not canonical TeamFrame |
| `api-server` | Unconnected; three Production variables; relationship to TeamFrame V2 not proven | REVIEW | Generic name and unclear consumer dependencies |

Old deployments inside retained projects need not be deleted for cosmetic reasons. Founder Review already has Vercel Deployment Retention enabled. Remove aliases/domains or deployments only where they create a genuine routing or operational ambiguity.

## Supabase — current organisation inventory

All projects below are in `Takaven` (`jdlcphgoqpnztlbklkpc`), Free plan. `NANO` on the dashboard indicates an active compute project; absence of it on 2026-09-28 corresponded to paused state.

| Project / ref | Status | Known synthetic footprint | Recommendation |
| --- | --- | --- | --- |
| `teamframe-founder-review-20260924` / `dcfxyjrfsrkibhpbmjnw` | ACTIVE | Northstar synthetic fixture; 17 employees at original bootstrap; current Review accounts/workflows | KEEP |
| `teamframe-operator-repeat-rehearsal-2-20260928` / `drohdttbgekrmwubhala` | ACTIVE, replay locked | Current 45-table/RLS/no-anon proof; synthetic Crescent Ridge 50-person setup and four review identities | KEEP TEMPORARILY; DELETE after Production acceptance and approval |
| `teamframe-first-customer-rehearsal` / `tosrbylwchodbeaculgi` | PAUSED | 45-table install; synthetic 50-person rehearsal | DELETE after approval once repeat-proof evidence is accepted |
| `teamframe-operator-repeat-rehearsal-20260927` / `haxtsdnlcbhmwwwzjncd` | PAUSED / QUARANTINED | Failed 45-table post-install no-anon gate; no customer/Production data | DELETE after approval; evidence is documented |
| `teamframe-api-grant-proof-disposable-20260921` / `jxiiinglydqqhwjglxtg` | PAUSED | One synthetic company, 120 employees, one auth user, private bucket, zero objects at final check | DELETE after approval |
| `teamframe-f2-clean-baseline-disposable-20260922` / `wafkfvpsdhjfrxrmgksl` | PAUSED | One synthetic company/operator, 120 employees, private bucket | DELETE after approval once no remaining visual/baseline evidence depends on it |
| `teamframe-h2-handoff-disposable-20260922` / `euhvgedjldqzfczkzjqi` | PAUSED | One synthetic company, three employees, one auth user, zero objects; privileged-key exposure recorded | DELETE after approval; never reuse |
| `teamframe-fresh-command-proof-disposable-20260921` / `nvuijkgiqqhqeqduqqgm` | PAUSED / QUARANTINED | Historical 39-table install; zero companies/auth users/objects; private bucket | DELETE after approval |
| `teamframe-fresh-install-restore-disposable-20260921` / `xjdobcfzwluozumhnjng` | PAUSED | Historical 39-table install; zero companies/auth users/objects; private bucket | DELETE after approval |
| `teamframe-launch-test-disposable-20260920` / `syytforaidoorrvrbqwz` | PAUSED | Zero companies/auth users/buckets/objects at final check | DELETE after approval |
| `teamframe-s3-restore-proof-2-disposable-20260923` / `zdwhsxhpireckvqdqdkh` | PAUSED | Restore-proof purpose; final counts not present in canonical repository evidence inspected | REVIEW, then delete after exact data/reference check and approval |
| `teamframe-northstar-demo-persistent-20260923` / `sgndpkvjrqsffwclrujp` | PAUSED | Older Northstar synthetic demo; final counts not present in canonical repository evidence inspected | REVIEW; likely delete after confirming Founder Review supersedes it |

## Already retired / outside current organisation

| Resource | Retired state | Date / rule |
| --- | --- | --- |
| Supabase `xqiamhwkuogcgucwmlxy` | DELETED after six zero-data checks | 2026-09-27; never reuse |
| Supabase `zylllrvcmockvfcfubkp` | ABANDONED FOR LAUNCH; inaccessible and not in current organisation | Do not restore, reuse, or infer authority; no deletion authorised |

## Safe cleanup sequence after approval

1. Reconfirm current active Vercel variable targets without exposing values.
2. Export any final evidence metadata needed from historical resources.
3. Delete approved historical Vercel projects before archiving their source repositories.
4. Delete only explicitly approved Supabase refs after final no-customer/no-active-reference checks.
5. Delete merged/stale Git branches after their Preview/deployment dependencies are closed.
6. Re-run provider inventories and update this registry with deletion dates.
