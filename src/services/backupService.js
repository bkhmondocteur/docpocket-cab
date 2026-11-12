import {
  getAllPatients,
  getAllConsultations,
  getAllPrescriptions,
  getAllInvoices,
  getAllBordereaux,
  savePatient,
  saveConsultation,
  savePrescription,
  saveInvoice,
  saveBordereau
} from './patientStorage';
import { writeBackupFileToFolder } from './backupFolderService';

/**
 * Service de Sauvegarde & Restauration Universel pour DocPocket Cab
 * Compatible :
 * 1. Sauvegardes natives DocPocket Cab (.json)
 * 2. Sauvegardes d'archives SQL de l'ancien cabinet (Archives .zip SMED6__*.zip avec décompression pure JS hors-ligne)
 */

// ==============================================================
// 1. DÉCOMPRESSEUR ZIP PUR JAVASCRIPT (ZERO DÉPENDANCE EXTERNE)
// ==============================================================
export async function unzipBuffer(arrayBuffer) {
  const uint8 = new Uint8Array(arrayBuffer);
  const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
  let offset = 0;
  const files = {};

  while (offset < uint8.length - 30) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // Fin des en-têtes locaux

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const nameBuf = uint8.slice(offset + 30, offset + 30 + nameLen);
    const fileName = new TextDecoder('utf-8').decode(nameBuf);

    const dataStart = offset + 30 + nameLen + extraLen;
    const compData = uint8.slice(dataStart, dataStart + compressedSize);

    // Ne décompresser que les fichiers SQL ou TXT utiles
    if (fileName && !fileName.endsWith('/')) {
      try {
        if (compressionMethod === 0) {
          files[fileName] = new TextDecoder('utf-8').decode(compData);
        } else if (compressionMethod === 8) {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(compData);
          writer.close();
          const reader = ds.readable.getReader();
          const chunks = [];
          let total = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            total += value.length;
          }
          const res = new Uint8Array(total);
          let pos = 0;
          for (const c of chunks) {
            res.set(c, pos);
            pos += c.length;
          }
          files[fileName] = new TextDecoder('utf-8').decode(res);
        }
      } catch (err) {
        console.warn(`Erreur décompression du fichier ${fileName}:`, err);
      }
    }
    offset = dataStart + compressedSize;
  }
  return files;
}

// ==============================================================
// 2. PARSEUR DE DUMPS SQL MARIADB / ANCIENNE BASE
// ==============================================================
export function parseSqlDump(sqlContent) {
  if (!sqlContent) return [];
  const insertRegex = /INSERT INTO `([^`]+)` \(([^)]+)\) VALUES\s*([\s\S]+?);/g;
  let match;
  const results = [];

  function cleanVal(v) {
    if (!v || v === 'NULL') return null;
    let s = v.trim();
    if (s.startsWith('\'') && s.endsWith('\'')) {
      s = s.slice(1, -1);
    }
    return s.replace(/\\'/g, '\'').replace(/\\\\/g, '\\').trim();
  }

  while ((match = insertRegex.exec(sqlContent)) !== null) {
    const columns = match[2].split(',').map(c => c.trim().replace(/`/g, ''));
    const valuesBlock = match[3];

    let inString = false;
    let escape = false;
    let currentRow = [];
    let currentVal = '';
    let inParen = false;

    for (let i = 0; i < valuesBlock.length; i++) {
      const ch = valuesBlock[i];
      if (escape) {
        currentVal += ch;
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '\'' && !escape) {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === '(' && !inParen) {
          inParen = true;
          currentRow = [];
          currentVal = '';
          continue;
        } else if (ch === ')' && inParen) {
          currentRow.push(currentVal);
          inParen = false;
          const rowObj = {};
          columns.forEach((col, idx) => {
            rowObj[col] = cleanVal(currentRow[idx]);
          });
          results.push(rowObj);
          currentVal = '';
          continue;
        } else if (ch === ',' && inParen) {
          currentRow.push(currentVal);
          currentVal = '';
          continue;
        }
      }
      if (inParen) {
        currentVal += ch;
      }
    }
  }
  return results;
}

