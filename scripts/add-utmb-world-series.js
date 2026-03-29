#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const {
  buildRefreshMigration,
  buildStaticUtmbRows,
  dedupeRows,
  enrichRows,
} = require('./ironman-race-catalog');

function parseArgs(argv) {
  const args = {
    inputJson: path.resolve(process.cwd(), 'public/upcoming-race-catalog.json'),
    outputJson: path.resolve(process.cwd(), 'public/upcoming-race-catalog.json'),
    outputSql: path.resolve(process.cwd(), 'supabase/migrations/20260329123000_race_catalog_ironman_refresh_v2.sql'),
    today: new Date().toISOString().slice(0, 10),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input-json') args.inputJson = argv[++i];
    else if (arg === '--output-json') args.outputJson = argv[++i];
    else if (arg === '--output-sql') args.outputSql = argv[++i];
    else if (arg === '--today') args.today = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseRows = JSON.parse(fs.readFileSync(args.inputJson, 'utf8'));
  const preservedRows = baseRows.filter(row => row.source_site !== 'utmb');
  const utmbRows = buildStaticUtmbRows(args.today);
  const enrichedUtmbRows = await enrichRows(utmbRows);
  const mergedRows = dedupeRows([...preservedRows, ...enrichedUtmbRows]);
  fs.writeFileSync(args.outputJson, `${JSON.stringify(mergedRows, null, 2)}\n`);
  fs.writeFileSync(args.outputSql, buildRefreshMigration(mergedRows));
  process.stdout.write(`${JSON.stringify({
    total: mergedRows.length,
    utmb: mergedRows.filter(row => row.source_site === 'utmb').length,
  })}\n`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
