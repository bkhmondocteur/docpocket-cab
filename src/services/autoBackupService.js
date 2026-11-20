// ==============================================================
// SERVICE DE SAUVEGARDE AUTOMATIQUE APRÈS CHAQUE MODIFICATION
// 100% LOCAL - ZERO CLOUD - SILENCIEUX & ATOMIQUE
// ==============================================================

import {
  getAllPatients,
  getAllConsultations,
  getAllPrescriptions,
  getAllInvoices,
  getAllBordereaux,
  onDataChange,
  isDemoDatabase
} from './patientStorage';
import {
  writeAutoBackupFileToFolder,
  getBackupFolderInfo,
  downloadLatestAutoBackupSnapshot
} from './backupFolderService';
import { uploadBackupToBridge } from './firebaseBridgeSyncService';

const AUTOBACKUP_ENABLED_KEY = 'docpocket_autobackup_enabled';
const AUTOBACKUP_DAILY_KEY = 'docpocket_autobackup_daily';
const AUTOBACKUP_LAST_TIME_KEY = 'docpocket_autobackup_last_time';
const AUTOBACKUP_LAST_INFO_KEY = 'docpocket_autobackup_last_info';
// Temporisation courte (1.2 seconde) pour batcher les frappes rapides et synchroniser quasi-instantanément avec Firebase
const DEBOUNCE_DELAY_MS = 1200;

let debounceTimer = null;
let isBackupInProgress = false;
let pendingReason = null;
const subscribers = new Set();

// Si l'utilisateur quitte la fenêtre ou bascule d'application, exécuter immédiatement en arrière-plan
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
      performAutoBackupNow(pendingReason || 'mise_en_arriere_plan');
    }
  });
}

let status = {
  state: 'idle', // 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  enabled: localStorage.getItem(AUTOBACKUP_ENABLED_KEY) !== 'false',
  includeDaily: localStorage.getItem(AUTOBACKUP_DAILY_KEY) !== 'false',
  lastBackupTime: Number(localStorage.getItem(AUTOBACKUP_LAST_TIME_KEY)) || null,
  lastInfo: (() => {
    try {
      return JSON.parse(localStorage.getItem(AUTOBACKUP_LAST_INFO_KEY) || 'null');
    } catch {
      return null;
    }
  })(),
  lastError: null
};

function notifySubscribers() {
  const currentSnapshot = { ...status };
  for (const cb of subscribers) {
    try {
      cb(currentSnapshot);
    } catch (e) {
      console.warn("Erreur subscriber autobackup:", e);
    }
  }
}

/**
 * Abonnement aux changements d'état de la sauvegarde automatique
 */
export function subscribeAutoBackup(callback) {
  subscribers.add(callback);
  // Émettre l'état immédiat
  callback({ ...status });
  return () => subscribers.delete(callback);
}

/**
 * Récupère le statut actuel
 */
export function getAutoBackupStatus() {
  return { ...status };
}

/**
 * Active ou désactive la sauvegarde automatique
 */
export function setAutoBackupEnabled(enabled) {
  status.enabled = Boolean(enabled);
  localStorage.setItem(AUTOBACKUP_ENABLED_KEY, status.enabled ? 'true' : 'false');
  notifySubscribers();
  if (status.enabled) {
    scheduleAutoBackup('activation_option');
  }
}

/**
 * Active ou désactive la création d'un fichier journalier d'archive
 */
export function setAutoBackupDaily(includeDaily) {
  status.includeDaily = Boolean(includeDaily);
  localStorage.setItem(AUTOBACKUP_DAILY_KEY, status.includeDaily ? 'true' : 'false');
  notifySubscribers();
}

/**
 * Exécute la sauvegarde automatique
 */
