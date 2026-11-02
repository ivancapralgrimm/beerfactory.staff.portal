/**
 * BFStaff's intentionally small, editorial, non-personalized daily prompts.
 * They are presentation-only: never saved to notes, never included in audit,
 * notifications, read receipts, or shift operational state.
 */
export type FeedPulseAction = "compose" | "knowledge";

export type FeedPulsePrompt = {
  id: string;
  kind: "Мысль смены" | "Небольшая практика" | "Идея для команды" | "Пара минут для себя";
  title: string;
  body: string;
  action: FeedPulseAction;
};

export const FEED_PULSE_PROMPTS: readonly FeedPulsePrompt[] = [
  {
    id: "handover-telephone",
    kind: "Мысль смены",
    title: "Телепатию в штате пока не оформили.",
    body: "Если следующей смене стоит что-то знать заранее, оставь пару строк. Даже самая хорошая память не работает за всех сразу.",
    action: "compose"
  },
  {
    id: "knowledge-small",
    kind: "Пара минут для себя",
    title: "Не обязательно учить всё сразу.",
    body: "Одна понятная статья сегодня иногда полезнее десяти открытых вкладок, к которым никто не вернётся.",
    action: "knowledge"
  },
  {
    id: "one-detail",
    kind: "Идея для команды",
    title: "Одна мелочь тоже считается.",
    body: "Есть деталь в работе, которая могла бы сэкономить коллегам несколько минут? Хорошая подсказка не обязана быть революцией.",
    action: "compose"
  },
  {
    id: "finish-not-perfect",
    kind: "Мысль смены",
    title: "Идеальная смена не обязательна.",
    body: "Полезнее честно передать, что получилось, а что осталось доделать. У красивого молчания плохая память.",
    action: "compose"
  },
  {
    id: "service-not-script",
    kind: "Небольшая практика",
    title: "Хороший сервис не обязан звучать заученно.",
    body: "Иногда уверенность появляется не от идеальной фразы, а от понимания продукта. В знаниях есть с чего начать.",
    action: "knowledge"
  },
  {
    id: "lost-minute",
    kind: "Идея для команды",
    title: "Где теряются минуты?",
    body: "Если постоянно приходится искать одну и ту же вещь или ответ, расскажи команде. Возможно, это проще исправить, чем терпеть.",
    action: "compose"
  },
  {
    id: "memory-ram",
    kind: "Мысль смены",
    title: "Оперативная память смены не бесконечна.",
    body: "Короткая запись сейчас лучше утреннего «кажется, вчера что-то было». Особенно если это важно для следующей команды.",
    action: "compose"
  },
  {
    id: "curiosity-beer",
    kind: "Пара минут для себя",
    title: "Любопытство тоже рабочий инструмент.",
    body: "Один вопрос о напитке, на который сегодня не нашлось ответа, может стать хорошим поводом заглянуть в базу знаний.",
    action: "knowledge"
  },
  {
    id: "say-specific",
    kind: "Идея для команды",
    title: "«Будьте внимательнее» не инструкция.",
    body: "А вот «обратите внимание на этот конкретный момент» уже помогает. В передаче смены детали обычно полезнее лозунгов.",
    action: "compose"
  },
  {
    id: "end-of-shift",
    kind: "Мысль смены",
    title: "Конец смены не конец истории.",
    body: "Следующая команда начинает с того, что осталось после нас. Две ясные строки могут избавить её от лишних поисков.",
    action: "compose"
  },
  {
    id: "little-win",
    kind: "Идея для команды",
    title: "Удачная находка заслуживает продолжения.",
    body: "Если сегодня нашёл способ сделать привычное действие проще, запиши его. Хорошие решения не должны исчезать с окончанием смены.",
    action: "compose"
  },
  {
    id: "no-race",
    kind: "Пара минут для себя",
    title: "Знания не забег на скорость.",
    body: "Понимание одной темы важнее галочки напротив всех. Можно просто открыть материал, который давно хотелось прояснить.",
    action: "knowledge"
  },
  {
    id: "colleague-future",
    kind: "Мысль смены",
    title: "Коллега из завтра не читает мысли.",
    body: "Если ситуация требует продолжения, оставь её суть и следующий шаг. Иначе история начнётся заново, только без пролога.",
    action: "compose"
  },
  {
    id: "good-question",
    kind: "Небольшая практика",
    title: "Хороший вопрос лучше случайного ответа.",
    body: "Если что-то в продукте кажется очевидным, попробуй объяснить это простыми словами. Не вышло? Есть повод открыть знания.",
    action: "knowledge"
  },
  {
    id: "the-exception",
    kind: "Идея для команды",
    title: "Необычное лучше записать.",
    body: "Постоянные правила все знают. Именно редкие исключения чаще всего теряются при передаче информации.",
    action: "compose"
  },
  {
    id: "after-rush",
    kind: "Мысль смены",
    title: "После загрузки голова просит тишины.",
    body: "Но если важная деталь осталась только в памяти, запиши её коротко. Не сочинение, просто факт и что с ним делать.",
    action: "compose"
  },
  {
    id: "understand-first",
    kind: "Пара минут для себя",
    title: "Сложное становится проще по кусочкам.",
    body: "Не нужно открывать сразу весь справочник. Найди одну тему, которая сегодня действительно интересна.",
    action: "knowledge"
  },
  {
    id: "small-fix",
    kind: "Идея для команды",
    title: "Маленькие улучшения живут дольше громких обещаний.",
    body: "Есть простой приём, который экономит лишнее движение? Поделись им с командой, пока не забыл.",
    action: "compose"
  },
  {
    id: "not-a-detective",
    kind: "Мысль смены",
    title: "Следующая смена не детективное агентство.",
    body: "Оставь контекст, если дело не закончено. Фраза «там разберётесь» выглядит коротко, но обходится дорого.",
    action: "compose"
  },
  {
    id: "taste-language",
    kind: "Небольшая практика",
    title: "Знакомый продукт иногда можно объяснить лучше.",
    body: "Попробуй подобрать три понятных слова вместо длинного описания. А за деталями можно заглянуть в знания.",
    action: "knowledge"
  },
  {
    id: "good-experience",
    kind: "Идея для команды",
    title: "Не только проблемы заслуживают записи.",
    body: "Если какой-то способ сегодня сработал особенно хорошо, это тоже полезно знать другим. Удачу можно повторить.",
    action: "compose"
  },
  {
    id: "keep-context",
    kind: "Мысль смены",
    title: "Одного «сделано» бывает недостаточно.",
    body: "Когда история может продолжиться, добавь короткое «почему» и «что дальше». Так информация переживёт смену.",
    action: "compose"
  },
  {
    id: "brain-break",
    kind: "Пара минут для себя",
    title: "Не всё надо запоминать с первого раза.",
    body: "Нормально вернуться к материалу позже. Знания здесь не для рекордов, а чтобы помогать в работе.",
    action: "knowledge"
  },
  {
    id: "handover-quality",
    kind: "Идея для команды",
    title: "Хорошая передача смены экономит вопросы.",
    body: "Попробуй написать так, чтобы коллеге не пришлось угадывать, о чём речь. Иногда достаточно одной конкретной детали.",
    action: "compose"
  },
  {
    id: "silence-not-proof",
    kind: "Мысль смены",
    title: "Тишина в Ленте не всегда значит, что всё понятно.",
    body: "Если есть полезное уточнение для других, оставь его. Оно не обязано быть срочным, чтобы быть ценным.",
    action: "compose"
  },
  {
    id: "own-pace",
    kind: "Пара минут для себя",
    title: "Хорошая привычка: узнать одну новую вещь.",
    body: "Не по расписанию и не для отчёта. Просто из любопытства к тому, с чем работаешь каждый день.",
    action: "knowledge"
  },
  {
    id: "tiny-warning",
    kind: "Идея для команды",
    title: "Предупреждение лучше сюрприза.",
    body: "Если есть что-то, на что стоит обратить внимание в следующей смене, две понятные строки справятся лучше устной легенды.",
    action: "compose"
  },
  {
    id: "no-heroics",
    kind: "Мысль смены",
    title: "Рабочие процессы не должны держаться на героизме.",
    body: "Подсказка, оставленная вовремя, помогает всем работать спокойнее. А это уже вполне конкретное улучшение.",
    action: "compose"
  },
  {
    id: "everyday-curiosity",
    kind: "Небольшая практика",
    title: "Обычный вопрос может оказаться интересным.",
    body: "Почему продукт называют именно так? Чем отличаются похожие вещи? Иногда ответ уже есть в базе знаний.",
    action: "knowledge"
  },
  {
    id: "human-not-machine",
    kind: "Идея для команды",
    title: "Самый полезный лайфхак часто знает соседняя смена.",
    body: "Если нашёл простой способ облегчить рутину, напиши об этом. Пусть идея работает, даже когда тебя нет рядом.",
    action: "compose"
  },
  {
    id: "useful-two-lines",
    kind: "Мысль смены",
    title: "Полезному сообщению не нужен длинный заголовок.",
    body: "Что произошло, на что обратить внимание, что делать дальше. Три вопроса, после которых другим гораздо проще.",
    action: "compose"
  },
  {
    id: "repeat-one",
    kind: "Небольшая практика",
    title: "Повторение не обязано быть экзаменом.",
    body: "Пара минут с одной статьёй иногда возвращают в память именно то, что хотелось вспомнить.",
    action: "knowledge"
  },
  {
    id: "clear-pass",
    kind: "Идея для команды",
    title: "Договорённости любят ясность.",
    body: "Если кто-то должен продолжить задачу, скажи какую именно. «Мы обсуждали» не очень хороший адрес доставки.",
    action: "compose"
  },
  {
    id: "rest-with-purpose",
    kind: "Пара минут для себя",
    title: "Пять минут не обязаны быть серьёзными.",
    body: "Можно просто узнать что-то любопытное о напитках или сервисе, без тестов, баллов и оценок.",
    action: "knowledge"
  },
  {
    id: "not-urgent-is-useful",
    kind: "Идея для команды",
    title: "Не срочно — не значит неважно.",
    body: "Идея для улучшения или удачное наблюдение вполне заслуживают места в Ленте. Главное — конкретика.",
    action: "compose"
  },
  {
    id: "make-it-easy",
    kind: "Мысль смены",
    title: "Хорошая смена помогает следующей начать спокойно.",
    body: "Если осталось что-то неочевидное, передай короткий контекст. Меньше догадок — больше времени на настоящую работу.",
    action: "compose"
  }
] as const;

