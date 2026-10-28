import os

def fix_file(fpath):
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix PageHeader actions
    # <button className="btn btn-primary" onClick={() =><Plus className="size-5" />setCreateModal(true)}>
    # Should be: <button className="btn btn-primary" onClick={() => setCreateModal(true)}><Plus className="size-5" />
    content = content.replace(
        '<button className="btn btn-primary" onClick={() =><Plus className="size-5" />setCreateModal(true)}>',
        '<button className="btn btn-primary" onClick={() => setCreateModal(true)}><Plus className="size-5" />'
    )
    
    # Calendar.tsx has a different problem?
    # No, Calendar.tsx didn't have a syntax error from PageHeader, wait:
    # `src/pages/Calendar.tsx:69:14 - error TS1005: ';' expected.`
    # Let's check Calendar.tsx around line 68
    
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)

for fpath in ['src/pages/Inventory.tsx', 'src/pages/Tickets.tsx', 'src/pages/Calendar.tsx']:
    if os.path.exists(fpath):
        fix_file(fpath)

print("Done syntax fix")
