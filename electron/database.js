import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

let db = null;
let dbPath = '';

export async function initDB(userDataPath) {
  const SQL = await initSqlJs();
  dbPath = path.join(userDataPath, 'docpocket_data.sqlite');

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      telephone TEXT,
      date_naissance TEXT,
      derniere_visite TEXT,
      observations TEXT
    );
  `);

  // Check if patients table is empty, seed with initial data
  const res = db.exec("SELECT COUNT(*) as count FROM patients");
  const count = res[0].values[0][0];
  if (count === 0) {
    db.run(`
      INSERT INTO patients (nom, prenom, telephone, date_naissance, derniere_visite, observations)
      VALUES 
      ('Dupont', 'Jean', '06 12 34 56 78', '1985-04-12', '12/05/2026', 'Consultation de routine - RAS'),
      ('Martin', 'Sophie', '06 98 76 54 32', '1990-11-23', '15/06/2026', 'Allergie à la pénicilline'),
      ('Bernard', 'Luc', '07 65 43 21 09', '1978-02-05', '20/07/2026', 'Suivi tension artérielle');
    `);
    saveDB();
  }

  return true;
}

export function saveDB() {
  if (!db || !dbPath) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export function getPatients(search = '') {
  if (!db) return [];
  let query = "SELECT * FROM patients";
  let params = [];
  if (search.trim() !== '') {
    query += " WHERE nom LIKE ? OR prenom LIKE ? OR telephone LIKE ?";
    const pattern = `%${search.trim()}%`;
    params = [pattern, pattern, pattern];
  }
  query += " ORDER BY id DESC";

  const stmt = db.prepare(query);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function addPatient(patient) {
  if (!db) return null;
  const today = new Date().toLocaleDateString('fr-FR');
  const stmt = db.prepare(`
    INSERT INTO patients (nom, prenom, telephone, date_naissance, derniere_visite, observations)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run([
    patient.nom || '',
    patient.prenom || '',
    patient.telephone || '',
    patient.date_naissance || '',
    today,
    patient.observations || ''
  ]);
  stmt.free();
  saveDB();
  return getPatients();
}

export function deletePatient(id) {
  if (!db) return null;
  const stmt = db.prepare("DELETE FROM patients WHERE id = ?");
  stmt.run([id]);
  stmt.free();
  saveDB();
  return getPatients();
}
