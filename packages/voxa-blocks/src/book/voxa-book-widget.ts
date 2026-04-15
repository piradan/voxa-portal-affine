/**
 * voxa:book — Book cover + lesson list web component
 *
 * Fetches book lesson list from voxa-app GET /api/portal/books/:bookId/lessons
 * and student progress from GET /api/portal/student/data?types=grades.
 * Renders locked/unlocked state per lesson based on student.currentLesson.
 *
 * Used as a fallback web component (e.g. in embed-html contexts).
 * The canonical BlockSuite block is in:
 *   blocksuite/affine/blocks/embed/src/embed-voxa-book-block/
 *
 * Attributes:
 *   book-id      — UUID of the book (required)
 *   book-number  — Display number (default: "")
 *   title        — Display title (default: "")
 */

const VOXA_APP_URL =
  typeof window !== 'undefined'
    ? window.location.origin.includes('portal.voxa.education')
      ? 'https://dev.voxa.education'
      : 'http://localhost:3000'
    : 'http://localhost:3000';

interface LessonItem {
  lessonNumber: number;
  title: string;
  isUnlocked: boolean;
}

export class VoxaBookWidget extends HTMLElement {
  static get observedAttributes() {
    return ['book-id', 'book-number', 'title'];
  }

  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.render('Loading…');
    this.load().catch(console.error);
  }

  attributeChangedCallback() {
    if (this.shadowRoot) {
      this.load().catch(console.error);
    }
  }

  private render(content: string) {
    if (!this.shadowRoot) return;
    const bookNumber = this.getAttribute('book-number') ?? '';
    const title = this.getAttribute('title') ?? (bookNumber ? `Book ${bookNumber}` : 'Book');

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .card {
          border: 1.5px solid #e0e0e0;
          border-radius: 10px;
          overflow: hidden;
          font-family: sans-serif;
          background: #fff;
        }
        .header {
          padding: 14px 18px;
          background: linear-gradient(135deg, #2d6a4f, #1b4332);
          color: #fff;
        }
        .book-num { font-size: 11px; font-weight: 600; letter-spacing: .08em; opacity: .8; text-transform: uppercase; }
        .book-title { font-size: 17px; font-weight: 700; margin-top: 3px; }
        #content { padding: 0; }
        .lesson { display: flex; align-items: center; gap: 10px; padding: 9px 18px; font-size: 13px; }
        .lesson.locked { opacity: .4; }
        .num { color: #888; min-width: 22px; font-size: 12px; }
        .lbl { flex: 1; }
        .icon { width: 16px; text-align: center; }
        .footer { padding: 8px 18px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888; background: #f8f8f8; }
        .msg { padding: 20px 18px; color: #888; font-size: 13px; }
      </style>
      <div class="card">
        <div class="header">
          ${bookNumber ? `<div class="book-num">Book ${bookNumber}</div>` : ''}
          <div class="book-title">${title}</div>
        </div>
        <div id="content"><div class="msg">${content}</div></div>
      </div>
    `;
  }

  private async load() {
    const bookId = this.getAttribute('book-id');
    if (!bookId) {
      this.render('Missing book-id attribute.');
      return;
    }

    const [lessonsRes, progressRes] = await Promise.allSettled([
      fetch(`${VOXA_APP_URL}/api/portal/books/${encodeURIComponent(bookId)}/lessons`, { credentials: 'include' }),
      fetch(`${VOXA_APP_URL}/api/portal/student/data?types=grades`, { credentials: 'include' }),
    ]);

    let rawLessons: Array<{ lessonNumber: number; title: string }> = [];
    if (lessonsRes.status === 'fulfilled' && lessonsRes.value.ok) {
      const d = await lessonsRes.value.json() as { lessons: Array<{ lessonNumber: number; title: string }> };
      rawLessons = d.lessons ?? [];
    }

    let currentLesson = 0;
    if (progressRes.status === 'fulfilled' && progressRes.value.ok) {
      const d = await progressRes.value.json() as { grades?: { books: Array<{ bookId: string; currentLesson: number }> } };
      const bp = d.grades?.books?.find(b => b.bookId === bookId);
      currentLesson = bp?.currentLesson ?? 0;
    }

    const lessons: LessonItem[] = rawLessons.map(l => ({
      lessonNumber: l.lessonNumber,
      title: l.title || `Lesson ${l.lessonNumber}`,
      isUnlocked: l.lessonNumber <= currentLesson,
    }));

    const unlocked = lessons.filter(l => l.isUnlocked).length;
    const contentHtml = lessons.length === 0
      ? '<div class="msg">No lessons found.</div>'
      : lessons.map(l => `
          <div class="lesson ${l.isUnlocked ? 'unlocked' : 'locked'}">
            <span class="icon">${l.isUnlocked ? '✓' : '🔒'}</span>
            <span class="num">${l.lessonNumber}</span>
            <span class="lbl">${l.title}</span>
          </div>
        `).join('') + `<div class="footer">${unlocked} of ${lessons.length} lessons unlocked</div>`;

    const bookNumber = this.getAttribute('book-number') ?? '';
    const title = this.getAttribute('title') ?? (bookNumber ? `Book ${bookNumber}` : 'Book');

    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .card { border: 1.5px solid #e0e0e0; border-radius: 10px; overflow: hidden; font-family: sans-serif; background: #fff; }
        .header { padding: 14px 18px; background: linear-gradient(135deg, #2d6a4f, #1b4332); color: #fff; }
        .book-num { font-size: 11px; font-weight: 600; letter-spacing: .08em; opacity: .8; text-transform: uppercase; }
        .book-title { font-size: 17px; font-weight: 700; margin-top: 3px; }
        #content { }
        .lesson { display: flex; align-items: center; gap: 10px; padding: 9px 18px; font-size: 13px; }
        .lesson.locked { opacity: .4; }
        .num { color: #888; min-width: 22px; font-size: 12px; }
        .lbl { flex: 1; }
        .icon { width: 16px; text-align: center; }
        .footer { padding: 8px 18px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888; background: #f8f8f8; }
        .msg { padding: 20px 18px; color: #888; font-size: 13px; }
      </style>
      <div class="card">
        <div class="header">
          ${bookNumber ? `<div class="book-num">Book ${bookNumber}</div>` : ''}
          <div class="book-title">${title}</div>
        </div>
        <div id="content">${contentHtml}</div>
      </div>
    `;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('voxa-book')) {
  customElements.define('voxa-book', VoxaBookWidget);
}
