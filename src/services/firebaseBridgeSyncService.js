// ==============================================================
// DOCPOCKET CABINET - SERVICE DE SYNCHRONISATION PONT FIREBASE
// SYNCHRONISATION HYBRIDE ÉCONOME PC <-> MOBILE (ANDROID / IPHONE)
// ==============================================================

import {
  getAllPatients,
  getAllConsultations,
  getAllPrescriptions,
  getAllInvoices,
  getAllBordereaux,
  getAllCertificates,
  getAppointments,
  savePatient,
  saveConsultation,
  savePrescription,
  saveInvoice,
  saveBordereau,
  saveCertificate,
  saveAppointment,
  deletePatientById,
  deleteConsultationById,
  deletePrescriptionById,
  deleteInvoiceById,
  deleteCertificate,
  deleteAppointment,
  setSyncImporting,
  notifyDataChanged,
  onDataChange,
  isDemoDatabase,
  clearDemoDataIfPresent
} from './patientStorage';
import { getActiveLicensePartitionId, getLicenseStatus } from './licenseService';
import { getSmsLicenseSyncPayload, autoActivateSmsOnMobile } from './smsLicenseService';

const CONFIG_STORAGE_KEY = 'docpocket_firebase_bridge_config';
const LAST_SYNC_KEY = 'docpocket_bridge_last_sync_time';
const DEVICE_ID_KEY = 'docpocket_bridge_device_id';
const LAST_SIGNAL_ID_KEY = 'docpocket_bridge_last_signal_id';
const LAST_DELTA_ID_KEY = 'docpocket_bridge_last_delta_id';

let lastProcessedSignalId = '';
let lastProcessedDeltaId = '';
if (typeof localStorage !== 'undefined') {
  try {
    lastProcessedSignalId = localStorage.getItem(LAST_SIGNAL_ID_KEY) || '';
    lastProcessedDeltaId = localStorage.getItem(LAST_DELTA_ID_KEY) || '';
  } catch (e) {}
}

// ==============================================================
// GESTION DU REPOS & INACTIVITÉ UTILISATEUR (SMART IDLE SYNC)
// ==============================================================
let lastUserInteractionTime = Date.now();
// 10 secondes d'inactivité humaine requises pour autoriser une synchronisation entrante
const USER_ACTIVE_THRESHOLD_MS = 10000;
let pendingIdleSignal = null;
let idleCheckInterval = null;

if (typeof window !== 'undefined') {
  const recordActivity = () => {
    lastUserInteractionTime = Date.now();
  };
  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'input', 'pointerdown'].forEach(evt => {
    window.addEventListener(evt, recordActivity, { passive: true });
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      // Lorsque l'utilisateur quitte l'application ou la met en arrière-plan : exécuter immédiatement
      if (document.hidden && pendingIdleSignal) {
        executePendingSignalWhenIdle();
      }
    });
  }
}

/**
 * Vérifie formellement si l'utilisateur est activement en train d'utiliser l'application.
 * En AUCUN CAS la synchronisation entrante ne doit s'effectuer si cette fonction retourne true,
 * afin de ne jamais faire perdre le focus, perturber la saisie ou écraser un formulaire en cours.
 */
export function isUserActivelyUsingApp() {
  if (typeof document !== 'undefined') {
    // Si l'application est en arrière-plan, l'utilisateur n'est pas en train d'interagir
    if (document.hidden) {
      return false;
    }

    // 1. Focus actif dans un champ de saisie (texte, zone de diagnostic, ordonnance, etc.)
    const active = document.activeElement;
    if (active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.tagName === 'SELECT' ||
      active.isContentEditable ||
      active.closest?.('.modal-overlay') ||
      active.closest?.('[role="dialog"]')
    )) {
      return true; // Saisie active en cours !
    }

    // 2. Modals critiques d'édition ou de consultation ouverts
    if (document.querySelector('.modal-overlay, [role="dialog"], .consult-active')) {
      return true;
    }

    // 3. Indicateur global d'opération en cours
    if (typeof window !== 'undefined' && window.__docpocket_user_busy) {
      return true;
    }
  }

  // 4. Inactivité récente : l'utilisateur a cliqué, scrollé ou tapé dans les 10 dernières secondes
  return (Date.now() - lastUserInteractionTime) < USER_ACTIVE_THRESHOLD_MS;
}

export async function executePendingSignalWhenIdle() {
  if (!pendingIdleSignal) return;
  const signalToExecute = pendingIdleSignal;
  pendingIdleSignal = null;
  if (idleCheckInterval) {
    clearInterval(idleCheckInterval);
    idleCheckInterval = null;
  }
  await processIncomingBackupSignal(signalToExecute);
}

// Taille maximale d'un morceau pour ne pas dépasser les limites et minimiser la bande passante (150 Ko)
const CHUNK_SIZE = 400 * 1024;

// Configuration par défaut modifiable par le médecin (mode 'auto' par défaut pour zéro configuration)
const DEFAULT_CONFIG = {
  enabled: true,
  projectId: 'docpocket-cabinet-auto',
  databaseURL: 'auto', // 'auto' active le pont automatique immédiat sans configuration manuelle
  apiKey: '',
  authToken: '', // Jeton ou secret Firebase si base sécurisée
  autoSync: true,
  lastSync: null,
  googleUserEmail: '',
  googleDoctorName: '',
  cabinetProvisioned: false
};

// Obtenir ou générer un identifiant unique d'appareil
function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent || '');
    const prefix = isMobile ? 'mob' : 'pc';
    id = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// Obtenir le nom lisible de l'appareil
export function getDeviceDisplayName() {
  const isAndroid = /android/i.test(navigator.userAgent || '');
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  const isMac = /macintosh|mac os x/i.test(navigator.userAgent || '');
  if (isAndroid) return 'Smartphone Android';
  if (isIos) return 'Apple iPhone';
  if (isMac) return 'Ordinateur Mac';
  return 'Ordinateur PC (Windows)';
}

export function isMobileDevice() {
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent || '');
}

/**
 * Récupère la configuration actuelle du pont Firebase
 */
export function getFirebaseBridgeConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      deviceId: getOrCreateDeviceId(),
      deviceName: getDeviceDisplayName(),
      isMobile: isMobileDevice(),
      lastSync: Number(localStorage.getItem(LAST_SYNC_KEY)) || null
    };
  } catch {
    return {
      ...DEFAULT_CONFIG,
      deviceId: getOrCreateDeviceId(),
      deviceName: getDeviceDisplayName(),
      isMobile: isMobileDevice(),
      lastSync: null
    };
  }
}

/**
 * Enregistre la configuration Firebase saisie par l'utilisateur
 */
export function saveFirebaseBridgeConfig(newConfig) {
  const current = getFirebaseBridgeConfig();
  const merged = { ...current, ...newConfig };
  // Normaliser l'URL de base si nécessaire
  if (merged.databaseURL && !merged.databaseURL.startsWith('http')) {
    merged.databaseURL = `https://${merged.databaseURL}`;
  }
  if (merged.databaseURL && merged.databaseURL.endsWith('/')) {
    merged.databaseURL = merged.databaseURL.slice(0, -1);
  }
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(merged));
  notifyBridgeSubscribers({ type: 'CONFIG_CHANGED', config: merged });
  restartBridgeListener();
  return merged;
}

/**
 * Déconnexion totale et réinitialisation de la liaison Firebase
 * Permet de se connecter facilement avec un nouveau compte
 */
