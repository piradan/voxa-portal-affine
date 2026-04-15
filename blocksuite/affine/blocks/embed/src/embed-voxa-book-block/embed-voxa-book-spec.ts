import { VoxaBookBlockSchema } from '@blocksuite/affine-model';
import type { SlashMenuConfig } from '@blocksuite/affine-widget-slash-menu';
import { SlashMenuConfigExtension } from '@blocksuite/affine-widget-slash-menu';
import { BlockViewExtension, FlavourExtension } from '@blocksuite/std';
import type { ExtensionType } from '@blocksuite/store';
import { html } from 'lit';
import { literal } from 'lit/static-html.js';

const flavour = VoxaBookBlockSchema.model.flavour;

/**
 * Slash menu entry for the voxa:book block.
 * Type /book in a Portal doc to insert.
 */
const voxaBookSlashMenuConfig: SlashMenuConfig = {
  items: [
    {
      name: 'Book',
      description: 'Embed a Voxa book with lesson list.',
      icon: html`<span style="font-size:18px">📚</span>`,
      group: '4_Content & Media@10',
      when: ({ model }) =>
        model.store.schema.flavourSchemaMap.has(flavour),
      action: ({ std, model }) => {
        const { host } = std;
        const parentModel = host.store.getParent(model);
        if (!parentModel) return;

        const index = parentModel.children.indexOf(model) + 1;

        // Prompt for bookId — in a full implementation this would open a modal
        // to pick from available books. For now use a simple prompt.
        const bookId = window.prompt(
          'Enter Voxa Book ID (UUID from voxa-app):',
          ''
        );
        if (!bookId?.trim()) return;

        const bookNumberStr = window.prompt('Enter book number (1, 2, 3...):', '1');
        const bookNumber = parseInt(bookNumberStr ?? '1', 10) || 1;

        const titleInput = window.prompt('Enter book title:', `Book ${bookNumber}`);
        const displayTitle = titleInput?.trim() || `Book ${bookNumber}`;

        // Insert block via standard BlockSuite transaction (Yjs-safe)
        std.store.addBlock(
          flavour,
          {
            bookId: bookId.trim(),
            bookNumber,
            displayTitle,
          },
          parentModel,
          index
        );

        // Remove the placeholder text block created by the slash command
        if (model.text?.length === 0) {
          std.store.deleteBlock(model);
        }
      },
    },
  ],
};

export const EmbedVoxaBookViewExtensions: ExtensionType[] = [
  FlavourExtension(flavour),
  BlockViewExtension(flavour, _model => literal`affine-embed-voxa-book-block`),
  SlashMenuConfigExtension(flavour, voxaBookSlashMenuConfig),
];
