// ==============================================================
// DOCPOCKET CABINET - GESTION DU SYSTÈME DE LICENCE & KEYGEN PRO
// ==============================================================

const STORAGE_KEY = 'docpocket_cabinet_license';
const STORAGE_REVOKED_KEY = 'docpocket_revoked_licenses';
const LICENSE_SALT = 'DOCPOCKET_CABINET_PRO_SECURITY_SALT_2026';

// Clés maîtresses de démonstration
const PREDEFINED_KEYS = {
  'DOCPOCKET-2026-TRIAL': {
    name: "Licence d'Évaluation Provisoire (30 Jours)",
    expiryDate: '2026-12-31',
    maxDevices: 3,
    type: 'provisoire'
  },
  'CABINET-DEMO-2026': {
    name: 'Licence Partenaire Évaluation',
    expiryDate: '2026-12-31',
    maxDevices: 2,
    type: 'provisoire'
  },
  'DOCPOCKET-PRO-2026': {
    name: 'Licence Professionnelle Cabinet Pro',
    expiryDate: '2026-12-31',
    maxDevices: 5,
    type: 'provisoire'
  },
  'CABINET-TEST-2026': {
    name: 'Licence Démo Test Cabinet',
    expiryDate: '2026-12-31',
    maxDevices: 1,
    type: 'provisoire'
  }
};

/**
 * Calcule un checksum hexadécimal à partir d'une chaîne
 */
function computeChecksum(str) {
  let hash = 5381;
  const combined = str + LICENSE_SALT;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash) + combined.charCodeAt(i);
    hash = hash & 0xFFFFFFFF;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(4, '0');
  return hex.slice(0, 4);
}

/**
 * Récupère la liste des licences révoquées
 */
