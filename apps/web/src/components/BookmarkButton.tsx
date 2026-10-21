import { toggleBookmark, useHistory } from '../practice/history.ts';

export function BookmarkButton({ questionId }: { questionId: string }) {
  const on = useHistory().bookmarks.includes(questionId);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => toggleBookmark(questionId)}
      className="flex min-h-11 items-center gap-2 rounded-token border border-line bg-surface px-3 text-sm font-semibold hover:border-muted"
    >
      <span aria-hidden="true" className={on ? 'text-brand' : 'text-muted'}>
        {on ? '★' : '☆'}
      </span>
      Bookmark
    </button>
  );
}
