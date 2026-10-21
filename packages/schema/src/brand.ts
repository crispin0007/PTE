/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** The light page background; brand text and buttons sit on it. */
export const LIGHT_BG = '#f3f5fa';

/**
 * Why an institute's brand colour cannot be used, or null if it can. Buttons use white text on
 * the colour and links use the colour on the page, so both need 4.5:1.
 */
export function brandColorProblem(hex: string): string | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return 'Use a colour like #1f6f5c.';
  if (contrast(hex, LIGHT_BG) < 4.5 || contrast(hex, '#ffffff') < 4.5)
    return 'This colour is too light for readable text. Pick a darker shade.';
  return null;
}
