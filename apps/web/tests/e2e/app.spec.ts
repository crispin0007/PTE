import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const TRADEMARK = 'Not affiliated with, endorsed by, or connected to Pearson';

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    serious.map(
      (v) =>
        `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ') + ' ' + (n.failureSummary ?? '').split('\n')[1]).join('; ')})`,
    ),
  ).toEqual([]);
}

test('home page shows the trademark notice and is accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('trademark-notice')).toContainText(TRADEMARK);
  await expectAccessible(page);
});

test('practice menu lists all 22 question types', async ({ page }) => {
  await page.goto('/#/practice');
  await expect(page.getByRole('heading', { name: 'Practice by question type' })).toBeVisible();
  await expect(page.locator('main li a')).toHaveCount(22);
  await expectAccessible(page);
});

const q = (type: string, n = 1) => `/#/practice/${type}/${type.replaceAll('_', '-')}-000${n}`;

async function submitAndExpect(page: Page, score: string) {
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByTestId('score')).toHaveText(score);
  await expect(page.getByTestId('score-disclaimer')).toContainText('not an official PTE score');
  await expect(page.getByTestId('trademark-notice')).toContainText(TRADEMARK);
  await expectAccessible(page);
}

test.describe('reading questions can be answered and scored', () => {
  test('multiple choice, single answer', async ({ page }) => {
    await page.goto(q('reading_mcq_single'));
    await page.getByRole('radio').first().check();
    await expectAccessible(page);
    await submitAndExpect(page, '1 / 1');
    await page.getByRole('button', { name: 'Retry' }).click();
    await page.getByRole('radio').nth(1).check();
    await submitAndExpect(page, '0 / 1');
  });

  test('multiple choice, multiple answers subtracts wrong picks', async ({ page }) => {
    await page.goto(q('reading_mcq_multiple'));
    // Key is A, C, D. Picking A, C and B gives 2 - 1 = 1.
    for (const i of [0, 2, 1]) await page.getByRole('checkbox').nth(i).check();
    await submitAndExpect(page, '1 / 3');
  });

  test('fill in the blanks with dropdowns', async ({ page }) => {
    await page.goto(q('reading_fib_dropdown'));
    await page.getByLabel('Blank 1').selectOption('partnership');
    await page.getByLabel('Blank 2').selectOption('supply');
    await page.getByLabel('Blank 3').selectOption('holds on');
    await submitAndExpect(page, '2 / 4');
    await expect(page.getByTestId('question')).toContainText('✓ breaks down');
  });

  test('fill in the blanks from a word bank', async ({ page }) => {
    await page.goto(q('reading_fib_drag_drop'));
    const bank = page.getByRole('region', { name: 'Word bank' });
    for (const w of ['drifted', 'rejected', 'melted'])
      await bank.getByRole('button', { name: w }).click();
    await expectAccessible(page);
    await submitAndExpect(page, '2 / 3');
  });

  test('re-order paragraphs scores neighbouring pairs', async ({ page }) => {
    await page.goto(q('reading_reorder_paragraphs'));
    // Sort into the right order with the move buttons: paragraph texts are known.
    const order = ['In 1928', 'Around the mould', 'However, he', 'A decade later', 'Their work'];
    for (let target = 0; target < order.length; target++) {
      const items = page.locator('main ol > li');
      let at = -1;
      for (let i = 0; i < order.length; i++) {
        if ((await items.nth(i).innerText()).includes(order[target]!)) at = i;
      }
      for (; at > target; at--) {
        await page.getByRole('button', { name: `Move paragraph ${at + 1} up` }).click();
      }
    }
    await submitAndExpect(page, '4 / 4');
  });

  test('attempts drive the status dots and the Next button', async ({ page }) => {
    await page.goto(q('reading_mcq_single'));
    await page.getByRole('radio').nth(1).check();
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.getByRole('button', { name: 'Next question' }).click();
    await expect(page).toHaveURL(/reading-mcq-single-0002/);
    await page.goto('/#/practice/reading_mcq_single');
    await expect(page.locator('main ol li').first()).toContainText('No marks');
    await page.getByRole('button', { name: 'Mistakes' }).click();
    await expect(page.locator('main ol li')).toHaveCount(1);
  });
});

