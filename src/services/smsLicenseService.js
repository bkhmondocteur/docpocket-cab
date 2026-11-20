// ==============================================================
// DOCPOCKET SMS RDV - GESTION DU SYSTÈME DE LICENCE DÉDIÉ
// MODULE PASSERELLE SMS & RAPPELS DE RENDEZ-VOUS AUTOMATISÉS
// ==============================================================

const STORAGE_KEY = 'docpocket_sms_rdv_license';
const LICENSE_SALT = 'DOCPOCKET_SMS_RDV_SECURITY_SALT_2026';
const MOBILE_SECRET_SALT = typeof atob === 'function' ? atob('TUVEV0lOX1NFQ18yMDI2') : Buffer.from('TUVEV0lOX1NFQ18yMDI2', 'base64').toString('utf8');
const TRIAL_CACHE_KEY = 'docpocket_sms_generated_trial';

// Clés maîtresses et de démonstration pour DocPocket SMS RDV
const PREDEFINED_SMS_KEYS = {
  'DPSMS-2026-TRIAL': {
    name: "Licence d'Évaluation DocPocket SMS RDV (30 Jours)",
    expiryDate: '2026-12-31',
    maxDevices: 3,
    type: 'provisoire'
  },
  'DPSMS-TRIAL-2M': {
    name: "Licence Test DocPocket SMS RDV (2 Mois)",
    expiryDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 60);
      return d.toISOString().slice(0, 10);
    })(),
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
 * Calcule le condensat MD5 d'une chaîne
 */
function calculateMd5(str) {
  function rhex(n) {
    let s = '', hex_chr = '0123456789abcdef'.split('');
    for (let j = 0; j < 4; j++) s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
    return s;
  }
  function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
  function cmn(q, a, b, x, s, t) { a = add32(add32(a, q), add32(x, t)); return add32((a << s) | (a >>> (32 - s)), b); }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
  function cycle(x, k) {
    let a = x[0], b = x[1], c = x[2], d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586); c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426); c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417); c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101); c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632); c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083); c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690); c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784); c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463); c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353); c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222); c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835); c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415); c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606); c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744); c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379); c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
  }
  function blk(s) {
    let md = [], i;
    for (i = 0; i < 64; i += 4) md[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    return md;
  }
  function core(s) {
    let n = s.length, st = [1732584193, -271733879, -1732584194, 271733878], i;
    for (i = 64; i <= s.length; i += 64) cycle(st, blk(s.substring(i - 64, i)));
    s = s.substring(i - 64);
    let t = [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
    for (i = 0; i < s.length; i++) t[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    t[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) { cycle(st, t); for (i = 0; i < 16; i++) t[i] = 0; }
    t[14] = n * 8;
    cycle(st, t);
    return st;
  }
  const txt = unescape(encodeURIComponent(str));
  const res = core(txt);
  return (rhex(res[0]) + rhex(res[1]) + rhex(res[2]) + rhex(res[3])).toUpperCase();
}

/**
 * Génère une clé de test 2 mois (60 jours) compatible avec le smartphone Android DocPocket SMS RDV
 */
export function generateMobileSmsTrialKey(doctorName = 'DR HAMED BEN KHALIFA', durationDays = 60) {
  const cleanName = (doctorName || 'DR HAMED BEN KHALIFA').trim().toUpperCase();
  const raw = cleanName + MOBILE_SECRET_SALT;
  const hash = calculateMd5(raw);
  const keyBase = hash.slice(0, 16);
  const mobileKey = `${keyBase.slice(0, 4)}-${keyBase.slice(4, 8)}-${keyBase.slice(8, 12)}-${keyBase.slice(12, 16)}`;
  
  const exp = new Date();
  exp.setDate(exp.getDate() + durationDays);
  const expiryDate = exp.toISOString().slice(0, 10);
  const dpsmsKey = generateSmsLicenseKey({ durationDays, expiryDate });

  const trialInfo = {
    doctorName: cleanName,
    mobileKey,
    dpsmsKey,
    durationDays,
    expiryDate,
    createdAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(TRIAL_CACHE_KEY, JSON.stringify(trialInfo));
  } catch {}

  return trialInfo;
}

export function getLastGeneratedTrialKey() {
  try {
    const raw = localStorage.getItem(TRIAL_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

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

  // 3. Format Mobile Android 4 blocs : XXXX-XXXX-XXXX-XXXX (Clé Test 2 Mois)
  const regexMobile = /^([A-F0-9]{4})-([A-F0-9]{4})-([A-F0-9]{4})-([A-F0-9]{4})$/;
  const matchMobile = cleanKey.match(regexMobile);
  if (matchMobile) {
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 60);
    const expiryStr = defaultExpiry.toISOString().slice(0, 10);
    return {
      valid: true,
      isLicensed: true,
      key: cleanKey,
      name: "Licence Test DocPocket SMS RDV (2 Mois)",
      expiryDate: expiryStr,
      maxDevices: 3,
      daysRemaining: 60,
      isLifetime: false,
      type: 'test_2_mois'
    };
  }

  return {
    valid: false,
    error: 'Format de clé SMS inconnu. Format attendu : DPSMS-03-20271231-XXXX-XXXX, XXXX-XXXX-XXXX-XXXX ou DPSMS-2026-TRIAL'
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
