import type { QuestionType, Skill } from '@openpte/schema';

export const SKILL_META: Record<Skill, { label: string; color: string; soft: string }> = {
  speaking: { label: 'Speaking', color: 'bg-speak', soft: 'border-speak' },
  writing: { label: 'Writing', color: 'bg-write', soft: 'border-write' },
  reading: { label: 'Reading', color: 'bg-read', soft: 'border-read' },
  listening: { label: 'Listening', color: 'bg-listen', soft: 'border-listen' },
};

/** Short code learners use for each type, and a one-line tip written for openpte. */
export const TYPE_GUIDE: Record<QuestionType, { code: string; tip: string }> = {
  speaking_read_aloud: {
    code: 'RA',
    tip: 'Read at a steady pace. Pausing at commas sounds natural; restarting a sentence does not.',
  },
  speaking_repeat_sentence: {
    code: 'RS',
    tip: 'Keep talking even if you miss a word. Rhythm counts as much as every word.',
  },
  speaking_describe_image: {
    code: 'DI',
    tip: 'Name the topic, give the biggest and smallest values, then one trend and a conclusion.',
  },
  speaking_retell_lecture: {
    code: 'RL',
    tip: 'Note key nouns while you listen, then link them into four or five sentences.',
  },
  speaking_answer_short_question: {
    code: 'ASQ',
    tip: 'One word or a short phrase is enough. Speak as soon as you know it.',
  },
  speaking_summarize_group_discussion: {
    code: 'SGD',
    tip: 'Say who held which view and where they agreed. Keep it to the main points.',
  },
  speaking_respond_to_situation: {
    code: 'RTS',
    tip: 'Answer the person in the situation directly, politely, with a reason and a next step.',
  },
  writing_summarize_written_text: {
    code: 'SWT',
    tip: 'One sentence, 5 to 75 words. Join the main idea and one support with a linking word.',
  },
  writing_essay: {
    code: 'WE',
    tip: 'Plan four paragraphs: position, two reasons with examples, and a short conclusion.',
  },
  reading_fib_dropdown: {
    code: 'RWFIB',
    tip: 'Read the whole sentence first. Grammar often rules out two options straight away.',
  },
  reading_mcq_multiple: {
    code: 'MCMA',
    tip: 'Wrong picks cost a point, so choose only the options the passage clearly supports.',
  },
  reading_reorder_paragraphs: {
    code: 'RO',
    tip: 'Find the sentence that needs no context to start, then follow pronouns and linkers.',
  },
  reading_fib_drag_drop: {
    code: 'RFIB',
    tip: 'Check each word fits both the meaning and the grammar of the gap.',
  },
  reading_mcq_single: {
    code: 'MCSA',
    tip: 'Read the question before the passage, then look for the sentence that answers it.',
  },
  listening_summarize_spoken_text: {
    code: 'SST',
    tip: 'Write 50 to 70 words: the main point, two supporting details and how it ends.',
  },
  listening_mcq_multiple: {
    code: 'LMCMA',
    tip: 'Wrong picks cost a point. Only choose what the speaker actually said.',
  },
  listening_fib: {
    code: 'LFIB',
    tip: 'Type each word as you hear it, then check spelling. Spelling must be exact.',
  },
  listening_highlight_correct_summary: {
    code: 'HCS',
    tip: 'Rule out summaries that add details the speaker never mentioned.',
  },
  listening_mcq_single: {
    code: 'LMCSA',
    tip: 'Listen for the speaker’s main purpose, not a single detail.',
  },
  listening_select_missing_word: {
    code: 'SMW',
    tip: 'Follow the direction of the argument; the missing end usually completes it.',
  },
  listening_highlight_incorrect_words: {
    code: 'HIW',
    tip: 'Follow the text with your eyes and click as soon as a word differs. Wrong clicks cost.',
  },
  listening_write_from_dictation: {
    code: 'WFD',
    tip: 'Every correct word scores. Write what you remember even if the sentence is not complete.',
  },
};