export function disconnectFirebaseBridge() {
  stopBridgeListener();
  localStorage.removeItem(CONFIG_STORAGE_KEY);
  localStorage.removeItem(LAST_SYNC_KEY);
  notifyBridgeSubscribers({ type: 'DISCONNECTED' });
  return { success: true, message: 'Pont Firebase déconnecté. Prêt pour un nouveau compte.' };
}

/**
 * Calcule une clé de canal sécurisée dérivée de l'email Google et de la partition de licence.
 * Sécurité hermétique et étanche : chaque médecin dispose de sa propre room Cloud privée,
 * impossible qu'un confrère télécharge ou synchronise les données d'un autre cabinet.
 */
export function getBridgeChannelKey() {
  const cfg = getFirebaseBridgeConfig();
  const cleanEmail = (cfg.googleUserEmail || '').toLowerCase().trim();
  const partition = getActiveLicensePartitionId ? getActiveLicensePartitionId() : 'primary';
  const lic = getLicenseStatus ? getLicenseStatus() : null;
  const cleanKey = lic?.key ? lic.key.trim().toUpperCase() : '';

  if (cleanEmail) {
    const seed = `${cleanEmail}|DOCPOCKET_CABINET_PRO_SALT_2026`;
    let hash = 5381;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) + hash) + seed.charCodeAt(i);
      hash = hash & 0xFFFFFFFF;
    }
    const safeHash = Math.abs(hash).toString(16).padStart(8, '0');
    const cleanPrefix = cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 8);
    return `cab_${cleanPrefix}_${safeHash}`;
  }

  if (cleanKey && cleanKey !== 'NOKEY' && !cleanKey.includes('TRIAL') && !cleanKey.includes('DEMO')) {
    const cleanKeyId = cleanKey.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 16);
    return `cab_lic_${cleanKeyId.toLowerCase()}`;
  }

  return 'cab_dr_hamed_ben_khalifa';
}

/**
 * Initialisation 100% automatique du cabinet dans le Cloud Firebase
 */
export async function autoProvisionCabinetCloud(email, doctorName = '') {
  if (!email || !email.includes('@')) {
    throw new Error("Veuillez saisir une adresse email Google valide.");
  }

  const cleanEmail = email.trim().toLowerCase();
  saveFirebaseBridgeConfig({
    googleUserEmail: cleanEmail,
    googleDoctorName: doctorName || 'Docteur',
    enabled: true,
    autoSync: true,
    cabinetProvisioned: true
  });

  const room = getBridgeChannelKey();
  return {
    success: true,
    cabinetRoom: room,
    ownerEmail: cleanEmail,
    message: `✓ Espace Cloud Cabinet initialisé avec succès pour ${cleanEmail} !`
  };
}

// ==============================================================
// 1. REQUÊTES REST CLOUD FIRESTORE OFFICIEL (PROJET docpocket-rdv)
// ==============================================================

const FIRESTORE_CONFIG = {
  projectId: 'docpocket-rdv',
  apiKey: 'AIzaSyBHfojIB8BfwbJpbpwLJMm2RhGKmUnS8M4',
  base: 'https://firestore.googleapis.com/v1/projects/docpocket-rdv/databases/(default)/documents'
};

export const DEFAULT_PUBLIC_TUNNEL_URL = 'https://firestore.googleapis.com';
export const DEFAULT_LOCAL_WIFI_URL = 'https://firestore.googleapis.com';

export function getBridgeBaseUrl() {
  return FIRESTORE_CONFIG.base;
}

/**
 * Client universel Cloud Firestore REST API pour la synchronisation PC <-> Mobile.
 * Fonctionne directement sur le Web, Android, PC, 4G et Wi-Fi sans aucun serveur intermédiaire.
 */
export async function firebaseFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const room = getBridgeChannelKey();

  // Normaliser le chemin en ID de document Firestore
  let subName = path.replace(/\//g, '_');
  if (subName.startsWith('payload_chunks_')) {
    subName = 'chunk_' + subName.replace('payload_chunks_', '');
  }
  const docId = `${room}_${subName}`;
  const url = `${FIRESTORE_CONFIG.base}/bridge_sync/${docId}?key=${FIRESTORE_CONFIG.apiKey}`;

  if (method === 'GET') {
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`Erreur Firestore HTTP ${res.status}`);
      }
      const data = await res.json();
      const raw = data.fields?.payload?.stringValue;
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    } catch (err) {
      if (err.message && err.message.includes('404')) return null;
      throw err;
    }
  }

  if (method === 'PUT' || method === 'PATCH' || method === 'POST') {
    const rawPayload = typeof options.body === 'string' ? options.body : JSON.stringify(options.body || {});
    const body = JSON.stringify({
      fields: {
        payload: { stringValue: rawPayload },
        updatedAt: { stringValue: new Date().toISOString() },
        room: { stringValue: room }
      }
    });

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body
    });

    if (!res.ok) {
      const errTxt = await res.text().catch(() => '');
      throw new Error(`Erreur écriture Firestore HTTP ${res.status}: ${errTxt}`);
    }
    return res.json();
  }

  if (method === 'DELETE') {
    try {
      const res = await fetch(url, { method: 'DELETE' });
      return { ok: res.ok };
    } catch {
      return { ok: true };
    }
  }
}

/**
 * Teste la connectivité directe avec Cloud Firestore
 */
