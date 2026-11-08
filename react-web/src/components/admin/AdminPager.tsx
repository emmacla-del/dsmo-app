export interface AdminPagerProps {
  page: number;
  pageCount: number;
  /** « Page 2 sur 5 », already worded for the list it belongs to. */
  status: string;
  previousLabel: string;
  nextLabel: string;
  onPage: (next: number) => void;
}

/** Previous / next for a list. Goes in the `footer` of its AdminTablePanel. */
export function AdminPager({ page, pageCount, status, previousLabel, nextLabel, onPage }: AdminPagerProps) {
  return (
    <div className="cam-audit-pager">
      <button
        type="button"
        className="cam-button cam-button-secondary cam-button-sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        {previousLabel}
      </button>
      <span>{status}</span>
      <button
        type="button"
        className="cam-button cam-button-secondary cam-button-sm"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        {nextLabel}
      </button>
    </div>
  );
}
