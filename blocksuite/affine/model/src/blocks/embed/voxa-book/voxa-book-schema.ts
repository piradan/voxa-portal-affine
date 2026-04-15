import { BlockSchemaExtension } from '@blocksuite/store';

import { createEmbedBlockSchema } from '../../../utils/index.js';
import {
  defaultVoxaBookBlockProps,
  type VoxaBookBlockProps,
  VoxaBookBlockModel,
} from './voxa-book-model.js';

export const VoxaBookBlockSchema = createEmbedBlockSchema({
  name: 'voxa-book',
  version: 1,
  toModel: () => new VoxaBookBlockModel(),
  props: (): VoxaBookBlockProps => defaultVoxaBookBlockProps,
});

export const VoxaBookBlockSchemaExtension = BlockSchemaExtension(
  VoxaBookBlockSchema
);
