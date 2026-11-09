# Builds public/brand/launch/*.svg (the animated app open logo) from the exact brand paths. Run: python3 scripts/brand/build-launch-art.py
import re
import os
B=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'apps', 'web', 'public', 'brand') + '/'
m=open(B+'vallo-mark.svg').read(); w=open(B+'vallo-wordmark.svg').read()
def parts(s):
    vb=[float(x) for x in re.search(r'viewBox="([^"]+)"',s).group(1).split()]
    return vb, s[s.index('<defs>')+6:s.index('</defs>')], s[s.index('</defs>')+7:s.rindex('</svg>')]
mvb,mdefs,mbody=parts(m); wvb,wdefs,wbody=parts(w)
paths=re.findall(r'<path[^>]*/>',mbody); ring,shade=paths[0],paths[-1]
ip=re.findall(r'<path[^>]*/>',re.search(r'<g clip-path="url\(#vm-above\)">(.*)</g>',mbody).group(1))
towers=[''.join(ip[0:2]),''.join(ip[2:5]),''.join(ip[5:7]),''.join(ip[7:9])]
wp=re.findall(r'<path[^>]*/>',wbody[:wbody.index('<g')])
sheen=re.findall(r'<path[^>]*/>',re.search(r'<g[^>]*>(.*)</g>',wbody).group(1))
sh=lambda p: p.replace('/>',' fill="url(#vw-sheen)"/>')
letters=[''.join(wp[0:3])+sh(sheen[0])+sh(sheen[1]), ''.join(wp[3:5])+sh(sheen[2]), wp[5]+sh(sheen[3]), wp[6]+sh(sheen[4]), ''.join(wp[7:9])+sh(sheen[5])]

mx,my,mw,mh=mvb; wx,wy,ww,wh=wvb
S=0.8                       # wordmark scale against the mark
GAP=70
WH=wh*S; WW=ww*S
W_X=mw+GAP                  # word origin in lockup units (mark at 0,0)
W_Y=mh*0.60-WH/2            # the word's middle on the towers' waist
TOTAL=W_X+WW
SHIFT=(TOTAL-mw)/2          # the mark starts centred, then moves aside
cx,cy=625,760               # the ring's own centre in mark units

def mark_group(anim, cls=''):
    t=''.join(f'<g class="t t{i}">{x}</g>' for i,x in enumerate(towers))
    mask=f'url(#nfl-sweep)' if anim else None
    rg=f'<g mask="{mask}">{ring}</g>' if anim else ring
    sg=f'<g mask="{mask}">{shade}</g>' if anim else shade
    return f'<g class="mk{cls}" transform="translate({-mx} {-my})">{rg}<g clip-path="url(#vm-above)">{t}</g>{sg}</g>'

SWEEP=f'<mask id="nfl-sweep" maskUnits="userSpaceOnUse" x="{mx}" y="{my}" width="{mw}" height="{mh}"><circle class="sw" cx="{cx}" cy="{cy}" r="215" fill="none" stroke="#fff" stroke-width="430" pathLength="100" stroke-dasharray="100 100" transform="translate({cx} {cy}) scale(1 -1) rotate(171) translate({-cx} {-cy})"/></mask>'

EASE='cubic-bezier(0.16, 1, 0.3, 1)'
RISE='cubic-bezier(0.34, 1.3, 0.64, 1)'
def css(lockup):
    c=f'''.sw{{stroke-dashoffset:100;animation:sw 640ms {EASE} 40ms forwards}}
.t{{transform-box:fill-box;transform-origin:50% 100%;transform:translateY(40%) scaleY(0);animation:rise 520ms {RISE} forwards}}
.t0{{animation-delay:200ms}}.t1{{animation-delay:300ms}}.t2{{animation-delay:400ms}}.t3{{animation-delay:500ms}}
@keyframes sw{{to{{stroke-dashoffset:0}}}}
@keyframes rise{{to{{transform:none}}}}
'''
    if lockup:
        c+=f'''.mv{{transform:translateX({SHIFT:.1f}px);animation:mv 540ms {EASE} 760ms forwards}}
.l{{opacity:0;transform:translateX(-{WW*0.32:.0f}px);animation:out 520ms {EASE} forwards}}
.l0{{animation-delay:980ms}}.l1{{animation-delay:1050ms}}.l2{{animation-delay:1120ms}}.l3{{animation-delay:1190ms}}.l4{{animation-delay:1260ms}}
@keyframes mv{{to{{transform:none}}}}
@keyframes out{{to{{opacity:1;transform:none}}}}
'''
    c+='@media (prefers-reduced-motion:reduce){.sw,.t,.mv,.l{animation:fade 300ms linear forwards;stroke-dashoffset:0;transform:none;opacity:0}@keyframes fade{to{opacity:1}}.sw{opacity:1}}'
    return '<style>'+c.replace('\n','')+'</style>'

def ns(x): return x
def word(anim):
    ls=''.join(f'<g class="l l{i}">{x}</g>' if anim else x for i,x in enumerate(letters))
    clip=f' clip-path="url(#nfl-behind)"' if anim else ''
    return f'<g transform="translate({W_X:.1f} {W_Y:.1f}) scale({S})"><g{clip}><g transform="translate({-wx} {-wy})">{ls}</g></g></g>'

head='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" role="img" aria-label="Vallo"><title>Vallo</title>'
# The clip that hides the letters behind the mark: everything right of the mark's edge, in word units.
behind=f'<clipPath id="nfl-behind"><rect x="{-GAP/S*0.35:.0f}" y="-200" width="{ww+400}" height="{wh+400}"/></clipPath>'

lock_anim=head.format(w=TOTAL,h=mh)+'<defs>'+mdefs+wdefs+SWEEP+behind+'</defs>'+css(True)+f'<g class="mv">{mark_group(True)}</g>'+word(True)+'</svg>'
lock_still=head.format(w=TOTAL,h=mh)+'<defs>'+mdefs+wdefs+'</defs>'+mark_group(False)+word(False)+'</svg>'
mark_anim=head.format(w=mw,h=mh)+'<defs>'+mdefs+SWEEP+'</defs>'+css(False)+mark_group(True)+'</svg>'
import os
os.makedirs(B+'launch',exist_ok=True)
for name,data in [('vallo-launch.svg',lock_anim),('vallo-launch-still.svg',lock_still),('vallo-mark-draw.svg',mark_anim)]:
    open(B+'launch/'+name,'w').write(data); print(name,len(data))
