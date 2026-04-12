/**
 * voxa:flashcards — SRS review widget
 *
 * Shows due flashcard count and launches a review session.
 * Data from GET /api/portal/student/data?types=flashcards on voxa-app.
 */

const VOXA_APP_URL = "https://dev.voxa.education";

export class VoxaFlashcardsWidget extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: "open" });
    this.load();
  }

  private async load() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `<style>
      :host { display: block; font-family: sans-serif; }
      .card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; text-align: center; }
      .count { font-size: 48px; font-weight: bold; color: #47b319; }
      .label { color: #666; font-size: 13px; margin-top: 4px; }
      button { margin-top: 16px; padding: 10px 24px; background: #47b319;
               color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    </style>
    <div class="card"><div class="count" id="count">…</div>
    <div class="label">cards due today</div>
    <button id="review-btn">Start Review</button></div>`;

    try {
      const res = await fetch(
        `${VOXA_APP_URL}/api/portal/student/data?types=flashcards`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { flashcards } = await res.json() as { flashcards: { dueCount: number; totalCards: number } };

      this.shadowRoot!.querySelector("#count")!.textContent =
        String(flashcards.dueCount);

      this.shadowRoot!.querySelector("#review-btn")?.addEventListener(
        "click",
        () => {
          window.open(`${VOXA_APP_URL}/admin/srs`, "_blank");
        }
      );
    } catch (err) {
      this.shadowRoot!.querySelector("#count")!.textContent = "!";
      this.shadowRoot!.querySelector(".label")!.textContent =
        `Error: ${(err as Error).message}`;
    }
  }
}

if (typeof customElements !== "undefined") {
  customElements.define("voxa-flashcards", VoxaFlashcardsWidget);
}