test.describe('listening questions can be answered and scored', () => {
  test('audio falls back to the device voice and a transcript', async ({ page }) => {
    await page.goto(q('listening_mcq_single'));
    await expect(page.getByRole('button', { name: 'Play audio' })).toBeVisible();
    await page.getByRole('button', { name: /Show the transcript/ }).click();
    await expect(page.getByTestId('question')).toContainText('Hide transcript');
    await page.getByRole('radio').nth(2).check();
    await submitAndExpect(page, '1 / 1');
  });

  test('multiple answers', async ({ page }) => {
    await page.goto(q('listening_mcq_multiple'));
    for (const i of [0, 1, 4]) await page.getByRole('checkbox').nth(i).check();
    await submitAndExpect(page, '1 / 3');
  });

  test('highlight correct summary and select missing word', async ({ page }) => {
    await page.goto(q('listening_highlight_correct_summary'));
    await page.getByRole('radio').nth(3).check();
    await submitAndExpect(page, '1 / 1');
    await page.goto(q('listening_select_missing_word'));
    await page.getByRole('radio').nth(1).check();
    await submitAndExpect(page, '0 / 1');
  });

  test('fill in the blanks needs exact spelling', async ({ page }) => {
    await page.goto(q('listening_fib'));
    await page.getByLabel('Blank 1').fill('Energy');
    await page.getByLabel('Blank 2').fill('warm');
    await page.getByLabel('Blank 3').fill('bleeching');
    await submitAndExpect(page, '2 / 4');
  });

  test('highlight incorrect words', async ({ page }) => {
    await page.goto(q('listening_highlight_incorrect_words'));
    const text = page.getByRole('region', { name: /Click the words/ });
    await text.getByRole('button', { name: 'dangerous', exact: true }).click();
    await text.getByRole('button', { name: 'green', exact: true }).click();
    await text.getByRole('button', { name: 'Coral', exact: true }).click();
    await expectAccessible(page);
    // 2 found, 1 wrong click: 2 - 1 = 1.
    await submitAndExpect(page, '1 / 3');
  });

  test('write from dictation counts words', async ({ page }) => {
    await page.goto(q('listening_write_from_dictation'));
    await page
      .getByLabel(/Type the sentence/)
      .fill('the assignment must be submited through the portal');
    // 9 words; "submitted" misspelled and "online" missing.
    await submitAndExpect(page, '7 / 9');
  });
});

test.describe('writing answers get form and spelling feedback', () => {
  test('summarize written text: one sentence', async ({ page }) => {
    await page.goto(q('writing_summarize_written_text'));
    const box = page.getByLabel('Your answer');
    await box.fill('This passage explains a problem. It also offers a solution.');
    await expect(page.getByTestId('question')).toContainText('2 sentences');
    await box.fill('The passage explains a problem and suggests a practical solution to it.');
    await expectAccessible(page);
    await submitAndExpect(page, '1 / 1');
    await expect(page.getByText('Sample answer', { exact: true })).toBeVisible();
  });

  test('essay: word count bands and spelling', async ({ page }) => {
    await page.goto(q('writing_essay'));
    const sentence = 'Technology has changed the way people study and work in many countries. ';
    // 12 words x 13 = 156 words: form 1 of 2. One misspelling: spelling 1 of 2.
    await page.getByLabel('Your answer').fill(sentence.repeat(13) + 'Thsi is wrong.');
    await submitAndExpect(page, '2 / 4');
    await expect(page.getByRole('table')).toContainText('Thsi');
  });

  test('summarize spoken text', async ({ page }) => {
    await page.goto(q('listening_summarize_spoken_text'));
    const text = 'The speaker describes how cities can plan for hotter summers. ';
    // 10 words x 6 = 60 words, all spelled correctly: 2 + 2.
    await page.getByLabel('Your answer').fill(text.repeat(6));
    await submitAndExpect(page, '4 / 4');
  });
});

test('answers drive Today and Progress across reloads', async ({ page }) => {
  await page.goto(q('reading_mcq_single'));
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.goto(q('reading_mcq_single', 2));
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.goto('/#/more');
  await page.getByLabel('Daily goal').selectOption('5');
  await page.reload();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Today');
  await expect(page.getByTestId('daily-goal')).toContainText('2 of 5 questions today');
  await expectAccessible(page);
  await page.goto('/#/progress');
  await expect(page.getByRole('meter', { name: 'Reading' })).toBeVisible();
  await expect(page.getByTestId('estimate')).toContainText('Answer 18 more questions');
  await expectAccessible(page);
});

