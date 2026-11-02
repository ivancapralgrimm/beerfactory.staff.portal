export type GlassKind = 'mug' | 'wheat' | 'snifter' | 'chalice';
export type BeerId = 'helles' | 'pilsner' | 'weissbier' | 'marzen' | 'dunkel' | 'ipa' | 'cherry';
export interface Beer {
  id: BeerId; name: string; style: string; type: string; glass: GlassKind;
  density: string | null; alcohol: string; description: string; aroma: string | null;
  production: string | null; guest: string; seasonal: true | null;
  source: string; sourceQuote: string;
  appearance: { body: string; light: string; dark: string; foam: string; haze: number; bubbles: number; foamHeight: number; note: string };
}
/** Historical booklet only. No current assortment, availability, IBU or unstated strength is inferred. */
export const beers: readonly Beer[] = [
  {id:'helles',name:'Хеллес',style:'Helles',type:'Светлое',glass:'mug',density:'12%',alcohol:'не менее 4,5%',seasonal:null,
   description:'Светлое прозрачное пиво с насыщенным вкусом. Сначала чувствуется умеренная солодовая сладость; хмелевая горечь почти не ощущается. Послевкусие тонкое и сухое.',aroma:null,
   production:'В методичке указаны два солода: пильзенский и карамельный экстра лайт.',guest:'Светлое, прозрачное, с мягким солодовым вкусом и почти незаметной горечью. В послевкусии — лёгкая сухость.',
   source:'IMG_7622.webp / IMG_7623.webp',sourceQuote:'Светлое. Плотность: 12%. Объемная доля спирта не менее 4,5%.',
   appearance:{body:'#d78c16',light:'#ffce57',dark:'#713307',foam:'#fff2d3',haze:.03,bubbles:48,foamHeight:58,note:'Золотистое и прозрачное'}},
  {id:'pilsner',name:'Пильзенское',style:'Pilsner',type:'Светлое',glass:'mug',density:'13%',alcohol:'не менее 4,7%',seasonal:null,
   description:'Полноценный мягкий вкус, хмельной аромат и естественная освежающая горечь. В методичке указан оригинальный рецепт пивоварни «Пльзень» в Чехии.',aroma:'Хмельной аромат.',
   production:'Три солода: пильзенский, мюнхенский и карамельный светлый.',guest:'Светлое пиво с выразительным хмельным ароматом и освежающей горчинкой. При этом вкус остаётся полным и мягким.',
   source:'IMG_7622.webp / IMG_7623.webp',sourceQuote:'Светлое. Плотность: 13%. Объемная доля спирта не менее 4,7%.',
   appearance:{body:'#d79416',light:'#ffd45f',dark:'#7e3c07',foam:'#fff2d9',haze:.02,bubbles:58,foamHeight:61,note:'Прозрачное золотистое пиво'}},
  {id:'weissbier',name:'Пшеничное',style:'Weissbier',type:'Светлое',glass:'wheat',density:'13%',alcohol:'4,9%',seasonal:null,
   description:'Освежающее пшеничное пиво с характерным вкусом банана и гвоздики. Эти оттенки методичка связывает со специальными дрожжами верхового брожения.',aroma:null,
   production:'50% пшеничного солода; специальные дрожжи верхового брожения.',guest:'Освежающее пшеничное с узнаваемыми оттенками банана и гвоздики. Они появляются благодаря специальным дрожжам верхового брожения.',
   source:'IMG_7623.webp / IMG_7624.webp',sourceQuote:'Светлое. Плотность: 13%. Объемная доля спирта 4,9%.',
   appearance:{body:'#dd9d38',light:'#ffd479',dark:'#91601c',foam:'#fff1d8',haze:.72,bubbles:30,foamHeight:78,note:'Мягкое золотистое свечение и пшеничная мутность по фото'}},
  {id:'marzen',name:'Мартовское',style:'Märzen',type:'Полутёмное',glass:'mug',density:'12%',alcohol:'не менее 4,1%',seasonal:null,
   description:'Насыщенный цвет, гармоничный солодовый вкус и аромат карамельного солода. Хмелевая горечь мягкая.',aroma:'Аромат карамельного солода.',
   production:'Пять солодов: пильзенский, мюнхенский, карамельный светлый, венский и меланоидин.',guest:'Полутёмное пиво с мягкой хмелевой горчинкой. Во вкусе и аромате особенно хорошо раскрывается карамельный солод.',
   source:'IMG_7622.webp / IMG_7623.webp',sourceQuote:'Полутёмное. Плотность: 12%. Объемная доля спирта не менее 4,1%.',
   appearance:{body:'#a84c18',light:'#e99b3b',dark:'#451707',foam:'#f4dfb9',haze:.12,bubbles:38,foamHeight:56,note:'Насыщенный янтарный оттенок по фото'}},
  {id:'dunkel',name:'Бархатное',style:'Böhmisch Dunkel',type:'Тёмное',glass:'mug',density:'13%',alcohol:'не менее 4,4%',seasonal:null,
   description:'Плотное тёмное пиво с мягким вкусом, чистым карамельным ароматом и тонкой хмелевой горчинкой. Послевкусие приятное, бархатное.',aroma:'Чистый карамельный аромат.',
   production:'Пильзенский, мюнхенский, карамельный светлый, карамельный тёмный солода и жжёная карамель.',guest:'Тёмное, мягкое, с карамельным ароматом и тонкой горчинкой. Название хорошо передаёт его бархатное послевкусие.',
   source:'IMG_7624.webp',sourceQuote:'Тёмное. Плотность: 13%. Объемная доля спирта не менее 4,4%.',
   appearance:{body:'#32160f',light:'#9b4921',dark:'#100a08',foam:'#dec39d',haze:.2,bubbles:23,foamHeight:57,note:'Тёмное, с глубокими карамельными бликами'}},
  {id:'ipa',name:'IPA Factory',style:'IPA Factory',type:'Эль',glass:'snifter',density:'14%',alcohol:'5,4%',seasonal:true,
   description:'Плотный насыщенный эль с балансом солодовой сладости и хмелевой горечи.',aroma:'Фруктовые, цитрусовые и цветочные ноты.',
   production:null,guest:'Насыщенный эль с балансом солодовой сладости и хмелевой горечи. В аромате — фрукты, цитрусы и цветочные ноты.',
   source:'IMG_7624.webp',sourceQuote:'Плотность 14%. Объемная доля спирта 5,4%. Сезонный сорт.',
   appearance:{body:'#a75023',light:'#dc9250',dark:'#512211',foam:'#f3e2c5',haze:.25,bubbles:32,foamHeight:34,note:'Медно-янтарное пиво по фото методички'}},
  {id:'cherry',name:'Вишнёвый эль',style:'Cherry Beer',type:'Фруктовый эль',glass:'chalice',density:null,alcohol:'5,4%',seasonal:true,
   description:'Освежающий лёгкий фруктовый эль. Сбалансированный насыщенный вкус с приятной вишнёвой кислинкой и мягкой хмелевой горечью.',aroma:null,
   production:null,guest:'Лёгкий фруктовый эль с насыщенным вкусом, приятной вишнёвой кислинкой и мягкой хмелевой горчинкой.',
   source:'IMG_7624.webp',sourceQuote:'Объемная доля спирта 5,4%. Сезонный сорт. Плотность в источнике не указана.',
   appearance:{body:'#7e142d',light:'#c33f55',dark:'#300b19',foam:'#f0c9cc',haze:.2,bubbles:26,foamHeight:40,note:'Рубиново-вишнёвый цвет по фото'}}
];
export const glassLabels: Record<GlassKind,string> = {mug:'Фирменная пивная кружка',wheat:'Высокий пшеничный бокал',snifter:'Бокал-снифтер на ножке',chalice:'Тюльпановидный бокал на ножке'};
export function beerIndex(id:string | undefined):number {return Math.max(0,beers.findIndex(b=>b.id===id));}
export function wrappedIndex(index:number):number {return (index%beers.length+beers.length)%beers.length;}
