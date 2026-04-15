import type { VoxaBookBlockModel } from '@blocksuite/affine-model';
import { BlockComponent } from '@blocksuite/std';
import { css, html, nothing } from 'lit';
import { state } from 'lit/decorators.js';

/**
 * voxa:book block renderer.
 *
 * On mount: fetches lesson list from voxa-app GET /api/portal/books/:bookId/lessons.
 * Fetches student progress from GET /api/portal/student/data?types=grades.
 * Renders a list of lessons with locked/unlocked state.
 *
 * Locked  = lesson.lessonNumber > student.currentLesson
 * Unlocked = lesson.lessonNumber <= student.currentLesson
 *
 * Read-only: never writes back to voxa-app. All Yjs state is managed by the
 * block creation path (slash command handler) via standard BlockSuite transactions.
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

interface LessonListResponse {
  lessons: LessonItem[];
  currentLesson: number;
}

export class EmbedVoxaBookBlockComponent extends BlockComponent<VoxaBookBlockModel> {
  static override styles = css`
    :host {
      display: block;
    }

    .voxa-book-block {
      font-family: var(--affine-font-family, sans-serif);
      border: 1.5px solid var(--affine-border-color, #e0e0e0);
      border-radius: 10px;
      overflow: hidden;
      background: var(--affine-background-primary-color, #fff);
      user-select: none;
    }

    .book-header {
      padding: 16px 20px 14px;
      background: linear-gradient(135deg, #2d6a4f 0%, #1b4332 100%);
      color: #fff;
    }

    .book-number {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.8;
      margin-bottom: 4px;
    }

    .book-title {
      font-size: 18px;
      font-weight: 700;
      line-height: 1.3;
    }

    .lesson-list {
      padding: 8px 0;
      max-height: 400px;
      overflow-y: auto;
    }

    .lesson-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 20px;
      cursor: pointer;
      transition: background 0.12s;
    }

    .lesson-row:hover.unlocked {
      background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
    }

    .lesson-row.locked {
      cursor: default;
      opacity: 0.45;
    }

    .lesson-icon {
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .lesson-number {
      font-size: 12px;
      color: var(--affine-text-secondary-color, #888);
      min-width: 24px;
    }

    .lesson-title {
      font-size: 14px;
      color: var(--affine-text-primary-color, #333);
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .status-bar {
      padding: 10px 20px;
      border-top: 1px solid var(--affine-border-color, #e0e0e0);
      font-size: 12px;
      color: var(--affine-text-secondary-color, #888);
      background: var(--affine-background-secondary-color, #f8f8f8);
    }

    .loading-state {
      padding: 32px 20px;
      text-align: center;
      color: var(--affine-text-secondary-color, #888);
      font-size: 14px;
    }

    .error-state {
      padding: 20px;
      color: var(--affine-error-color, #d93025);
      font-size: 13px;
    }

    .unlock-icon {
      color: #2d6a4f;
    }

    .lock-icon {
      color: var(--affine-text-secondary-color, #bbb);
    }
  `;

  @state()
  private accessor _lessons: LessonItem[] = [];

  @state()
  private accessor _currentLesson = 0;

  @state()
  private accessor _loading = true;

  @state()
  private accessor _error: string | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this._fetchData().catch(console.error);
  }

  private async _fetchData(): Promise<void> {
    const { bookId } = this.model.props;
    if (!bookId) {
      this._loading = false;
      this._error = 'Block misconfigured: missing bookId';
      return;
    }

    try {
      const [lessonsRes, progressRes] = await Promise.allSettled([
        fetch(`${VOXA_APP_URL}/api/portal/books/${encodeURIComponent(bookId)}/lessons`, {
          credentials: 'include',
        }),
        fetch(`${VOXA_APP_URL}/api/portal/student/data?types=grades`, {
          credentials: 'include',
        }),
      ]);

      // Parse lesson list
      let rawLessons: Array<{ lessonNumber: number; title: string }> = [];
      if (lessonsRes.status === 'fulfilled' && lessonsRes.value.ok) {
        const data = (await lessonsRes.value.json()) as {
          lessons: Array<{ lessonNumber: number; title: string }>;
        };
        rawLessons = data.lessons ?? [];
      }

      // Parse student progress
      let currentLesson = 0;
      if (progressRes.status === 'fulfilled' && progressRes.value.ok) {
        const data = (await progressRes.value.json()) as {
          grades?: {
            books: Array<{ bookId: string; currentLesson: number }>;
          };
        };
        const bookProgress = data.grades?.books?.find(b => b.bookId === bookId);
        currentLesson = bookProgress?.currentLesson ?? 0;
      }

      this._currentLesson = currentLesson;
      this._lessons = rawLessons.map(l => ({
        lessonNumber: l.lessonNumber,
        title: l.title || `Lesson ${l.lessonNumber}`,
        isUnlocked: l.lessonNumber <= currentLesson,
      }));
    } catch (err) {
      this._error = `Failed to load book data: ${(err as Error).message}`;
      // Render all lessons as locked on error — fail safe
      this._lessons = [];
    } finally {
      this._loading = false;
    }
  }

  private _renderLockIcon(unlocked: boolean) {
    if (unlocked) {
      // Checkmark / open lock
      return html`<svg
        class="unlock-icon"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <path d="M6.5 11.5L4 9l.7-.7 1.8 1.8 4.8-4.8.7.7z" />
      </svg>`;
    }
    // Lock icon
    return html`<svg
      class="lock-icon"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="currentColor"
    >
      <rect x="3" y="6" width="8" height="6" rx="1" />
      <path
        d="M5 6V4.5a2 2 0 0 1 4 0V6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.2"
      />
    </svg>`;
  }

  override renderBlock() {
    const { bookNumber, displayTitle } = this.model.props;
    const title = displayTitle || `Book ${bookNumber}`;

    if (this._loading) {
      return html`<div class="voxa-book-block">
        <div class="book-header">
          <div class="book-number">Book ${bookNumber}</div>
          <div class="book-title">${title}</div>
        </div>
        <div class="loading-state">Loading lessons…</div>
      </div>`;
    }

    if (this._error) {
      return html`<div class="voxa-book-block">
        <div class="book-header">
          <div class="book-number">Book ${bookNumber}</div>
          <div class="book-title">${title}</div>
        </div>
        <div class="error-state">${this._error}</div>
      </div>`;
    }

    const unlockedCount = this._lessons.filter(l => l.isUnlocked).length;

    return html`<div class="voxa-book-block">
      <div class="book-header">
        <div class="book-number">Book ${bookNumber}</div>
        <div class="book-title">${title}</div>
      </div>
      <div class="lesson-list">
        ${this._lessons.length === 0
          ? html`<div class="loading-state">No lessons found.</div>`
          : this._lessons.map(
              lesson => html`
                <div
                  class="lesson-row ${lesson.isUnlocked ? 'unlocked' : 'locked'}"
                >
                  <div class="lesson-icon">
                    ${this._renderLockIcon(lesson.isUnlocked)}
                  </div>
                  <span class="lesson-number">${lesson.lessonNumber}</span>
                  <span class="lesson-title">${lesson.title}</span>
                </div>
              `
            )}
      </div>
      ${this._lessons.length > 0
        ? html`<div class="status-bar">
            ${unlockedCount} of ${this._lessons.length} lessons unlocked
          </div>`
        : nothing}
    </div>`;
  }
}
