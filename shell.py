SB = [
    ('DesktopHome.dc.html', 'home', 'Accueil', '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"></path>'),
    ('Desktop.dc.html', 'dico', 'Dictionnaire', '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"></path><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20"></path>'),
    ('DesktopLesson.dc.html', 'lesson', 'Leçons', '<path d="M5 6h14M5 12h14M5 18h9"></path>'),
    ('DesktopVerb.dc.html', 'verb', 'Verbes', '<path d="M4 7h16M4 12h10M4 17h13"></path>'),
    ('DesktopGrammar.dc.html', 'grammar', 'Grammaire', '<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 10h18M9 4v16"></path>'),
]


def sidebar(active):
    out = [
        '<nav aria-label="Navigation principale" style="flex: 1 1 220px; max-width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 6px; background: #161B2E; color: #FFFFFF; padding: 24px 16px">',
        '<div style="display: flex; flex-direction: column; padding: 0 10px 18px">',
        '<span style="font-family: \'PT Serif\', serif; font-size: 22px; font-weight: 700">Русский</span>',
        '<span style="font-family: \'Marck Script\', cursive; font-size: 24px; color: #AFC0F2; line-height: 1">мой словарь</span>',
        '</div>',
        '<div style="display: flex; flex-direction: column; gap: 4px">',
    ]
    for href, key, label, icon in SB:
        st = 'background: #2A3150; color: #FFFFFF; font-weight: 700' if key == active else 'color: #C3C8D8'
        out.append(f'<a href="{href}" style="display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 0 12px; border-radius: 10px; text-decoration: none; font-size: 15px; {st}">\n'
                   f'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{icon}</svg>{label}</a>')
    out.append('</div>')
    ring = '; box-shadow: 0 0 0 2px #FFFFFF' if active == 'log' else ''
    out.append(f'<a href="DesktopLog.dc.html" style="display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; margin-top: 16px; border-radius: 12px; background: #B42A22; color: #FFFFFF; text-decoration: none; font-weight: 700; font-size: 15px{ring}">\n'
               '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>Valider une leçon</a>')
    out.append('</nav>')
    return '\n'.join(out)


def shell(head, title, active):
    return (head(title) + '\n'
            '<div style="min-height: 100vh; box-sizing: border-box; display: flex; flex-wrap: wrap; background: #F3F4F7; font-family: \'PT Sans\', sans-serif; color: #161B2E">\n'
            + sidebar(active) + '\n'
            '<main style="flex: 999 1 560px; min-width: 0; box-sizing: border-box; padding: 32px clamp(16px, 4vw, 48px) 48px">\n'
            '<div style="max-width: 1100px; display: flex; flex-direction: column; gap: 20px">')


SHELLEND = '</div>\n</main>\n</div>\n</x-dc>'