// ==============================================================
// 3. SAUVEGARDE NATIVE DOCPOCKET CAB (.JSON)
// ==============================================================
export async function exportDocPocketBackup() {
  const [patients, consultations, prescriptions, invoices, bordereaux] = await Promise.all([
    getAllPatients(),
    getAllConsultations(),
    getAllPrescriptions(),
    getAllInvoices(),
    getAllBordereaux()
  ]);

  const doctorProfile = JSON.parse(localStorage.getItem('docpocket_doctor_profile') || '{}');

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-');
  const filename = `DocPocketCab_Sauvegarde_${dateStr.slice(0, 10)}_${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}.json`;

  const backupData = {
    app: 'DocPocket Cab',
    schemaVersion: 6,
    exportedAt: now.toISOString(),
    stats: {
      patientsCount: patients.length,
      consultationsCount: consultations.length,
      prescriptionsCount: prescriptions.length,
      invoicesCount: invoices.length,
      bordereauxCount: bordereaux.length
    },
    doctorProfile,
    data: {
      patients,
      consultations,
      prescriptions,
      invoices,
      bordereaux
    }
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  
  // Enregistrement direct dans le dossier configuré (ou téléchargement si non disponible)
  const saveResult = await writeBackupFileToFolder(filename, blob);

  return {
    filename,
    stats: backupData.stats,
    saveMode: saveResult.mode,
    folderName: saveResult.folderName
  };
}

// ==============================================================
// 4. RESTAURATION DEPUIS FICHIER .JSON NATIVE
// ==============================================================
export async function restoreDocPocketBackup(jsonObj, mode = 'merge', onProgress = () => {}) {
  if (!jsonObj || !jsonObj.data) {
    throw new Error("Format de fichier de sauvegarde DocPocket Cab invalide.");
  }

  const { patients = [], consultations = [], prescriptions = [], invoices = [], bordereaux = [] } = jsonObj.data;
  let importedCount = { patients: 0, consultations: 0, prescriptions: 0, invoices: 0 };

  // Profil médecin
  if (jsonObj.doctorProfile) {
    localStorage.setItem('docpocket_doctor_profile', JSON.stringify(jsonObj.doctorProfile));
  }

  // Patients
  onProgress("Importation des dossiers patients...");
  for (const pat of patients) {
    const item = { ...pat };
    if (mode === 'merge') delete item.id;
    await savePatient(item);
    importedCount.patients++;
  }

  // Consultations
  onProgress("Importation des consultations...");
  for (const c of consultations) {
    const item = { ...c };
    if (mode === 'merge') delete item.id;
    await saveConsultation(item);
    importedCount.consultations++;
  }

  // Prescriptions
  onProgress("Importation des ordonnances...");
  for (const p of prescriptions) {
    const item = { ...p };
    if (mode === 'merge') delete item.id;
    await savePrescription(item);
    importedCount.prescriptions++;
  }

  // Invoices
  onProgress("Importation des quittances & factures...");
  for (const inv of invoices) {
    const item = { ...inv };
    if (mode === 'merge') delete item.id;
    await saveInvoice(item);
    importedCount.invoices++;
  }

  // Bordereaux
  for (const b of bordereaux) {
    const item = { ...b };
    if (mode === 'merge') delete item.id;
    await saveBordereau(item);
  }

  onProgress("Restauration terminée avec succès !");
  return importedCount;
}

// ==============================================================
// 5. RESTAURATION DEPUIS ARCHIVE SQL DU CABINET (SMED6__*.zip)
// ==============================================================
export async function restoreLegacyBackupZip(arrayBuffer, mode = 'merge', onProgress = () => {}) {
  onProgress("Décompression de l'archive de sauvegarde...");
  const files = await unzipBuffer(arrayBuffer);

  const fileKeys = Object.keys(files);
  if (fileKeys.length === 0 || !files['patient_id.sql']) {
    throw new Error("L'archive sélectionnée n'est pas une sauvegarde valide (fichier patient_id.sql manquant).");
  }

  onProgress("Extraction et analyse des tables SQL de la base...");

  // 1. Parser les patients
  const rawPatients = parseSqlDump(files['patient_id.sql'] || '');
  onProgress(`Lecture de ${rawPatients.length} fiches patients...`);

  // Map des patients créés pour lier les consultations par uid
  const uidToPatientMap = new Map();
  let importedPatientsCount = 0;

  for (const p of rawPatients) {
    // Nettoyage des chaînes
    const nom = (p.famname || '').trim().toUpperCase();
    const prenom = (p.shortname || '').trim();
    if (!nom && !prenom) continue;

    const fullname = nom + (prenom ? ' ' + prenom : '');
    const gender = (p.gender || '').toLowerCase().includes('fem') ? 'F' : 'M';
    const rawCiv = (p.civility || '').trim();
    const civLower = rawCiv.toLowerCase();

    // Détection de l'état civil matrimonial depuis l'ancienne base (qui stockait Marie(e), Celibataire dans civility)
    let etat_civil = 'Célibataire';
    if (civLower.includes('mari')) {
      etat_civil = 'Marié(e)';
    } else if (civLower.includes('divorc')) {
      etat_civil = 'Divorcé(e)';
    } else if (civLower.includes('veuf') || civLower.includes('veuv')) {
      etat_civil = 'Veuf(ve)';
    } else if (civLower.includes('celib')) {
      etat_civil = 'Célibataire';
    }

    // Civilité strictement honorifique (M., Mme, Mlle, Enfant)
    let civility = gender === 'F' ? (etat_civil === 'Célibataire' ? 'Mlle' : 'Mme') : 'M.';

    const patientObj = {
      nom,
      prenom,
      fullname,
      gender,
      civility,
      etat_civil,
      birthdate: p.birthdate || '',
      telephone: (p.telephone || '').trim(),
      cin: (p.cin || '').trim(),
      city: (p.city || '').trim(),
      adress: (p.adress || '').trim(),
      numfch: (p.numfch || '').trim(),
      cnamid: (p.cnamid || '').trim(),
      caisse: (p.Caisse || 'CNSS').trim(),
      quality: (p.quality || 'Assuré(e)').trim(),
      filiere: p.Filliar === '1' ? 'Privée (Médecin de famille)' : 'Remboursement',
      apci: (p.apci || '').trim(),
      apciLabel: p.apci ? `APCI Code ${p.apci}` : '',
      solde: parseFloat(p.solde) || 0,
      derniere_visite: p.lastcons || '',
      atcd_medicaux: p.nota || '',
      atcd_chirurgicaux: '',
      atcd_familiaux: '',
      allergies: ''
    };

    try {
      const savedId = await savePatient(patientObj);
      if (p.uid) {
        uidToPatientMap.set(p.uid, { id: savedId, fullname, cnamid: patientObj.cnamid });
      }
      importedPatientsCount++;
    } catch (e) {
      console.warn("Erreur insertion patient:", e);
    }
  }

  // 2. Parser les consultations
  let importedConsultCount = 0;
  if (files['consult.sql']) {
    onProgress("Importation de l'historique des consultations médicales...");
    const rawConsults = parseSqlDump(files['consult.sql']);

    for (const c of rawConsults) {
      const linkedPatient = uidToPatientMap.get(c.uid);
      const patientId = linkedPatient ? linkedPatient.id : (c.uid || '1');
      const patientName = linkedPatient ? linkedPatient.fullname : 'PATIENT';

      let taMax = '';
      let taMin = '';
      if (c.ta && c.ta.includes('/')) {
        const parts = c.ta.split('/');
        taMax = parts[0].trim();
        taMin = parts[1].trim();
      } else {
        taMax = c.tamax || '';
        taMin = c.tamin || '';
      }

      const consultObj = {
        patientId,
        patientName,
        date: c.consdate || new Date().toISOString().split('T')[0],
        heure: c.dtime ? c.dtime.slice(0, 5) : '10:00',
        motif: c.motif || 'Consultation de suivi',
        taMax,
        taMin,
        poids: c.weight || '',
        taille: c.height || '',
        bmi: c.bmi || '',
        pouls: c.rc || '',
        temperature: c.temperat || '',
        spo2: c.sao2 || '',
        examGeneral: '',
        examRespiratoire: '',
        examHemodynamique: '',
        examNeurologique: '',
        examAbdominal: '',
        examMusculosquelettique: '',
        examReste: c.examens || '',
        diagnostic: c.cnsdiag || '',
        traitement: '',
        conduite: '',
        reposJours: c.repos || '',
        reposDebut: c.debutrepos || ''
      };

      try {
        await saveConsultation(consultObj);
        importedConsultCount++;
      } catch (e) {
        console.warn("Erreur insertion consultation:", e);
      }
    }
  }

  // 3. Parser les prescriptions
  let importedPrescCount = 0;
  if (files['prescrip.sql']) {
    onProgress("Importation des ordonnances et prescriptions...");
    const rawPresc = parseSqlDump(files['prescrip.sql']);

    // Grouper par consid pour reconstituer les ordonnances
    const groupedPresc = {};
    for (const item of rawPresc) {
      const cid = item.consid || 'DEFAULT';
      if (!groupedPresc[cid]) groupedPresc[cid] = [];
      groupedPresc[cid].push({
        nom: item.itemname || item.shortname || 'Médicament',
        dci: item.dci || '',
        dosage: '',
        forme: item.forme || '',
        posologie: item.posology || '',
        duree: item.ttperiod || ''
      });
    }

    for (const [cid, meds] of Object.entries(groupedPresc)) {
      const prescObj = {
        patientId: 1,
        date: new Date().toISOString().split('T')[0],
        type: 'normale',
        medicaments: meds,
        notes: `Prescription importée depuis l'archive (Réf: ${cid})`
      };
      try {
        await savePrescription(prescObj);
        importedPrescCount++;
      } catch (e) {
        // ignore
      }
    }
  }

  // 4. Parser les paramètres médecin s'ils existent
  if (files['appset.sql']) {
    try {
      const rawApp = parseSqlDump(files['appset.sql']);
      if (rawApp.length > 0) {
        const app = rawApp[0];
        const profile = {
          nom: 'Hamed BEN KHALIFA',
          specialite: 'Médecine Générale',
          cnamId: '010002763183',
          fiscId: app.FiscID || '856103/M',
          ordreId: app.CNOMID || '12052',
          adresse: 'Complexe Médical Dar Attabib, Mahdia',
          telephone: '31 576 900 / 53 573 117'
        };
        localStorage.setItem('docpocket_doctor_profile', JSON.stringify(profile));
      }
    } catch (e) {
      // ignore
    }
  }

  onProgress("Importation terminée !");
  return {
    patients: importedPatientsCount,
    consultations: importedConsultCount,
    prescriptions: importedPrescCount
  };
}
