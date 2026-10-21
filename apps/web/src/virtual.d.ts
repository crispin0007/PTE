declare module 'virtual:openpte/catalog' {
  import type { ItemTypeDef } from '@openpte/schema';
  import type { Question, QuestionType } from '@openpte/schema';
  export const registry: (ItemTypeDef & { id: QuestionType })[];
  export const counts: Record<QuestionType, number>;
  export const includesUnreviewed: boolean;
  /** content-assets paths that exist on disk; audio is missing until TTS has run. */
  export const availableAssets: string[];
  export const loaders: Record<QuestionType, () => Promise<Question[]>>;
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}