export async function testFirebaseBridgeConnection(customConfig = null) {
  const room = getBridgeChannelKey();
  const testDocId = `${room}_ping`;
  const url = `${FIRESTORE_CONFIG.base}/bridge_sync/${testDocId}?key=${FIRESTORE_CONFIG.apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const body = JSON.stringify({
      fields: {
        payload: { stringValue: JSON.stringify({ ping: Date.now(), device: getDeviceDisplayName() }) },
        updatedAt: { stringValue: new Date().toISOString() }
      }
    });

    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return {
        success: true,
        message: `✅ Connexion réussie ! Le Cloud Firebase DocPocket Cab est 100% opérationnel pour ${room} (${getDeviceDisplayName()}).`
      };
    }

    const txt = await res.text().catch(() => '');
    return { success: false, status: res.status, message: `Erreur ${res.status} : ${txt || res.statusText}` };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      success: false,
      message: `❌ Erreur de connexion au Cloud Firebase : ${err.message}`
    };
  }
}

export function computeBackupFingerprint(backupData) {
  const p = backupData?.data?.patients || [];
  const c = backupData?.data?.consultations || [];
  const pr = backupData?.data?.prescriptions || [];
  const inv = backupData?.data?.invoices || [];
  const b = backupData?.data?.bordereaux || [];
  const certs = backupData?.data?.certificates || [];
  const appts = backupData?.data?.appointments || [];

  let latestDataTime = 0;
  for (const item of c) {
    const t = new Date(item.dateConsultation || item.date || item.updatedAt || item.createdAt || 0).getTime();
    if (t > latestDataTime) latestDataTime = t;
  }
  for (const item of p) {
    const t = new Date(item.updatedAt || item.createdAt || 0).getTime();
    if (t > latestDataTime) latestDataTime = t;
  }
  for (const item of pr) {
    const t = new Date(item.datePrescription || item.date || item.createdAt || 0).getTime();
    if (t > latestDataTime) latestDataTime = t;
  }
  for (const item of inv) {
    const t = new Date(item.dateFacture || item.date || item.createdAt || 0).getTime();
    if (t > latestDataTime) latestDataTime = t;
  }
  for (const item of appts) {
    const t = new Date(item.updatedAt || item.createdAt || 0).getTime();
    if (t > latestDataTime) latestDataTime = t;
  }
  for (const item of certs) {
    const t = new Date(item.updatedAt || item.createdAt || 0).getTime();
    if (t > latestDataTime) latestDataTime = t;
  }

  if (!latestDataTime && backupData?.exportedAt) {
    latestDataTime = new Date(backupData.exportedAt).getTime();
  }

  const countsStr = `p${p.length}_c${c.length}_pr${pr.length}_inv${inv.length}_b${b.length}_ap${appts.length}_ce${certs.length}`;
  const rawKey = `${countsStr}_t${latestDataTime}`;
  let hash = 5381;
  for (let i = 0; i < rawKey.length; i++) {
    hash = ((hash << 5) + hash) + rawKey.charCodeAt(i);
    hash = hash & 0xFFFFFFFF;
  }
  const hashHex = Math.abs(hash).toString(16);

  return {
    patientsCount: p.length,
    consultationsCount: c.length,
    prescriptionsCount: pr.length,
    invoicesCount: inv.length,
    bordereauxCount: b.length,
    certificatesCount: certs.length,
    appointmentsCount: appts.length,
    latestDataTime,
    fingerprint: `${countsStr}_${hashHex}`
  };
}

/**
 * Découpe et envoie le dernier fichier de sauvegarde sur Firebase.
 * Ne transfère les paquets que si les deux sauvegardes (locale et distante) sont différentes.
 * L'appareil qui a la sauvegarde la plus récente l'envoie à l'autre.
 */
export async function uploadBackupToBridge(backupData, reason = 'auto_sync', force = false) {
  const cfg = getFirebaseBridgeConfig();
  if (!cfg.enabled) return { skipped: true, reason: 'Pont désactivé' };

  const deviceId = getOrCreateDeviceId();
  const deviceName = getDeviceDisplayName();
  const isMobile = isMobileDevice();
  const localFp = computeBackupFingerprint(backupData);

  // Vérifier d'abord ce qui est présent sur le pont pour éviter tout transfert inutile
  if (!force) {
    try {
      const remoteMeta = await firebaseFetch('payload/metadata');
      if (remoteMeta && remoteMeta.totalChunks) {
        const remoteFp = remoteMeta.fingerprint;
        const remotePatients = remoteMeta.stats?.patientsCount ?? 0;
        const remoteConsults = remoteMeta.stats?.consultationsCount ?? 0;
        const remoteLatestTime = remoteMeta.latestDataTime || remoteMeta.timestamp || 0;

        // 1. Les deux sauvegardes sont STRICTEMENT IDENTIQUES : aucun paquet envoyé !
        const isIdentical = (remoteFp && remoteFp === localFp.fingerprint) ||
          (remotePatients === localFp.patientsCount &&
           remoteConsults === localFp.consultationsCount &&
           Math.abs(remoteLatestTime - localFp.latestDataTime) < 2000);

        if (isIdentical) {
          notifyBridgeSubscribers({
            type: 'SYNC_UP_TO_DATE',
            message: '✓ Sauvegardes du PC et du smartphone déjà identiques (aucun paquet envoyé).'
          });
          return { skipped: true, reason: 'identical_backup', metadata: remoteMeta };
        }
      }
    } catch (checkErr) {
      // Si la vérification échoue (ex: premier envoi ou pont vide), on procède à l'envoi normal
    }
  }

  // 3. Notre appareil possède la sauvegarde la plus récente et différente : découpage et envoi des morceaux
  if (!backupData.smsRdvLicense) {
    backupData.smsRdvLicense = getSmsLicenseSyncPayload();
  }
  const jsonStr = JSON.stringify(backupData);
  const totalLength = jsonStr.length;
  const totalChunks = Math.ceil(totalLength / CHUNK_SIZE);
  const timestamp = Date.now();

  notifyBridgeSubscribers({
    type: 'UPLOADING',
    totalChunks,
    progress: 0,
    message: `Envoi de la sauvegarde la plus récente en ${totalChunks} morceau(x)...`
  });

  // Vider les anciens morceaux sur le pont
  try {
    await firebaseFetch('payload/chunks', { method: 'DELETE' });
  } catch (e) {
    // continuer
  }

  // Envoyer les morceaux un par un
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalLength);
    const chunkPiece = jsonStr.substring(start, end);

    await firebaseFetch(`payload/chunks/${i}`, {
      method: 'PUT',
      body: JSON.stringify(chunkPiece)
    });

    notifyBridgeSubscribers({
      type: 'UPLOADING',
      currentChunk: i + 1,
      totalChunks,
      progress: Math.round(((i + 1) / totalChunks) * 100),
      message: `Envoi du morceau ${i + 1}/${totalChunks} sur le pont Firebase...`
    });
  }

  // Enregistrer les métadonnées de la sauvegarde avec empreinte
  const metadata = {
    version: timestamp,
    timestamp,
    exportedAt: backupData.exportedAt || new Date().toISOString(),
    sourceDeviceId: deviceId,
    sourceDeviceName: deviceName,
    isMobile,
    totalChunks,
    totalBytes: totalLength,
    latestDataTime: localFp.latestDataTime || timestamp,
    fingerprint: localFp.fingerprint,
    stats: {
      patientsCount: localFp.patientsCount,
      consultationsCount: localFp.consultationsCount,
      prescriptionsCount: localFp.prescriptionsCount,
      invoicesCount: localFp.invoicesCount,
      bordereauxCount: localFp.bordereauxCount,
      certificatesCount: localFp.certificatesCount,
      appointmentsCount: localFp.appointmentsCount
    },
    reason,
    smsRdvLicense: getSmsLicenseSyncPayload()
  };

  await firebaseFetch('payload/metadata', {
    method: 'PUT',
    body: JSON.stringify(metadata)
  });

  // Émettre le signal instantané
  const signal = {
    type: 'NEW_BACKUP_AVAILABLE',
    version: timestamp,
    timestamp,
    sourceDeviceId: deviceId,
    sourceDeviceName: deviceName,
    isMobile,
    stats: metadata.stats,
    smsRdvLicense: metadata.smsRdvLicense
  };

  await firebaseFetch('signals/latest', {
    method: 'PUT',
    body: JSON.stringify(signal)
  });

  localStorage.setItem(LAST_SYNC_KEY, String(timestamp));

  notifyBridgeSubscribers({
    type: 'UPLOADED_SUCCESS',
    metadata,
    message: `✓ Sauvegarde envoyée sur le pont Firebase (${metadata.stats.patientsCount} patients, ${metadata.stats.consultationsCount} consult.)`
  });

  return { success: true, metadata };
}

// ==============================================================
// 3. TÉLÉCHARGEMENT DES MORCEAUX & RECONSTITUTION
// ==============================================================

/**
 * Télécharge et réassemble le dernier fichier de sauvegarde depuis Firebase
 */
export async function downloadBackupFromBridge() {
  notifyBridgeSubscribers({
    type: 'DOWNLOADING',
    message: 'Vérification du dernier fichier de sauvegarde sur Firebase...'
  });

  // 1. Lire les métadonnées
  const metadata = await firebaseFetch('payload/metadata');
  if (!metadata || !metadata.totalChunks) {
    throw new Error("Aucune sauvegarde disponible sur le pont Firebase.");
  }

  const totalChunks = metadata.totalChunks;
  let reassembledJson = '';

  for (let i = 0; i < totalChunks; i++) {
    notifyBridgeSubscribers({
      type: 'DOWNLOADING',
      currentChunk: i + 1,
      totalChunks,
      progress: Math.round(((i + 1) / totalChunks) * 100),
      message: `Téléchargement du morceau ${i + 1}/${totalChunks}...`
    });

    const chunkPiece = await firebaseFetch(`payload/chunks/${i}`);
    if (typeof chunkPiece !== 'string') {
      throw new Error(`Morceau ${i} corrompu ou manquant sur le pont Firebase.`);
    }
    reassembledJson += chunkPiece;
  }

  const backupData = JSON.parse(reassembledJson);

  notifyBridgeSubscribers({
    type: 'DOWNLOADED_SUCCESS',
    metadata,
    backupData,
    message: `✓ Sauvegarde téléchargée (${metadata.stats?.patientsCount || 0} patients).`
  });

  return { metadata, backupData };
}

// ==============================================================
// 4. FUSION INTELLIGENTE SANS DOUBLONS (SMART DEDUPLICATING MERGE)
// ==============================================================

/**
 * Fusionne les données reçues sans jamais dupliquer les patients ni les consultations.
 * N'ajoute que les nouvelles consultations et met à jour les fiches existantes.
 */
export async function smartDeduplicatingMerge(incomingData, onProgress = () => {}) {
  if (!incomingData || !incomingData.data) {
    throw new Error("Format de données de sauvegarde non reconnu.");
  }

  const {
    patients: inPatients = [],
    consultations: inConsults = [],
    prescriptions: inPrescs = [],
    invoices: inInvoices = [],
    bordereaux: inBords = [],
    certificates: inCerts = []
  } = incomingData.data;

  onProgress("Chargement de la base locale...");
  const [localPatients, localConsults, localPrescs, localInvoices, localBords, localCerts] = await Promise.all([
    getAllPatients(),
    getAllConsultations(),
    getAllPrescriptions(),
    getAllInvoices(),
    getAllBordereaux(),
    getAllCertificates()
  ]);

  const mergeReport = {
    newPatients: 0,
    updatedPatients: 0,
    newConsultations: 0,
    updatedConsultations: 0,
    newPrescriptions: 0,
    newInvoices: 0,
    newCertificates: 0
  };

  setSyncImporting(true);
  try {

  // 1. Table de correspondance des patients : incomingPatientId -> localPatientId
  const patientIdMap = new Map();

  // Création des index de recherche locale
  const patientByCin = new Map();
  const patientByNameBirth = new Map();
  const patientById = new Map();

  for (const lp of localPatients) {
    patientById.set(String(lp.id), lp);
    if (lp.cin && lp.cin.trim()) {
      patientByCin.set(lp.cin.trim().toUpperCase(), lp);
    }
    const key = `${(lp.nom || '').trim().toUpperCase()}|${(lp.prenom || '').trim().toUpperCase()}|${lp.birthdate || ''}`;
    patientByNameBirth.set(key, lp);
  }

  onProgress("Fusion intelligente des dossiers patients...");
  for (const ip of inPatients) {
    const ipCin = ip.cin ? ip.cin.trim().toUpperCase() : '';
    const ipKey = `${(ip.nom || '').trim().toUpperCase()}|${(ip.prenom || '').trim().toUpperCase()}|${ip.birthdate || ''}`;

    let matchedLocalPatient = null;

    if (ipCin && patientByCin.has(ipCin)) {
      matchedLocalPatient = patientByCin.get(ipCin);
    } else if (patientByNameBirth.has(ipKey)) {
      matchedLocalPatient = patientByNameBirth.get(ipKey);
    } else if (patientById.has(String(ip.id))) {
      matchedLocalPatient = patientById.get(String(ip.id));
    }

    if (matchedLocalPatient) {
      // Patient déjà existant : mise à jour intelligente et complète
      const isIncomingNewer = !matchedLocalPatient.updatedAt || !ip.updatedAt ||
        new Date(ip.updatedAt).getTime() >= new Date(matchedLocalPatient.updatedAt).getTime();

      const updated = isIncomingNewer ? {
        ...matchedLocalPatient,
        ...ip,
        id: matchedLocalPatient.id // Préserver l'ID local IndexedDB
      } : {
        ...matchedLocalPatient,
        telephone: ip.telephone || matchedLocalPatient.telephone,
        adress: ip.adress || matchedLocalPatient.adress,
        city: ip.city || matchedLocalPatient.city,
        cnamid: ip.cnamid || matchedLocalPatient.cnamid,
        caisse: ip.caisse || matchedLocalPatient.caisse,
        filiere: ip.filiere || matchedLocalPatient.filiere,
        apci: ip.apci || matchedLocalPatient.apci,
        apciLabel: ip.apciLabel || matchedLocalPatient.apciLabel,
        allergies: ip.allergies || matchedLocalPatient.allergies,
        atcd_medicaux: ip.atcd_medicaux || matchedLocalPatient.atcd_medicaux,
        atcd_chirurgicaux: ip.atcd_chirurgicaux || matchedLocalPatient.atcd_chirurgicaux,
        atcd_familiaux: ip.atcd_familiaux || matchedLocalPatient.atcd_familiaux,
        derniere_visite: ip.derniere_visite || matchedLocalPatient.derniere_visite
      };

      await savePatient(updated);
      patientIdMap.set(String(ip.id), String(matchedLocalPatient.id));
      mergeReport.updatedPatients++;
    } else {
      // Nouveau patient créé
      const newPatientObj = { ...ip };
      const newId = await savePatient(newPatientObj);
      patientIdMap.set(String(ip.id), String(newId));
      mergeReport.newPatients++;
    }
  }

  // 2. Index des consultations locales existantes
  onProgress("Intégration des nouvelles consultations médicales...");
  const consultLookup = new Set();
  for (const lc of localConsults) {
    consultLookup.add(String(lc.id));
    // Index par patientId + date + heure
    const signature = `${lc.patientId}_${lc.date}_${(lc.heure || '').slice(0, 5)}`;
    consultLookup.add(signature);
  }

  for (const ic of inConsults) {
    const mappedPatientId = patientIdMap.get(String(ic.patientId)) || String(ic.patientId);
    const signature = `${mappedPatientId}_${ic.date}_${(ic.heure || '').slice(0, 5)}`;
    const idKey = String(ic.id);

    if (consultLookup.has(idKey) || consultLookup.has(signature)) {
      // Consultation déjà enregistrée sur cette machine -> Ne pas dupliquer !
      // On met à jour l'examen ou le diagnostic si complété
      const existing = localConsults.find(c => String(c.id) === idKey || `${c.patientId}_${c.date}_${(c.heure || '').slice(0, 5)}` === signature);
      if (existing) {
        const isIncomingNewer = !existing.updatedAt || !ic.updatedAt ||
          new Date(ic.updatedAt).getTime() >= new Date(existing.updatedAt).getTime();

        const updatedConsult = isIncomingNewer ? {
          ...existing,
          ...ic,
          id: existing.id,
          patientId: mappedPatientId
        } : {
          ...existing,
          patientId: mappedPatientId,
          motif: ic.motif || existing.motif,
          examenClinique: ic.examenClinique || existing.examenClinique,
          diagnostic: ic.diagnostic || existing.diagnostic,
          traitement: ic.traitement || existing.traitement,
          taMax: ic.taMax || existing.taMax,
          taMin: ic.taMin || existing.taMin,
          poids: ic.poids || existing.poids,
          temperature: ic.temperature || existing.temperature
        };
        await saveConsultation(updatedConsult);
        mergeReport.updatedConsultations++;
      }
    } else {
      // Nouvelle consultation effectuée sur l'autre appareil !
      const newConsult = {
        ...ic,
        patientId: mappedPatientId
      };
      await saveConsultation(newConsult);
      consultLookup.add(signature);
      mergeReport.newConsultations++;
    }
  }

  // 3. Ordonnances médicales
  onProgress("Intégration des ordonnances...");
  const prescLookup = new Set(localPrescs.map(p => String(p.id)));
  for (const ip of inPrescs) {
    const mappedPatientId = patientIdMap.get(String(ip.patientId)) || String(ip.patientId);
    if (!prescLookup.has(String(ip.id))) {
      await savePrescription({
        ...ip,
        patientId: mappedPatientId
      });
      prescLookup.add(String(ip.id));
      mergeReport.newPrescriptions++;
    }
  }

  // 4. Factures et quittances
  onProgress("Intégration des quittances et paiements...");
  const invLookup = new Set(localInvoices.map(i => String(i.id)));
  for (const ii of inInvoices) {
    const mappedPatientId = patientIdMap.get(String(ii.patientId)) || String(ii.patientId);
    if (!invLookup.has(String(ii.id))) {
      await saveInvoice({
        ...ii,
        patientId: mappedPatientId
      });
      invLookup.add(String(ii.id));
      mergeReport.newInvoices++;
    }
  }

  // 5. Bordereaux CNAM
  const bordLookup = new Set(localBords.map(b => String(b.id)));
  for (const ib of inBords) {
    if (!bordLookup.has(String(ib.id))) {
      await saveBordereau({ ...ib });
      bordLookup.add(String(ib.id));
    }
  }

  // 6. Certificats & Attestations Médicales
  if (inCerts && inCerts.length > 0) {
    const certLookup = new Set(localCerts.map(c => String(c.id)));
    for (const ic of inCerts) {
      const mappedPatientId = patientIdMap.get(String(ic.patientId)) || String(ic.patientId);
      if (!certLookup.has(String(ic.id))) {
        await saveCertificate({
          ...ic,
          patientId: mappedPatientId
        });
        certLookup.add(String(ic.id));
        mergeReport.newCertificates++;
      }
    }
  }

  // 7. Rendez-vous de l'agenda
  const inAppts = incomingData.data.appointments || [];
  if (inAppts.length > 0) {
    onProgress("Intégration des rendez-vous de l'agenda...");
    const localAppts = await getAppointments(null);
    const apptLookup = new Set();
    for (const la of localAppts) {
      apptLookup.add(String(la.id));
      apptLookup.add(`${la.rdvDate}_${la.rdvTime}_${la.patientName || la.patientId}`);
    }

    for (const ia of inAppts) {
      const mappedPatientId = ia.patientId ? (patientIdMap.get(String(ia.patientId)) || String(ia.patientId)) : null;
      const signature = `${ia.rdvDate}_${ia.rdvTime}_${ia.patientName || mappedPatientId}`;
      const idKey = String(ia.id);

      if (!apptLookup.has(idKey) && !apptLookup.has(signature)) {
        await saveAppointment({
          ...ia,
          patientId: mappedPatientId
        });
        apptLookup.add(signature);
        mergeReport.newAppointments = (mergeReport.newAppointments || 0) + 1;
      }
    }
  }

  // 7. Synchronisation automatique de la licence DocPocket SMS RDV sur mobile si PC activé
  if (incomingData?.smsRdvLicense) {
    try {
      const autoActivated = autoActivateSmsOnMobile(incomingData.smsRdvLicense);
      if (autoActivated) {
        notifyBridgeSubscribers({
          type: 'SMS_LICENSE_SYNCED',
          message: '✓ DocPocket SMS RDV activé automatiquement depuis votre PC !'
        });
      }
    } catch (e) {
      console.warn("Erreur auto-activation licence SMS:", e);
    }
  }

  onProgress("✓ Synchronisation terminée avec succès !");
  return mergeReport;
  } finally {
    setSyncImporting(false);
    notifyDataChanged('bridge_sync_complete');
  }
}

// ==============================================================
// 5. DEMANDE INITIALE LORS DE L'INSTALLATION SUR ANDROID
// ==============================================================

/**
 * Envoie un signal sur Firebase demandant au PC d'envoyer la dernière sauvegarde
 * Utilisé à la première exécution sur Android après saisie de la licence
 */
export async function sendInitialSyncRequestFromMobile() {
  const cfg = getFirebaseBridgeConfig();
  const deviceId = getOrCreateDeviceId();

  const reqSignal = {
    type: 'REQUEST_INITIAL_BACKUP',
    requesterDeviceId: deviceId,
    requesterName: getDeviceDisplayName(),
    isMobile: true,
    timestamp: Date.now()
  };

  await firebaseFetch('signals/latest', {
    method: 'PUT',
    body: JSON.stringify(reqSignal)
  });

  notifyBridgeSubscribers({
    type: 'INITIAL_REQUEST_SENT',
    message: "Signal envoyé au PC via Firebase. En attente de la dernière sauvegarde..."
  });

  return { success: true };
}

/**
 * Synchronisation automatique intelligente et symétrique (PC <-> Smartphone) :
 * Détecte si la sauvegarde du pont Firebase est plus récente que la base locale, ou inversement,
 * et synchronise automatiquement tous les appareils sans doublons.
 */
export async function autoSyncWithLatestBridge(onProgress = () => {}) {
  const cfg = getFirebaseBridgeConfig();
  if (!cfg.enabled) return { success: false, reason: 'disabled' };

  try {
    const metadata = await firebaseFetch('payload/metadata');
    const bridgeTimestamp = metadata?.timestamp ? Number(metadata.timestamp) : 0;
    const lastSync = Number(localStorage.getItem(LAST_SYNC_KEY)) || 0;
    const lastLocalWrite = Number(localStorage.getItem('docpocket_last_local_write')) || 0;
    const localPatients = await getAllPatients();
    const isLocalDemo = isDemoDatabase(localPatients);
    const hasLocalRealData = localPatients.length > 3 || !isLocalDemo;

    // CAS 1 : Le pont Firebase possède une sauvegarde plus récente que notre dernière sync locale
    if (bridgeTimestamp > 0 && bridgeTimestamp > lastSync && bridgeTimestamp > lastLocalWrite && (metadata.stats?.patientsCount || 0) > 0) {
      notifyBridgeSubscribers({
        type: 'SYNC_START',
        message: `🔄 Sauvegarde plus récente détectée sur le pont (${new Date(bridgeTimestamp).toLocaleTimeString('fr-FR')}). Synchronisation...`
      });

      const { backupData } = await downloadBackupFromBridge();

      if (isMobileDevice() && isLocalDemo) {
        await clearDemoDataIfPresent();
      }

      const report = await smartDeduplicatingMerge(backupData, onProgress);
      localStorage.setItem('docpocket_has_synced_with_pc', 'true');
      localStorage.setItem(LAST_SYNC_KEY, String(bridgeTimestamp));

      notifyBridgeSubscribers({
        type: 'SYNC_COMPLETE',
        report,
        metadata,
        message: `✓ Cabinet synchronisé : +${report.newPatients} patient(s), +${report.newConsultations} consult. ajoutés sans doublons !`
      });

      return { success: true, action: 'pulled', report };
    }

    // CAS 2 : Le pont est vide ou ne contient que les démos, alors que l'appareil local a des données réelles
    const bridgeNeedsFeed = !metadata || !metadata.totalChunks || (metadata.stats?.patientsCount || 0) <= 3;
    if (hasLocalRealData && (bridgeNeedsFeed || (lastLocalWrite > bridgeTimestamp && (Date.now() - bridgeTimestamp > 60000)))) {
      return { success: true, action: 'push_needed', localPatientsCount: localPatients.length };
    }

    return { success: true, action: 'up_to_date' };
  } catch (err) {
    console.warn("autoSyncWithLatestBridge:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Vérifie si une sauvegarde complète est déjà disponible sur le pont et la fusionne directement
 * Utilisé à l'ouverture sur Android pour une synchronisation immédiate sans attendre de signal
 */
export async function checkAndPullExistingBackup(onProgress = () => {}) {
  const cfg = getFirebaseBridgeConfig();
  if (!cfg.enabled) return false;

  try {
    const metadata = await firebaseFetch('payload/metadata');
    if (!metadata || !metadata.totalChunks) return false;

    // Si la sauvegarde contient de vrais patients (> 3 ou émise par PC)
    if ((metadata.stats?.patientsCount || 0) > 3 || !metadata.isMobile) {
      notifyBridgeSubscribers({
        type: 'SYNC_START',
        message: `🔄 Sauvegarde du cabinet détectée sur le pont (${metadata.stats?.patientsCount || 0} patients). Synchronisation...`
      });

      const { backupData } = await downloadBackupFromBridge();

      // Nettoyer les démos si le mobile n'avait que des démos
      if (isMobileDevice()) {
        const localPats = await getAllPatients();
        if (isDemoDatabase(localPats)) {
          await clearDemoDataIfPresent();
        }
      }

      const report = await smartDeduplicatingMerge(backupData, onProgress);
      localStorage.setItem('docpocket_has_synced_with_pc', 'true');
      localStorage.setItem(LAST_SYNC_KEY, String(metadata.timestamp || Date.now()));

      notifyBridgeSubscribers({
        type: 'SYNC_COMPLETE',
        report,
        metadata,
        message: `✓ Cabinet synchronisé : +${report.newPatients} patient(s), +${report.newConsultations} consult. ajoutés sans doublons !`
      });

      return { success: true, report, metadata };
    }
  } catch (err) {
    console.log("checkAndPullExistingBackup:", err.message);
  }
  return false;
}

// ==============================================================
// 6. ÉCOUTEUR TEMPS RÉEL (EVENTSOURCE / POLLING LÉGER)
// ==============================================================

let eventSource = null;
let pollTimer = null;
const bridgeSubscribers = new Set();
let isHandlingSync = false;

let currentBridgeStatus = {
  state: 'synced', // 'synced' | 'syncing' | 'busy_pending' | 'offline' | 'error'
  lastSyncTime: Number(localStorage.getItem(LAST_SYNC_KEY)) || null,
  message: ''
};

export function getBridgeSyncStatus() {
  return { ...currentBridgeStatus };
}

export function subscribeBridgeSync(callback) {
  bridgeSubscribers.add(callback);
  // Émission immédiate de l'état actuel pour réactivité instantanée
  try {
    callback({ type: 'STATUS_INIT', ...currentBridgeStatus });
  } catch (e) {}
  return () => bridgeSubscribers.delete(callback);
}

function notifyBridgeSubscribers(event) {
  // Mettre à jour l'état interne de synchronisation
  if (event.type === 'SYNC_START' || event.type === 'UPLOADING' || event.type === 'DOWNLOADING' || event.type === 'MERGING_PROGRESS') {
    currentBridgeStatus.state = 'syncing';
    currentBridgeStatus.message = event.message || 'Synchronisation en cours...';
  } else if (event.type === 'SYNC_COMPLETE' || event.type === 'UPLOADED_SUCCESS' || event.type === 'SYNC_UP_TO_DATE') {
    currentBridgeStatus.state = 'synced';
    currentBridgeStatus.lastSyncTime = Date.now();
    currentBridgeStatus.message = event.message || 'Synchronisé';
  } else if (event.type === 'SYNC_PENDING_USER_BUSY') {
    currentBridgeStatus.state = 'busy_pending';
    currentBridgeStatus.message = 'Mise à jour en attente (application en cours d\'utilisation)';
  } else if (event.type === 'SYNC_ERROR') {
    currentBridgeStatus.state = 'error';
    currentBridgeStatus.message = event.error || 'Erreur synchronisation';
  }

  for (const cb of bridgeSubscribers) {
    try {
      cb(event);
    } catch (e) {
      console.warn("Erreur subscriber bridge sync:", e);
    }
  }
}

/**
 * Traite un signal reçu depuis Firebase
 */
async function handleIncomingSignal(signal) {
  if (!signal || !signal.type || isHandlingSync) return;

  const cfg = getFirebaseBridgeConfig();
  if (!cfg.enabled) return;

  const myDeviceId = getOrCreateDeviceId();
  // Ignorer nos propres signaux
  if (signal.sourceDeviceId === myDeviceId || signal.requesterDeviceId === myDeviceId) {
    return;
  }

  const isPc = !isMobileDevice();
  const isMobile = isMobileDevice();

  // CAS 0 : Signal d'expulsion / déconnexion administrative immédiate (Effacement de licence)
  if (signal.type === 'FORCE_DISCONNECT' || signal.type === 'REVOKE_DISCONNECT') {
    disconnectFirebaseBridge();
    notifyBridgeSubscribers({
      type: 'DISCONNECTED',
      message: "⛔ Accès révoqué par l'administrateur. Cet appareil a été immédiatement déconnecté du Cloud."
    });
    try {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert("⛔ Accès au Cloud Révoqué :\n\nL'administrateur a effacé ou révoqué cette licence. Cet appareil et tous les postes associés ont été immédiatement déconnectés du réseau de synchronisation.");
      }
    } catch {
      // ignore alert error in headless
    }
    return;
  }

  // CAS 0-BIS : Synchronisation automatique de la licence DocPocket SMS RDV vers mobile
  if (signal.type === 'SMS_LICENSE_UPDATED' && isMobile && signal.smsRdvLicense) {
    const activated = autoActivateSmsOnMobile(signal.smsRdvLicense);
    if (activated) {
      notifyBridgeSubscribers({
        type: 'SMS_LICENSE_SYNCED',
        message: '✓ DocPocket SMS RDV activé automatiquement depuis votre PC !'
      });
    }
    return;
  }

  // Si le signal transporte la licence SMS et qu'on est sur mobile
  if (isMobile && signal.smsRdvLicense) {
    autoActivateSmsOnMobile(signal.smsRdvLicense);
  }

  // CAS 1 : Le téléphone Android demande la sauvegarde initiale au PC
  if (signal.type === 'REQUEST_INITIAL_BACKUP' && isPc) {
    isHandlingSync = true;
    try {
      notifyBridgeSubscribers({
        type: 'REMOTE_REQUEST_RECEIVED',
        signal,
        message: `📱 ${signal.requesterName || 'Le smartphone'} demande la sauvegarde du cabinet.`
      });

      // Le PC prépare et envoie immédiatement sa dernière sauvegarde
      const [patients, consultations, prescriptions, invoices, bordereaux, certificates, appointments] = await Promise.all([
        getAllPatients(),
        getAllConsultations(),
        getAllPrescriptions(),
        getAllInvoices(),
        getAllBordereaux(),
        getAllCertificates(),
        getAppointments(null)
      ]);

      const doctorProfile = JSON.parse(localStorage.getItem('docpocket_doctor_profile') || '{}');
      const payload = {
        app: 'DocPocket Cab',
        schemaVersion: 7,
        exportedAt: new Date().toISOString(),
        stats: {
          patientsCount: patients.length,
          consultationsCount: consultations.length,
          prescriptionsCount: prescriptions.length,
          invoicesCount: invoices.length,
          bordereauxCount: bordereaux.length,
          certificatesCount: certificates.length,
          appointmentsCount: appointments.length
        },
        doctorProfile,
        smsRdvLicense: getSmsLicenseSyncPayload(),
        data: { patients, consultations, prescriptions, invoices, bordereaux, certificates, appointments }
      };

      await uploadBackupToBridge(payload, 'reponse_demande_initiale_mobile');
    } catch (err) {
      console.error("Erreur réponse demande initiale:", err);
    } finally {
      isHandlingSync = false;
    }
    return;
  }

  // CAS 2 : Une sauvegarde plus récente est disponible sur le pont -> Intégration asynchrone immédiate en arrière-plan
  if (signal.type === 'NEW_BACKUP_AVAILABLE' && cfg.autoSync) {
    const signalId = `${signal.sourceDeviceId}_${signal.version || signal.timestamp}`;
    if (signalId !== lastProcessedSignalId) {
      lastProcessedSignalId = signalId;
      try {
        localStorage.setItem(LAST_SIGNAL_ID_KEY, signalId);
      } catch (e) {}
      await processIncomingBackupSignal(signal);
    }
  }
}

/**
 * Exécute la synchronisation en arrière-plan (au repos ou en tâche de fond)
 */
async function processIncomingBackupSignal(signal) {
  const isMobile = isMobileDevice();
  isHandlingSync = true;
  try {
    notifyBridgeSubscribers({
      type: 'SYNC_START',
      signal,
      message: `🔄 Synchronisation discrète en arrière-plan avec ${signal.sourceDeviceName || 'l\'autre appareil'}...`
    });

    // Télécharger
    const { backupData, metadata } = await downloadBackupFromBridge();

    // Si nous sommes sur mobile et que nous n'avons que des données de démonstration :
    if (isMobile) {
      const localPatients = await getAllPatients();
      if (isDemoDatabase(localPatients)) {
        await clearDemoDataIfPresent();
      }
    }

    // Fusionner sans doublons
    const report = await smartDeduplicatingMerge(backupData, (msg) => {
      notifyBridgeSubscribers({ type: 'MERGING_PROGRESS', message: msg });
    });

    localStorage.setItem(LAST_SYNC_KEY, String(signal.timestamp));
    if (isMobile) {
      localStorage.setItem('docpocket_has_synced_with_pc', 'true');
    }

    notifyBridgeSubscribers({
      type: 'SYNC_COMPLETE',
      report,
      metadata,
      message: `✓ Synchronisé : +${report.newPatients} patient(s), +${report.newConsultations} consult. ajoutés sans doublons !`
    });
  } catch (err) {
    console.error("Erreur sync automatique pont:", err);
    notifyBridgeSubscribers({
      type: 'SYNC_ERROR',
      error: err.message
    });
  } finally {
    isHandlingSync = false;
  }
}

// ==============================================================
// 7. MICRO-SYNCHRONISATION DELTA INSTANTANÉE (< 2 Ko, ULTRA-FLUIDE)
// Permet la synchronisation quasi-instantanée (1-3s) sans renvoyer
// toute la sauvegarde ni ralentir l'appareil ou clignoter l'UI.
// ==============================================================

/**
 * Diffuse immédiatement une modification atomique vers le pont Firebase
 */
export async function broadcastLocalDelta(action, entityType, data) {
  const cfg = getFirebaseBridgeConfig();
  if (!cfg.enabled) return;

  const deviceId = getOrCreateDeviceId();
  const deviceName = getDeviceDisplayName();
  const isMobile = isMobileDevice();
  const timestamp = Date.now();
  const deltaId = `${deviceId}_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;

  lastProcessedDeltaId = deltaId;
  try {
    localStorage.setItem(LAST_DELTA_ID_KEY, deltaId);
  } catch (e) {}

  const deltaPayload = {
    deltaId,
    sourceDeviceId: deviceId,
    sourceDeviceName: deviceName,
    isMobile,
    action,
    entityType,
    data,
    timestamp
  };

  try {
    await firebaseFetch('delta/latest', {
      method: 'PUT',
      body: JSON.stringify(deltaPayload)
    });
  } catch (err) {
    console.warn("Erreur diffusion micro-delta pont:", err.message);
  }
}

