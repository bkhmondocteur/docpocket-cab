// ==============================================================
// DOCPOCKET CABINET - SERVICE DE GESTION MULTI-PRATICIENS
// ==============================================================
// Cloisonnement étanche et indépendant des données médicales & financières
// par médecin : chaque praticien dispose de sa propre base de données,
// de son code CNAM, de ses quittances, ordonnances et consultations.

import { getActiveLicensePartitionId } from './licenseService';

const PRACTITIONERS_LIST_KEY = 'docpocket_practitioners_list_v1';
const ACTIVE_PRACTITIONER_KEY = 'docpocket_active_practitioner_id';
const DOCTOR_PROFILE_KEY = 'docpocket_doctor_profile';
const PIN_STORAGE_KEY = 'docpocket_doctor_pin_code';

/**
 * Scoping dynamique par partition de licence :
 * Garantit que chaque médecin acquéreur d'une licence possède sa propre liste
 * de praticiens, son propre profil et son propre code PIN, totalement isolés
 * de la base de données originelle de Dr. Hamed BEN KHALIFA.
 */
function getScopedKey(baseKey) {
  const partition = getActiveLicensePartitionId();
  if (!partition || partition === 'primary') return baseKey;
  return `${baseKey}_${partition}`;
}

// Couleurs professionnelles attribuées aux avatars des médecins
export const PRACTITIONER_COLORS = [
  '#0284c7', // Bleu Cyan (Praticien Principal)
  '#059669', // Émeraude / Vert Médical
  '#7c3aed', // Violet Impérial
  '#d97706', // Ambre / Ocre
  '#e11d48', // Rose Framboise
  '#0d9488', // Sarcelle / Turquoise
  '#4f46e5', // Indigo
  '#ca8a04'  // Or / Bronze
];

/**
 * Praticien initial par défaut (Dr. Hamed BEN KHALIFA)
 * Lié de façon permanente à la base originelle 'DocPocketCabinetDB'
 */
const DEFAULT_PRIMARY_DOCTOR = {
  id: 'primary',
  nom: 'BEN KHALIFA',
  prenom: 'Hamed',
  titre: 'Dr.',
  specialite: 'Médecine Générale',
  telephone: '31 576 900 / 53 573 117',
  email: '',
  adresse: 'Complexe Médical Dar Attabib',
  ville: 'Mahdia',
  cnamId: '010002763183',
  fiscId: '856103/M',
  ordreId: '12052',
  pinCode: '',
  isDefault: true,
  color: '#0284c7',
  createdAt: '2026-01-01T00:00:00.000Z'
};

const practitionerListeners = new Set();

export function onPractitionerChange(listener) {
  practitionerListeners.add(listener);
  return () => practitionerListeners.delete(listener);
}

function notifyPractitionerChanged(action, practitioner) {
  for (const listener of practitionerListeners) {
    try {
      listener({ action, practitioner, timestamp: Date.now() });
    } catch (e) {
      console.warn("Erreur notification changement praticien:", e);
    }
  }
}

/**
 * Initialise ou récupère la liste de tous les praticiens
 */
