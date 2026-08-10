# TeamFrame Brand System

## 1. Brand Positioning

TeamFrame is a managed people-ops readiness system for founder-led teams. It helps a founder see operational people risks, assign the next action, and preserve practical evidence that the issue was resolved.

## 2. Primary Tagline

**People operations, made ready.**

This is the master-brand tagline for logo lockups, metadata, login screens, and active product copy.

## 3. Supporting Campaign Line

**See what needs attention. Know what comes next.**

Use this selectively where it helps explain the product journey, such as the login screen, prospect walkthroughs, or dashboard orientation.

## 4. Logo Variants

The primary identity is the interlocking TF mark plus the TeamFrame wordmark and tagline.

- Primary mark: `public/brand/teamframe-mark-primary.svg`
- Reversed mark: `public/brand/teamframe-mark-reversed.svg`
- Monochrome dark mark: `public/brand/teamframe-mark-monochrome-dark.svg`
- Monochrome light mark: `public/brand/teamframe-mark-monochrome-light.svg`
- Primary lockup: `public/brand/teamframe-lockup-primary.svg`
- Reversed lockup: `public/brand/teamframe-lockup-reversed.svg`
- Wordmark: `public/brand/teamframe-wordmark.svg`

## 5. Clear Space

Keep clear space around the mark equal to at least the width of the vertical lime stem. Do not place the mark inside another badge, frame, or decorative container unless it is the approved app icon shape.

## 6. Minimum Size

Use the full lockup at 160 px wide or larger. Use the mark alone below 160 px, including favicons, mobile headers, compact navigation, and app icons.

## 7. Favicon Usage

Next.js App Router icon assets live in `app/icon.svg`, `app/favicon.svg`, and `app/apple-icon.png`. The favicon uses the simplified mark so the F remains legible at small sizes.

## 8. Core Colours

| Token | Value | Use |
| --- | --- | --- |
| Electric Signal Green | `#01FF22` | Primary CTA fill, active marker, focus ring, current work progression |
| Titanium Grey | `#68707D` | Secondary text, supporting UI |
| Soft Graphite | `#42494D` | Large dark surfaces: navigation rail, mobile top bar, authentication brand panel |
| Body ink | `#20242B` | Primary text on light surfaces and neutral Org chart selection |
| Soft Mist | `#F4F6F8` | App background |
| White | `#FFFFFF` | Elevated surfaces |

## 9. Neutral Scale

| Token | Value |
| --- | --- |
| N-900 | `#0F1115` |
| N-700 | `#2A2F37` |
| N-500 | `#68707D` |
| N-300 | `#CCD1D8` |
| N-100 | `#E9EDF1` |
| N-50 | `#F4F6F8` |
| N-0 | `#FFFFFF` |

## 10. Semantic-Colour Separation

Electric Signal Green is not a generic success colour. Functional states use semantic tokens:

- Success: resolved or completed
- Warning: needs attention or nearing deadline
- Error: failed, expired, rejected, or unsafe
- Information: neutral guidance
- Disabled: unavailable action

## 11. Signal Green Usage

Use Electric Signal Green for primary calls to action, active navigation markers, priority indicators, focus rings, small progress cues, and directional emphasis.

Do not use lime for body copy, long text, large backgrounds, generic success states, error states, decorative gradients, or multiple competing focal points on one screen.

## 12. Typography Hierarchy

Preserve the application type system. Use clear page titles, readable body copy, consistent labels, controlled weight, and sparing uppercase only for compact labels or metadata.

## 13. Button Hierarchy

- Primary: Electric Signal Green background, body-ink foreground.
- Secondary: white or transparent background, charcoal text, neutral border.
- Tertiary: text link with restrained accent treatment.

Use arrows only for directional actions such as opening details or continuing a setup path. Do not add arrows to save, approve, reject, upload, delete, cancel, or other non-directional commands.

## 14. Navigation Treatment

Authenticated navigation uses a charcoal surface, white or soft-grey text, a lime active marker, restrained icons or marks, and accurate route labels. Do not add unsupported routes to match a brand-board example.

Current route labels:

- Overview
- Employees
- Onboarding
- Leave
- Policies
- Me

## 15. Status Systems

Presentation labels should remain object-specific:

- Action: Not started, In progress, Completed, Overdue
- Risk: Open, Under action, Resolved, Recurring
- Document: Valid, Expiring soon, Expired, Missing
- Policy: Draft, Published, Superseded, Archived
- Acknowledgement: Acknowledged, Outstanding, Not applicable
- Leave: Pending, Approved, Rejected, Cancelled

Colour is never the only indicator; every status keeps a visible text label.

## 16. Accessibility Rules

Maintain visible keyboard focus. Do not place white text on lime. Keep badge text legible, preserve error contrast, and make icon-only controls accessible by name. Reduced-motion preferences should remain respected.

## 17. Incorrect Usage

Do not use:

- Lime body text
- Large lime backgrounds
- Performance-management claims
- Unsupported analytics or productivity language
- Distorted logo proportions
- Low-contrast monochrome logo combinations
- Detached or rearranged logo elements
- Excessive status colours

## 18. Accurate Product-Language Examples

Use readiness-oriented language:

- Readiness overview
- Priority signals
- Open actions
- Recently resolved
- Onboarding progress
- Documents requiring attention
- Policy acknowledgements
- Signal -> Action -> Resolution

Avoid unsupported language such as performance reviews, productivity monitoring, goals, employee scoring, talent ratings, and workforce-performance analytics.