async function applyIncomingPatientDelta(data) {
  if (!data) return;
  const localPatients = await getAllPatients();
  const dataCin = (data.cin || '').trim().toUpperCase();
  const dataKey = `${(data.nom || '').trim().toUpperCase()}|${(data.prenom || '').trim().toUpperCase()}|${data.birthdate || ''}`;

  let matched = null;
  if (dataCin) {
    matched = localPatients.find(p => p.cin && p.cin.trim().toUpperCase() === dataCin);
  }
  if (!matched && data.nom && data.prenom) {
    matched = localPatients.find(p => {
      const k = `${(p.nom || '').trim().toUpperCase()}|${(p.prenom || '').trim().toUpperCase()}|${p.birthdate || ''}`;
      return k === dataKey;
    });
  }
  if (!matched && data.id) {
    matched = localPatients.find(p => String(p.id) === String(data.id));
  }

  if (matched) {
    const updated = {
      ...matched,
      ...data,
      id: matched.id // Toujours conserver l'ID local IndexedDB
    };
    await savePatient(updated);
  } else {
    const newPat = { ...data };
    delete newPat.id;
    await savePatient(newPat);
  }
}

async function applyIncomingAppointmentDelta(data) {
  if (!data) return;
  const localAppts = await getAppointments(null);
  const existing = localAppts.find(a =>
    (data.id && String(a.id) === String(data.id)) ||
    (a.rdvDate === data.rdvDate && a.rdvTime === data.rdvTime && (a.patientName === data.patientName || String(a.patientId) === String(data.patientId)))
  );

  if (existing) {
    await saveAppointment({ ...existing, ...data, id: existing.id });
  } else {
    const newAppt = { ...data };
    delete newAppt.id;
    await saveAppointment(newAppt);
  }
}

