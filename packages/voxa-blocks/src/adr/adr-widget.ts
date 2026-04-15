/**
 * voxa:adr — Architecture Decision Records widget
 *
 * Lists existing ADR documents from the internal Voxa workspace and exposes
 * a "New ADR" button that creates an AFFiNE doc pre-filled with the standard
 * ADR template. The document editor is AFFiNE's own — this widget just seeds
 * a new doc and links to it.
 *
 * Attributes:
 *   workspace-id        — internal workspace UUID (required)
 *   service-token       — AFFINE_SERVICE_TOKEN (optional — if present, used
 *                         to call POST /api/voxa/workspace-note directly).
 *                         In normal Portal use the backend proxies this.
 *
 * New ADR creation path:
 *   POST /api/voxa/workspace-note
 *     { workspaceId, title, markdown }  (service-token gated)
 *   → returns { docId } which we open in a new tab.
 */

const PORTAL_URL =
  typeof window !== "undefined" ? window.location.origin : "";

interface AdrListItem {
  docId: string;
  title: string;
  status?: string;
  updatedAt?: string;
}

const ADR_TEMPLATE = (num: string) =>
  `# ADR-${num}: [Title]\n\n` +
  `**Status:** Draft | Accepted | Superseded | Deprecated\n` +
  `**Date:** ${new Date().toISOString().slice(0, 10)}\n\n` +
  `## Context\n[What is the issue that motivated this decision?]\n\n` +
  `## Decision\n[What is the change that we're actually proposing or doing?]\n\n` +
  `## Consequences\n[What becomes easier or more difficult because of this decision?]\n\n` +
  `## Counter-argument considered\n` +
  `[REQUIRED: What is the strongest argument against this decision, and why was it rejected?]\n` +
  `\n> Note: This field must be filled before an ADR can be marked Accepted.\n`;

export class VoxaAdrWidget extends HTMLElement {
  static get observedAttributes() {
    return ["workspace-id"];
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
    this.render();
    this.loadList().catch(err =>
      console.warn("[VoxaAdr] list load failed", err)
    );
  }

  attributeChangedCallback() {
    if (this.shadowRoot) {
      this.render();
      this.loadList().catch(() => undefined);
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
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 10px;
        }
        .title {
          font-size: 14px; font-weight: 600; color: #1a1a2e;
          display: flex; align-items: center; gap: 6px;
        }
        .new-btn {
          padding: 6px 12px;
          background: #4f46e5; color: #fff;
          border: none; border-radius: 6px;
          cursor: pointer; font-size: 12px; font-weight: 500;
        }
        .new-btn:hover { background: #4338ca; }
        .new-btn:disabled { background: #9ca3af; cursor: not-allowed; }
        .list { list-style: none; padding: 0; margin: 0; }
        .row {
          display: flex; align-items: center; gap: 10px;
          padding: 7px 4px;
          border-bottom: 1px solid #f3f4f6;
          font-size: 13px;
        }
        .row:last-child { border-bottom: none; }
        .row a {
          color: #1f2937;
          text-decoration: none;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .row a:hover { color: #4f46e5; text-decoration: underline; }
        .status {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .s-draft { background: #fef3c7; color: #92400e; }
        .s-accepted { background: #d1fae5; color: #065f46; }
        .s-superseded { background: #e0e7ff; color: #3730a3; }
        .s-deprecated { background: #fee2e2; color: #991b1b; }
        .msg { padding: 8px 4px; color: #6b7280; font-size: 12px; }
      </style>
      <div class="card">
        <div class="header">
          <div class="title">🏛️ Architecture Decision Records</div>
          <button class="new-btn" id="new-btn">+ New ADR</button>
        </div>
        <ul class="list" id="list"><li class="msg">Loading…</li></ul>
      </div>
    `;

    const btn = this.shadowRoot.getElementById(
      "new-btn"
    ) as HTMLButtonElement | null;
    if (btn) {
      btn.addEventListener("click", () => {
        this.createNew().catch(err => {
          console.error("[VoxaAdr] create failed", err);
          alert(`Create ADR failed: ${(err as Error).message}`);
        });
      });
      btn.disabled = !this.getAttribute("workspace-id");
    }
  }

  private async loadList() {
    const workspaceId = this.getAttribute("workspace-id") ?? "";
    if (!workspaceId) {
      this.paintList([], "No workspace configured.");
      return;
    }
    try {
      const res = await fetch(
        `${PORTAL_URL}/api/voxa/adr-list?workspaceId=${encodeURIComponent(workspaceId)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { adrs?: AdrListItem[] };
      this.paintList(data.adrs ?? [], data.adrs?.length ? undefined : "No ADRs yet.");
    } catch {
      this.paintList([], "List endpoint unavailable — use the workspace file tree.");
    }
  }

  private paintList(adrs: AdrListItem[], note?: string) {
    if (!this.shadowRoot) return;
    const list = this.shadowRoot.getElementById("list");
    if (!list) return;
    if (adrs.length === 0) {
      list.innerHTML = `<li class="msg">${note ?? "No ADRs yet."}</li>`;
      return;
    }
    const workspaceId = this.getAttribute("workspace-id") ?? "";
    list.innerHTML = adrs
      .map(a => {
        const statusClass = a.status
          ? `s-${a.status.toLowerCase()}`
          : "s-draft";
        return `
          <li class="row">
            <a href="/workspace/${workspaceId}/${a.docId}" target="_blank">${this.escape(a.title)}</a>
            <span class="status ${statusClass}">${this.escape(a.status ?? "Draft")}</span>
          </li>
        `;
      })
      .join("");
  }

  private async createNew() {
    const workspaceId = this.getAttribute("workspace-id") ?? "";
    if (!workspaceId) throw new Error("workspace-id attribute missing");

    // Naive incrementing ID — picks up from list length. Rename on accept.
    const list = this.shadowRoot?.querySelectorAll(".row").length ?? 0;
    const nextNum = String(list + 1).padStart(3, "0");
    const title = `ADR-${nextNum}: Draft`;
    const markdown = ADR_TEMPLATE(nextNum);

    const res = await fetch(`${PORTAL_URL}/api/voxa/workspace-note`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, title, markdown }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    const { docId } = (await res.json()) as { docId: string };
    window.open(`/workspace/${workspaceId}/${docId}`, "_blank");
    // Refresh list
    this.loadList().catch(() => undefined);
  }

  private escape(s: string): string {
    return s.replace(/[&<>"']/g, c =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] ?? c
    );
  }
}

if (typeof customElements !== "undefined" && !customElements.get("voxa-adr")) {
  customElements.define("voxa-adr", VoxaAdrWidget);
}
