import { hasRichTextContent } from './rich-text-editor';

describe('hasRichTextContent', () => {
  it('is false for an empty string', () => {
    expect(hasRichTextContent('')).toBe(false);
  });

  it('is false for whitespace-only content', () => {
    expect(hasRichTextContent('   \n\t  ')).toBe(false);
  });

  it('is false for an editor that was typed into and cleared (tags but no text)', () => {
    expect(hasRichTextContent('<p><br></p>')).toBe(false);
    expect(hasRichTextContent('<div></div>')).toBe(false);
  });

  it('is false for non-breaking-space-only content', () => {
    expect(hasRichTextContent('<p>&nbsp;</p>')).toBe(false);
  });

  it('is true once there is real text, tags or not', () => {
    expect(hasRichTextContent('Wields a longsword')).toBe(true);
    expect(hasRichTextContent('<p><strong>Skittish</strong></p>')).toBe(true);
    expect(hasRichTextContent('<ul><li>Loot: 3gp</li></ul>')).toBe(true);
  });
});