export function getAllPractitioners() {
  try {
    const partition = getActiveLicensePartitionId();
    const isMaster = partition === 'primary';
    const listKey = getScopedKey(PRACTITIONERS_LIST_KEY);
    const raw = localStorage.getItem(listKey);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }

    if (isMaster) {
      // Premier lancement : migre le profil existant s'il existe vers 'primary'
      let primaryDoctor = { ...DEFAULT_PRIMARY_DOCTOR };
      const savedOldProfile = localStorage.getItem(DOCTOR_PROFILE_KEY);
      if (savedOldProfile) {
        try {
          const parsed = JSON.parse(savedOldProfile);
          primaryDoctor = {
            ...primaryDoctor,
            nom: parsed.nom || primaryDoctor.nom,
            prenom: parsed.prenom || primaryDoctor.prenom,
            specialite: parsed.specialite || primaryDoctor.specialite,
            telephone: parsed.telephone || primaryDoctor.telephone,
            email: parsed.email || primaryDoctor.email,
            adresse: parsed.adresse || primaryDoctor.adresse,
            ville: parsed.ville || primaryDoctor.ville,
            cnamId: parsed.cnamId || primaryDoctor.cnamId,
            fiscId: parsed.fiscId || primaryDoctor.fiscId,
            ordreId: parsed.ordreId || primaryDoctor.ordreId
          };
        } catch (e) {}
      }

      // Récupère aussi le PIN déjà configuré pour l'associer au médecin principal
      const existingPin = localStorage.getItem(PIN_STORAGE_KEY);
      if (existingPin && existingPin.trim()) {
        primaryDoctor.pinCode = existingPin.trim();
      }

      const initialList = [primaryDoctor];
      localStorage.setItem(listKey, JSON.stringify(initialList));
      if (!localStorage.getItem(getScopedKey(ACTIVE_PRACTITIONER_KEY))) {
        localStorage.setItem(getScopedKey(ACTIVE_PRACTITIONER_KEY), 'primary');
      }
      return initialList;
    } else {
      // Cabinet d'un médecin confrère acheteur indépendant
      const savedProfile = localStorage.getItem(getScopedKey(DOCTOR_PROFILE_KEY));
      let clientDoctor = {
        id: 'primary',
        nom: '',
        prenom: '',
        titre: 'Dr.',
        specialite: 'Médecine Générale',
        telephone: '',
        email: '',
        adresse: '',
        ville: '',
        cnamId: '',
        fiscId: '',
        ordreId: '',
        pinCode: '',
        isDefault: true,
        color: '#059669',
        createdAt: new Date().toISOString()
      };

      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          clientDoctor = {
            ...clientDoctor,
            nom: parsed.nomSeul || parsed.nom || '',
            prenom: parsed.prenomSeul || parsed.prenom || '',
            specialite: parsed.specialite || 'Médecine Générale',
            telephone: parsed.telephone || '',
            email: parsed.email || '',
            adresse: parsed.adresse || '',
            ville: parsed.ville || '',
            cnamId: parsed.cnamId || '',
            fiscId: parsed.fiscId || '',
            ordreId: parsed.ordreId || ''
          };
        } catch (e) {}
      }

      const clientPin = localStorage.getItem(getScopedKey(PIN_STORAGE_KEY));
      if (clientPin && clientPin.trim()) {
        clientDoctor.pinCode = clientPin.trim();
      }

      const initialList = [clientDoctor];
      localStorage.setItem(listKey, JSON.stringify(initialList));
      if (!localStorage.getItem(getScopedKey(ACTIVE_PRACTITIONER_KEY))) {
        localStorage.setItem(getScopedKey(ACTIVE_PRACTITIONER_KEY), 'primary');
      }
      return initialList;
    }
  } catch (e) {
    console.error("Erreur lecture liste praticiens:", e);
    return [DEFAULT_PRIMARY_DOCTOR];
  }
}

/**
 * Récupère l'identifiant du praticien actif
 */
export function getActivePractitionerId() {
  try {
    return localStorage.getItem(getScopedKey(ACTIVE_PRACTITIONER_KEY)) || 'primary';
  } catch {
    return 'primary';
  }
}

/**
 * Récupère l'objet praticien actif
 */
export function getActivePractitioner() {
  const list = getAllPractitioners();
  const activeId = getActivePractitionerId();
  const found = list.find(p => p.id === activeId);
  return found || list[0] || DEFAULT_PRIMARY_DOCTOR;
}

/**
 * Renvoie le nom physique de la base IndexedDB pour le praticien actif.
 * GARANTIE 100% SÉCURITÉ & ISOLATION :
 * - Praticien maître 'primary' -> 'DocPocketCabinetDB' (base de 4000 patients préservée intacte).
 * - Licence vendue à un confrère -> 'DocPocketCabinetDB_lic_YYYYMMDD_XXXX' (base 100% vierge et privée).
 */
