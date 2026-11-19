// ==============================================================
// DOCPOCKET SMS RDV - GESTION DU SYSTÈME DE LICENCE DÉDIÉ
// MODULE PASSERELLE SMS & RAPPELS DE RENDEZ-VOUS AUTOMATISÉS
// ==============================================================

const STORAGE_KEY = 'docpocket_sms_rdv_license';
const LICENSE_SALT = 'DOCPOCKET_SMS_RDV_SECURITY_SALT_2026';

// Clés maîtresses et de démonstration pour DocPocket SMS RDV
const PREDEFINED_SMS_KEYS = {
  'DPSMS-2026-TRIAL': {
    name: "Licence d'Évaluation DocPocket SMS RDV (30 Jours)",
    expiryDate: '2026-12-31',
    maxDevices: 3,
    type: 'provisoire'
  },
  'DPSMS-PRO-2026': {
    name: 'Licence Professionnelle DocPocket SMS RDV Pro',
    expiryDate: '2026-12-31',
    maxDevices: 5,
    type: 'provisoire'
  },
  'DPSMS-DEMO-2026': {
    name: 'Licence Démo Test SMS RDV',
    expiryDate: '2026-12-31',
    maxDevices: 2,
    type: 'provisoire'
  },
  'DPSMS-LIFETIME': {
    name: 'Licence Permanente DocPocket SMS RDV (À Vie)',
    expiryDate: '2099-12-31',
    maxDevices: 99,
    type: 'commerciale'
  }
};

/**
 * Calcule un checksum hexadécimal à partir d'une chaîne et du sel secret SMS RDV
 */
export function computeSmsChecksum(str) {
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
 * Génère une clé de licence algorithmique DocPocket SMS RDV
 * Format : DPSMS-{DEV}-{YYYYMMDD}-{SERIAL}-{CHECKSUM}
 * Exemple : DPSMS-03-20271231-A79B-9E14
 */
export function generateSmsLicenseKey(optionsOrDate) {
  let expiryDateStr = '';
  let maxDevices = 3;

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
  }

  if (!expiryDateStr) {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 365);
    expiryDateStr = defaultDate.toISOString().slice(0, 10);
  }

  const cleanDate = expiryDateStr.replace(/-/g, '');
  const devCode = String(maxDevices || 3).padStart(2, '0').slice(0, 2);
  const randomSerial = (optionsOrDate?.serial || Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0')).slice(0, 4);
  const payloadToSign = `${devCode}${cleanDate}${randomSerial}`;
  const checksum = computeSmsChecksum(payloadToSign);

  return `DPSMS-${devCode}-${cleanDate}-${randomSerial}-${checksum}`;
}

/**
 * Vérifie la validité d'une clé de licence DocPocket SMS RDV
 */
export function verifySmsLicenseKey(key) {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'Veuillez saisir une clé de licence DocPocket SMS RDV.' };
  }

  const cleanKey = key.trim().toUpperCase();

  // 1. Clés maîtresses prédéfinies
  if (PREDEFINED_SMS_KEYS[cleanKey]) {
    const info = PREDEFINED_SMS_KEYS[cleanKey];
    const expiry = new Date(info.expiryDate + 'T23:59:59');
    const now = new Date();
    const isExpired = now > expiry;
    const daysRemaining = Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));

    if (isExpired) {
      return { valid: false, isExpired: true, error: `Cette clé DocPocket SMS RDV a expiré le ${info.expiryDate}.` };
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

  // 2. Format Algorithmique 5 blocs : DPSMS-{DEV}-{YYYYMMDD}-{SERIAL}-{CHECKSUM}
  const regexPro = /^DPSMS-(\d{2})-(\d{8})-([A-F0-9]{4})-([A-F0-9]{4})$/;
  const matchPro = cleanKey.match(regexPro);

  if (matchPro) {
    const devCode = matchPro[1];
    const dateStr = matchPro[2];
    const serial = matchPro[3];
    const checksum = matchPro[4];

    const expectedChecksum = computeSmsChecksum(`${devCode}${dateStr}${serial}`);
    if (checksum !== expectedChecksum) {
      return { valid: false, error: 'Signature de licence DocPocket SMS RDV invalide ou corrompue.' };
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
      return { valid: false, isExpired: true, error: `Cette licence DocPocket SMS RDV a expiré le ${formattedExpiry}.` };
    }

    return {
      valid: true,
      isLicensed: true,
      key: cleanKey,
      name: isLifetime ? 'Licence Permanente DocPocket SMS RDV' : `Licence DocPocket SMS RDV Pro (${daysRemaining} jours)`,
      expiryDate: formattedExpiry,
      maxDevices: maxDevNum === 99 ? 'Illimité' : maxDevNum,
      daysRemaining: isLifetime ? 'Illimité' : daysRemaining,
      isLifetime,
      type: 'commerciale'
    };
  }

  return {
    valid: false,
    error: 'Format de clé SMS inconnu. Format attendu : DPSMS-03-20271231-XXXX-XXXX ou DPSMS-2026-TRIAL'
  };
}

