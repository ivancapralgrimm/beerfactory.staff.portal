from pathlib import Path
import fitz,json,io,math
from PIL import Image
r=Path(__file__).resolve().parents[1];src=r/'evidence/ui-nov1';out=r/'artifacts/BFStaff-UI-2026-11-01.pdf';doc=fitz.open();font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';toc=[]
def page():
 p=doc.new_page(width=595,height=842);p.insert_font(fontname='dv',fontfile=font);return p
def text(p,x,y,t,size=10):p.insert_text((x,y),t,fontname='dv',fontsize=size)
p=page();text(p,35,65,'BFStaff · правки 01.11.2026',22)
for i,s in enumerate(['Настоящие браузерные снимки собранного приложения.', 'Тестовые данные и API; рабочие базы не изменены.', 'Основные размеры 390 и 375 px. Длинные страницы разбиты.', '', 'Варианты ответов проверены вводом, сохранением и повторным', 'открытием вопроса. Записи отправлены только в тестовую фикстуру.', '', 'Дни рождения: интерфейс поддерживает вчера, сегодня и 1–3 дня.', 'Для рабочей базы подготовлен отдельный SQL-патч; он НЕ применён.', '', '«Данные рецепта» сохранены: блок виден всем сотрудникам,', 'содержит метаданные текущего рецепта, не полный журнал.', '', 'Лицензии удалены из интерфейса; сведения сохранены в файлах.', '', 'Сборка: PASS. CI: 109/109. Целевые проверки: 8/8.', 'SQL проверен только локально, включая Новый год и 29 февраля.', 'Прежние ограничения серверной части RC1 сохраняются.']):text(p,35,110+24*i,s)
items=[('home','Главная: порядок блоков и бренд'),('birthdays','Дни рождения: вчера и три дня вперёд'),('recipe','Рецепт: редактировать и поделиться'),('feed','Передача: поиск и обновление'),('note','Новая заметка: адресаты'),('profile','Профиль: должность и заведение'),('answers-edit','Редактирование вариантов ответа'),('answers-new','Создание вариантов ответа'),('width375--menu','Рецепты · 375px'),('width375--knowledge','Знания · 375px'),('width375--settings','Настройки · 375px'),('width375--profile','Профиль · 375px')]
for file,title in items:
 image=Image.open(src/(file+'.png')).convert('RGB');w,h=image.size;scale=300/w;step=int(710/scale);count=math.ceil(h/step);toc.append([1,title,len(doc)+1])
 for i in range(count):
  p=page();text(p,28,35,title,13);text(p,28,55,f'{w}px · фрагмент {i+1}/{count}',9);im=image.crop((0,i*step,w,min(h,(i+1)*step)));buf=io.BytesIO();im.save(buf,format='JPEG',quality=92,subsampling=0);p.insert_image(fitz.Rect(147,70,447,70+im.height*scale),stream=buf.getvalue());text(p,28,820,'Браузерная съёмка · тестовые данные · production не изменён',8)
doc.set_toc(toc);doc.save(out,garbage=4,deflate=True);print(json.dumps({'file':str(out),'screens':len(items),'pages':len(doc),'bytes':out.stat().st_size}))
