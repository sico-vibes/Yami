# Adaptation rules

Adaptation brings an existing feature into Yami with the same functional end result and operating behavior, presented through Yami's established design language. These rules apply to future implementation; they do not mean the researched features are already shipped.

## Reuse the interface

Extend existing tabs, dock and utility navigation, settings groups and rows, `IconButton`, `Toggle`, fields, dialogs, status pills and empty/error states. Reuse Rubik, Phosphor, Yami's tokens, spacing, rounded geometry, hover/focus treatments and reduced-motion behavior. A new feature can add a new tab or control by following these patterns; it must not introduce a second visual system. Reuse implementation as well as appearance where possible. See [Design system](reference/design-system.md).

## Preserve the behavior

Before implementing, record the upstream repository and revision, the exact feature being adapted, its inputs and outputs, backend/API contracts, state transitions, persistence, side effects, streaming/cancellation, failure and recovery behavior, and the end-to-end result. Map each behavior to the Yami control or screen that exposes it.

Changing presentation is allowed; silently replacing an interactive shell with one-shot command execution, a real approval response with a decorative notification, or account quota data with an estimate is not functional parity. Do not remove functionality merely to fit an existing control. Extend the existing pattern enough to expose the real behavior.

Windows implementations may need different platform APIs. Verify the same user-visible outcome and operating semantics on Windows. Record differences explicitly; do not describe partial support, unavailable APIs, mock responses or a prototype as a completed adaptation.

## Keep Yami's boundaries

Preserve chats, settings and provider credentials. Provider requests and secret handling remain in the main process. Keep explicit tool permissions, user control, accessibility, free-first configuration and the existing restrictions on automated actions. If an upstream behavior conflicts with those boundaries, document the conflict and proposed scope before implementation; do not silently weaken a guardrail or promise parity that cannot be delivered.

Keep optional integrations disabled until configured. Avoid idle polling, eager heavy imports and always-running shell servers. Measure complete process trees, including PTYs, shells, agents and connector helpers. Do not trade away required functionality to report a smaller memory number.

## Verify and attribute

Record source behavior alongside meaningful end-to-end parity checks, including errors, interruption, cleanup, keyboard access and restart behavior where relevant. Use browser fixtures for presentation, then the real Windows path for operating behavior. Keep unsupported cases visible.

Inspect the license of each reused file, dependency and asset; preserve required notices. An upstream code license does not automatically grant rights to its name, character, artwork, sounds or screenshots. Keep downloaded reference code and assets in ignored local research storage. Update the affected documentation, source provenance and project-local skill copies when shipping an adaptation.

The [repository adaptation review](research/adaptation-review.md) applies these rules to Coucou, Terax AI and CodeNotch. The [workspace implementation guide](workspace.md) separates implemented scope, Windows checks and live-account/device gaps. The research review is a dated source record, not a claim of full upstream parity.
