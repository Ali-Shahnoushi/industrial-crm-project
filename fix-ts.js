import fs from 'fs'

const pages = [
  'src/pages/Inventory.tsx',
  'src/pages/Tickets.tsx',
  'src/pages/Tasks.tsx',
  'src/pages/Calendar.tsx',
  'src/pages/Chat.tsx',
  'src/pages/Settings.tsx'
]

for (const p of pages) {
  let content = fs.readFileSync(p, 'utf8')
  
  // 1. Fix PageHeader children -> actions
  content = content.replace(/<PageHeader\s*title="([^"]+)"\s*subtitle="([^"]+)">\s*([\s\S]*?)<\/PageHeader>/g, (match, title, subtitle, inner) => {
    if (!inner.trim()) return `<PageHeader title="${title}" subtitle="${subtitle}" />`
    return `<PageHeader \n        title="${title}" \n        subtitle="${subtitle}"\n        actions={\n          <>\n            ${inner.trim()}\n          </>\n        }\n      />`
  })

  // 2. Fix StatCard icon={<Icon className="..." />} -> icon={Icon}
  content = content.replace(/icon=\{<([A-Z][a-zA-Z]+)[^>]*>\}/g, 'icon={$1}')

  // 3. Fix EmptyState icon={<...>} 
  content = content.replace(/<EmptyState[^>]*icon=\{[^{}]*\}[^>]*\/>/g, (match) => {
    return match.replace(/\s*icon=\{[^{}]*\}\s*/, ' ')
  })
  
  // 4. Fix dateFa(m.date, { time: true }) -> dateTimeFa(m.date)
  content = content.replace(/dateFa\([^,]+,\s*\{[^}]+\}\s*\)/g, (match) => {
    return match.replace(/dateFa/, 'dateTimeFa').replace(/,\s*\{[^}]+\}\s*/, '')
  })

  // 5. Add dateTimeFa import if needed
  if (content.includes('dateTimeFa') && !content.includes('dateTimeFa,')) {
    content = content.replace(/dateFa,/, 'dateFa, dateTimeFa,')
  }

  // 6. Fix DatePicker in Tasks.tsx
  content = content.replace(/<DatePicker value=\{dateStr\} onChange=\{setDateStr\} placeholder="1403\/05\/20" \/>/g, 
    '<DatePicker value={dateStr} onChange={(v) => setDateStr(v || "")} placeholder="1403/05/20" />')

  fs.writeFileSync(p, content, 'utf8')
}
console.log("Done")
