/**
 * Voxa Portal Custom Blocks
 *
 * Custom web components for the Voxa Portal (AFFiNE fork).
 *
 * Student blocks:
 *   - voxa-homework  (Phase J) — Moodle/Genially activity iframe + xAPI forwarding
 *   - voxa-grades    (Phase L) — Book progress panel
 *   - voxa-flashcards(Phase L) — SRS review widget
 *   - voxa-livekit   (Phase K) — LiveKit class session
 *
 * AI blocks:
 *   - voxa-adam      — Adam AI tutor iframe (students/parents/clients)
 *   - voxa-eve       — Eve AI assistant iframe (staff/teachers only)
 *
 * Staff blocks:
 *   - voxa-analytics (Phase M) — Student progress analytics
 *
 * Registration:
 *   Import this file in the AFFiNE frontend bootstrap to register all components.
 *   Each component is a standard Custom Element — no BlockSuite dependency required
 *   for rendering. To insert into an AFFiNE doc use the embed-html block type.
 *
 * To add a new block:
 *   1. Create src/[name]/[name]-widget.ts
 *   2. Export it here
 *   3. The customElement is auto-registered on import
 */

export { VoxaHomeworkWidget, initHomeworkXapiListener } from "./homework/homework-widget";
export { VoxaLivekitWidget } from "./livekit/livekit-widget";
export { VoxaGradesWidget } from "./grades/grades-widget";
export { VoxaFlashcardsWidget } from "./flashcards/flashcards-widget";
export { VoxaAnalyticsWidget } from "./analytics/analytics-widget";
export { VoxaAdamWidget } from "./adam/adam-widget";
export { VoxaEveWidget } from "./eve/eve-widget";
