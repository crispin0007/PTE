/**
 * Every scoring rule named by `scoring_rule` in content/item-types.yaml. Phase 0 only lists them;
 * each gets an implementation, unit tests against hand-computed cases and a citation to Pearson's
 * published score guide when its item type is built (Phase 1 onward). See AGENTS.md section 6.
 */
export const SCORING_RULES = {
  mcq_single: 'Correct option 1, otherwise 0',
  mcq_multiple_negative: '+1 per correct option, -1 per incorrect option, minimum 0',
  reorder_adjacent_pairs: '1 per correctly ordered adjacent pair',
  fib_per_blank: '1 per correct blank',
  fib_per_blank_spelling: '1 per correct blank, spelling must be exact',
  hiw_plus_minus: '+1 per correct highlight, -1 per wrong highlight, minimum 0',
  wfd_per_word: '1 per correct word of the reference sentence, spelling checked',
  writing_swt: 'Content, form (one sentence, 5-75 words), grammar, vocabulary',
  writing_sst: 'Content, form (50-70 words), grammar, vocabulary, spelling',
  writing_essay:
    'Content, form (200-300 words), development, grammar, linguistic range, vocabulary, spelling',
  speaking_read_aloud: 'Content (word match), oral fluency, pronunciation',
  speaking_repeat_sentence: 'Content (word match), oral fluency, pronunciation',
  speaking_short_answer: 'Vocabulary: matches an accepted answer',
  speaking_open_response: 'Content (key points), oral fluency, pronunciation',
} as const;

export type ScoringRuleId = keyof typeof SCORING_RULES;
