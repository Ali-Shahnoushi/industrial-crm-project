import Papa from 'papaparse'

/** Persian/Arabic digits → ASCII, so users can type either. */
export const toLatinDigits = (s: string) =>
  s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))

/** Downloads rows as a UTF-8 CSV (with BOM so Excel shows Persian correctly). */
export function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  const csv = '\uFEFF' + Papa.unparse(rows)
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function parseCsv(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
      complete: (r) => resolve(r.data),
      error: reject,
    })
  })
}
