/**
 * voxa:analytics — Staff analytics panel (Phase M)
 *
 * Shows student count and book progress breakdown.
 * Role-gated: only renders in staff workspaces.
 * Data from GET /api/portal/staff/data?types=analytics on voxa-app.
 */

const VOXA_APP_URL = "https://dev.voxa.education";

export class VoxaAnalyticsWidget extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: "open" });
    this.load();
  }

  private async load() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `<style>
      :host { display: block; font-family: sans-serif; }
      .card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; }
      h3 { margin: 0 0 12px; font-size: 15px; color: #333; }
      .stat { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
      .num { font-size: 32px; font-weight: bold; color: #47b319; }
      .desc { color: #666; font-size: 13px; }
      .row { display: flex; justify-content: space-between; padding: 4px 0;
             font-size: 13px; border-bottom: 1px solid #f0f0f0; }
    </style>
    <div class="card">
      <h3>Analytics</h3>
      <div id="content">Loading...</div>
    </div>`;

    try {
      const res = await fetch(
        `${VOXA_APP_URL}/api/portal/staff/data?types=analytics`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { analytics } = await res.json() as {
        analytics: {
          studentCount: number;
          bookProgressByStatus: { status: string; count: number }[];
        }
      };

      const content = this.shadowRoot!.querySelector("#content")!;
      content.innerHTML = `
        <div class="stat">
          <div class="num">${analytics.studentCount}</div>
          <div class="desc">active students</div>
        </div>
        ${analytics.bookProgressByStatus
          .map(
            (r) => `<div class="row"><span>${r.status.replace("_", " ")}</span><span>${r.count}</span></div>`
          )
          .join("")}
      `;
    } catch (err) {
      this.shadowRoot!.querySelector("#content")!.textContent =
        `Error: ${(err as Error).message}`;
    }
  }
}

if (typeof customElements !== "undefined") {
  customElements.define("voxa-analytics", VoxaAnalyticsWidget);
}
