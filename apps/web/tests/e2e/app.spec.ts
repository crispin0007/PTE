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

// One sample question per skill.
const SAMPLES = [
  {
    skill: 'speaking',
    type: 'speaking_describe_image',
    id: 'speaking-describe-image-0001',
    expectText: /Describe the image/,
  },
  { skill: 'writing', type: 'writing_essay', id: 'writing-essay-0001', expectText: /Essay prompt/ },
  {
    skill: 'listening',
    type: 'listening_mcq_single',
    id: 'listening-mcq-single-0001',
    expectText: /Options/,
  },
];

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

for (const s of SAMPLES) {
  test(`a ${s.skill} question renders with footer and score disclaimer`, async ({ page }) => {
    await page.goto(`/#/practice/${s.type}/${s.id}`);
    const question = page.getByTestId('question');
    await expect(question).toBeVisible();
    await expect(question).toContainText(s.expectText);
    await expect(page.getByTestId('score-disclaimer')).toContainText('not an official PTE score');
    await expect(page.getByTestId('trademark-notice')).toContainText(TRADEMARK);
    await expectAccessible(page);
  });
}

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

test('unknown pages show a not-found message', async ({ page }) => {
  await page.goto('/#/practice/not_a_type');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