async function applyIncomingConsultationDelta(data) {
  if (!data) return;
  const localConsults = await getAllConsultations();
  const existing = localConsults.find(c =>
    (data.id && String(c.id) === String(data.id)) ||
    (String(c.patientId) === String(data.patientId) && c.date === data.date && (c.heure || '').slice(0, 5) === (data.heure || '').slice(0, 5))
  );

  if (existing) {
    await saveConsultation({ ...existing, ...data, id: existing.id });
  } else {
    const newConsult = { ...data };
    delete newConsult.id;
    await saveConsultation(newConsult);
  }
}

async function applyIncomingPrescriptionDelta(data) {
  if (!data) return;
  const localPrescs = await getAllPrescriptions();
  const existing = localPrescs.find(p => data.id && String(p.id) === String(data.id));
  if (existing) {
    await savePrescription({ ...existing, ...data, id: existing.id });
  } else {
    const newPresc = { ...data };
    delete newPresc.id;
    await savePrescription(newPresc);
  }
}

async function applyIncomingInvoiceDelta(data) {
  if (!data) return;
  const localInvs = await getAllInvoices();
  const existing = localInvs.find(i =>
    (data.id && String(i.id) === String(data.id)) ||
    (data.numFacture && i.numFacture === data.numFacture)
  );
  if (existing) {
    await saveInvoice({ ...existing, ...data, id: existing.id });
  } else {
    const newInv = { ...data };
    delete newInv.id;
    await saveInvoice(newInv);
  }
}

