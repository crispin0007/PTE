import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const TRADEMARK = 'Not affiliated with, endorsed by, or connected to Pearson';

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
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
    skill: 'reading',
    type: 'reading_fib_dropdown',
    id: 'reading-fib-dropdown-0001',
    expectText: /Blank 1|Passage/,
  },
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
  await page.goto('/#/practice/reading_mcq_single/reading-mcq-single-0001');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
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

test('unknown pages show a not-found message', async ({ page }) => {
  await page.goto('/#/practice/not_a_type');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
