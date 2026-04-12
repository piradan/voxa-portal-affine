/**
 * voxa:grades — Student book progress panel
 *
 * Fetches from GET /api/portal/student/data?types=grades on voxa-app
 * and renders a progress summary in the Portal canvas.
 */

const VOXA_APP_URL = "https://dev.voxa.education";

export class VoxaGradesWidget extends HTMLElement {
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
      .row { display: flex; justify-content: space-between; padding: 4px 0;
             border-bottom: 1px solid #f0f0f0; font-size: 13px; }
      .status { padding: 2px 8px; border-radius: 4px; font-size: 11px; }
      .in_progress { background: #fff3cd; color: #856404; }
      .completed { background: #d4edda; color: #155724; }
      .paused { background: #f8d7da; color: #721c24; }
    </style>
    <div class="card"><h3>My Progress</h3><div id="content">Loading...</div></div>`;

    try {
      const res = await fetch(
        `${VOXA_APP_URL}/api/portal/student/data?types=grades`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { grades } = await res.json() as { grades: { books: { bookId: string; currentLesson: number; lessonsCompleted: number; status: string }[] } };

      const content = this.shadowRoot!.querySelector("#content")!;
      if (!grades.books.length) {
        content.textContent = "No books assigned yet.";
        return;
      }
      content.innerHTML = grades.books
        .map(
          (b) => `
          <div class="row">
            <span>Book</span>
            <span>Lesson ${b.currentLesson} · ${b.lessonsCompleted} done</span>
            <span class="status ${b.status}">${b.status.replace("_", " ")}</span>
          </div>`
        )
        .join("");
    } catch (err) {
      this.shadowRoot!.querySelector("#content")!.textContent =
        `Error loading grades: ${(err as Error).message}`;
    }
  }
}

if (typeof customElements !== "undefined") {
  customElements.define("voxa-grades", VoxaGradesWidget);
}
