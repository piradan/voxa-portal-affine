import { BlockModel } from '@blocksuite/store';

import { defineEmbedModel } from '../../../utils/index.js';

/**
 * voxa:book block — displays a Voxa book cover with lesson list.
 * Lessons are progressively unlocked based on student progress fetched
 * from voxa-app at render time. Block is read-only (no back-writes to voxa-app).
 */
export type VoxaBookBlockProps = {
  /** UUID of the book in voxa-app's hybrid_books table */
  bookId: string;
  /** Human-readable book number (1, 2, 3, ...) */
  bookNumber: number;
  /** Display title stored in Yjs so it shows without a network fetch */
  displayTitle: string;
};

export const defaultVoxaBookBlockProps: VoxaBookBlockProps = {
  bookId: '',
  bookNumber: 0,
  displayTitle: '',
};

export class VoxaBookBlockModel extends defineEmbedModel<VoxaBookBlockProps>(
  BlockModel
) {}
