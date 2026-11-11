// ==============================================================
// GESTION DU DOSSIER DE SAUVEGARDE LOCAL (FILE SYSTEM ACCESS API)
// 100% LOCAL - ZERO CLOUD - SECRET MÉDICAL GARANTI
// ==============================================================

const FOLDER_DB_NAME = 'DocPocketFolderDB';
const FOLDER_STORE_NAME = 'handles';
const HANDLE_KEY = 'backup_directory_handle';
const LOCAL_STORAGE_FOLDER_NAME = 'docpocket_backup_folder_name';
const LOCAL_STORAGE_MANUAL_PATH = 'docpocket_backup_folder_path';
const LOCAL_STORAGE_CONFIGURED_FLAG = 'docpocket_backup_folder_configured';

/**
 * Ouvre ou crée la base IndexedDB isolée pour stocker le handle du dossier
 */
function openFolderDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FOLDER_DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(FOLDER_STORE_NAME)) {
        db.createObjectStore(FOLDER_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Vérifie si l'API File System Access (showDirectoryPicker) est supportée par le navigateur
 */
export function isDirectoryPickerSupported() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

/**
 * Récupère le handle du dossier sauvegardé dans IndexedDB
 */
export async function getSavedDirectoryHandle() {
  try {
    const db = await openFolderDB();
    return new Promise((resolve) => {
      const tx = db.transaction(FOLDER_STORE_NAME, 'readonly');
      const store = tx.objectStore(FOLDER_STORE_NAME);
      const req = store.get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn('Impossible de lire le handle du dossier:', e);
    return null;
  }
}

/**
 * Sauvegarde le handle du dossier dans IndexedDB
 */
export async function saveDirectoryHandle(handle) {
  try {
    const db = await openFolderDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FOLDER_STORE_NAME, 'readwrite');
      const store = tx.objectStore(FOLDER_STORE_NAME);
      const req = store.put(handle, HANDLE_KEY);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Impossible de stocker le handle du dossier:', e);
    return false;
  }
}

/**
 * Vérifie ou demande la permission d'accès en écriture au dossier
 */
export async function verifyFolderPermission(handle, readWrite = true) {
  if (!handle) return false;
  const options = {};
  if (readWrite) options.mode = 'readwrite';

  try {
    if ((await handle.queryPermission(options)) === 'granted') {
      return true;
    }
    if ((await handle.requestPermission(options)) === 'granted') {
      return true;
    }
  } catch (e) {
    console.warn('Erreur vérification permission dossier:', e);
  }
  return false;
}

/**
 * Ouvre le sélecteur natif de dossier de l'ordinateur et le mémorise
 */
export async function selectBackupDirectory() {
  if (!isDirectoryPickerSupported()) {
    throw new Error("Votre navigateur ne prend pas en charge la sélection directe de dossier.");
  }

  const handle = await window.showDirectoryPicker({
    mode: 'readwrite',
    startIn: 'documents'
  });

  const hasPerm = await verifyFolderPermission(handle, true);
  if (!hasPerm) {
    throw new Error("Permission d'écriture dans le dossier refusée.");
  }

  await saveDirectoryHandle(handle);
  localStorage.setItem(LOCAL_STORAGE_FOLDER_NAME, handle.name);
  localStorage.setItem(LOCAL_STORAGE_CONFIGURED_FLAG, 'true');

  return {
    success: true,
    folderName: handle.name
  };
}

/**
 * Définit un chemin de dossier de sauvegarde manuel (pour les navigateurs sans showDirectoryPicker)
 */
export function setManualBackupPath(pathStr) {
  const clean = (pathStr || '').trim();
  localStorage.setItem(LOCAL_STORAGE_MANUAL_PATH, clean);
  localStorage.setItem(LOCAL_STORAGE_FOLDER_NAME, clean || 'Dossier Téléchargements');
  localStorage.setItem(LOCAL_STORAGE_CONFIGURED_FLAG, 'true');
  return true;
}

/**
 * Indique si le dossier de sauvegarde a déjà été configuré au moins une fois
 */
export function isBackupFolderConfigured() {
  return localStorage.getItem(LOCAL_STORAGE_CONFIGURED_FLAG) === 'true';
}

/**
 * Ignore la configuration initiale (l'utilisateur configurera plus tard depuis les paramètres)
 */
export function dismissInitialFolderSetup() {
  localStorage.setItem(LOCAL_STORAGE_CONFIGURED_FLAG, 'true');
}

/**
 * Récupère le nom et le statut du dossier de sauvegarde configuré
 */
export async function getBackupFolderInfo() {
  const isConfigured = isBackupFolderConfigured();
  const folderName = localStorage.getItem(LOCAL_STORAGE_FOLDER_NAME) || '';
  const manualPath = localStorage.getItem(LOCAL_STORAGE_MANUAL_PATH) || '';
  const handle = await getSavedDirectoryHandle();

  return {
    isConfigured,
    folderName: folderName || (manualPath ? manualPath : 'Non configuré (Dossier Téléchargements par défaut)'),
    manualPath,
    hasDirectHandle: Boolean(handle),
    supported: isDirectoryPickerSupported()
  };
}

/**
 * Enregistre un fichier de sauvegarde directement dans le dossier choisi (ou fallback téléchargement)
 */
export async function writeBackupFileToFolder(filename, blobData) {
  const handle = await getSavedDirectoryHandle();

  if (handle) {
    try {
      const hasPerm = await verifyFolderPermission(handle, true);
      if (hasPerm) {
        const fileHandle = await handle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blobData);
        await writable.close();

        return {
          success: true,
          mode: 'direct',
          folderName: handle.name,
          filename
        };
      }
    } catch (err) {
      console.warn("Écriture directe dans le dossier échouée, bascule vers téléchargement standard:", err);
    }
  }

  // Fallback universel : déclencher le téléchargement navigateur
  const url = URL.createObjectURL(blobData);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  const folderName = localStorage.getItem(LOCAL_STORAGE_FOLDER_NAME) || 'Dossier de téléchargements';
  return {
    success: true,
    mode: 'download',
    folderName,
    filename
  };
}

/**
 * Sauvegarde une copie interne du snapshot d'auto-sauvegarde dans IndexedDB (isole de toute perte)
 */
export async function saveInternalAutoBackupSnapshot(filename, blobOrText) {
  try {
    const db = await openFolderDB();
    const text = typeof blobOrText === 'string'
      ? blobOrText
      : (blobOrText.text ? await blobOrText.text() : '');

    return new Promise((resolve, reject) => {
      const tx = db.transaction(FOLDER_STORE_NAME, 'readwrite');
      const store = tx.objectStore(FOLDER_STORE_NAME);
      const payload = {
        filename,
        text,
        savedAt: Date.now(),
        isoDate: new Date().toISOString()
      };
      const req = store.put(payload, 'latest_autobackup_snapshot');
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("Erreur sauvegarde snapshot interne:", e);
    return false;
  }
}

/**
 * Récupère le dernier snapshot d'auto-sauvegarde stocké en interne
 */
export async function getInternalAutoBackupSnapshot() {
  try {
    const db = await openFolderDB();
    return new Promise((resolve) => {
      const tx = db.transaction(FOLDER_STORE_NAME, 'readonly');
      const store = tx.objectStore(FOLDER_STORE_NAME);
      const req = store.get('latest_autobackup_snapshot');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

/**
 * Télécharge manuellement le dernier snapshot d'auto-sauvegarde stocké
 */
export async function downloadLatestAutoBackupSnapshot() {
  const snapshot = await getInternalAutoBackupSnapshot();
  if (!snapshot || !snapshot.text) {
    throw new Error("Aucune sauvegarde automatique récente n'est encore disponible.");
  }
  const blob = new Blob([snapshot.text], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = snapshot.filename || 'DocPocketCab_AutoBackup.json';
  a.click();
  URL.revokeObjectURL(url);
  return snapshot;
}

/**
 * Écriture SILENCIEUSE pour la sauvegarde automatique après chaque modification
 * - Écrit directement dans le dossier local si un handle autorisé existe (sans ouvrir de boîte de dialogue)
 * - Conserve une copie miroir dans l'IndexedDB locale protégée
 * - Ne provoque JAMAIS de popup de téléchargement agaçante pendant la saisie médicale
 */
export async function writeAutoBackupFileToFolder(filename, blobData) {
  const handle = await getSavedDirectoryHandle();
  let writtenDirectly = false;

  if (handle) {
    try {
      let hasPerm = false;
      try {
        hasPerm = (await handle.queryPermission({ mode: 'readwrite' })) === 'granted';
      } catch (e) {
        // queryPermission error
      }

      if (hasPerm) {
        const fileHandle = await handle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blobData);
        await writable.close();
        writtenDirectly = true;
      }
    } catch (err) {
      console.warn("Écriture auto directe impossible:", err);
    }
  }

  // Toujours enregistrer le snapshot en miroir local interne
  await saveInternalAutoBackupSnapshot(filename, blobData);

  if (writtenDirectly) {
    return {
      success: true,
      mode: 'direct',
      folderName: handle.name,
      filename
    };
  }

  const configuredName = localStorage.getItem(LOCAL_STORAGE_FOLDER_NAME) || 'Mémoire locale (IndexedDB)';
  return {
    success: true,
    mode: 'internal',
    folderName: configuredName,
    filename
  };
}
