/** Pure, shared by the Edge handler and local tests. No profile/credential data. */
export function normalizeIdentityName(value:string){return value.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru-RU');}
export function identityCandidates(fullName:string):Array<{first:string;last:string}>{
 const value=normalizeIdentityName(fullName),words=value.split(' ');
 if(words.length<2||words.length>8||value.length>161)return [];
 const found=new Map<string,{first:string;last:string}>();
 for(let split=1;split<words.length;split++){
  const a=words.slice(0,split).join(' '),b=words.slice(split).join(' ');
  for(const [first,last]of [[a,b],[b,a]])if(first.length<=80&&last.length<=80)found.set(first+'\u0000'+last,{first,last});
 }
 return [...found.values()];
}
/** Quoted PostgREST literal; %, _ must be literal identity characters, not wildcards. */
export function identityLiteral(value:string){return '"'+value.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/[%_]/g,character=>'\\'+character)+'"';}
export function identityFilter(candidates:Array<{first:string;last:string}>){return candidates.map(pair=>`and(first_name.ilike.${identityLiteral(pair.first)},last_name.ilike.${identityLiteral(pair.last)})`).join(',');}
/** Same limiter keys for reversed ordering; do not double-attempt sign-in. */
export function identityFingerprint(fullName:string){return normalizeIdentityName(fullName).split(' ').sort().join(':');}
