#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const { buildRefreshMigration, dedupeRows } = require('./ironman-race-catalog');

function parseArgs(argv) {
  const args = {
    inputJson: path.resolve(process.cwd(), 'public/upcoming-race-catalog.json'),
    manualJson: '',
    outputJson: path.resolve(process.cwd(), 'public/upcoming-race-catalog.json'),
    outputFallbackJson: path.resolve(process.cwd(), 'public/ironman-race-catalog.json'),
    outputSql: path.resolve(process.cwd(), 'supabase/migrations/20260329123000_race_catalog_ironman_refresh_v2.sql'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input-json') args.inputJson = argv[++i];
    else if (arg === '--manual-json') args.manualJson = argv[++i];
    else if (arg === '--output-json') args.outputJson = argv[++i];
    else if (arg === '--output-fallback-json') args.outputFallbackJson = argv[++i];
    else if (arg === '--output-sql') args.outputSql = argv[++i];
  }
  return args;
}

function loadManualRows(manualJson) {
  const files = manualJson
    ? [manualJson]
    : fs.readdirSync(__dirname)
      .filter(name => /^manual-race-imports.*\.json$/.test(name))
      .sort()
      .map(name => path.resolve(__dirname, name));
  return files.flatMap(file => JSON.parse(fs.readFileSync(file, 'utf8')));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseRows = JSON.parse(fs.readFileSync(args.inputJson, 'utf8'));
  const manualRows = loadManualRows(args.manualJson);
  const preservedRows = baseRows.filter(row => (
    row.source_site !== 'manual-screenshot'
    && row.source_url !== 'https://www.ahotu.com/event/bank-of-america-chicago-marathon'
  ));
  const mergedRows = dedupeRows([...preservedRows, ...manualRows]);
  const serialized = `${JSON.stringify(mergedRows, null, 2)}\n`;
  fs.writeFileSync(args.outputJson, serialized);
  fs.writeFileSync(args.outputFallbackJson, serialized);
  fs.writeFileSync(args.outputSql, buildRefreshMigration(mergedRows));
  process.stdout.write(`${JSON.stringify({
    total: mergedRows.length,
    manual: mergedRows.filter(row => row.source_site === 'manual-screenshot').length,
  })}\n`);
}

if (require.main === module) {
  main();
}