/**
 * Récupère le statut actuel de la licence DocPocket SMS RDV
 */
export function getSmsLicenseStatus() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { isLicensed: false, reason: 'DocPocket SMS RDV non activé' };
    }
    const data = JSON.parse(raw);
    const verification = verifySmsLicenseKey(data.key);

    if (!verification.valid) {
      return {
        isLicensed: false,
        isExpired: verification.isExpired,
        error: verification.error
      };
    }

    return {
      isLicensed: true,
      key: data.key,
      name: verification.name,
      clientName: data.clientName || '',
      expiryDate: verification.expiryDate,
      maxDevices: verification.maxDevices || data.maxDevices || 3,
      daysRemaining: verification.daysRemaining,
      activatedAt: data.activatedAt,
      isLifetime: verification.isLifetime,
      activatedFromPc: Boolean(data.activatedFromPc)
    };
  } catch (e) {
    console.warn('Erreur lecture licence SMS RDV:', e);
    return { isLicensed: false, reason: "Erreur d'intégrité de la licence DocPocket SMS RDV" };
  }
}

/**
 * Indique si DocPocket SMS RDV est activé et valide sur cet appareil
 */
export function isSmsRdvActivated() {
  const status = getSmsLicenseStatus();
  return Boolean(status && status.isLicensed);
}

/**
 * Active la licence DocPocket SMS RDV sur cet appareil
 */
export function activateSmsLicense(key, clientName = '', options = {}) {
  const verification = verifySmsLicenseKey(key);
  if (!verification.valid) {
    return verification;
  }

  const payload = {
    key: verification.key,
    name: verification.name,
    clientName: clientName || '',
    maxDevices: verification.maxDevices,
    activatedAt: new Date().toISOString(),
    expiryDate: verification.expiryDate,
    activatedFromPc: Boolean(options.fromPc)
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

  // Émettre un événement personnalisé pour rafraîchir l'interface immédiatement et déclencher la synchronisation Cloud
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('docpocket_sms_license_changed', { detail: payload }));
  }

  return {
    valid: true,
    isLicensed: true,
    message: '✓ DocPocket SMS RDV activé avec succès !',
    details: {
      ...verification,
      isLicensed: true
    }
  };
}

/**
 * Désactive la licence DocPocket SMS RDV
 */
export function deactivateSmsLicense() {
  localStorage.removeItem(STORAGE_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('docpocket_sms_license_changed', { detail: null }));
  }
  return { success: true, message: 'DocPocket SMS RDV désactivé.' };
}

/**
 * Synchronise l'état de la licence SMS vers le mobile (appelé par PC ou par le service de synchronisation)
 */
export function getSmsLicenseSyncPayload() {
  const status = getSmsLicenseStatus();
  if (!status || !status.isLicensed) return null;
  return {
    key: status.key,
    clientName: status.clientName,
    name: status.name,
    expiryDate: status.expiryDate,
    maxDevices: status.maxDevices,
    activatedAt: status.activatedAt,
    activatedOnPc: true
  };
}

/**
 * Active automatiquement DocPocket SMS RDV sur mobile si le PC est déjà activé
 */
export function autoActivateSmsOnMobile(smsPayload) {
  if (!smsPayload || !smsPayload.key) return false;

  const current = getSmsLicenseStatus();
  if (current.isLicensed && current.key === smsPayload.key) {
    return false; // Déjà activé avec la même clé
  }

  const res = activateSmsLicense(smsPayload.key, smsPayload.clientName, { fromPc: true });
  if (res.valid) {
    console.log("✓ DocPocket SMS RDV synchronisé et activé automatiquement depuis le PC");
    return true;
  }
  return false;
}
