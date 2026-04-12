/**
 * voxa:eve — AI Assistant Eve block
 *
 * Embeds the Eve AI chat interface from voxa-app as an iframe.
 * Intended for staff, teacher, and internal workspaces.
 * Role-gated in the embed page — non-staff see an access denied message.
 *
 * Usage: Insert as a custom HTML/embed block in an AFFiNE doc.
 * The iframe loads /embed/eve from voxa-app, which handles auth
 * via the existing NextAuth session (shared cookie domain).
 *
 * Attributes:
 *   height  — iframe height in px (default: 600)
 *   title   — accessible title (default: "Eve AI Assistant")
 */

const VOXA_APP_URL =
  typeof window !== "undefined"
    ? window.location.origin.includes("portal.voxa.education")
      ? "https://dev.voxa.education"
      : "http://localhost:3000"
    : "http://localhost:3000";

export class VoxaEveWidget extends HTMLElement {
  static get observedAttributes() {
    return ["height", "title"];
  }

  connectedCallback() {
    this.attachShadow({ mode: "open" });
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    if (!this.shadowRoot) return;
    const height = this.getAttribute("height") ?? "600";
    const title = this.getAttribute("title") ?? "Eve AI Assistant";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; }
        iframe {
          width: 100%;
          height: ${height}px;
          border: none;
          border-radius: 12px;
          overflow: hidden;
        }
      </style>
      <iframe
        src="${VOXA_APP_URL}/embed/eve"
        title="${title}"
        allow="microphone; clipboard-write"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
      ></iframe>
    `;
  }
}

if (typeof customElements !== "undefined" && !customElements.get("voxa-eve")) {
  customElements.define("voxa-eve", VoxaEveWidget);
}
