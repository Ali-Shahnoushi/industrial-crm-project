import os
import re

files = [
    'src/pages/Inventory.tsx',
    'src/pages/Tickets.tsx',
    'src/pages/Tasks.tsx',
    'src/pages/Calendar.tsx',
    'src/pages/Chat.tsx',
    'src/pages/Settings.tsx'
]

for fpath in files:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pagination: <Pagination page={page} total={totalPages} onChange={setPage} /> -> <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
    content = re.sub(r'<Pagination\s+page=\{page\}\s+total=\{totalPages\}\s+onChange=\{setPage\}\s*/>',
                     r'<Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />', content)

    # TableSkeleton: columns={7} rows={5} -> cols={7} rows={5}
    content = content.replace('columns={7}', 'cols={7}')

    # Settings.tsx fixes
    content = content.replace('const setAuth = useAuthStore(s => s.setAuth)', 'const updateProfileStore = useAuthStore(s => s.updateProfile)')
    content = content.replace('setAuth({ ...me, ...updates })', 'updateProfileStore(updates)')
    content = content.replace('const { theme, toggleTheme } = useThemeStore()', 'const { theme, toggle } = useThemeStore()')
    content = content.replace("theme === 'dark'", "theme === 'nikan-dark'")
    content = content.replace('onChange={toggleTheme}', 'onChange={toggle}')

    # PageHeader fixes (robust)
    content = re.sub(r'<PageHeader([^>]*?)>\s*<button([^>]+)>\s*(?:<Plus[^>]*>)?\s*(.*?)\s*</button>\s*</PageHeader>',
                     r'<PageHeader\1 actions={<button\2><Plus className="size-5" />\3</button>} />', content, flags=re.DOTALL)
                     
    content = re.sub(r'<PageHeader([^>]*?)>\s*<div([^>]+)>\s*<div([^>]+)>\s*<Filter([^>]*?)/>\s*<select([\s\S]*?)</select>\s*</div>\s*<button([^>]+)>\s*<Plus([^>]*?)/>\s*(.*?)\s*</button>\s*</div>\s*</PageHeader>',
                     r'<PageHeader\1 actions={<div\2><div\3><Filter\4/><select\5</select></div><button\6><Plus\7/>\8</button></div>} />', content, flags=re.DOTALL)

    # Chat.tsx fixes
    if "dateTimeFa" in content and "import { cx, dateFa }" in content:
        content = content.replace("import { cx, dateFa }", "import { cx, dateFa, dateTimeFa }")
    
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done python fix")
