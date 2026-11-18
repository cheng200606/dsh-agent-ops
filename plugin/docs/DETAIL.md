# Agent Ops Console

Turn "who approved what, and what was blocked" into a readable timeline.

## What it does

DSH already writes `approval/asked` and `approval/decided` into the session log —
nobody ever renders them as a list. This plugin folds those two events, plus the
fence's own denials, into a read-only audit view on the "Ops" page in the sidebar.

Three things:

1. **Audit timeline** — one row per approval request: time, tool, reason, final outcome
   (allowed once / rejected / cancelled / unavailable). Requests still waiting show as pending.
2. **Fence** — seven high-risk categories (destroy or overwrite data, change permissions,
   change production, publish content, send messages or invites, purchase or transfer money,
   accept legal terms) are graded by risk:
   - `critical` is denied outright; the model sees `Error: blocked by fence: <rule> (<note>)`;
   - `high` escalates to the native approval card.
3. **Execution environment** — the header shows the session's sandbox mode, approval policy,
   and permission preset, folded from `sandbox/mode`, `approval/policy`, `permission/preset`.

## What it does not do

- **It never answers an approval.** The plugin observes the `approval/request` waterfall and
  always forwards via `next()`. Answering stays with the host and the human.
- **It never rewrites a tool result.** A fenced call is denied; arguments are not altered.
- **It creates no storage.** The audit data is a pure function of the session log; the only
  in-process state is a volatile in-flight index.
- **It injects nothing into the model context.**

## Configuration

In the profile's `cordis.patch.yml`, override the `agent-ops` row's `config`:

```yaml
- id: agent-ops
  config:
    policy:
      enabled: true          # false = fence off entirely (audit keeps working)
      mode: enforce          # enforce | observe (observe records without blocking)
      askRisk: high          # escalate at or above: high | critical | null (off)
      denyRisk: critical     # deny at or above: critical | high | null (off)
      categories: null       # null = all seven; or e.g. [destructive, payment]
      exemptRules: []        # exempt specific rule ids (critical is never exempt)
```

Defaults: `enabled: true, mode: enforce, askRisk: high, denyRisk: critical`.

## Known limits

- State keeps the latest 1000 audit entries; the view shows the latest 500.
- Subagents always run under the `never` approval policy, so any approval-requiring action
  inside a subagent resolves to a denial and appears as `unavailable` on the timeline.
  That is host behaviour, not this plugin's.
