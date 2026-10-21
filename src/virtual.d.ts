declare module 'virtual:openpte/catalog' {
  import type { ItemTypeDef } from './schema/registry.ts';
  import type { Question, QuestionType } from './schema/questions.ts';
  export const registry: (ItemTypeDef & { id: QuestionType })[];
  export const counts: Record<QuestionType, number>;
  export const includesUnreviewed: boolean;
  /** content-assets paths that exist on disk; audio is missing until TTS has run. */
  export const availableAssets: string[];
  export const loaders: Record<QuestionType, () => Promise<Question[]>>;
}
