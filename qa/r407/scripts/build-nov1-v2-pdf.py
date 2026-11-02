from pathlib import Path
import fitz,json,io,math
from PIL import Image
r=Path(__file__).resolve().parents[1];src=r/'evidence/ui-nov1-v2';out=r/'artifacts/BFStaff-UI-2026-11-01-v2.pdf';doc=fitz.open();font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';toc=[]
def page():
 p=doc.new_page(width=595,height=842);p.insert_font(fontname='dv',fontfile=font);return p
def text(p,x,y,t,size=10):p.insert_text((x,y),t,fontname='dv',fontsize=size)
p=page();text(p,35,65,'BFStaff · дополнение 01.11.2026 v2',22)
for i,s in enumerate(['Настоящие браузерные снимки собранного приложения.', 'Тестовые данные/API, production и базы не изменены.', '', 'Данные рецепта: только владелец и администратор, внизу.', 'Сотрудник и старший не видят блок метаданных.', 'Дни рождения: единый блок со списком сотрудников.', 'Глобальный поиск: фон, скругление и объём как у смены.', '', 'Build PASS · CI109/109 · browser21/21 · targeted5/5.', 'Диапазон дней рождения требует ранее подготовленного SQL.', 'SQL-патч не применён, прежние ограничения RC1 сохраняются.']):text(p,35,110+24*i,s)
items=[('home','Главная: общий список и поиск'),('search','Поиск: результаты'),('recipe-admin','Данные рецепта: администратор'),('recipe-owner','Данные рецепта: владелец')]
for file,title in items:
 image=Image.open(src/(file+'.png')).convert('RGB');w,h=image.size;scale=300/w;step=int(710/scale);count=math.ceil(h/step);toc.append([1,title,len(doc)+1])
 for i in range(count):
  p=page();text(p,28,35,title,13);text(p,28,55,f'{w}px · фрагмент {i+1}/{count}',9);im=image.crop((0,i*step,w,min(h,(i+1)*step)));buf=io.BytesIO();im.save(buf,format='JPEG',quality=92,subsampling=0);p.insert_image(fitz.Rect(147,70,447,70+im.height*scale),stream=buf.getvalue());text(p,28,820,'Браузерная съёмка · тестовые данные · production не изменён',8)
doc.set_toc(toc);doc.save(out,garbage=4,deflate=True);print(json.dumps({'file':str(out),'screens':len(items),'pages':len(doc),'bytes':out.stat().st_size}))
