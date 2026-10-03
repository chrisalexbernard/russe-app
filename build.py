import re,sys
T='tpl/'
common=open(T+'common.js',encoding='utf-8').read()
row=open(T+'wordrow.html',encoding='utf-8').read()
def head(title):
    return f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="https://fonts.googleapis.com/css2?family=Marck+Script&amp;family=PT+Sans:wght@400;700&amp;family=PT+Serif:wght@400;700&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0}}
a{{color:#2340A0}}a:hover{{color:#16296B}}
</style>
</helmet>'''
ICON={'main':'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"></path>',
 'dico':'<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"></path><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20"></path>',
 'grammar':'<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 10h18M9 4v16"></path>'}
def tab(href,key,label,active):
    col='color: #B42A22; font-weight: 700' if active==key else 'color: #5A6074'
    return f'<a href="{href}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-width: 64px; min-height: 52px; text-decoration: none; font-size: 12px; {col}">\n<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{ICON[key]}</svg>{label}</a>'
def tabs(active):
    return ('<nav style="display: flex; justify-content: space-around; align-items: center; height: 76px; flex-shrink: 0; background: #FFFFFF; border-top: 1px solid #E2E4EA; padding: 0 8px 8px">\n'
     + tab('Main.dc.html','main','Accueil',active)+'\n'+tab('Dictionary.dc.html','dico','Dico',active)+'\n'
     + '<a href="LogLesson.dc.html" aria-label="Valider une leçon" style="display: flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 26px; background: #B42A22; color: #FFFFFF">\n<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg></a>\n'
     + tab('Grammar.dc.html','grammar','Grammaire',active)+'\n</nav>')
from shell import sidebar, shell, SHELLEND
for name in sys.argv[1:]:
    s=open(T+name+'.html',encoding='utf-8').read()
    s=re.sub(r'%%SHELL:(.*?):(\w+)%%',lambda m:shell(head,m.group(1),m.group(2)),s)
    s=re.sub(r'%%SHELLEND:\d+%%',lambda m:SHELLEND,s)
    s=re.sub(r'<nav aria-label="Navigation principale".*?</nav>','%%SIDEBAR:dico%%',s,flags=re.S) if name=='Desktop' else s
    s=re.sub(r'%%SIDEBAR:(\w+)%%',lambda m:sidebar(m.group(1)),s)
    s=re.sub(r'%%HEAD:(.*?)%%',lambda m:head(m.group(1)),s)
    s=re.sub(r'%%TABS:(\w+)%%',lambda m:tabs(m.group(1)),s)
    r=row.replace('href="Verb.dc.html"','href="DesktopVerb.dc.html"') if name.startswith('Desktop') else row
    s=s.replace('%%WORDROW%%',r.strip()).replace('%%COMMON%%',common.strip())
    assert '%%' not in s, name
    open('ru/project/'+name+'.dc.html','w',encoding='utf-8',newline='\n').write(s)
    print(name,len(s))
