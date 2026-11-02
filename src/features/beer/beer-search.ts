import {beers} from './beer-data';

// Search metadata only: no image/renderer import or backend request on Home.
const normalize = (value:string) => value.normalize('NFD').replace(/\p{M}/gu,'')
  .toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const aliases = 'пиво пива пивной пивная карта коллекция наше нашего фирменное BeerFactory BeerBistro бирфэктори '
  + 'хелес пилснер пильзнер пшеничка вайсбир вайссбир марцен марзен дункель ипа айпиэй вишневое лагер лагеры';
const searchText = normalize(['Пивная карта',aliases,...beers.flatMap(beer=>[beer.name,beer.style,beer.type])].join(' '));

export function matchesBeerMap(query:string):boolean {
  const value=normalize(query);
  return value.length>=2 && value.split(/\s+/).every(word=>searchText.includes(word));
}

export const beerMapSearchResult = {
  id:'beer-map', title:'Пивная карта', path:'/beer', kind:'Сорта BeerFactory', rank:-1
} as const;