export function getRevokedLicenses() {
  try {
    const raw = localStorage.getItem(STORAGE_REVOKED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Vérifie si une clé est dans la liste noire des révocations
 */
export function isLicenseRevoked(key) {
  if (!key) return false;
  const cleanKey = key.trim().toUpperCase();
  const list = getRevokedLicenses();
  return list.some(item => item.key === cleanKey);
}

/**
 * Ajoute une licence à la liste des clés révoquées
 */
export function revokeLicenseKey(key, reason = 'Révocation administrative') {
  if (!key || typeof key !== 'string') {
    return { success: false, error: 'Clé invalide.' };
  }
  const cleanKey = key.trim().toUpperCase();
  const list = getRevokedLicenses();

  // Éviter les doublons
  const filtered = list.filter(item => item.key !== cleanKey);
  filtered.unshift({
    key: cleanKey,
    reason: reason || 'Révocation par l\'administrateur',
    date: new Date().toISOString()
  });

  localStorage.setItem(STORAGE_REVOKED_KEY, JSON.stringify(filtered));

  // Si la clé révoquée est celle actuellement active sur cet appareil, la désactiver immédiatement
  const current = getLicenseStatus();
  if (current && current.key === cleanKey) {
    revokeLicense();
  }

  return { success: true, message: `Clé ${cleanKey} révoquée avec succès.` };
}

/**
 * Réactive / supprime une clé de la liste noire
 */
export function unrevokeLicenseKey(key) {
  if (!key) return;
  const cleanKey = key.trim().toUpperCase();
  const list = getRevokedLicenses();
  const filtered = list.filter(item => item.key !== cleanKey);
  localStorage.setItem(STORAGE_REVOKED_KEY, JSON.stringify(filtered));
  return { success: true, message: `Clé ${cleanKey} rétablie.` };
}

/**
 * Génère une clé de licence algorithmique DocPocket Pro
 * Format : DPCAB-{DEV}-{YYYYMMDD}-{SERIAL}-{CHECKSUM}
 * Exemple : DPCAB-03-20271231-A79B-8F42
 */
export function generateLicenseKey(optionsOrDate) {
  let expiryDateStr = '';
  let maxDevices = 3;
  let clientRef = 'CABINET';

  if (typeof optionsOrDate === 'string') {
    expiryDateStr = optionsOrDate;
  } else if (typeof optionsOrDate === 'object' && optionsOrDate !== null) {
    if (optionsOrDate.expiryDate) {
      expiryDateStr = optionsOrDate.expiryDate;
    } else if (optionsOrDate.durationDays) {
      if (optionsOrDate.durationDays === 'lifetime' || optionsOrDate.durationDays >= 9999) {
        expiryDateStr = '2099-12-31';
      } else {
        const d = new Date();
        d.setDate(d.getDate() + Number(optionsOrDate.durationDays));
        expiryDateStr = d.toISOString().slice(0, 10);
      }
    }
    if (optionsOrDate.maxDevices) {
      maxDevices = Number(optionsOrDate.maxDevices);
    }
    if (optionsOrDate.clientRef) {
      clientRef = optionsOrDate.clientRef.trim();
    }
  }

  if (!expiryDateStr) {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 365); // 1 an par défaut
    expiryDateStr = defaultDate.toISOString().slice(0, 10);
  }

  const cleanDate = expiryDateStr.replace(/-/g, '');
  const devCode = String(maxDevices || 3).padStart(2, '0').slice(0, 2);

  // Serial aléatoire ou dérivé
  const randomSerial = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  const payloadToSign = `${devCode}${cleanDate}${randomSerial}`;
  const checksum = computeChecksum(payloadToSign);

  return `DPCAB-${devCode}-${cleanDate}-${randomSerial}-${checksum}`;
}

/**
 * Vérifie la validité d'une clé de licence saisie
 */
export function verifyLicenseKey(key) {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'Veuillez saisir une clé de licence.' };
  }

  const cleanKey = key.trim().toUpperCase();

  // 1. Vérification de la liste noire de révocation
  if (isLicenseRevoked(cleanKey)) {
    const list = getRevokedLicenses();
    const item = list.find(it => it.key === cleanKey);
    return {
      valid: false,
      isRevoked: true,
      error: `⛔ Licence révoquée par l'administrateur (Motif : ${item?.reason || 'Non spécifié'}).`
    };
  }

  // 2. Vérification des clés prédéfinies
  if (PREDEFINED_KEYS[cleanKey]) {
    const info = PREDEFINED_KEYS[cleanKey];
    const expiry = new Date(info.expiryDate + 'T23:59:59');
    const now = new Date();
    const isExpired = now > expiry;
    const daysRemaining = Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));

    if (isExpired) {
      return { valid: false, isExpired: true, error: `Cette clé de licence a expiré le ${info.expiryDate}.` };
    }

    return {
      valid: true,
      isLicensed: true,
      key: cleanKey,
      name: info.name,
      expiryDate: info.expiryDate,
      maxDevices: info.maxDevices || 3,
      daysRemaining,
      type: info.type
    };
  }

  // 3. Format DocPocket Pro 5 blocs : DPCAB-{DEV}-{YYYYMMDD}-{SERIAL}-{CHECKSUM}
  const regexPro = /^DPCAB-(\d{2})-(\d{8})-([A-F0-9]{4})-([A-F0-9]{4})$/;
  const matchPro = cleanKey.match(regexPro);

  if (matchPro) {
    const devCode = matchPro[1];
    const dateStr = matchPro[2];
    const serial = matchPro[3];
    const checksum = matchPro[4];

    const expectedChecksum = computeChecksum(`${devCode}${dateStr}${serial}`);
    if (checksum !== expectedChecksum) {
      return { valid: false, error: 'Signature de licence invalide ou corrompue.' };
    }

    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10) - 1;
    const day = parseInt(dateStr.slice(6, 8), 10);
    const expiryDate = new Date(year, month, day, 23, 59, 59);

    const now = new Date();
    if (isNaN(expiryDate.getTime())) {
      return { valid: false, error: "Date d'expiration encodée invalide." };
    }

    const isLifetime = year >= 2099;
    const isExpired = !isLifetime && (now > expiryDate);
    const daysRemaining = isLifetime ? 9999 : Math.max(0, Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24)));
    const formattedExpiry = isLifetime ? 'À vie (Illimitée)' : `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const maxDevNum = parseInt(devCode, 10);

    if (isExpired) {
      return { valid: false, isExpired: true, error: `Cette licence a expiré le ${formattedExpiry}.` };
    }

    return {
      valid: true,
      isLicensed: true,
      key: cleanKey,
      name: isLifetime ? 'Licence Cabinet Permanente (À Vie)' : `Licence Cabinet Pro (${daysRemaining} jours)`,
      expiryDate: formattedExpiry,
      maxDevices: maxDevNum === 99 ? 'Illimité' : maxDevNum,
      daysRemaining: isLifetime ? 'Illimité' : daysRemaining,
      isLifetime,
      type: 'commerciale'
    };
  }

  // 4. Rétrocompatibilité Format Legacy 3 blocs : DPCAB-YYYYMMDD-XXXX
  const regexLegacy = /^DPCAB-(\d{8})-([A-F0-9]{4})$/;
  const matchLegacy = cleanKey.match(regexLegacy);

  if (matchLegacy) {
    const dateStr = matchLegacy[1];
    const checksum = matchLegacy[2];

    let hash = 5381;
    const legacySalt = 'DOCPOCKET_CAB_SECRET_SALT_2026';
    const combined = dateStr + legacySalt;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) + hash) + combined.charCodeAt(i);
      hash = hash & 0xFFFFFFFF;
    }
    const expectedLegacy = Math.abs(hash).toString(16).toUpperCase().padStart(4, '0').slice(0, 4);

    if (checksum !== expectedLegacy && checksum !== computeChecksum(dateStr)) {
      return { valid: false, error: 'Format ou signature de clé incorrecte.' };
    }

    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10) - 1;
    const day = parseInt(dateStr.slice(6, 8), 10);
    const expiryDate = new Date(year, month, day, 23, 59, 59);

    const now = new Date();
    const isExpired = now > expiryDate;
    const daysRemaining = Math.max(0, Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24)));
    const formattedExpiry = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (isExpired) {
      return { valid: false, isExpired: true, error: `Cette licence a expiré le ${formattedExpiry}.` };
    }

    return {
      valid: true,
      isLicensed: true,
      key: cleanKey,
      name: 'Licence Standard Cabinet',
      expiryDate: formattedExpiry,
      maxDevices: 3,
      daysRemaining,
      type: 'commerciale'
    };
  }

  return {
    valid: false,
    error: 'Format de clé inconnu. Exemple attendu : DPCAB-03-20271231-XXXX-XXXX ou DOCPOCKET-2026-TRIAL'
  };
}

/**
 * Détecte si l'appareil est un smartphone ou une tablette mobile
 */
function isDeviceMobile() {
  return typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent || '');
}

/**
 * Récupère le statut actuel de la licence depuis localStorage
 */
export function getLicenseStatus() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { isLicensed: false, reason: 'Aucune licence enregistrée' };
    }
    const data = JSON.parse(raw);
    const verification = verifyLicenseKey(data.key);

    if (!verification.valid) {
      return {
        isLicensed: false,
        isExpired: verification.isExpired,
        isRevoked: verification.isRevoked,
        error: verification.error
      };
    }

    const maxDev = verification.maxDevices || data.maxDevices || 3;

    // Protection Smartphone : Si la licence n'autorise qu'un seul poste (PC uniquement)
    if (isDeviceMobile() && maxDev === 1) {
      return {
        isLicensed: false,
        isMobileBlocked: true,
        key: data.key,
        name: verification.name,
        maxDevices: 1,
        expiryDate: verification.expiryDate,
        error: "Accès Smartphone non inclus : Cette licence est limitée à 1 poste (PC uniquement). Pour connecter votre smartphone, demandez à votre éditeur une licence multi-postes (2 appareils ou plus)."
      };
    }

    return {
      isLicensed: true,
      key: data.key,
      name: verification.name,
      expiryDate: verification.expiryDate,
      maxDevices: maxDev,
      daysRemaining: verification.daysRemaining,
      activatedAt: data.activatedAt
    };
  } catch (e) {
    console.warn('Erreur lecture licence:', e);
    return { isLicensed: false, reason: "Erreur d'intégrité de la licence" };
  }
}

/**
 * Calcule l'empreinte cryptographique de sécurité (4 caractères hexadécimaux)
 * à partir du Nom, du Prénom et du N° d'Ordre du médecin.
 * Utilisée comme composante {SERIAL} de la clé pour garantir qu'une clé de mise à niveau
 * correspond bien au même praticien titulaire.
 */
export function computeDoctorSerial(nomOrFullName, prenom = '', ordreId = '') {
  const cleanOrdre = (ordreId || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
  const combined = `${nomOrFullName || ''} ${prenom || ''}`
    .toLowerCase()
    .replace(/^(dr\.?|docteur)\s+/i, '')
    .trim();

  // Découper et trier tous les mots pour que l'ordre des termes n'altère jamais la signature
  const words = combined
    .split(/[\s,._-]+/)
    .filter(w => w.length > 0)
    .sort();

  const seed = `${words.join('_')}_${cleanOrdre}`;

  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) + seed.charCodeAt(i);
    hash = hash & 0xFFFFFFFF;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(4, '0').slice(0, 4);
}

/**
 * Enregistre et active une clé de licence
 */
export function activateLicense(key, clientName = '') {
  const result = verifyLicenseKey(key);
  if (!result.valid) {
    return result;
  }

  // Refuser l'activation sur smartphone si la licence est strictement monoposte (1 seul appareil PC)
  if (isDeviceMobile() && result.maxDevices === 1) {
    return {
      valid: false,
      isMobileBlocked: true,
      error: "Accès Smartphone non autorisé : Cette clé de licence est configurée pour 1 seul poste (PC uniquement). Veuillez utiliser une clé multi-postes (2 appareils ou plus) pour votre smartphone."
    };
  }

  // Déterminer et figer la partition liée pour que les futurs renouvellements / extensions la conservent
  const partitionId = getLicensePartitionId(result.key);
  try {
    localStorage.setItem('docpocket_cabinet_bound_partition', partitionId || 'primary');
  } catch {}

  const payload = {
    key: result.key,
    name: result.name,
    clientName: clientName || '',
    maxDevices: result.maxDevices,
    activatedAt: new Date().toISOString(),
    expiryDate: result.expiryDate
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return {
    valid: true,
    isLicensed: true,
    message: 'Licence activée avec succès !',
    details: {
      ...result,
      isLicensed: true
    }
  };
}

/**
 * Met à niveau ou renouvelle la clé de licence du cabinet tout en garantissant :
 * 1. La conservation intégrale de la base de données patients existante.
 * 2. La conservation intégrale du code PIN de sécurité existant.
 * 3. La mise à jour des quotas d'appareils (ex: 1 poste -> 3 postes) et de la date d'expiration.
 * 4. La synchronisation automatique du nouveau statut sur Firebase.
 */
export function upgradeLicenseKey(newKey) {
  const cleanKey = String(newKey || '').trim().toUpperCase();
  const verification = verifyLicenseKey(cleanKey);
  if (!verification.valid) {
    return { success: false, error: verification.error };
  }

  // Refus sur mobile si la nouvelle clé reste monoposte
  if (isDeviceMobile() && verification.maxDevices === 1) {
    return {
      success: false,
      error: "Accès Smartphone non inclus : Cette clé est configurée pour 1 seul poste (PC uniquement). Pour connecter votre smartphone, demandez une clé multi-postes (3 appareils ou plus)."
    };
  }

  // Déterminer la partition cible : si c'est Dr. Hamed BEN KHALIFA ou le cabinet maître, rester toujours 'primary'
  const matchPro = cleanKey.match(/^DPCAB-(\d{2})-(\d{8})-([A-F0-9]{4})-([A-F0-9]{4})$/);
  const hamedSerial = computeDoctorSerial('BEN KHALIFA', 'Hamed', '12052');
  const isHamedKey = matchPro && (
    matchPro[3].toUpperCase() === hamedSerial ||
    matchPro[3].toUpperCase() === '16F3' ||
    matchPro[3].toUpperCase() === '6001'
  );

  const isMaster = isMasterInstallation() || isHamedKey;
  const targetPartition = isMaster ? 'primary' : (getActiveLicensePartitionId() || getLicensePartitionId(verification.key));

  try {
    localStorage.setItem('docpocket_cabinet_bound_partition', targetPartition);
  } catch {}

  const currentStatus = getLicenseStatus();
  const payload = {
    key: verification.key,
    name: verification.name,
    clientName: isMaster ? 'Dr. Hamed BEN KHALIFA' : (currentStatus.clientName || ''),
    maxDevices: verification.maxDevices,
    activatedAt: currentStatus.activatedAt || new Date().toISOString(),
    lastUpgradedAt: new Date().toISOString(),
    expiryDate: verification.expiryDate
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

  // Réinitialiser les tentatives de PIN erronées pour fluidifier l'accès
  resetPinAttempts();

  // Synchronisation Firebase en arrière-plan
  try {
    syncLicenseWithFirebase();
  } catch {}

  return {
    success: true,
    message: 'Licence mise à niveau avec succès !',
    details: {
      ...verification,
      previousDevices: currentStatus.maxDevices,
      newDevices: verification.maxDevices,
      partition: targetPartition
    }
  };
}

/**
 * Révoque / efface la licence enregistrée sur cet appareil
 */
export function revokeLicense() {
  localStorage.removeItem(STORAGE_KEY);
  return true;
}

// ==============================================================
// GESTION DU CODE PIN MÉDECIN & VERROUILLAGE APRÈS 3 ÉCHECS
// ==============================================================
const PIN_STORAGE_KEY = 'docpocket_doctor_pin_code';
const PIN_ATTEMPTS_KEY = 'docpocket_pin_failed_attempts';
const PIN_LOCKOUT_KEY = 'docpocket_pin_lockout_active';

export function getDoctorPinConfig() {
  try {
    const pin = localStorage.getItem(PIN_STORAGE_KEY);
    return {
      hasPin: Boolean(pin && pin.trim()),
      pinCode: pin || ''
    };
  } catch {
    return { hasPin: false, pinCode: '' };
  }
}

export function setDoctorPinCode(pin) {
  if (!pin || String(pin).trim().length < 4) {
    return { success: false, error: 'Le code PIN doit comporter au moins 4 chiffres.' };
  }
  const cleanPin = String(pin).trim();
  localStorage.setItem(PIN_STORAGE_KEY, cleanPin);
  resetPinAttempts();
  return { success: true, message: 'Code PIN de sécurité enregistré avec succès !' };
}

export function removeDoctorPinCode() {
  localStorage.removeItem(PIN_STORAGE_KEY);
  resetPinAttempts();
  return { success: true };
}

export function getPinLockoutStatus() {
  try {
    const isLocked = localStorage.getItem(PIN_LOCKOUT_KEY) === 'true';
    const attempts = parseInt(localStorage.getItem(PIN_ATTEMPTS_KEY) || '0', 10);
    const remaining = Math.max(0, 3 - attempts);
    return {
      isLocked: isLocked || attempts >= 3,
      failedAttempts: attempts,
      remainingAttempts: remaining
    };
  } catch {
    return { isLocked: false, failedAttempts: 0, remainingAttempts: 3 };
  }
}

export function resetPinAttempts() {
  localStorage.removeItem(PIN_ATTEMPTS_KEY);
  localStorage.removeItem(PIN_LOCKOUT_KEY);
}

export function verifyDoctorPin(pinInput) {
  const status = getPinLockoutStatus();
  if (status.isLocked) {
    return {
      success: false,
      isLocked: true,
      error: "⛔ Application bloquée suite à 3 tentatives erronées. Veuillez saisir votre clé de licence pour déverrouiller l'accès."
    };
  }

  const cfg = getDoctorPinConfig();
  if (!cfg.hasPin) {
    return { success: true }; // Aucun PIN configuré
  }

  const cleanInput = String(pinInput || '').trim();
  if (cleanInput === cfg.pinCode) {
    resetPinAttempts();
    return { success: true };
  }

  const currentAttempts = (parseInt(localStorage.getItem(PIN_ATTEMPTS_KEY) || '0', 10)) + 1;
  localStorage.setItem(PIN_ATTEMPTS_KEY, String(currentAttempts));
  const remaining = Math.max(0, 3 - currentAttempts);

  if (remaining <= 0) {
    localStorage.setItem(PIN_LOCKOUT_KEY, 'true');
    return {
      success: false,
      isLocked: true,
      remainingAttempts: 0,
      error: "⛔ 3 tentatives incorrectes : Application bloquée par mesure de sécurité pour protéger les données patients. Veuillez saisir votre clé de licence pour déverrouiller."
    };
  }

  return {
    success: false,
    isLocked: false,
    remainingAttempts: remaining,
    error: `Code PIN incorrect. Attention : il vous reste ${remaining} tentative(s) avant le blocage de sécurité.`
  };
}

export function unlockAppWithLicense(key) {
  const result = activateLicense(key);
  if (result.valid) {
    resetPinAttempts();
    return {
      success: true,
      message: "Application déverrouillée avec succès par votre clé de licence !"
    };
  }
  return {
    success: false,
    error: result.error || "Clé de licence invalide."
  };
}

/**
 * Masque la clé de licence pour la sécurité (ne doit JAMAIS être affichée en clair dans les réglages)
 */
export function maskLicenseKey(key) {
  if (!key) return 'Aucune licence';
  return '••••••••••••••••••••••••• (Masquée pour sécurité)';
}

/**
 * Dérive un identifiant de partition étanche et stable à partir d'une clé de licence.
 * - Si clé vide ou clé maîtresse de Dr. Hamed BEN KHALIFA -> 'primary' (accès à la base originelle 'DocPocketCabinetDB').
 * - Si clé commerciale vendue à un confrère (format DPCAB-...) -> 'lic_YYYYMMDD_XXXX'
 *   garantissant une base de données locale vierge et isolée, 0 accès aux patients du cabinet maître.
 */
export function getLicensePartitionId(key) {
  if (!key) return 'primary';
  const cleanKey = String(key).trim().toUpperCase();

  // Clés maîtresses de Dr. Hamed BEN KHALIFA
  if (
    cleanKey === 'DOCPOCKET-2026-TRIAL' ||
    cleanKey === 'DOCPOCKET-PRO-2026' ||
    cleanKey === 'CABINET-DEMO-2026' ||
    cleanKey === 'CABINET-TEST-2026' ||
    cleanKey.startsWith('MASTER') ||
    cleanKey.includes('PRIMARY')
  ) {
    return 'primary';
  }

  // 1. Détection de la signature de Dr. Hamed BEN KHALIFA (N° Ordre 12052)
  const matchPro = cleanKey.match(/^DPCAB-(\d{2})-(\d{8})-([A-F0-9]{4})-([A-F0-9]{4})$/);
  if (matchPro) {
    const keySerial = matchPro[3].toUpperCase();
    const hamedSerial = computeDoctorSerial('BEN KHALIFA', 'Hamed', '12052');
    if (keySerial === hamedSerial || keySerial === '16F3' || keySerial === '6001') {
      return 'primary';
    }
  }

  // 2. Si une partition a déjà été liée et enregistrée pour cette installation (garantit la conservation lors des mises à niveau)
  try {
    const bound = localStorage.getItem('docpocket_cabinet_bound_partition');
    if (bound) {
      return bound;
    }
  } catch {}

  // 3. Format DocPocket Pro 5 blocs pour confrère
  if (matchPro) {
    const serial = matchPro[3].toLowerCase();
    return `lic_${serial}`;
  }

  // Format Legacy 3 blocs : DPCAB-{YYYYMMDD}-{CHECKSUM}
  const matchLegacy = cleanKey.match(/^DPCAB-(\d{8})-([A-F0-9]{4})$/);
  if (matchLegacy) {
    return `lic_${matchLegacy[2].toLowerCase()}`;
  }

  // Autre format de clé : hachage stable
  let hash = 5381;
  for (let i = 0; i < cleanKey.length; i++) {
    hash = ((hash << 5) + hash) + cleanKey.charCodeAt(i);
    hash = hash & 0xFFFFFFFF;
  }
  return `lic_${Math.abs(hash).toString(16).slice(0, 8)}`;
}

/**
 * Renvoie l'identifiant de partition de la licence actuellement active
 */
export function getActiveLicensePartitionId() {
  const current = getLicenseStatus();
  return getLicensePartitionId(current?.key);
}

/**
 * Indique si l'appareil est actuellement sur l'installation maîtresse de Dr. Hamed BEN KHALIFA
 */
export function isMasterInstallation() {
  return getActiveLicensePartitionId() === 'primary';
}

/**
 * Rebascule immédiatement sur le cabinet principal maître de Dr. Hamed BEN KHALIFA
 */
export function switchToMasterInstallation() {
  return activateLicense('DOCPOCKET-2026-TRIAL', 'Dr. Hamed BEN KHALIFA');
}

/**
 * Synchronise et notifie l'état de la licence et l'identité du médecin
 * vers Firebase Realtime Database pour affichage en direct dans le Keygen Éditeur.
 */
export async function syncLicenseWithFirebase(profileData = null) {
  try {
    const lic = getLicenseStatus();
    if (!lic || !lic.isLicensed || !lic.key) return;

    let baseUrl = '';
    const bridgeRaw = localStorage.getItem('docpocket_firebase_bridge_config');
    if (bridgeRaw) {
      try {
        const bCfg = JSON.parse(bridgeRaw);
        if (bCfg.databaseURL && bCfg.databaseURL.startsWith('http') && !bCfg.databaseURL.includes('trycloudflare.com')) {
          baseUrl = bCfg.databaseURL.replace(/\/$/, '');
        }
      } catch {}
    }
    const keygenFb = localStorage.getItem('docpocket_keygen_firebase_url');
    if (keygenFb && keygenFb.startsWith('http')) {
      baseUrl = keygenFb.replace(/\/$/, '');
    }

    if (!baseUrl && typeof window !== 'undefined' && window.location?.origin?.startsWith('http')) {
      baseUrl = window.location.origin;
    }
    if (!baseUrl) return;

    const cleanKeyId = lic.key.replace(/[^a-zA-Z0-9]/g, '_');
    const docObj = profileData || {};

    const payload = {
      key: lic.key,
      doctorName: docObj.nom ? `${docObj.titre || 'Dr.'} ${docObj.nom} ${docObj.prenom || ''}`.trim() : (lic.clientName || 'Dr. Praticien'),
      specialite: docObj.specialite || 'Médecine Générale',
      ville: docObj.ville || '',
      adresse: docObj.adresse || '',
      telephone: docObj.telephone || '',
      email: docObj.email || '',
      ordreId: docObj.ordreId || '',
      cnamId: docObj.cnamId || '',
      maxDevices: lic.maxDevices || 3,
      expiryDate: lic.expiryDate,
      daysRemaining: lic.daysRemaining,
      status: 'active',
      lastSeenAt: new Date().toISOString(),
      activatedAt: lic.activatedAt || new Date().toISOString(),
      deviceInfo: typeof navigator !== 'undefined' ? (navigator.userAgent.slice(0, 100)) : 'Appareil Cabinet'
    };

    const targetUrl = `${baseUrl}/docpocket_licenses_registry/${cleanKeyId}.json`;
    const res = await fetch(targetUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'revoked') {
        revokeLicense();
        return { isRevoked: true };
      }
    }
  } catch (e) {
    // Silencieux si hors-ligne
  }
}
