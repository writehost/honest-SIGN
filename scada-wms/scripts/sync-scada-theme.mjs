// Copies the design tokens of the main SCADA System WMS verbatim, so Mini WMS
// never keeps its own look-alike palette.
//   node scripts/sync-scada-theme.mjs /path/to/scada_system
// Source: writehost/scada_system → app/globals.css
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const root = process.argv[2] ?? '../../writehost/scada_system'
const src = readFileSync(join(root, 'app/globals.css'), 'utf8')
let rev = 'unknown'
try { rev = execSync(`git -C "${root}" rev-parse --short HEAD`).toString().trim() } catch {}

/** Returns the balanced `{…}` block that starts at the first match of `head`. */
function block(head) {
  const i = src.indexOf(head)
  if (i < 0) throw new Error(`not found in scada_system globals.css: ${head}`)
  let depth = 0
  for (let j = src.indexOf('{', i); j < src.length; j++) {
    if (src[j] === '{') depth++
    else if (src[j] === '}' && --depth === 0) return src.slice(i, j + 1)
  }
  throw new Error(`unbalanced block: ${head}`)
}

const out = `/*
 * SCADA System WMS design tokens — GENERATED, do not edit.
 * Copied verbatim from writehost/scada_system app/globals.css @ ${rev}
 * by scripts/sync-scada-theme.mjs. Change the tokens in the main WMS, then re-sync.
 */

${block(':root {')}

${block('@theme inline {')}

/* Промышленные WMS-панели: карточки, таблицы, фильтры */
${block('@layer components {')}
`
writeFileSync(new URL('../src/theme/scada-system.css', import.meta.url), out)
console.log(`scada-system.css synced from ${root} @ ${rev}`)
