/**
 * voxa:livekit — LiveKit class session block
 *
 * Embeds a LiveKit room in an AFFiNE canvas block.
 * After class, links to the Cloudglue transcript doc in the same workspace.
 *
 * Architecture:
 *   - Uses LiveKit JS SDK (loaded from CDN for now)
 *   - Connects to wss://livekit.voxa.education
 *   - Requires Traefik CSP header: wss://livekit.voxa.education
 *   - Room token fetched from Voxa API: GET /api/admin/livekit/token?room=X
 *
 * Phase K implementation notes:
 *   - CSP: Add `wss://livekit.voxa.education` to Traefik Content-Security-Policy
 *   - Room token endpoint needed in voxa-app
 *   - Post-class: search workspace docs for matching Cloudglue transcript
 */

export class VoxaLivekitWidget extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: "open" });
    this.render();
  }

  private render() {
    if (!this.shadowRoot) return;
    const roomName = this.getAttribute("room") ?? "";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; min-height: 400px; }
        .container {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; background: #0f0f10; border-radius: 8px;
          min-height: 400px; color: white; font-family: sans-serif;
        }
        .title { font-size: 18px; margin-bottom: 8px; }
        .subtitle { font-size: 13px; color: #888; }
        button {
          margin-top: 16px; padding: 10px 24px; background: #47b319;
          color: white; border: none; border-radius: 6px; cursor: pointer;
          font-size: 14px;
        }
        button:hover { background: #3a9614; }
      </style>
      <div class="container">
        <div class="title">Voxa LiveKit</div>
        <div class="subtitle">${roomName ? `Room: ${roomName}` : "No room configured"}</div>
        ${roomName ? '<button id="join-btn">Join Class</button>' : ""}
      </div>
    `;

    this.shadowRoot.querySelector("#join-btn")?.addEventListener("click", () => {
      this.joinRoom(roomName);
    });
  }

  private joinRoom(roomName: string) {
    // TODO: Fetch token from voxa-app, initialize LiveKit SDK
    console.log(`[VoxaLivekit] Joining room: ${roomName}`);
    alert(`LiveKit room ${roomName} — Phase K: full SDK integration pending`);
  }
}

if (typeof customElements !== "undefined") {
  customElements.define("voxa-livekit", VoxaLivekitWidget);
}
