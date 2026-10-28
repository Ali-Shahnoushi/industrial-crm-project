import { ChevronLeft, ChevronRight } from 'lucide-react'
import { num } from '../../utils/format'

interface Props {
  page?: number
  current?: number
  pageSize?: number
  total: number
  onPage?: (p: number) => void
  onChange?: (p: number) => void
}

export function Pagination(props: Props) {
  const page = props.page ?? props.current ?? 1
  const onPage = props.onPage ?? props.onChange ?? (() => {})
  const pageSize = props.pageSize ?? 10
  const total = props.total

  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  // compact window: 1 … 4 5 6 … 20
  const list: (number | '…')[] = []
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) list.push(p)
    else if (list[list.length - 1] !== '…') list.push('…')
  }

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-base-300/60 px-4 py-3 sm:flex-row">
      <p className="text-sm text-base-content/60">
        نمایش {num(from)} تا {num(to)} از {num(total)} مورد
      </p>
      <div className="join">
        <button className="btn btn-sm join-item" disabled={page === 1} onClick={() => onPage(page - 1)} aria-label="قبلی">
          <ChevronRight className="size-4" />
        </button>
        {list.map((p, i) =>
          p === '…' ? (
            <button key={`e${i}`} className="btn btn-sm join-item btn-disabled">…</button>
          ) : (
            <button
              key={p}
              className={`btn btn-sm join-item ${p === page ? 'btn-primary' : ''}`}
              onClick={() => onPage(p)}
            >
              {num(p)}
            </button>
          ),
        )}
        <button className="btn btn-sm join-item" disabled={page === pages} onClick={() => onPage(page + 1)} aria-label="بعدی">
          <ChevronLeft className="size-4" />
        </button>
      </div>
    </div>
  )
}