/** Shift-based date, aligned with BFStaff's 11:00 start in Asia/Novosibirsk. */
export function getPulseWorkdayKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Novosibirsk",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);

  function part(type: "year" | "month" | "day" | "hour") {
    return parts.find((item) => item.type === type)?.value ?? "";
  }

  const year = Number(part("year"));
  const month = Number(part("month"));
  const day = Number(part("day"));
  const hour = Number(part("hour"));
  const midnight = Date.UTC(year, month - 1, day);
  const workday = midnight - (hour < 11 ? 86_400_000 : 0);
  return new Date(workday).toISOString().slice(0, 10);
}

const composePrompts = FEED_PULSE_PROMPTS.filter((prompt) => prompt.action === "compose");
const knowledgePrompts = FEED_PULSE_PROMPTS.filter((prompt) => prompt.action === "knowledge");

/** Alternate two operational nudges with one voluntary knowledge prompt. */
export function getPulseForWorkday(workdayKey: string): FeedPulsePrompt {
  const days = Math.floor(Date.parse(`${workdayKey}T00:00:00.000Z`) / 86_400_000);
  const slot = ((days + 17) % FEED_PULSE_PROMPTS.length + FEED_PULSE_PROMPTS.length) % FEED_PULSE_PROMPTS.length;
  const group = Math.floor(slot / 3);
  if (slot % 3 === 2) return knowledgePrompts[group];
  return composePrompts[group * 2 + (slot % 3)];
}
