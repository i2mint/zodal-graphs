const { z } = require('zod');
const { portTypeRefFromZod, portTypeCompatible } = require('./dist/index.cjs');
const ref = (l,s)=>{const r=portTypeRefFromZod(s); console.log(l.padEnd(40), JSON.stringify(r)); return r;};
const C = (l,o,i)=>console.log(l.padEnd(64), portTypeCompatible(o,i));

console.log('=== nativeEnum (TS enum) ===');
const Color = { Red: 0, Green: 1, Blue: 2 };  // numeric TS enum shape
try {
  const ne = z.nativeEnum ? z.nativeEnum(Color) : null;
  if (ne) { ref('z.nativeEnum(numeric)', ne);
    C('nativeEnum(numeric) -> string() (FALSE POS if true)', portTypeRefFromZod(ne), portTypeRefFromZod(z.string())); }
  else console.log('no z.nativeEnum');
} catch(e){ console.log('nativeEnum err:', e.message); }

const StrColor = { Red:'red', Green:'green' };
try {
  const nes = z.nativeEnum ? z.nativeEnum(StrColor) : null;
  if (nes) ref('z.nativeEnum(string)', nes);
} catch(e){ console.log('nativeEnum str err:', e.message); }

console.log('\n=== mixed enum {A:1, B:"x"} ===');
try { ref('z.enum({A:1,B:"x"})', z.enum({A:1,B:'x'})); } catch(e){ console.log('mixed enum err:', e.message); }

console.log('\n=== numeric enum inside a union flowing to string ===');
// realistic: out port = number-enum, into port = string union member
const numEnum = z.enum({Low:1, High:2});
C('enum{1,2} -> union[string, boolean]', portTypeRefFromZod(numEnum), portTypeRefFromZod(z.union([z.string(), z.boolean()])));

console.log('\n=== string-enum subset still correct ===');
C('enum[a,b] -> enum[a,b,c]', portTypeRefFromZod(z.enum(['a','b'])), portTypeRefFromZod(z.enum(['a','b','c'])));
C('enum[a,b] -> string()', portTypeRefFromZod(z.enum(['a','b'])), portTypeRefFromZod(z.string()));

console.log('\n=== (c) isSchema false-positive: object field value that is not a real schema but has _def ===');
// Can captureStructure for object encounter a non-schema with _def? Object.entries(def.shape) -> all real schemas normally.
// But array element: def.element. Always a schema. Low risk. Demonstrate isSchema accepts a fake:
const { } = {};
// We can't easily call internal isSchema; demonstrate via array of a fake won't happen through zod.
console.log('(isSchema only gates internal zod-derived values; not reachable with fake objects through normal zod schemas)');
