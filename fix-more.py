import re

with open('src/pages/Calendar.tsx', 'r') as f:
    c = f.read()
c = c.replace('shiftMonth(curr.jy, curr.jm, 1)', '{ ...shiftMonth(curr.jy, curr.jm, 1), jd: 1 }')
c = c.replace('shiftMonth(curr.jy, curr.jm, -1)', '{ ...shiftMonth(curr.jy, curr.jm, -1), jd: 1 }')
c = c.replace("{num(start.getHours().toString().padStart(2, '0'))}:{num(start.getMinutes().toString().padStart(2, '0'))}", "start.getHours().toString().padStart(2, '0') + ':' + start.getMinutes().toString().padStart(2, '0')")
with open('src/pages/Calendar.tsx', 'w') as f:
    f.write(c)

with open('src/pages/Tasks.tsx', 'r') as f:
    t = f.read()
t = re.sub(r'<PageHeader\s*title="([^"]+)"\s*subtitle="([^"]+)"\s*>\s*<div className="flex items-center gap-2">([\s\S]*?)</div>\s*</PageHeader>', r'<PageHeader title="\1" subtitle="\2" actions={<div className="flex items-center gap-2">\3</div>} />', t)
with open('src/pages/Tasks.tsx', 'w') as f:
    f.write(t)