test('progress shows an estimate after enough answers', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const day = 86_400_000;
    const attempts = Array.from({ length: 30 }, (_, i) => ({
      questionId: `reading-mcq-single-${String(i).padStart(4, '0')}`,
      type: 'reading_mcq_single',
      skill: i % 2 ? 'reading' : 'listening',
      score: i % 3 ? 1 : 0,
      max: 1,
      at: Date.now() - (i % 10) * day,
    }));
    localStorage.setItem(
      'openpte-history',
      JSON.stringify({
        version: 1,
        attempts,
        bookmarks: [],
        settings: { dailyGoal: 20, target: 65 },
      }),
    );
  });
  await page.goto('/#/progress');
  await page.reload();
  await expect(page.getByTestId('estimate')).toContainText('on the 10–90 scale');
  await expect(page.getByTestId('score-disclaimer')).toBeVisible();
  await expect(page.getByRole('img', { name: /Bar chart/ })).toBeVisible();
  await expectAccessible(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mistakes to retry' })).toBeVisible();
});

test.describe('speaking questions can be recorded and self-checked', () => {
  test('describe image: prepare, record, replay, key points', async ({ page }) => {
    await page.goto(q('speaking_describe_image'));
    await expect(page.getByTestId('question')).toContainText('Describe the image');
    const recorder = page.getByTestId('recorder');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(recorder).toHaveAttribute('data-phase', 'prep');
    await page.getByRole('button', { name: 'Skip preparation' }).click();
    await expect(recorder).toHaveAttribute('data-phase', 'recording');
    await expectAccessible(page);
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(recorder).toHaveAttribute('data-phase', 'done');
    const check = page.getByTestId('self-check');
    await expect(check.getByLabel('Your recording')).toBeVisible();
    // Chrome's WebM has no duration until the player is nudged; then it can be moved through.
    await expect
      .poll(() =>
        check.getByLabel('Your recording').evaluate((a: HTMLAudioElement) => ({
          duration: Number.isFinite(a.duration) && a.duration > 0.5,
          at: a.currentTime,
        })),
      )
      .toEqual({ duration: true, at: 0 });
    await check.getByRole('checkbox').first().check();
    await expect(check).toContainText(/1 of \d+ covered/);
    await expect(check).toContainText('stays on this device');
    await expect(page.getByTestId('trademark-notice')).toContainText(TRADEMARK);
    await expectAccessible(page);
  });

  test('repeat sentence records straight away and stops at the time limit', async ({ page }) => {
    await page.goto(q('speaking_repeat_sentence'));
    await page.getByRole('button', { name: 'Start recording' }).click();
    await expect(page.getByTestId('recorder')).toHaveAttribute('data-phase', 'done', {
      timeout: 20_000,
    });
    await expect(page.getByTestId('self-check')).toContainText('The sentence');
  });
});

test('describe-image chart loads', async ({ page }) => {
  await page.goto('/#/practice/speaking_describe_image/speaking-describe-image-0001');
  const img = page.getByTestId('question').getByRole('img');
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(
    true,
  );
});

test('dark mode can be selected and is accessible', async ({ page }) => {
  await page.goto('/#/more');
  await page.getByRole('main').getByRole('combobox', { name: 'Theme' }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectAccessible(page);
  await page.goto('/#/practice/reading_fib_dropdown/reading-fib-dropdown-0001');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByLabel('Blank 1').selectOption('partnership');
  await page.getByLabel('Blank 2').selectOption('deny');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expectAccessible(page);
});

test('main navigation reaches every tab', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const [label, heading] of [
    ['Practice', 'Practice by question type'],
    ['Progress', 'Progress'],
    ['More', 'More'],
    ['Today', 'Free PTE Academic practice'],
  ]) {
    await nav.getByRole('link', { name: label }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
  }
  await expectAccessible(page);
});

test('skill tabs narrow the practice hub', async ({ page }) => {
  await page.goto('/#/practice');
  await page
    .getByRole('navigation', { name: 'Skills' })
    .getByRole('link', { name: 'Reading' })
    .click();
  await expect(page.getByTestId('type-card')).toHaveCount(5);
  await page.getByTestId('type-card').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('main ol li')).toHaveCount(10);
  await expectAccessible(page);
});

