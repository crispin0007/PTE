// Plain constants with no Zod import, so app code can use them without bundling the schema library.

export const SKILLS = ['speaking', 'writing', 'reading', 'listening'] as const;
export const SECTIONS = ['speaking_writing', 'reading', 'listening'] as const;
export const ENABLING_SKILLS = [
  'grammar',
  'oral_fluency',
  'pronunciation',
  'spelling',
  'vocabulary',
  'written_discourse',
] as const;
