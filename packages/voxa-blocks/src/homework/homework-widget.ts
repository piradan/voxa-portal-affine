/**
 * voxa:homework — Homework activity block
 *
 * Wraps a Moodle/Genially activity in an iframe inside the Portal canvas.
 * Listens for xAPI postMessage events from the activity and forwards them
 * to Voxa's LRS proxy (/api/admin/xapi/forward).
 *
 * Usage in AFFiNE doc: insert as an embed iframe pointing to the activity URL.
 * The xAPI forwarding is handled by this script injected into the iframe context.
 *
 * Architecture: This is a web component that can be embedded in an AFFiNE doc
 * as a custom HTML block or via the embed-iframe block type.
 *
 * Registration: See index.ts for ViewExtension registration.
 */

const VOXA_APP_URL =
  typeof window !== "undefined"
    ? window.location.origin.includes("portal.voxa.education")
      ? "https://dev.voxa.education"
      : "http://localhost:3000"
    : "";

/**
 * Listen for xAPI statements posted from activity iframes and forward to LRS.
 * Called once per page/workspace load.
 */
export function initHomeworkXapiListener() {
  window.addEventListener("message", async (event) => {
    // Accept messages from known domains only
    const trustedOrigins = [
      "https://moodle.voxa.education",
      "https://genially.com",
      "http://localhost",
    ];
    const isTrusted = trustedOrigins.some((origin) =>
      event.origin.startsWith(origin)
    );
    if (!isTrusted) return;

    const data = event.data as unknown;
    if (
      typeof data !== "object" ||
      data === null ||
      !("statement" in data)
    ) {
      return;
    }

    const statement = (data as { statement: unknown }).statement;

    try {
      const res = await fetch(`${VOXA_APP_URL}/api/admin/xapi/forward`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statement),
      });

      // Notify the activity of the result
      if (event.source) {
        (event.source as WindowProxy).postMessage(
          { type: "xapi:result", status: res.status, ok: res.ok },
          event.origin
        );
      }
    } catch (err) {
      console.error("[VoxaHomework] xAPI forward failed:", err);
    }
  });
}

/**
 * Simple web component wrapper for homework activities.
 * Renders as an iframe with the activity URL + xAPI listener.
 */
export class VoxaHomeworkWidget extends HTMLElement {
  private iframe: HTMLIFrameElement | null = null;

  static get observedAttributes() {
    return ["src", "height"];
  }

  connectedCallback() {
    this.attachShadow({ mode: "open" });
    this.render();
    initHomeworkXapiListener();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    if (!this.shadowRoot) return;
    const src = this.getAttribute("src") ?? "";
    const height = this.getAttribute("height") ?? "600";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; }
        .container { border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
        iframe { width: 100%; height: ${height}px; border: none; }
        .badge { display: none; padding: 8px 16px; background: #47b319; color: white;
                 font-family: sans-serif; font-size: 13px; }
        .badge.visible { display: block; }
      </style>
      <div class="container">
        <iframe
          src="${src}"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          allow="fullscreen"
        ></iframe>
        <div class="badge" id="completion-badge">✓ Completed</div>
      </div>
    `;

    this.iframe = this.shadowRoot.querySelector("iframe");
  }

  /**
   * Mark activity as complete — shows the completion badge.
   * Called when LRS confirms an xAPI completion statement.
   */
  markComplete() {
    const badge = this.shadowRoot?.querySelector("#completion-badge");
    badge?.classList.add("visible");
  }
}

if (typeof customElements !== "undefined") {
  customElements.define("voxa-homework", VoxaHomeworkWidget);
}