test('a bookmarked question shows under the Bookmarked filter', async ({ page }) => {
  await page.goto('/#/practice/reading_mcq_single/reading-mcq-single-0002');
  await page.getByRole('button', { name: 'Bookmark' }).click();
  await expect(page.getByRole('button', { name: 'Bookmark' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.goto('/#/practice/reading_mcq_single');
  await page.getByRole('button', { name: 'Bookmarked' }).click();
  await expect(page.locator('main ol li')).toHaveCount(1);
  await expect(page.locator('main ol li')).toContainText('Question 2');
  await page.reload();
  await expect(page.locator('main ol li')).toHaveCount(1);
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.locator('main ol li')).toHaveCount(10);
});

test('the admin explains it needs the API on a static build', async ({ page }) => {
  await page.goto('/#/admin');
  await expect(page.getByText('The question bank admin needs the openpte API.')).toBeVisible();
  await page.goto('/#/more');
  await expect(page.getByText(/runs without a server, so there are no accounts/)).toBeVisible();
});

test('institutes explain they need the API on a static build', async ({ page }) => {
  await page.goto('/#/institutes');
  await expect(page.getByText('Institutes and classes need the openpte API.')).toBeVisible();
  await page.goto('/#/join/ABCD2345');
  await expect(page.getByText('Institutes and classes need the openpte API.')).toBeVisible();
});

test('unknown pages show a not-found message', async ({ page }) => {
  await page.goto('/#/practice/not_a_type');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test.describe('mock tests', () => {
  const startReading = async (page: Page) => {
    await page.goto('/#/mock');
    await page.getByRole('button', { name: 'Start Reading' }).click();
    await expect(page.getByRole('heading', { name: 'Part 1: Reading' })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Start part 1' }).click();
  };

  test('a reading mock runs in order with no going back and ends in a report', async ({ page }) => {
    await startReading(page);
    await expect(page.getByText('Question 1 of 15')).toBeVisible();
    await expect(page.getByRole('timer', { name: 'Time left in Reading' })).toBeVisible();
    await expect(page.getByLabel('Go to question')).toHaveCount(0);
    await expectAccessible(page);
    for (let i = 1; i < 15; i++) {
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByText(`Question ${i + 1} of 15`)).toBeVisible();
    }
    await page.getByRole('button', { name: 'Finish test' }).click();
    const report = page.getByTestId('mock-report');
    await expect(report).toBeVisible();
    await expect(page.getByTestId('mock-overall')).toContainText('/ 90');
    await expect(report.getByRole('meter', { name: 'Reading' })).toBeVisible();
    await expect(report.getByText('Not scored in this mock')).toHaveCount(2);
    await expect(page.getByTestId('score-disclaimer')).toContainText('not an official PTE score');
    await expect(page.getByTestId('trademark-notice')).toContainText(TRADEMARK);
    await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeVisible();
    await expectAccessible(page);
    await page.goto('/#/mock');
    await expect(page.getByRole('heading', { name: 'Past reports' })).toBeVisible();
  });

  test('pausing keeps the place and the section clock', async ({ page }) => {
    await startReading(page);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('link', { name: 'Pause' }).click();
    await expect(page.getByText('Question 2 of 15')).toBeVisible();
    await page.getByRole('link', { name: 'Continue' }).click();
    await expect(page.getByText(/Paused at question 2/)).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Question 2 of 15')).toBeVisible();
  });

  test('when section time runs out the rest is skipped', async ({ page }) => {
    await page.clock.install();
    await startReading(page);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.clock.fastForward('31:00');
    await expect(page.getByTestId('mock-report')).toBeVisible();
    await expect(page.getByText(/13 questions were not reached in time/)).toBeVisible();
  });

  test('a custom mock runs only the chosen types', async ({ page }) => {
    await page.goto('/#/mock');
    await page.getByRole('spinbutton', { name: 'Write from Dictation' }).fill('2');
    await page
      .getByRole('spinbutton', { name: 'Reading: Multiple Choice, Single Answer' })
      .fill('1');
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Start custom mock (3 questions)' }).click();
    await page.getByRole('button', { name: 'Start part 1' }).click();
    await expect(page.getByTestId('mock-item')).toHaveAttribute('data-type', 'reading_mcq_single');
    await expect(page.getByRole('timer', { name: 'Time left in Reading' })).toHaveText('2:00');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Part 2: Listening' })).toBeVisible();
    await page.getByRole('button', { name: 'Start part 2' }).click();
    await expect(page.getByTestId('mock-item')).toHaveAttribute(
      'data-type',
      'listening_write_from_dictation',
    );
  });

  test('speaking items record without listening back', async ({ page }) => {
    await page.goto('/#/mock');
    await page.getByRole('button', { name: 'Start Speaking and Writing' }).click();
    await page.getByRole('button', { name: 'Start part 1' }).click();
    await expect(page.getByTestId('mock-item')).toHaveAttribute('data-type', 'speaking_read_aloud');
    await expect(page.getByTestId('recorder')).toBeVisible();
    await expect(page.getByTestId('self-check')).toHaveCount(0);
  });
});

test('the privacy page is linked from every page', async ({ page }) => {
  await page.goto('./#/practice');
  await page.getByRole('link', { name: 'Privacy' }).click();
  await expect(page.getByRole('heading', { name: 'Privacy', level: 1 })).toBeVisible();
  await expect(page.getByText('no trackers')).toBeVisible();
  await expect(page.getByTestId('trademark-notice')).toContainText(TRADEMARK);
  await expectAccessible(page);
});
