#!/usr/bin/env python3
"""Cache-buster. Run from anywhere AFTER editing lesson.css / lesson.js:
    python3 learn/bump-version.py
Sets ?v=<content-hash> on lesson.css and lesson.js in every lesson page, so
browsers/CDN fetch the new files after each deploy. Unchanged files keep the
same hash (cache still works)."""
import glob, hashlib, os, re
d = os.path.dirname(os.path.abspath(__file__))
h = lambda n: hashlib.md5(open(os.path.join(d, n), 'rb').read()).hexdigest()[:8]
v = {'lesson.css': h('lesson.css'), 'lesson.js': h('lesson.js')}
n = 0
for f in glob.glob(os.path.join(d, '*.html')):
    s = open(f, encoding='utf-8').read(); o = s
    for name, ver in v.items():
        s = re.sub(r'((?:href|src)=")' + re.escape(name) + r'(?:\?v=[0-9a-f]+)?(")', r'\g<1>' + name + '?v=' + ver + r'\2', s)
    if s != o:
        open(f, 'w', encoding='utf-8').write(s); n += 1
print('updated', n, 'pages', v)
