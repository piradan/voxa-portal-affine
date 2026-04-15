/**
 * voxa:backlog — Voxa Platform Intelligence backlog widget
 *
 * NOTE: This block does NOT implement a custom Kanban board.
 * AFFiNE already has a native database block with Kanban, grid, and table
 * views. This widget is a small summary card that links OUT to an AFFiNE
 * database doc pre-configured with the task schema. Users interact with it
 * through AFFiNE's native UI — we just fetch a count summary and render a
 * button that opens the backlog doc.
 *
 * Attributes:
 *   workspace-id     — internal workspace UUID (required)
 *   backlog-doc-id   — AFFiNE database doc ID of the backlog (required)
 *
 * Used inside the Voxa Platform Intelligence workspace; safe no-op elsewhere.
 */

const VOXA_APP_URL =
  typeof window !== "undefined"
    ? window.location.origin.includes("portal.voxa.education")
      ? "https://dev.voxa.education"
      : "http://localhost:3000"
    : "";

interface BacklogSummary {
  todo: number;
  inProgress: number;
  done: number;
}

export class VoxaBacklogWidget extends HTMLElement {
  static get observedAttributes() {
    return ["workspace-id", "backlog-doc-id"];
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
    this.render();
    this.loadSummary().catch(err =>
      console.warn("[VoxaBacklog] summary load failed", err)
    );
  }

  attributeChangedCallback() {
    if (this.shadowRoot) {
      this.render();
      this.loadSummary().catch(() => undefined);
    }
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: sans-serif; padding: 12px; }
        .card {
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          background: #fff;
          padding: 14px 16px;
        }
        .header {
          font-size: 14px;
          font-weight: 600;
          color: #1a1a2e;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .status-row {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          font-size: 12px;
          color: #666;
          flex-wrap: wrap;
        }
        .badge {
          padding: 3px 10px;
          border-radius: 11px;
          font-size: 11px;
          font-weight: 500;
        }
        .todo { background: #e5e7eb; color: #374151; }
        .inprogress { background: #dbeafe; color: #1e40af; }
        .done { background: #d1fae5; color: #065f46; }
        .open-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: #4f46e5;
          color: #fff;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        }
        .open-btn:hover { background: #4338ca; }
        .open-btn:disabled { background: #9ca3af; cursor: not-allowed; }
      </style>
      <div class="card">
        <div class="header">📋 Voxa Backlog</div>
        <div class="status-row" id="status">Loading…</div>
        <button class="open-btn" id="open-btn">Open Kanban ↗</button>
      </div>
    `;

    const btn = this.shadowRoot.getElementById(
      "open-btn"
    ) as HTMLButtonElement | null;
    if (btn) {
      btn.addEventListener("click", () => this.openKanban());
      btn.disabled = !this.getAttribute("backlog-doc-id");
    }
  }

  private async loadSummary() {
    const workspaceId = this.getAttribute("workspace-id") ?? "";
    if (!workspaceId) {
      this.paint({ todo: 0, inProgress: 0, done: 0 }, "No workspace configured.");
      return;
    }

    try {
      const res = await fetch(
        `${VOXA_APP_URL}/api/voxa/backlog-summary?workspaceId=${encodeURIComponent(workspaceId)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Partial<BacklogSummary>;
      this.paint({
        todo: data.todo ?? 0,
        inProgress: data.inProgress ?? 0,
        done: data.done ?? 0,
      });
    } catch {
      // Endpoint may not exist yet — render a neutral placeholder rather than
      // an error, so the widget still shows the Open Kanban button.
      this.paint({ todo: 0, inProgress: 0, done: 0 }, "Summary unavailable.");
    }
  }

  private paint(summary: BacklogSummary, note?: string) {
    if (!this.shadowRoot) return;
    const row = this.shadowRoot.getElementById("status");
    if (!row) return;
    const numOrDash = (n: number) => (note ? "—" : String(n));
    row.innerHTML = `
      <span class="badge todo">Backlog: ${numOrDash(summary.todo)}</span>
      <span class="badge inprogress">In Progress: ${numOrDash(summary.inProgress)}</span>
      <span class="badge done">Done: ${numOrDash(summary.done)}</span>
      ${note ? `<span style="opacity:.7">${note}</span>` : ""}
    `;
  }

  openKanban() {
    const backlogDocId = this.getAttribute("backlog-doc-id");
    const workspaceId = this.getAttribute("workspace-id");
    if (!backlogDocId || !workspaceId) return;
    window.open(`/workspace/${workspaceId}/${backlogDocId}`, "_blank");
  }
}

if (
  typeof customElements !== "undefined" &&
  !customElements.get("voxa-backlog")
) {
  customElements.define("voxa-backlog", VoxaBacklogWidget);
}