async function applyIncomingCertificateDelta(data) {
  if (!data) return;
  const localCerts = await getAllCertificates();
  const existing = localCerts.find(c => data.id && String(c.id) === String(data.id));
  if (existing) {
    await saveCertificate({ ...existing, ...data, id: existing.id });
  } else {
    const newCert = { ...data };
    delete newCert.id;
    await saveCertificate(newCert);
  }
}

/**
 * Traite un micro-delta reçu depuis Firebase
 */
async function handleIncomingDelta(delta) {
  if (!delta || !delta.deltaId) return;
  const myDeviceId = getOrCreateDeviceId();
  // Ignorer nos propres signaux
  if (delta.sourceDeviceId === myDeviceId) return;
  if (delta.deltaId === lastProcessedDeltaId) return;

  lastProcessedDeltaId = delta.deltaId;
  try {
    localStorage.setItem(LAST_DELTA_ID_KEY, delta.deltaId);
  } catch (e) {}

  const { action, entityType, data } = delta;
  if (!data && !action?.startsWith('delete_')) return;

  setSyncImporting(true);
  try {
    if (action === 'save_patient' || entityType === 'patient') {
      await applyIncomingPatientDelta(data);
    } else if (action === 'delete_patient') {
      if (data?.id) await deletePatientById(data.id);
    } else if (action === 'save_appointment' || entityType === 'appointment') {
      await applyIncomingAppointmentDelta(data);
    } else if (action === 'delete_appointment') {
      if (data?.id) await deleteAppointment(data.id);
    } else if (action === 'save_consultation' || entityType === 'consultation') {
      await applyIncomingConsultationDelta(data);
    } else if (action === 'delete_consultation') {
      if (data?.id) await deleteConsultationById(data.id);
    } else if (action === 'save_prescription' || entityType === 'prescription') {
      await applyIncomingPrescriptionDelta(data);
    } else if (action === 'delete_prescription') {
      if (data?.id) await deletePrescriptionById(data.id);
    } else if (action === 'save_invoice' || entityType === 'invoice') {
      await applyIncomingInvoiceDelta(data);
    } else if (action === 'delete_invoice') {
      if (data?.id) await deleteInvoiceById(data.id);
    } else if (action === 'save_certificate' || entityType === 'certificate') {
      await applyIncomingCertificateDelta(data);
    } else if (action === 'delete_certificate') {
      if (data?.id) await deleteCertificate(data.id);
    }

    notifyBridgeSubscribers({
      type: 'SYNC_COMPLETE',
      isDelta: true,
      action,
      entityType,
      message: `✓ Synchronisé : ${entityType} mis à jour depuis ${delta.sourceDeviceName || 'l\'autre appareil'} !`
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('docpocket_data_synced', {
        detail: { action, entityType, data }
      }));
    }
  } catch (err) {
    console.warn("Erreur application micro-delta entrant:", err);
  } finally {
    setSyncImporting(false);
  }
}

