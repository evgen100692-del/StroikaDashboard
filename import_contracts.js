const fs   = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH  = 'C:\\projects\\StroikaDashboard\\StroikaDashboard\\data\\stroika.db';
const SQL_PATH = 'C:\\projects\\StroikaDashboard\\StroikaDashboard\\stroika_insert.sql';

async function main() {
  const SQL = await initSqlJs();

  let db;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('✅ База загружена:', DB_PATH);
  } else {
    console.error('❌ Файл базы не найден:', DB_PATH);
    process.exit(1);
  }

  const sql = fs.readFileSync(SQL_PATH, 'utf-8');
  const lines = sql.split('\n').filter(l => l.trim().startsWith('INSERT'));

  let inserted = 0;
  let skipped  = 0;

  for (const stmt of lines) {
    try {
      db.run(stmt);
      inserted++;
    } catch (e) {
      console.warn('⚠️  Пропущено:', e.message.slice(0, 100));
      skipped++;
    }
  }

  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  db.close();

  console.log(`\n✅ Готово!`);
  console.log(`   Вставлено: ${inserted}`);
  console.log(`   Пропущено: ${skipped}`);
  console.log(`   База сохранена: ${DB_PATH}`);
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});