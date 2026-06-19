const { z } = require('zod');
const { portTypeRefFromZod, portTypeCompatible } = require('./dist/index.cjs');
const C = (l,o,i)=>console.log(l.padEnd(60), portTypeCompatible(o,i));
C('enum{1,2} -> enum{"1","2"} (identity, should FALSE)', portTypeRefFromZod(z.enum({A:1,B:2})), portTypeRefFromZod(z.enum(['1','2'])));
C('enum{1,2} -> number()  (over-rejects, safe)', portTypeRefFromZod(z.enum({A:1,B:2})), portTypeRefFromZod(z.number()));
C('literal(1) -> number() (correct)', portTypeRefFromZod(z.literal(1)), portTypeRefFromZod(z.number()));
C('literal(1) -> string() (correctly FALSE)', portTypeRefFromZod(z.literal(1)), portTypeRefFromZod(z.string()));
