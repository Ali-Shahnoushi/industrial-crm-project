import { Search, X } from 'lucide-react'

export function SearchInput({ value, onChange, placeholder = 'جستجو...', className }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <label className={`input w-full ${className ?? ''}`}>
      <Search className="size-4 text-base-content/50" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="پاک کردن جستجو" className="text-base-content/50 hover:text-base-content">
          <X className="size-4" />
        </button>
      )}
    </label>
  )
}
