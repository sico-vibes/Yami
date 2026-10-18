# Product brief

## Identity

Yami is a lightweight Windows utility with a soul. A floating cat spirit with a downward-burning flame lives in a small island at the top of the screen and can roam the desktop. She gives Windows a friendly, characterful layer: voice and dictation, local desktop tools, and a growing set of customization features. Her skin, voice, personality, and ability can be changed in the local loadout. Gemini and Tavily connections use keys supplied by the user; Yami does not include a hosted AI account or shared provider credentials.

Yami is a community reconstruction informed by supplied Hitodama references. It is not affiliated with the original project, and it does not claim exact parity with undocumented behavior or hidden screens. Hitodama is an inspiration, not a template: Yami keeps its own name, character, artwork, and copy.

## Product purpose

Make a compact Windows companion that combines explicit voice and dictation sessions with useful local desktop controls, and that brings Windows' scattered settings together in one place. Keep the island lightweight, the main app directly accessible, and local features useful even when no AI key is connected.

The owner's direction, recorded in [feature recommendations](../research/feature-recommendations-2026-10-18.md):

- **Lightweight is a product requirement.** Users should not see high GPU, CPU, or RAM use caused by Yami. Idle behaviour matters most.
- **More utilities and more Windows customization,** collected in one place, including a theme hub that can apply a whole look at once.
- **Fun and theming.** The spirit should feel alive, and the Windows look should be customizable from Yami.
- **Smart search in the spirit of Raycast,** kept light.
- **Ideas from the Linux customization world** (Omarchy and related shells) where they fit Windows.

The recommendations are proposed, not shipped. Their status is tracked in the [roadmap](../roadmap.md).

## Current capabilities

Cat-spirit companion with roaming mode; spirit island with action card; on-screen voice captions; focus timer; Gemini text and Live voice; dictation; explicit screen lasso; quick and deep web research; routines and reminders; to-dos; editable local memories; clipboard history; app, file, and snippet launcher; media; Windows controls for volume, brightness, theme, Wi-Fi, Bluetooth, and Night Light; system metrics; speed test; wallpaper; power actions; loadout; settings; and the file wheel for converting or acting on dragged files. The AI workspace adds sessions and approvals for supported coding agents, subscription usage readers, read-only service connectors, a local model chat, HTTP MCP, a Windows terminal, notes and recordings, and recaps. Account and device limits are listed in the [AI workspace guide](../workspace.md).

## Product commitments

- Preserve the reference's Rubik typography, dark translucent surfaces, dock, fanned catalogue, and top-center island.
- Use Phosphor web icons; the cat spirit is a project-authored SVG with Yami's own names and copy.
- Adapt features through Yami's existing UI components and interaction patterns while preserving their functional and backend behavior. Record upstream revision, license and parity checks under the [adaptation rules](../adaptation.md).
- Keep operating-system actions in the Windows integration boundary and ask for confirmation on sensitive actions.
- Keep idle cost near zero. No idle polling, no idle animation, no background work that the user did not enable. Measure packaged builds against the [performance budgets](../performance.md).
- Make every new feature optional, with an off state that costs nothing. Anything that uses the network, microphone, camera, or screen is off by default.
- Never invent system readings or claim an action succeeded without a successful result.
- Keep local conversations, settings, plans, memories, and provider keys intact across ordinary updates.
- Describe provider quotas, regional availability, price, and terms as provider-controlled and changeable. Do not promise unlimited free use.
- Treat original prompts, reward rules, hidden screens, voice mappings, and effect timing as unknown unless the implementation itself defines them.

## Boundaries

Yami is Windows-first. The browser preview uses demo fixtures and does not represent the native app. Secure lock/UAC desktops, unsupported hardware, and Windows power policy can block system operations. The application runs as the signed-in user and is not a sandbox for arbitrary commands.

The app is a reconstruction, not an independently certified visual or behavioral clone. The [design system](design-system.md), [user guide](../features-and-settings.md), [security guide](../security-and-providers.md), and [roadmap](../roadmap.md) provide current source-derived details.
