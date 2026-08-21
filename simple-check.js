// Simple script to check if test.db has tables
const sqlite3 = import 'sqlite3').verbose();

const db = new sqlite3.Database('./test.db', (err) => {
  if (err) {
    console.error('Could not connect to test.db', err);
    process.exit(1);
  } else {
    console.log('Connected to test.db');
  }
});

db.serialize(() => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
    if (err) {
      console.error('Error querying tables:', err);
    } else {
      console.log('Tables in test.db:');
      rows.forEach(row => {
        console.log(`  - ${row.name}`);
      });
    }
    db.close();
  });
});