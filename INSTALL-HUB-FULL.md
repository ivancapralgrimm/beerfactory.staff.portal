# BeerFactory Staff Portal — Full Pack

## Архитектура

`index.html` — хаб. `menu.html` — меню. `training.html` — база знаний. `attestation.html` — проверка знаний.

Все три рабочих раздела используют общий `styles.css` и общий `script.js`.



## Что изменилось

Training теперь разделён на два типа материалов:

- `article` — полноценная длинная статья со скроллом, обложкой, фотографиями, разделами, списками, callout-блоками и содержанием.
- `note` — короткая памятка, которую удобно быстро открыть во время смены.

Общая архитектура проекта остаётся:

```text
index.html
training.html
attestation.html
styles.css
script.js
training-data.json
questions.txt
images/
```

## Установка

1. Сделайте резервную копию текущего проекта.
2. Из архива возьмите:
   - `index.html`
   - `menu.html`
   - `training.html`
   - `attestation.html`
   - `styles.css`
   - `script.js`
   - `training-data.json`
3. Замените ими соответствующие файлы в корне проекта.
4. Создайте папку:
   `images/training/`
5. Положите туда фотографии. В демо используются:
   - `hero.jpg`
   - `old-fashioned.jpg`
   - `old-fashioned-01.jpg`
   - `old-fashioned-02.jpg`
   - `beer.jpg`
   - `beer-01.jpg`
6. `index.html` и `attestation.html` менять не нужно, если они уже взяты из предыдущего unified-пакета.
7. `questions.txt` оставьте как есть.
8. Откройте `training.html` через HTTP-сервер, GitHub Pages или другой хостинг. Не тестируйте `fetch("training-data.json")` через `file://`, потому что браузер может заблокировать локальную загрузку JSON.

## GitHub Pages

Если репозиторий уже публикуется через GitHub Pages:

1. Загрузите новые файлы в корень репозитория.
2. Проверьте пути к изображениям.
3. Сделайте commit/push.
4. Откройте опубликованный `training.html`.
5. Если браузер показывает старую версию, обновите страницу с очисткой кеша.

## Как добавлять статью

Редактируйте `training-data.json`.

Пример:

```json
{
  "id": "negroni",
  "type": "article",
  "category": "Коктейли",
  "title": "Negroni: история и техника",
  "description": "История, баланс и правильная подача.",
  "cover": "images/training/negroni.jpg",
  "readingTime": 7,
  "featured": false,
  "sections": [
    {
      "type": "text",
      "title": "История",
      "content": "Текст статьи..."
    },
    {
      "type": "image",
      "src": "images/training/negroni-01.jpg",
      "caption": "Подготовка ингредиентов"
    },
    {
      "type": "list",
      "title": "Что важно помнить",
      "items": [
        "Пункт первый",
        "Пункт второй",
        "Пункт третий"
      ]
    },
    {
      "type": "tip",
      "title": "Главное",
      "content": "Короткий вывод или важное правило."
    }
  ]
}
```

## Как добавить заметку

Используйте:

```json
{
  "id": "service-greeting",
  "type": "note",
  "category": "Сервис",
  "title": "Приветствие гостя",
  "description": "Короткая памятка для смены.",
  "readingTime": 3,
  "sections": [
    {
      "type": "list",
      "items": [
        "Поздороваться",
        "Установить зрительный контакт",
        "Предложить меню"
      ]
    }
  ]
}
```

## Фотографии

Лучше использовать:

- JPG/WebP
- ширина примерно 1200–1800 px
- без огромных исходников с телефона
- отдельное фото для обложки
- отдельные фото внутри статьи

Клик по фотографии открывает её крупно.

## Что менять дизайнеру

Почти весь внешний вид находится в одном `styles.css`.

Основные переменные в начале файла:

```css
--bf-bg
--bf-surface
--bf-line
--bf-text
--bf-muted
--bf-gold
--bf-gold-soft
```

Например, фирменный золотой можно поменять через:

```css
--bf-gold:#e7a83b;
```

Не нужно возвращать inline CSS в `training.html`. Весь дизайн Training должен оставаться в общем `styles.css`.

## Что менять программисту

Вся логика находится в `script.js`.

Training определяется автоматически:

```html
<body data-page="training">
```

Для меню:

```html
<body data-page="menu">
```

Для аттестации:

```html
<body data-page="quiz">
```

Поэтому один `script.js` обслуживает все три страницы.

## Старый training-data.txt

Старый `training-data.txt` больше не нужен для новой версии Training.

Если в нём уже есть много материалов, их нужно один раз перенести в `training-data.json`.

Смысл миграции:

```text
старый текст
    ↓
определить category
    ↓
определить type
    ↓
разбить текст на sections
    ↓
при необходимости добавить cover/images
    ↓
training-data.json
```

## Важный принцип

Не пытайтесь запихивать большую статью в accordion.

Для короткой информации:

```text
Заметка → карточка → открыть → быстро прочитать
```

Для большого материала:

```text
Статья → карточка → отдельный экран → содержание → длинный скролл → фото → разделы
```

Так Training не превратится в один бесконечный список раскрывающихся коробок.