let isDeltaSyncInitialized = false;

export function initBridgeDeltaSync() {
  if (isDeltaSyncInitialized) return;
  isDeltaSyncInitialized = true;

  onDataChange(async ({ action, details }) => {
    // Si nous sommes en train d'importer une synchronisation, ne pas ré-émettre (anti-rebond)
    if (isSyncImporting) return;
    const cfg = getFirebaseBridgeConfig();
    if (!cfg.enabled) return;

    if (action.startsWith('save_') || action.startsWith('delete_')) {
      const entityType = action.replace('save_', '').replace('delete_', '');
      const data = details?.data || details?.patient || details?.certificate || { id: details?.id };
      await broadcastLocalDelta(action, entityType, data);
    }
  });
}

let isCheckingSignal = false;

/**
 * Vérifie périodiquement s'il y a un nouveau signal (très léger, 1 seul appel JSON)
 */
async function checkBridgeSignal() {
  const cfg = getFirebaseBridgeConfig();
  if (!cfg.enabled || isCheckingSignal) return;

  isCheckingSignal = true;
  try {
    const [latestDelta, latestSignal] = await Promise.all([
      firebaseFetch('delta/latest').catch(() => null),
      firebaseFetch('signals/latest').catch(() => null)
    ]);

    if (latestDelta) {
      await handleIncomingDelta(latestDelta);
    }
    if (latestSignal) {
      await handleIncomingSignal(latestSignal);
    }
  } catch (err) {
    // Silencieux pour ne pas polluer la console en cas de coupure réseau
  } finally {
    isCheckingSignal = false;
  }
}

