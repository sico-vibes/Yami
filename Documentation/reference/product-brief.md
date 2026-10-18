# Product brief

## Identity

Yami is a Windows desktop voice companion represented by a floating cat spirit with a downward-burning flame who lives in a small island at the top of the screen and can roam the desktop. Her skin, voice, personality, and ability can be changed in the local loadout. Gemini and Tavily connections use keys supplied by the user; Yami does not include a hosted AI account or shared provider credentials.

Yami is a community reconstruction informed by supplied Hitodama references. It is not affiliated with the original project, and it does not claim exact parity with undocumented behavior or hidden screens.

## Product purpose

Make a compact Windows companion that combines explicit voice and dictation sessions with useful local desktop controls. Keep the island lightweight, the main app directly accessible, and local features useful even when no AI key is connected.

## Current capabilities

Cat-spirit companion with roaming mode; spirit island with action card; on-screen voice captions; focus timer; Gemini text and Live voice; dictation; explicit screen lasso; quick/deep web research; routines and reminders; to-dos; editable local memories; clipboard history; app/file/snippet launcher; media; Windows controls; system metrics; speed test; wallpaper; power actions; loadout; and settings.

## Product commitments

- Preserve the reference’s Rubik typography, dark translucent surfaces, dock, fanned catalogue, and top-center island.
- Use Phosphor web icons; the cat spirit is a project-authored SVG with Yami’s own names and copy.
- Adapt features through Yami's existing UI components and interaction patterns while preserving their functional/backend behavior. Record upstream revision, license and parity checks under the [adaptation rules](../adaptation.md).
- Keep operating-system actions in the Windows integration boundary and ask for confirmation on sensitive actions.
- Never invent system readings or claim an action succeeded without a successful result.
- Keep local conversations, settings, plans, memories, and provider keys intact across ordinary updates.
- Describe provider quotas, regional availability, price, and terms as provider-controlled and changeable. Do not promise unlimited free use.
- Treat original prompts, reward rules, hidden screens, voice mappings, and effect timing as unknown unless the implementation itself defines them.

## Boundaries

Yami is Windows-first. The browser preview uses demo fixtures and does not represent the native app. Secure lock/UAC desktops, unsupported hardware, and Windows power policy can block system operations. The application runs as the signed-in user and is not a sandbox for arbitrary commands.

The app is a reconstruction, not an independently certified visual or behavioral clone. The [design system](design-system.md), [user guide](../features-and-settings.md), [security guide](../security-and-providers.md), and [roadmap](../roadmap.md) provide current source-derived details.
