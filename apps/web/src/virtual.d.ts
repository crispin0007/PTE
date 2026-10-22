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

declare module 'virtual:openpte/phones' {
  /** Question id to the expected sounds of each word (IPA phones, space separated). */
  const phones: Record<string, string[]>;
  export default phones;
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Folder of the in-browser phoneme model (model.onnx, phonemes.json). Default ./phonemes/ */
  readonly VITE_PHONEME_MODEL_URL?: string;
  /** Who to contact about data, shown on the privacy page. */
  readonly VITE_CONTACT_EMAIL?: string;
}
