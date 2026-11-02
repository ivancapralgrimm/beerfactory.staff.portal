from pathlib import Path
import json, math, io
import fitz
from PIL import Image
root=Path(__file__).resolve().parents[1]
source=root/'evidence/ui-review-2026-10-31'
m=json.loads((source/'manifest.json').read_text())
assert not m['issues'],m['issues']
out=root/'artifacts/BFStaff-UI-All-Pages-2026-10-31.pdf'
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
doc=fitz.open();toc=[]
def page():
 p=doc.new_page(width=595,height=842);p.insert_font(fontname='dv',fontfile=font);p.insert_font(fontname='dvb',fontfile=bold);return p
def text(p,x,y,t,size=10,b=False,color=(.22,.17,.13)):
 p.insert_text((x,y),t,fontname='dvb' if b else 'dv',fontsize=size,color=color)
p=page();text(p,38,65,'BFStaff · Тёплый зал',24,True);text(p,38,99,'Все страницы и ключевые состояния',17,True)
lines=['Браузерные снимки работающей сборки · 31 октября 2026', '', 'Это реальные снимки Chromium, а не концептуальные макеты.', 'Мобильный экран: 390 × 844 px; дополнительные размеры указаны.', 'Авторизация, данные и ответы API заменены тестовыми фикстурами.', 'Роли и возможности сервера имитируются для показа всех редакторов.', 'Production и ваши базы данных не изменялись.', '', 'Изменения этой сборки:', '• Убрана техническая подпись об иконках на рабочих экранах.', '• Атрибуция сохранена в свёрнутых «Лицензиях» настроек.', '• Убрано «Моё заведение / Все заведения» в рецептах.', '• Карточки рецептов компактнее; названия выделены жирным.', '• Заведение в профиле расположено сразу под должностью.', '', 'Длинные страницы разбиты на последовательные фрагменты.', 'Повторяющие маршруты-перенаправления отдельно не дублируются.', 'Пустые истории на части снимков — состояние тестовых данных.', '', 'Документ показывает интерфейс. Он не подтверждает установку', 'серверных патчей, работу production RLS или очистку файлов NocoDB.']
for i,l in enumerate(lines):text(p,38,145+i*22,l,10)
# Add a compact contents (filled before screenshot pages, page numbers computed).
contents=[]
for i in range(math.ceil(len(m['pages'])/30)):
 contents.append(len(doc));page()
for screen in m['pages']:
 img=Image.open(source/screen['file']).convert('RGB');w,h=img.size
 # Full width at mobile; additional desktop views kept at proportional width.
 target_width=300 if w<600 else 515
 scale=target_width/w
 segment_height=int(710/scale)
 parts=math.ceil(h/segment_height)
 first=len(doc)+1
 toc.append([1,f"{screen['number']:02d}. {screen['title']}",first])
 for part in range(parts):
  p=page();title=f"{screen['number']:02d}. {screen['title']}"
  text(p,28,33,title,11,True)
  text(p,28,53,f"{screen['route']} · {w}px · фрагмент {part+1}/{parts}",8)
  chunk=img.crop((0,part*segment_height,w,min(h,(part+1)*segment_height)))
  buf=io.BytesIO();chunk.save(buf,format='JPEG',quality=91,subsampling=0)
  dw=target_width;dh=chunk.height*scale;x=(595-dw)/2
  p.insert_image(fitz.Rect(x,70,x+dw,70+dh),stream=buf.getvalue())
  text(p,28,820,'Браузерная съёмка · тестовые данные · production не изменён',8)
  text(p,548,820,str(len(doc)),8)
for i,page_index in enumerate(contents):
 p=doc[page_index]
 text(p,30,45,'Содержание',20,True)
 for j,screen in enumerate(m['pages'][i*30:(i+1)*30]):
  entry=toc[i*30+j];name=f"{screen['number']:02d}. {screen['title']}";y=80+j*24
  text(p,30,y,name,9);text(p,545,y,str(entry[2]),9)
  p.insert_link({'kind':fitz.LINK_GOTO,'from':fitz.Rect(26,y-12,570,y+4),'page':entry[2]-1})
 text(p,30,820,'Браузерные снимки · актуальная локальная сборка',8)
doc.set_toc(toc);doc.set_metadata({'title':'BFStaff — все страницы, UI review 2026-10-31','author':'BFStaff','subject':'Real browser screenshots of compiled app with fixture data, no production changes'})
doc.save(out,garbage=4,deflate=True)
assert len(fitz.open(out))==len(doc)
print(json.dumps({'file':str(out),'screens':len(m['pages']),'pdfPages':len(doc),'bytes':out.stat().st_size},ensure_ascii=False))
