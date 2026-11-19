// IndexedDB Storage Adapter complet pour PWA / Mode Hors-Ligne
import historicalBordereaux from '../data/historicalBordereaux.json';
import { getActiveDBName, getActivePractitionerId, getActivePractitioner } from './practitionerService';

const DB_VERSION = 6; // Montée de version pour Facturation, Quittances & Bordereaux CNAM (Bloc 5)

const STORE_PATIENTS = 'patients';
const STORE_WAITING = 'waiting_room';
const STORE_AGENDA = 'agenda';
const STORE_CONSULTATIONS = 'consultations';
const STORE_PRESCRIPTIONS = 'prescriptions';
const STORE_INVOICES = 'invoices';
const STORE_BORDEREAUX = 'cnam_bordereaux';

// ==============================================================
// SYSTÈME DE NOTIFICATION DES MODIFICATIONS (AUTO-BACKUP HOOK)
// ==============================================================
const dataChangeListeners = new Set();

export function onDataChange(listener) {
  dataChangeListeners.add(listener);
  return () => dataChangeListeners.delete(listener);
}

export function notifyDataChanged(action, details = {}) {
  try {
    localStorage.setItem('docpocket_last_local_write', String(Date.now()));
  } catch (e) {
    // Silencieux
  }
  for (const listener of dataChangeListeners) {
    try {
      listener({ action, details, timestamp: Date.now() });
    } catch (e) {
      console.warn("Erreur notification changement base:", e);
    }
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    // Récupération dynamique du nom de base pour le praticien actif
    // (Praticien 'primary' -> 'DocPocketCabinetDB', autre -> 'DocPocketCabinetDB_<id>')
    const dbName = getActiveDBName();
    const request = indexedDB.open(dbName, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Store Patients
      if (!db.objectStoreNames.contains(STORE_PATIENTS)) {
        const store = db.createObjectStore(STORE_PATIENTS, { keyPath: 'id', autoIncrement: true });
        store.createIndex('fullname', 'fullname', { unique: false });
        store.createIndex('telephone', 'telephone', { unique: false });
        store.createIndex('cnamid', 'cnamid', { unique: false });
        store.createIndex('cin', 'cin', { unique: false });
        store.createIndex('numfch', 'numfch', { unique: false });
      }

      // Store Salle d'Attente (Bloc 2)
      if (!db.objectStoreNames.contains(STORE_WAITING)) {
        const waitingStore = db.createObjectStore(STORE_WAITING, { keyPath: 'id', autoIncrement: true });
        waitingStore.createIndex('patientId', 'patientId', { unique: false });
        waitingStore.createIndex('date', 'date', { unique: false });
        waitingStore.createIndex('status', 'status', { unique: false });
      }

      // Store Agenda / RDV (Bloc 2)
      if (!db.objectStoreNames.contains(STORE_AGENDA)) {
        const agendaStore = db.createObjectStore(STORE_AGENDA, { keyPath: 'id', autoIncrement: true });
        agendaStore.createIndex('patientId', 'patientId', { unique: false });
        agendaStore.createIndex('rdvDate', 'rdvDate', { unique: false });
      }

      // Store Consultations Médicales (Bloc 3)
      if (!db.objectStoreNames.contains(STORE_CONSULTATIONS)) {
        const consultStore = db.createObjectStore(STORE_CONSULTATIONS, { keyPath: 'id', autoIncrement: true });
        consultStore.createIndex('patientId', 'patientId', { unique: false });
        consultStore.createIndex('date', 'date', { unique: false });
      }

      // Store Prescriptions & Ordonnances Médicales (Bloc 4)
      if (!db.objectStoreNames.contains(STORE_PRESCRIPTIONS)) {
        const presStore = db.createObjectStore(STORE_PRESCRIPTIONS, { keyPath: 'id', autoIncrement: true });
        presStore.createIndex('patientId', 'patientId', { unique: false });
        presStore.createIndex('date', 'date', { unique: false });
        presStore.createIndex('type', 'type', { unique: false });
      }

      // Store Facturation & Quittances d'Honoraires (Bloc 5)
      if (!db.objectStoreNames.contains(STORE_INVOICES)) {
        const invoiceStore = db.createObjectStore(STORE_INVOICES, { keyPath: 'id', autoIncrement: true });
        invoiceStore.createIndex('patientId', 'patientId', { unique: false });
        invoiceStore.createIndex('date', 'date', { unique: false });
        invoiceStore.createIndex('modeReglement', 'modeReglement', { unique: false });
        invoiceStore.createIndex('statutBordereau', 'statutBordereau', { unique: false });
        invoiceStore.createIndex('bordereauId', 'bordereauId', { unique: false });
      }

      // Store Bordereaux CNAM Tiers-Payant (Bloc 5)
      if (!db.objectStoreNames.contains(STORE_BORDEREAUX)) {
        const bordStore = db.createObjectStore(STORE_BORDEREAUX, { keyPath: 'id', autoIncrement: true });
        bordStore.createIndex('numBordereau', 'numBordereau', { unique: false });
        bordStore.createIndex('dateCreation', 'dateCreation', { unique: false });
        bordStore.createIndex('statut', 'statut', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Données types initiales (aucune donnée fictive)
const INITIAL_PATIENTS = [];

// -------------------------------------------------------------
// UTILITAIRES DE NORMALISATION ÉTAT CIVIL & CIVICITÉ
// -------------------------------------------------------------
export function normalizeMaritalStatus(val) {
  if (!val) return 'Célibataire';
  const v = String(val).toLowerCase().trim();
  if (v.includes('mari')) return 'Marié(e)';
  if (v.includes('divorc')) return 'Divorcé(e)';
  if (v.includes('veuf') || v.includes('veuv')) return 'Veuf(ve)';
  if (v.includes('celib')) return 'Célibataire';
  return val;
}

export function sanitizeCivility(civility, gender, etat_civil) {
  const c = String(civility || '').trim();
  const lower = c.toLowerCase();
  if (lower.includes('mari') || lower.includes('celib') || lower.includes('veuf') || lower.includes('divorc') || !c) {
    if (gender === 'F') {
      return etat_civil === 'Célibataire' ? 'Mlle' : 'Mme';
    }
    return 'M.';
  }
  return c;
}

export function sanitizePatientRecord(p) {
  if (!p) return p;
  const clone = { ...p };
  const civLower = String(clone.civility || '').toLowerCase();
  
  // Si civility contenait la situation matrimoniale (ex: "Marie(e)", "Celibataire")
  if (civLower.includes('mari') || civLower.includes('celib') || civLower.includes('veuf') || civLower.includes('divorc')) {
    if (!clone.etat_civil || clone.etat_civil === 'Célibataire') {
      clone.etat_civil = normalizeMaritalStatus(clone.civility);
    }
    clone.civility = sanitizeCivility(clone.civility, clone.gender, clone.etat_civil);
  } else if (!clone.etat_civil) {
    clone.etat_civil = 'Célibataire';
  }

  // S'assurer que le nom et prénom sont bien formattés
  if (clone.nom) {
    clone.nom = clone.nom.trim().toUpperCase();
  }
  if (clone.prenom) {
    clone.prenom = clone.prenom.trim();
  }
  clone.fullname = `${clone.nom || ''} ${clone.prenom || ''}`.trim();
  return clone;
}

// -------------------------------------------------------------
// RECHERCHE LIBRE & INTELLIGENTE DU BLOC PATIENTS
// (Nom, Prénom ou l'un d'eux, Date de naissance, N° CIN, N° de Fiche)
// -------------------------------------------------------------
export function matchPatientFreeSearch(p, search) {
  if (!search || !search.trim()) return true;
  const rawQ = search.trim().toLowerCase();

  const normalize = (str) => (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const qNorm = normalize(rawQ);

  // 1. Numéro de fiche / ID dossier (ex: 'F-2026-001', '001', '1', '2026-001')
  const numFiche = normalize(p.numfch || '');
  const idStr = String(p.id || '');
  if (numFiche.includes(qNorm) || idStr === rawQ) return true;
  const digitsOnlyQ = rawQ.replace(/\D/g, '');
  if (digitsOnlyQ) {
    const numFicheDigits = numFiche.replace(/\D/g, '');
    if ((numFicheDigits && numFicheDigits.includes(digitsOnlyQ)) || idStr === digitsOnlyQ) {
      return true;
    }
  }

  // 2. Numéro de CIN (ex: '05489632')
  const cinStr = (p.cin || '').toLowerCase().replace(/\s/g, '');
  if (cinStr && (cinStr.includes(rawQ) || (digitsOnlyQ && cinStr.includes(digitsOnlyQ)))) return true;

  // 3. Date de Naissance (Formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD/MM, YYYY)
  const bdate = p.birthdate || p.date_naissance || '';
  if (bdate) {
    const parts = bdate.split(/[-/]/);
    let frDate = '';
    if (parts.length === 3) {
      if (parts[0].length === 4) { // YYYY-MM-DD
        frDate = `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
      } else { // DD-MM-YYYY
        frDate = `${parts[0]}/${parts[1]}/${parts[2]}`;
      }
    }
    const cleanB = bdate.replace(/[^\d]/g, '');
    if (
      bdate.toLowerCase().includes(rawQ) ||
      frDate.includes(rawQ) ||
      frDate.replace(/\//g, '-').includes(rawQ) ||
      (digitsOnlyQ.length >= 2 && cleanB.includes(digitsOnlyQ))
    ) {
      return true;
    }
  }

  // 4. Nom, Prénom, Nom + Prénom, Prénom + Nom (Ordre libre et mots multiples)
  const nomNorm = normalize(p.nom || '');
  const prenomNorm = normalize(p.prenom || '');
  const fullnameNorm = `${nomNorm} ${prenomNorm}`;
  const reverseFullname = `${prenomNorm} ${nomNorm}`;

  if (nomNorm.includes(qNorm) || prenomNorm.includes(qNorm) || fullnameNorm.includes(qNorm) || reverseFullname.includes(qNorm)) {
    return true;
  }

  // Découpage multi-mots (ex: 'hamed ben' ou 'fatma trabelsi')
  const tokens = qNorm.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const combined = `${nomNorm} ${prenomNorm} ${numFiche} ${cinStr} ${bdate}`;
    const allMatch = tokens.every(tok => combined.includes(tok));
    if (allMatch) return true;
  }

  // 5. Téléphone, CNAM, Situation
  if (p.telephone && p.telephone.replace(/\s/g, '').includes(rawQ.replace(/\s/g, ''))) return true;
  if (p.cnamid && p.cnamid.toLowerCase().includes(rawQ)) return true;
  if (p.etat_civil && p.etat_civil.toLowerCase().includes(rawQ)) return true;

  return false;
}

// -------------------------------------------------------------
// PATIENTS CRUD
// -------------------------------------------------------------
export async function getAllPatients(search = '') {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PATIENTS, 'readwrite');
    const store = tx.objectStore(STORE_PATIENTS);
    const request = store.getAll();

    request.onsuccess = async () => {
      let rawPatients = request.result || [];

      // Purge automatique de tout dossier fictif résiduel
      const demoNumfchs = ['F-2026-001', 'F-2026-002', 'F-2026-003'];
      const demoNames = ['BEN SALAH MOHAMED', 'TRABELSI FATMA', 'GHARBI YASSINE'];
      const hasDemo = rawPatients.some(p => demoNumfchs.includes(p.numfch) || demoNames.includes((p.fullname || '').trim().toUpperCase()));
      if (hasDemo) {
        rawPatients.filter(p => demoNumfchs.includes(p.numfch) || demoNames.includes((p.fullname || '').trim().toUpperCase())).forEach(p => {
          if (p.id) store.delete(p.id);
        });
        rawPatients = rawPatients.filter(p => !demoNumfchs.includes(p.numfch) && !demoNames.includes((p.fullname || '').trim().toUpperCase()));
      }

      if (!rawPatients || rawPatients.length === 0) {
        return resolve([]);
      }

      // Assainir tous les dossiers patients (séparation civilité et état civil)
      let patients = rawPatients.map(sanitizePatientRecord);

      if (search.trim() !== '') {
        patients = patients.filter(p => matchPatientFreeSearch(p, search));
      }

      patients.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      resolve(patients);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getPatientById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PATIENTS, 'readonly');
    const store = tx.objectStore(STORE_PATIENTS);
    const request = store.get(Number(id));

    request.onsuccess = () => {
      if (request.result) {
        resolve(sanitizePatientRecord(request.result));
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function seedPatients() {
  return true;
}

/**
 * Vérifie si la liste de patients correspond aux données de démonstration initiales
 */
export function isDemoDatabase(patients) {
  if (!patients || patients.length === 0) return true;
  if (patients.length <= 3) {
    const demoNames = ['BEN SALAH', 'TRABELSI', 'GHARBI'];
    return patients.every(p => demoNames.includes((p.nom || '').trim().toUpperCase()));
  }
  return false;
}

/**
 * Nettoie les données de démonstration pour laisser place aux vraies données synchronisées
 */
export async function clearDemoDataIfPresent() {
  try {
    const db = await openDB();
    const patients = await getAllPatients();
    if (isDemoDatabase(patients)) {
      localStorage.setItem('docpocket_suppress_seed', 'true');
      const tx = db.transaction([STORE_PATIENTS, STORE_INVOICES], 'readwrite');
      tx.objectStore(STORE_PATIENTS).clear();
      tx.objectStore(STORE_INVOICES).clear();
      await new Promise((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      return true;
    }
  } catch (err) {
    console.warn("Erreur clearDemoDataIfPresent:", err);
  }
  return false;
}

export async function savePatient(patient) {
  const db = await openDB();
  const sanitized = sanitizePatientRecord(patient);
  const patientData = {
    ...sanitized,
    fullname: `${sanitized.nom || ''} ${sanitized.prenom || ''}`.trim(),
    updatedAt: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PATIENTS, 'readwrite');
    const store = tx.objectStore(STORE_PATIENTS);
    let request;

    if (patientData.id !== undefined && patientData.id !== null) {
      request = store.put(patientData);
    } else {
      delete patientData.id;
      patientData.createdAt = new Date().toISOString();
      if (!patientData.derniere_visite) {
        patientData.derniere_visite = new Date().toISOString().split('T')[0];
      }
      request = store.add(patientData);
    }

    request.onsuccess = () => {
      notifyDataChanged('save_patient', { id: request.result });
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deletePatientById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PATIENTS, 'readwrite');
    const store = tx.objectStore(STORE_PATIENTS);
    const request = store.delete(Number(id));

    request.onsuccess = () => {
      notifyDataChanged('delete_patient', { id });
      resolve(true);
    };
    request.onerror = () => reject(request.error);
  });
}

// -------------------------------------------------------------
// DÉTECTION DE DOUBLONS & FUSION DE DOSSIERS PATIENTS
// -------------------------------------------------------------
export function normalizeStrForMatch(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Recherche tous les doublons potentiels de patients dans la base locale
 * Critère principal : Même Nom + Prénom + Date de naissance
 * Critère secondaire : Même N° CIN ou N° CNAM identique
 */
export async function findDuplicatePatients() {
  const allPatients = await getAllPatients();
  const groupsMap = new Map();

  for (const p of allPatients) {
    const nomClean = normalizeStrForMatch(p.nom);
    const prenomClean = normalizeStrForMatch(p.prenom);
    const birthClean = (p.birthdate || '').trim();
    const cinClean = (p.cin || '').trim();

    // 1. Règle clé : Nom + Prénom identiques ET Date de naissance identique
    if (nomClean && prenomClean && birthClean) {
      const key = `identity:${nomClean}|${prenomClean}|${birthClean}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          reason: `Même Identité & Date de Naissance (${p.nom.toUpperCase()} ${p.prenom} • ${birthClean})`,
          patients: []
        });
      }
      groupsMap.get(key).patients.push(p);
    } else if (cinClean && cinClean.length >= 7) {
      // 2. Règle alternative : Même CIN (si date de naissance non renseignée)
      const key = `cin:${cinClean}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          reason: `Même Numéro de CIN (${cinClean})`,
          patients: []
        });
      }
      // Éviter d'ajouter plusieurs fois le même patient
      if (!groupsMap.get(key).patients.some(item => item.id === p.id)) {
        groupsMap.get(key).patients.push(p);
      }
    }
  }

  // Ne garder que les groupes contenant au moins 2 dossiers distincts
  const duplicates = [];
  for (const [key, group] of groupsMap.entries()) {
    if (group.patients.length > 1) {
      // Dédupliquer par ID
      const uniquePatients = Array.from(new Map(group.patients.map(p => [p.id, p])).values());
      if (uniquePatients.length > 1) {
        duplicates.push({
          key,
          reason: group.reason,
          patients: uniquePatients
        });
      }
    }
  }

  return duplicates;
}

/**
 * Fusionne un ou plusieurs dossiers sources secondaires vers un dossier cible principal
 * Rapproche toutes les consultations, ordonnances, factures et antécédents vers la fiche cible
 */
export async function mergePatients(targetPatientId, sourcePatientIds = []) {
  if (!targetPatientId || !sourcePatientIds || sourcePatientIds.length === 0) {
    throw new Error("Paramètres de fusion invalides.");
  }

  const db = await openDB();
  const allPatients = await getAllPatients();

  const targetPatient = allPatients.find(p => String(p.id) === String(targetPatientId));
  if (!targetPatient) throw new Error("Dossier principal cible introuvable.");

  const sourcePatients = allPatients.filter(p => sourcePatientIds.map(String).includes(String(p.id)) && String(p.id) !== String(targetPatientId));
  if (sourcePatients.length === 0) throw new Error("Aucun dossier secondaire à fusionner.");

  // 1. Fusionner les informations démographiques et médicales
  const updatedTarget = { ...targetPatient };

  for (const src of sourcePatients) {
    // Compléter les champs vides depuis le dossier secondaire
    if (!updatedTarget.telephone && src.telephone) updatedTarget.telephone = src.telephone;
    if (!updatedTarget.cin && src.cin) updatedTarget.cin = src.cin;
    if (!updatedTarget.cnamid && src.cnamid) updatedTarget.cnamid = src.cnamid;
    if ((!updatedTarget.caisse || updatedTarget.caisse === 'Sans Caisse') && src.caisse) updatedTarget.caisse = src.caisse;
    if (!updatedTarget.apci && src.apci) {
      updatedTarget.apci = src.apci;
      updatedTarget.apciLabel = src.apciLabel;
    }
    if (!updatedTarget.city && src.city) updatedTarget.city = src.city;
    if (!updatedTarget.adress && src.adress) updatedTarget.adress = src.adress;
    if (!updatedTarget.birthdate && src.birthdate) updatedTarget.birthdate = src.birthdate;
    if (!updatedTarget.quality && src.quality) updatedTarget.quality = src.quality;
    if (!updatedTarget.filiere && src.filiere) updatedTarget.filiere = src.filiere;
    if (!updatedTarget.etat_civil && src.etat_civil) updatedTarget.etat_civil = src.etat_civil;

    // Fusion intelligente des allergies
    if (src.allergies && src.allergies.trim()) {
      if (!updatedTarget.allergies || !updatedTarget.allergies.trim()) {
        updatedTarget.allergies = src.allergies.trim();
      } else if (!updatedTarget.allergies.toLowerCase().includes(src.allergies.toLowerCase().trim())) {
        updatedTarget.allergies = `${updatedTarget.allergies} ; ${src.allergies.trim()}`;
      }
    }

    // Fusion intelligente des antécédents médicaux
    if (src.atcd_medicaux && src.atcd_medicaux.trim()) {
      if (!updatedTarget.atcd_medicaux || !updatedTarget.atcd_medicaux.trim()) {
        updatedTarget.atcd_medicaux = src.atcd_medicaux.trim();
      } else if (!updatedTarget.atcd_medicaux.includes(src.atcd_medicaux.trim())) {
        updatedTarget.atcd_medicaux = `${updatedTarget.atcd_medicaux}\n[Fusion dossier ${src.numfch || src.id}] : ${src.atcd_medicaux.trim()}`;
      }
    }

    // Fusion antécédents chirurgicaux
    if (src.atcd_chirurgicaux && src.atcd_chirurgicaux.trim()) {
      if (!updatedTarget.atcd_chirurgicaux || !updatedTarget.atcd_chirurgicaux.trim()) {
        updatedTarget.atcd_chirurgicaux = src.atcd_chirurgicaux.trim();
      } else if (!updatedTarget.atcd_chirurgicaux.includes(src.atcd_chirurgicaux.trim())) {
        updatedTarget.atcd_chirurgicaux = `${updatedTarget.atcd_chirurgicaux}\n${src.atcd_chirurgicaux.trim()}`;
      }
    }

    // Fusion antécédents familiaux
    if (src.atcd_familiaux && src.atcd_familiaux.trim()) {
      if (!updatedTarget.atcd_familiaux || !updatedTarget.atcd_familiaux.trim()) {
        updatedTarget.atcd_familiaux = src.atcd_familiaux.trim();
      } else if (!updatedTarget.atcd_familiaux.includes(src.atcd_familiaux.trim())) {
        updatedTarget.atcd_familiaux = `${updatedTarget.atcd_familiaux}\n${src.atcd_familiaux.trim()}`;
      }
    }

    // Dernière visite (garder la plus récente)
    if (src.derniere_visite && (!updatedTarget.derniere_visite || src.derniere_visite > updatedTarget.derniere_visite)) {
      updatedTarget.derniere_visite = src.derniere_visite;
    }
  }

  const srcIds = sourcePatients.map(p => String(p.id));

  // 2. Cascade : Rattachement de toutes les consultations
  let consultsMoved = 0;
  const txConsults = db.transaction(STORE_CONSULTATIONS, 'readwrite');
  const storeConsults = txConsults.objectStore(STORE_CONSULTATIONS);
  const allConsults = await new Promise((res, rej) => {
    const r = storeConsults.getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  });
  for (const c of allConsults) {
    if (srcIds.includes(String(c.patientId))) {
      c.patientId = targetPatient.id;
      c.patientName = targetPatient.fullname;
      storeConsults.put(c);
      consultsMoved++;
    }
  }
  await new Promise(res => { txConsults.oncomplete = res; });

  // 3. Cascade : Rattachement de toutes les ordonnances
  let prescsMoved = 0;
  const txPrescs = db.transaction(STORE_PRESCRIPTIONS, 'readwrite');
  const storePrescs = txPrescs.objectStore(STORE_PRESCRIPTIONS);
  const allPrescs = await new Promise((res, rej) => {
    const r = storePrescs.getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  });
  for (const p of allPrescs) {
    if (srcIds.includes(String(p.patientId))) {
      p.patientId = targetPatient.id;
      p.patientName = targetPatient.fullname;
      storePrescs.put(p);
      prescsMoved++;
    }
  }
  await new Promise(res => { txPrescs.oncomplete = res; });

  // 4. Cascade : Rattachement de toutes les quittances et factures
  let invoicesMoved = 0;
  const txInvoices = db.transaction(STORE_INVOICES, 'readwrite');
  const storeInvoices = txInvoices.objectStore(STORE_INVOICES);
  const allInvoices = await new Promise((res, rej) => {
    const r = storeInvoices.getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  });
  for (const inv of allInvoices) {
    if (srcIds.includes(String(inv.patientId))) {
      inv.patientId = targetPatient.id;
      inv.patientName = targetPatient.fullname;
      storeInvoices.put(inv);
      invoicesMoved++;
    }
  }
  await new Promise(res => { txInvoices.oncomplete = res; });

  // 5. Cascade : Salle d'attente
  let waitingMoved = 0;
  const txWaiting = db.transaction(STORE_WAITING, 'readwrite');
  const storeWaiting = txWaiting.objectStore(STORE_WAITING);
  const allWaiting = await new Promise((res, rej) => {
    const r = storeWaiting.getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  });
  for (const w of allWaiting) {
    if (srcIds.includes(String(w.patientId))) {
      w.patientId = targetPatient.id;
      w.patientName = targetPatient.fullname;
      storeWaiting.put(w);
      waitingMoved++;
    }
  }
  await new Promise(res => { txWaiting.oncomplete = res; });

  // 6. Cascade : Agenda & Rendez-vous
  let agendaMoved = 0;
  const txAgenda = db.transaction(STORE_AGENDA, 'readwrite');
  const storeAgenda = txAgenda.objectStore(STORE_AGENDA);
  const allAgenda = await new Promise((res, rej) => {
    const r = storeAgenda.getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  });
  for (const a of allAgenda) {
    if (srcIds.includes(String(a.patientId))) {
      a.patientId = targetPatient.id;
      a.patientName = targetPatient.fullname;
      storeAgenda.put(a);
      agendaMoved++;
    }
  }
  await new Promise(res => { txAgenda.oncomplete = res; });

  // 7. Supprimer les dossiers secondaires et sauvegarder la fiche cible
  const txPatients = db.transaction(STORE_PATIENTS, 'readwrite');
  const storePatients = txPatients.objectStore(STORE_PATIENTS);
  for (const src of sourcePatients) {
    storePatients.delete(Number(src.id));
  }
  storePatients.put(updatedTarget);
  await new Promise(res => { txPatients.oncomplete = res; });

  notifyDataChanged('merge_patients', {
    targetId: targetPatientId,
    sourceIds: sourcePatientIds
  });

  return {
    targetPatient: updatedTarget,
    mergedCount: sourcePatients.length,
    consultsMoved,
    prescsMoved,
    invoicesMoved,
    waitingMoved,
    agendaMoved
  };
}

/**
 * Fusionne plusieurs groupes de doublons en masse (traitement par lots)
 */
export async function mergeMultipleDuplicateGroups(groupsToMerge = [], onProgress = null) {
  let totalPatientsMerged = 0;
  let totalConsults = 0;
  let totalPrescs = 0;
  let totalInvoices = 0;
  let processedCount = 0;

  for (let i = 0; i < groupsToMerge.length; i++) {
    const item = groupsToMerge[i];
    if (onProgress) {
      onProgress({ current: i + 1, total: groupsToMerge.length, item });
    }
    try {
      const res = await mergePatients(item.targetId, item.sourceIds);
      totalPatientsMerged += res.mergedCount || 0;
      totalConsults += res.consultsMoved || 0;
      totalPrescs += res.prescsMoved || 0;
      totalInvoices += res.invoicesMoved || 0;
      processedCount++;
    } catch (err) {
      console.warn(`Erreur fusion groupe ${i}:`, err);
    }
  }

  return {
    success: true,
    processedCount,
    totalPatientsMerged,
    totalConsults,
    totalPrescs,
    totalInvoices
  };
}

// -------------------------------------------------------------
// SALLE D'ATTENTE (WAITING ROOM)
// -------------------------------------------------------------
export async function getTodayWaitingList(targetDate = null) {
  const dateStr = targetDate || new Date().toISOString().split('T')[0];
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WAITING, 'readonly');
    const store = tx.objectStore(STORE_WAITING);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result || [];
      const todayList = all.filter(item => item.date === dateStr);
      todayList.sort((a, b) => (a.order || 0) - (b.order || 0));
      resolve(todayList);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function addToWaitingRoom(patient, motif = '', isUrgent = false) {
  const db = await openDB();
  const dateStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  const arrivalTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const currentList = await getTodayWaitingList(dateStr);
  const nextOrder = currentList.length + 1;

  const entry = {
    patientId: patient.id,
    patientName: `${patient.nom} ${patient.prenom}`,
    numfch: patient.numfch || '',
    telephone: patient.telephone || '',
    caisse: patient.caisse || '',
    apci: patient.apci || '',
    date: dateStr,
    arrivalTime: arrivalTime,
    timestamp: now.getTime(),
    order: nextOrder,
    motif: motif || 'Consultation standard',
    isUrgent: Boolean(isUrgent),
    status: 'waiting' // 'waiting' | 'in_consultation' | 'finished'
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WAITING, 'readwrite');
    const store = tx.objectStore(STORE_WAITING);
    const request = store.add(entry);

    request.onsuccess = () => {
      notifyDataChanged('add_waiting', { id: request.result });
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateWaitingStatus(id, newStatus) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WAITING, 'readwrite');
    const store = tx.objectStore(STORE_WAITING);
    const getReq = store.get(Number(id));

    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) return reject(new Error('Entrée non trouvée'));
      item.status = newStatus;
      if (newStatus === 'in_consultation') {
        item.consultAt = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      } else if (newStatus === 'finished') {
        item.finishedAt = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }

      const updateReq = store.put(item);
      updateReq.onsuccess = () => {
        notifyDataChanged('update_waiting', { id, status: newStatus });
        resolve(item);
      };
      updateReq.onerror = () => reject(updateReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export async function removeFromWaitingRoom(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WAITING, 'readwrite');
    const store = tx.objectStore(STORE_WAITING);
    const request = store.delete(Number(id));

    request.onsuccess = () => {
      notifyDataChanged('remove_waiting', { id });
      resolve(true);
    };
    request.onerror = () => reject(request.error);
  });
}

// -------------------------------------------------------------
// BLOC 2 : AGENDA & RENDEZ-VOUS
// -------------------------------------------------------------
export async function getAppointments(targetDate = null) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AGENDA, 'readonly');
    const store = tx.objectStore(STORE_AGENDA);
    const request = store.getAll();

    request.onsuccess = () => {
      let appointments = request.result || [];
      if (targetDate) {
        appointments = appointments.filter(a => a.rdvDate === targetDate);
      }
      appointments.sort((a, b) => (a.rdvTime || '').localeCompare(b.rdvTime || ''));
      resolve(appointments);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveAppointment(appointment) {
  const db = await openDB();
  const item = {
    ...appointment,
    updatedAt: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AGENDA, 'readwrite');
    const store = tx.objectStore(STORE_AGENDA);
    let request;

    if (item.id !== undefined && item.id !== null) {
      request = store.put(item);
    } else {
      delete item.id;
      item.createdAt = new Date().toISOString();
      item.isDone = false;
      request = store.add(item);
    }

    request.onsuccess = () => {
      notifyDataChanged('save_appointment', { id: request.result });
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAppointment(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AGENDA, 'readwrite');
    const store = tx.objectStore(STORE_AGENDA);
    const request = store.delete(Number(id));

    request.onsuccess = () => {
      notifyDataChanged('delete_appointment', { id });
      resolve(true);
    };
    request.onerror = () => reject(request.error);
  });
}

// -------------------------------------------------------------
// BLOC 3 : CONSULTATIONS MÉDICALES & CONSTANTES
// -------------------------------------------------------------
export async function getAllConsultations() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CONSULTATIONS, 'readonly');
    const store = tx.objectStore(STORE_CONSULTATIONS);
    const request = store.getAll();

    request.onsuccess = () => {
      const list = request.result || [];
      list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      resolve(list);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getConsultationsByPatient(patientId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CONSULTATIONS, 'readonly');
    const store = tx.objectStore(STORE_CONSULTATIONS);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result || [];
      const filtered = all.filter(c => String(c.patientId) === String(patientId));
      filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      resolve(filtered);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveConsultation(consultation) {
  const db = await openDB();
  const item = {
    ...consultation,
    updatedAt: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CONSULTATIONS, 'readwrite');
    const store = tx.objectStore(STORE_CONSULTATIONS);
    let request;

    if (item.id !== undefined && item.id !== null) {
      request = store.put(item);
    } else {
      delete item.id;
      item.createdAt = new Date().toISOString();
      request = store.add(item);
    }

    request.onsuccess = async () => {
      const consultId = request.result;

      // Mettre à jour la date de dernière visite du patient
      try {
        const pTx = db.transaction(STORE_PATIENTS, 'readwrite');
        const pStore = pTx.objectStore(STORE_PATIENTS);
        const pReq = pStore.get(Number(item.patientId));
        pReq.onsuccess = () => {
          const pat = pReq.result;
          if (pat) {
            pat.derniere_visite = item.date || new Date().toISOString().split('T')[0];
            pStore.put(pat);
          }
        };
      } catch (e) {
        console.warn("Mise à jour dernière visite patient:", e);
      }

      notifyDataChanged('save_consultation', { id: consultId, patientId: item.patientId });
      resolve(consultId);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteConsultationById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CONSULTATIONS, 'readwrite');
    const store = tx.objectStore(STORE_CONSULTATIONS);
    const key = (typeof id === 'number' || (!isNaN(Number(id)) && String(id).trim() !== '')) ? Number(id) : id;
    const request = store.delete(key);

    request.onsuccess = () => {
      notifyDataChanged('delete_consultation', { id });
      resolve(true);
    };
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// STORE PRESCRIPTIONS & ORDONNANCES (Bloc 4)
// ==========================================

export async function getAllPrescriptions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRESCRIPTIONS, 'readonly');
    const store = tx.objectStore(STORE_PRESCRIPTIONS);
    const request = store.getAll();

    request.onsuccess = () => {
      const list = request.result || [];
      list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getPrescriptionsByPatient(patientId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRESCRIPTIONS, 'readonly');
    const store = tx.objectStore(STORE_PRESCRIPTIONS);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result || [];
      const filtered = all.filter(p => String(p.patientId) === String(patientId));
      filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      resolve(filtered);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function savePrescription(prescription) {
  const db = await openDB();
  const item = {
    ...prescription,
    updatedAt: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRESCRIPTIONS, 'readwrite');
    const store = tx.objectStore(STORE_PRESCRIPTIONS);
    let request;

    if (item.id !== undefined && item.id !== null) {
      request = store.put(item);
    } else {
      delete item.id;
      item.createdAt = new Date().toISOString();
      request = store.add(item);
    }

    request.onsuccess = () => {
      notifyDataChanged('save_prescription', { id: request.result });
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deletePrescriptionById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRESCRIPTIONS, 'readwrite');
    const store = tx.objectStore(STORE_PRESCRIPTIONS);
    const request = store.delete(Number(id));

    request.onsuccess = () => {
      notifyDataChanged('delete_prescription', { id });
      resolve(true);
    };
    request.onerror = () => reject(request.error);
  });
}

// ==============================================================
// STORE FACTURATION, HONORAIRES & QUITTANCES (Bloc 5)
// ==============================================================

const INITIAL_INVOICES = [];

export async function getAllInvoices() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_INVOICES, 'readwrite');
    const store = tx.objectStore(STORE_INVOICES);
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = () => {
      let list = getAllRequest.result || [];
      const demoNames = ['BEN SALAH MOHAMED', 'TRABELSI FATMA', 'GHARBI YASSINE'];
      const demoNumFacs = ['FAC-2026-001', 'FAC-2026-002', 'FAC-2026-003'];
      const hasDemo = list.some(inv => demoNumFacs.includes(inv.numFacture) || demoNames.includes((inv.patientName || '').trim().toUpperCase()));
      if (hasDemo) {
        list.filter(inv => demoNumFacs.includes(inv.numFacture) || demoNames.includes((inv.patientName || '').trim().toUpperCase())).forEach(inv => {
          if (inv.id) store.delete(inv.id);
        });
        list = list.filter(inv => !demoNumFacs.includes(inv.numFacture) && !demoNames.includes((inv.patientName || '').trim().toUpperCase()));
      }
      list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      resolve(list);
    };
    getAllRequest.onerror = () => reject(getAllRequest.error);
  });
}

export async function getInvoicesByPatient(patientId) {
  const all = await getAllInvoices();
  return all.filter(inv => String(inv.patientId) === String(patientId));
}

export async function getPendingCnamInvoices() {
  const all = await getAllInvoices();
  return all.filter(inv => 
    (inv.modeReglement === 'cnam_mo' || inv.modeReglement === 'cnam_apci') &&
    inv.statutBordereau === 'en_attente' &&
    Number(inv.partCnam) > 0
  );
}

export async function saveInvoice(invoice) {
  const db = await openDB();
  const item = {
    ...invoice,
    updatedAt: new Date().toISOString()
  };

  if (!item.numFacture) {
    const count = await getInvoicesCount();
    const year = new Date().getFullYear();
    const seq = String(count + 1).padStart(4, '0');
    item.numFacture = `FAC-${year}-${seq}`;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_INVOICES, 'readwrite');
    const store = tx.objectStore(STORE_INVOICES);
    let request;

    if (item.id !== undefined && item.id !== null) {
      request = store.put(item);
    } else {
      delete item.id;
      item.createdAt = item.createdAt || new Date().toISOString();
      request = store.add(item);
    }

    request.onsuccess = () => {
      notifyDataChanged('save_invoice', { id: request.result });
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteInvoiceById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_INVOICES, STORE_BORDEREAUX], 'readwrite');
    const invStore = tx.objectStore(STORE_INVOICES);
    const bordStore = tx.objectStore(STORE_BORDEREAUX);

    const getReq = invStore.get(Number(id));
    getReq.onsuccess = () => {
      const invoice = getReq.result;
      if (!invoice) {
        invStore.delete(Number(id));
        return;
      }

      // Si la facture était attachée à un bordereau CNAM, mettre à jour le bordereau
      if (invoice.bordereauId) {
        const bReq = bordStore.get(Number(invoice.bordereauId));
        bReq.onsuccess = () => {
          const bord = bReq.result;
          if (bord) {
            bord.facturesIds = (bord.facturesIds || []).filter(fid => Number(fid) !== Number(id));
            bord.lignes = (bord.lignes || []).filter(l => Number(l.factureId) !== Number(id));
            bord.totalFactures = (bord.facturesIds || []).length;
            bord.totalActes = (bord.lignes || []).length;
            bord.montantTotalGlobal = (bord.lignes || []).reduce((acc, l) => acc + (Number(l.montantGlobal) || 0), 0);
            bord.montantTotalPatient = (bord.lignes || []).reduce((acc, l) => acc + (Number(l.partPatient) || 0), 0);
            bord.montantTotalCnam = (bord.lignes || []).reduce((acc, l) => acc + (Number(l.partCnam) || 0), 0);
            bordStore.put(bord);
          }
        };
      }

      // Supprimer définitivement la facture
      invStore.delete(Number(id));
    };

    tx.oncomplete = () => {
      notifyDataChanged('delete_invoice', { id });
      resolve(true);
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function getInvoicesCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_INVOICES, 'readonly');
    const store = tx.objectStore(STORE_INVOICES);
    const req = store.count();
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => reject(req.error);
  });
}

// ==============================================================
// STORE BORDEREAUX CNAM TIERS-PAYANT (Bloc 5)
// ==============================================================

const INITIAL_BORDEREAUX = Array.isArray(historicalBordereaux) && historicalBordereaux.length > 0 
  ? historicalBordereaux 
  : [];

export function parseCnamBordereauTxt(content, fileName = 'medecins.txt') {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) throw new Error("Le fichier est vide.");
  const header = lines[0];
  if (!header.startsWith("401")) {
    throw new Error("Format non reconnu : la première ligne doit être un en-tête CNAM débutant par '401'.");
  }

  function formatDate(yyyymmdd) {
    if (!yyyymmdd || yyyymmdd.length !== 8) return "";
    return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
  }

  const rawDateStr = header.slice(13, 21);
  const rawDebut = header.slice(21, 29);
  const rawFin = header.slice(29, 37);
  const medCode = header.slice(45, 57).trim() || "010002763183";
  const nbActes = parseInt(header.slice(57, 62), 10) || (lines.length - 1);
  const totalGlobal = (parseInt(header.slice(62, 72), 10) || 0) / 1000;
  const totalPatient = (parseInt(header.slice(72, 82), 10) || 0) / 1000;
  const totalCnam = (parseInt(header.slice(82, 92), 10) || 0) / 1000;

  const dateCreation = formatDate(rawDateStr);
  const periodeDebut = formatDate(rawDebut);
  const periodeFin = formatDate(rawFin);

  const savedProfile = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('docpocket_doctor_profile') || '{}') : {};
  const docNom = savedProfile.nom ? `Dr. ${savedProfile.nom}` : 'Dr. Hamed BEN KHALIFA';

  const lignes = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("200")) continue;
    const cnamId = line.slice(6, 16).trim();
    const patientName = line.slice(22, 82).trim();
    const birth = formatDate(line.slice(82, 90));
    const rawActeDate = line.slice(102, 110);
    const acteDate = formatDate(rawActeDate);
    const mttGlobal = (parseInt(line.slice(110, 120), 10) || 0) / 1000;
    const partPatient = (parseInt(line.slice(130, 140), 10) || 0) / 1000;
    const partCnam = (parseInt(line.slice(140, 150), 10) || 0) / 1000;
    const rawApci = line.slice(150).trim();
    const apciCode = rawApci && parseInt(rawApci, 10) > 0 ? String(parseInt(rawApci, 10)).padStart(2, "0") : "";

    lignes.push({
      numOrdre: i,
      factureId: `ARCH-${dateCreation}-${i}`,
      date: acteDate || dateCreation,
      patientName,
      cnamId,
      birthDate: birth,
      quality: "Assuré(e)",
      apci: apciCode ? `APCI ${apciCode}` : "",
      codeActe: "C",
      nomActe: apciCode ? `Consultation APCI ${apciCode}` : "Consultation Médecine Générale",
      montantGlobal: mttGlobal,
      partPatient,
      partCnam
    });
  }

  const fileBase = fileName.replace(/\.txt$/i, "");
  const numBordereau = `BORD-CNAM-${fileBase.replace(/^medecins-/, "")}`;

  return {
    numBordereau,
    sourceFile: fileName,
    dateCreation,
    periodeDebut,
    periodeFin,
    medecinNom: docNom,
    medecinCnamId: medCode,
    caisse: "CNSS / CNRPS",
    typeBordereau: "Télétransmission CNAM",
    facturesIds: [],
    lignes,
    totalFactures: lignes.length,
    totalActes: lignes.length,
    montantTotalGlobal: totalGlobal || lignes.reduce((a, b) => a + b.montantGlobal, 0),
    montantTotalPatient: totalPatient || lignes.reduce((a, b) => a + b.partPatient, 0),
    montantTotalCnam: totalCnam || lignes.reduce((a, b) => a + b.partCnam, 0),
    statut: "regle",
    dateDepot: dateCreation,
    dateReglement: dateCreation,
    referenceVirement: "Virement CNAM Télétransmission",
    observations: `Archive historique CNAM (${fileName})`
  };
}

export async function getAllBordereaux() {
  try {
    const db = await openDB();
    const storedList = await new Promise((resolve) => {
      const tx = db.transaction(STORE_BORDEREAUX, 'readonly');
      const req = tx.objectStore(STORE_BORDEREAUX).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    const isPrimary = getActivePractitionerId() === 'primary';
    const hasDemo = storedList.some(b => b.medecinNom === 'Dr. MEDECIN Cabinet');

    // Pour le praticien principal ('primary' / Dr. Hamed BEN KHALIFA), injecter les 35 archives historiques si la base est neuve
    if (isPrimary && (storedList.length < 5 || hasDemo)) {
      const cleanExisting = storedList.filter(b => b.medecinNom !== 'Dr. MEDECIN Cabinet');
      const existingNums = new Set(cleanExisting.map(b => b.numBordereau));
      const toAddList = [];

      (INITIAL_BORDEREAUX || []).forEach(hb => {
        if (!existingNums.has(hb.numBordereau)) {
          const item = { ...hb };
          delete item.id;
          toAddList.push(item);
        }
      });

      // Écriture asynchrone sécurisée dans IndexedDB
      if (toAddList.length > 0 || hasDemo) {
        setTimeout(async () => {
          try {
            const writeTx = db.transaction(STORE_BORDEREAUX, 'readwrite');
            const writeStore = writeTx.objectStore(STORE_BORDEREAUX);
            storedList.filter(b => b.medecinNom === 'Dr. MEDECIN Cabinet').forEach(b => {
              if (b.id) writeStore.delete(b.id);
            });
            toAddList.forEach(item => writeStore.add(item));
          } catch (err) {
            console.warn("Écriture en tâche de fond des bordereaux:", err);
          }
        }, 10);
      }

      const merged = [...cleanExisting, ...toAddList];
      merged.sort((a, b) => new Date(b.dateCreation || 0) - new Date(a.dateCreation || 0));
      return merged.length > 0 ? merged : (INITIAL_BORDEREAUX || []);
    }

    storedList.sort((a, b) => new Date(b.dateCreation || 0) - new Date(a.dateCreation || 0));
    return storedList;
  } catch (err) {
    console.error("Erreur getAllBordereaux:", err);
    return getActivePractitionerId() === 'primary' ? (INITIAL_BORDEREAUX || []) : [];
  }
}

export async function getBordereauById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BORDEREAUX, 'readonly');
    const store = tx.objectStore(STORE_BORDEREAUX);
    const req = store.get(Number(id));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveBordereau(bordereau) {
  const db = await openDB();
  const item = {
    ...bordereau,
    updatedAt: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_BORDEREAUX, STORE_INVOICES], 'readwrite');
    const bordStore = tx.objectStore(STORE_BORDEREAUX);
    const invStore = tx.objectStore(STORE_INVOICES);

    let bordRequest;
    if (item.id !== undefined && item.id !== null) {
      bordRequest = bordStore.put(item);
    } else {
      delete item.id;
      item.createdAt = item.createdAt || new Date().toISOString();
      bordRequest = bordStore.add(item);
    }

    bordRequest.onsuccess = () => {
      const savedBordId = bordRequest.result || item.id;

      // Mettre à jour le statut des factures incluses dans ce bordereau
      if (Array.isArray(item.facturesIds) && item.facturesIds.length > 0) {
        item.facturesIds.forEach(facId => {
          const fReq = invStore.get(Number(facId));
          fReq.onsuccess = () => {
            const fac = fReq.result;
            if (fac) {
              fac.statutBordereau = 'inclus_bordereau';
              fac.bordereauId = savedBordId;
              invStore.put(fac);
            }
          };
        });
      }

      notifyDataChanged('save_bordereau', { id: savedBordId });
      resolve(savedBordId);
    };

    bordRequest.onerror = () => reject(bordRequest.error);
  });
}

export async function deleteBordereauById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_BORDEREAUX, STORE_INVOICES], 'readwrite');
    const bordStore = tx.objectStore(STORE_BORDEREAUX);
    const invStore = tx.objectStore(STORE_INVOICES);

    // D'abord libérer les factures associées
    const invAllReq = invStore.getAll();
    invAllReq.onsuccess = () => {
      const invoices = invAllReq.result || [];
      invoices.forEach(inv => {
        if (Number(inv.bordereauId) === Number(id)) {
          inv.statutBordereau = 'en_attente';
          inv.bordereauId = null;
          invStore.put(inv);
        }
      });

      // Supprimer le bordereau
      const delReq = bordStore.delete(Number(id));
      delReq.onsuccess = () => {
        notifyDataChanged('delete_bordereau', { id });
        resolve(true);
      };
      delReq.onerror = () => reject(delReq.error);
    };

    invAllReq.onerror = () => reject(invAllReq.error);
  });
}

// ==========================================
// Gestion des Consultations en Attente de Règlement
// ==========================================

export async function checkConsultationHasInvoice(consultationId) {
  if (!consultationId) return false;
  try {
    const invoices = await getAllInvoices();
    return invoices.some(inv => String(inv.consultationId) === String(consultationId));
  } catch (e) {
    return false;
  }
}

function getUnsettledStorageKey() {
  const activeId = getActivePractitionerId();
  return (!activeId || activeId === 'primary')
    ? 'docpocket_unsettled_consultation'
    : `docpocket_unsettled_consultation_${activeId}`;
}

export function getUnsettledConsultation() {
  try {
    const raw = localStorage.getItem(getUnsettledStorageKey());
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setUnsettledConsultation(data) {
  try {
    const key = getUnsettledStorageKey();
    if (!data) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch (e) {}
}

export function clearUnsettledConsultation() {
  try {
    localStorage.removeItem(getUnsettledStorageKey());
  } catch (e) {}
}