export function getActiveDBName() {
  const partition = getActiveLicensePartitionId();
  const activeId = getActivePractitionerId();

  if (partition === 'primary') {
    if (activeId === 'primary') {
      return 'DocPocketCabinetDB';
    }
    const cleanId = String(activeId).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `DocPocketCabinetDB_${cleanId}`;
  }

  // Partition étanche pour un confrère avec sa propre licence
  const cleanPart = String(partition).replace(/[^a-zA-Z0-9_-]/g, '_');
  if (activeId === 'primary' || !activeId) {
    return `DocPocketCabinetDB_${cleanPart}`;
  }
  const cleanId = String(activeId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `DocPocketCabinetDB_${cleanPart}_${cleanId}`;
}

/**
 * Formate le nom d'affichage complet d'un médecin (ex: 'Dr. Hamed BEN KHALIFA')
 */
export function formatDoctorDisplayName(doc) {
  if (!doc) return 'Dr. Praticien';
  const titre = doc.titre || 'Dr.';
  const nomComplet = `${doc.prenom || ''} ${doc.nom || ''}`.trim();
  if (!nomComplet) return `${titre} Médecin`;
  return `${titre} ${nomComplet}`;
}

/**
 * Enregistre ou met à jour un praticien
 */
export function savePractitioner(practitionerData) {
  try {
    const listKey = getScopedKey(PRACTITIONERS_LIST_KEY);
    const list = getAllPractitioners();
    const now = new Date().toISOString();

    let target = { ...practitionerData };

    // Si nouveau praticien
    if (!target.id) {
      target.id = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      target.createdAt = now;
      target.isDefault = false;
      // Assigne une couleur différente
      const usedColors = list.map(p => p.color);
      const availableColor = PRACTITIONER_COLORS.find(c => !usedColors.includes(c)) || PRACTITIONER_COLORS[list.length % PRACTITIONER_COLORS.length];
      target.color = target.color || availableColor;
    }

    target.updatedAt = now;
    target.nom = (target.nom || '').trim();
    target.prenom = (target.prenom || '').trim();
    target.specialite = (target.specialite || 'Médecine Générale').trim();
    target.titre = target.titre || 'Dr.';

    const existingIdx = list.findIndex(p => p.id === target.id);
    if (existingIdx >= 0) {
      // Conserve isDefault
      target.isDefault = list[existingIdx].isDefault;
      list[existingIdx] = target;
    } else {
      list.push(target);
    }

    localStorage.setItem(listKey, JSON.stringify(list));

    // Si le praticien sauvegardé est le praticien actif, met à jour le profil courant
    if (target.id === getActivePractitionerId()) {
      syncDoctorProfileWithPractitioner(target);
    }

    notifyPractitionerChanged('saved', target);
    return { success: true, practitioner: target };
  } catch (e) {
    console.error("Erreur enregistrement praticien:", e);
    return { success: false, error: e.message };
  }
}

/**
 * Supprime un praticien associé (le praticien 'primary' est protégé)
 */
export function deletePractitioner(practitionerId) {
  try {
    if (practitionerId === 'primary') {
      return { success: false, error: "Le médecin principal du cabinet ne peut pas être supprimé." };
    }

    const listKey = getScopedKey(PRACTITIONERS_LIST_KEY);
    const list = getAllPractitioners();
    const updated = list.filter(p => p.id !== practitionerId);
    if (updated.length === list.length) {
      return { success: false, error: "Praticien introuvable." };
    }

    localStorage.setItem(listKey, JSON.stringify(updated));

    // Si on supprime le praticien actuellement actif, on rebascule immédiatement sur 'primary'
    if (getActivePractitionerId() === practitionerId) {
      switchPractitioner('primary');
    }

    notifyPractitionerChanged('deleted', { id: practitionerId });
    return { success: true };
  } catch (e) {
    console.error("Erreur suppression praticien:", e);
    return { success: false, error: e.message };
  }
}

/**
 * Bascule vers un autre praticien du cabinet
 * Valide le code PIN si le praticien cible en a défini un
 */
export function switchPractitioner(targetPractitionerId, enteredPin = null) {
  try {
    const list = getAllPractitioners();
    const target = list.find(p => p.id === targetPractitionerId);

    if (!target) {
      return { success: false, error: "Praticien introuvable dans le cabinet." };
    }

    // Vérification du code PIN de sécurité si configuré
    if (target.pinCode && target.pinCode.trim()) {
      const cleanInput = String(enteredPin || '').trim();
      if (cleanInput !== target.pinCode.trim()) {
        return {
          success: false,
          needsPin: true,
          error: "Code PIN personnel incorrect pour ce médecin."
        };
      }
    }

    // Bascule effective de l'ID actif
    localStorage.setItem(getScopedKey(ACTIVE_PRACTITIONER_KEY), target.id);

    // Synchronisation du profil médecin actif pour les ordonnances, quittances et rapports
    syncDoctorProfileWithPractitioner(target);

    // Synchronisation du code PIN dans le service de licence
    if (target.pinCode && target.pinCode.trim()) {
      localStorage.setItem(getScopedKey(PIN_STORAGE_KEY), target.pinCode.trim());
      // Rétrocompatibilité pour la session en cours
      localStorage.setItem(PIN_STORAGE_KEY, target.pinCode.trim());
    } else {
      localStorage.removeItem(getScopedKey(PIN_STORAGE_KEY));
      localStorage.removeItem(PIN_STORAGE_KEY);
    }

    // Notifie tous les écouteurs de l'application
    notifyPractitionerChanged('switched', target);

    return {
      success: true,
      practitioner: target,
      message: `Bascule effectuée vers le cabinet du ${formatDoctorDisplayName(target)}.`
    };
  } catch (e) {
    console.error("Erreur bascule praticien:", e);
    return { success: false, error: e.message };
  }
}

/**
 * Synchronise les données du praticien actif dans 'docpocket_doctor_profile'
 * pour garantir que toutes les quittances, bordereaux CNAM et ordonnances
 * portent instantanément les coordonnées du médecin en cours.
 */
export function syncDoctorProfileWithPractitioner(doc) {
  if (!doc) return;
  try {
    const profilePayload = {
      nom: `${doc.prenom || ''} ${doc.nom || ''}`.trim(),
      nomSeul: doc.nom || '',
      prenomSeul: doc.prenom || '',
      titre: doc.titre || 'Dr.',
      specialite: doc.specialite || 'Médecine Générale',
      telephone: doc.telephone || '',
      email: doc.email || '',
      adresse: doc.adresse || '',
      ville: doc.ville || '',
      cnamId: doc.cnamId || '',
      fiscId: doc.fiscId || '',
      ordreId: doc.ordreId || '',
      practitionerId: doc.id,
      color: doc.color || '#0284c7'
    };
    localStorage.setItem(getScopedKey(DOCTOR_PROFILE_KEY), JSON.stringify(profilePayload));
    // Pour rétrocompatibilité avec les générateurs de rapports
    localStorage.setItem(DOCTOR_PROFILE_KEY, JSON.stringify(profilePayload));
  } catch (e) {
    console.warn("Erreur synchronisation profil praticien:", e);
  }
}

/**
 * Outil inter-confrères : permet à un médecin de copier un dossier administratif patient
 * depuis la base d'un confrère sans mélanger les actes, ordonnances ou factures.
 */
export async function copyPatientFromColleague(sourcePatient, targetPractitionerId = null) {
  if (!sourcePatient) return { success: false, error: "Patient source manquant." };
  
  const destId = targetPractitionerId || getActivePractitionerId();
  const destDBName = destId === 'primary' ? 'DocPocketCabinetDB' : `DocPocketCabinetDB_${destId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(destDBName);
    req.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('patients')) {
        db.close();
        return resolve({ success: false, error: "Base cible non initialisée." });
      }

      // Crée une copie propre du dossier sans les identifiants internes précédents
      const cleanCopy = {
        ...sourcePatient,
        id: undefined, // autoIncrement
        importedFromDoctor: getActivePractitioner()?.nom || 'Confrère',
        importedAt: new Date().toISOString()
      };
      delete cleanCopy.id;

      const tx = db.transaction(['patients'], 'readwrite');
      const store = tx.objectStore('patients');
      const addReq = store.add(cleanCopy);

      addReq.onsuccess = (ev) => {
        cleanCopy.id = ev.target.result;
        db.close();
        resolve({ success: true, patient: cleanCopy });
      };

      addReq.onerror = (ev) => {
        db.close();
        reject(ev.target.error);
      };
    };
    req.onerror = () => reject(req.error);
  });
}