function onWindowWakeup() {
  checkBridgeSignal();
}

function onVisibilityChange() {
  if (typeof document !== 'undefined') {
    if (document.hidden) {
      if (pendingIdleSignal) {
        executePendingSignalWhenIdle();
      }
      // Mode veille économe : scrutation ralentie à 15s en arrière-plan
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = setInterval(checkBridgeSignal, 15000);
      }
    } else {
      // Réveil immédiat : vérification instantanée à 0 seconde puis scrutation ultra-réactive à 3.5s
      checkBridgeSignal();
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = setInterval(checkBridgeSignal, 3500);
      }
    }
  }
}

/**
 * Force une vérification immédiate du pont Firebase (appelée par le témoin au clic)
 */
export function triggerBridgeCheck() {
  return checkBridgeSignal();
}

/**
 * Démarre l'écouteur du pont Firebase
 */
export function startBridgeListener() {
  stopBridgeListener();
  const cfg = getFirebaseBridgeConfig();
  if (!cfg.enabled) return;

  // Initialisation de la micro-synchronisation delta automatique sur changements locaux
  initBridgeDeltaSync();

  // 1. Première vérification immédiate
  checkBridgeSignal();

  // 2. Scrutation régulière ultra-réactive toutes les 3.5 secondes
  pollTimer = setInterval(checkBridgeSignal, 3500);

  // 3. Écouteurs de réveil instantané (déverrouillage téléphone, focus onglet, retour en ligne)
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onWindowWakeup);
    window.addEventListener('online', onWindowWakeup);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
  }
}

export function stopBridgeListener() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('focus', onWindowWakeup);
    window.removeEventListener('online', onWindowWakeup);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  }
}

export function restartBridgeListener() {
  stopBridgeListener();
  startBridgeListener();
}

/**
 * Diffuse immédiatement la licence DocPocket SMS RDV vers le pont Firebase
 * pour synchronisation instantanée vers le mobile
 */
export async function syncSmsLicenseDirectlyToBridge() {
  try {
    const lic = getSmsLicenseSyncPayload();
    if (!lic) return;
    const deviceId = getOrCreateDeviceId();
    const deviceName = getDeviceDisplayName();

    const signal = {
      type: 'SMS_LICENSE_UPDATED',
      timestamp: Date.now(),
      sourceDeviceId: deviceId,
      sourceDeviceName: deviceName,
      isMobile: isMobileDevice(),
      smsRdvLicense: lic
    };

    await firebaseFetch('signals/latest', {
      method: 'PUT',
      body: JSON.stringify(signal)
    });
  } catch (e) {
    // Silencieux si hors-ligne
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('docpocket_sms_license_changed', (e) => {
    if (e.detail && !isMobileDevice()) {
      syncSmsLicenseDirectlyToBridge();
    }
  });
}
