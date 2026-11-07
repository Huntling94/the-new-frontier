import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bakeLayout, layoutFile } from './bake';

const target = fileURLToPath(new URL('../../core/data/lande-layout.ts', import.meta.url));
const obstacles = bakeLayout();
writeFileSync(target, layoutFile(obstacles));
console.log(`Baked ${String(obstacles.length)} obstacles into packages/core/data/lande-layout.ts.`);