export async function performAutoBackupNow(reason = 'modification_manuelle') {
  if (isBackupInProgress) {
    pendingReason = reason;
    return;
  }

  isBackupInProgress = true;
  status.state = 'saving';
  status.lastError = null;
  notifySubscribers();

  try {
    const [patients, consultations, prescriptions, invoices, bordereaux] = await Promise.all([
      getAllPatients(),
      getAllConsultations(),
      getAllPrescriptions(),
      getAllInvoices(),
      getAllBordereaux()
    ]);

    const doctorProfile = JSON.parse(localStorage.getItem('docpocket_doctor_profile') || '{}');
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);

    const backupPayload = {
      app: 'DocPocket Cab',
      schemaVersion: 6,
      backupType: 'auto_backup',
      triggerReason: reason,
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

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });

    // 1. Sauvegarde principale toujours à jour (écrasement propre du fichier miroir)
    const mainFilename = 'DocPocketCab_AutoBackup.json';
    const mainResult = await writeAutoBackupFileToFolder(mainFilename, blob);

    // 2. Sauvegarde journalière additionnelle (pour historique jour par jour)
    if (status.includeDaily) {
      const dailyFilename = `DocPocketCab_AutoBackup_${dateStr}.json`;
      await writeAutoBackupFileToFolder(dailyFilename, blob);
    }

    const info = {
      timestamp: Date.now(),
      isoTime: now.toISOString(),
      timeFormatted: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      mode: mainResult.mode, // 'direct' (sur disque) ou 'internal' (IndexedDB)
      folderName: mainResult.folderName,
      filename: mainFilename,
      reason,
      stats: backupPayload.stats
    };

    status.state = 'saved';
    status.lastBackupTime = Date.now();
    status.lastInfo = info;
    localStorage.setItem(AUTOBACKUP_LAST_TIME_KEY, String(Date.now()));
    localStorage.setItem(AUTOBACKUP_LAST_INFO_KEY, JSON.stringify(info));
    notifySubscribers();

    // 3. Découpage et envoi asynchrone sur le pont Firebase pour synchronisation (PC <-> Mobile)
    // Protection absolue : Ne JAMAIS envoyer les données de démo depuis un mobile vers le pont !
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent || '');
    const isDemo = isDemoDatabase(patients);
    const hasSyncedWithPc = localStorage.getItem('docpocket_has_synced_with_pc') === 'true';

    const hasUserModifications = reason.includes('patient') || reason.includes('consultation') || reason.includes('rdv') || reason.includes('immediate');

    if (isMobile && !hasSyncedWithPc && isDemo && !hasUserModifications) {
      console.log("ℹ️ Mobile en mode démonstration initiale : envoi pont suspendu pour préserver la base du PC.");
    } else {
      uploadBackupToBridge(backupPayload, reason).catch(e => {
        // Silencieux si hors-ligne ou pont non configuré
      });
    }

    // Après 3 secondes, repasser en état 'idle' tout en conservant lastBackupTime
    setTimeout(() => {
      if (status.state === 'saved') {
        status.state = 'idle';
        notifySubscribers();
      }
    }, 3000);

    return info;
  } catch (err) {
    console.error("Erreur exécution auto-sauvegarde:", err);
    status.state = 'error';
    status.lastError = err.message || 'Erreur inconnue';
    notifySubscribers();
  } finally {
    isBackupInProgress = false;
    if (pendingReason) {
      const nextReason = pendingReason;
      pendingReason = null;
      performAutoBackupNow(nextReason);
    }
  }
}

/**
 * Déclenche immédiatement l'auto-sauvegarde et la diffusion vers Firebase sans attendre
 */
export function triggerImmediateAutoBackup(reason = 'modification_immediate') {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  return performAutoBackupNow(reason);
}

/**
 * Planifie une sauvegarde avec debouncing
 */
export function scheduleAutoBackup(reason = 'donnee_modifiee') {
  if (!status.enabled) return;

  status.state = 'pending';
  notifySubscribers();

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    performAutoBackupNow(reason);
  }, DEBOUNCE_DELAY_MS);
}

let isInitialized = false;

/**
 * Initialise le système d'auto-sauvegarde en s'abonnant aux changements de la base locale
 */
export function initAutoBackup() {
  if (isInitialized) return;
  isInitialized = true;

  // Écoute automatique des modifications dans patientStorage
  onDataChange((changeEvent) => {
    scheduleAutoBackup(changeEvent.action || 'modification_base');
  });

  // Écoute d'éventuelles modifications de profil praticien depuis localStorage
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === 'docpocket_doctor_profile') {
        scheduleAutoBackup('modification_profil_praticien');
      }
    });
  }

  // Effectuer une première auto-sauvegarde silencieuse au démarrage si aucune sauvegarde récente (> 1h)
  const lastTime = Number(localStorage.getItem(AUTOBACKUP_LAST_TIME_KEY)) || 0;
  if (Date.now() - lastTime > 3600 * 1000) {
    setTimeout(() => {
      performAutoBackupNow('sauvegarde_initiale_session');
    }, 4000);
  }
}

export { downloadLatestAutoBackupSnapshot };
