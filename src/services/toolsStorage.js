/**
 * DocPocket Cabinet - Service de Gestion des Outils Médicaux
 * Gère le stockage et l'historique pour :
 * 1. DocPocket Mapa (Holter tensionnel 24h)
 * 2. MailPocket Pro (Messagerie médicale & résultats)
 * 3. DocPocket SMS RDV (Rappels de rendez-vous)
 * 4. DocPocket Scores (Calculateurs cliniques)
 */

import { getActivePractitionerId } from './practitionerService';
import { getActiveLicensePartitionId } from './licenseService';

const STORAGE_KEYS = {
  MAPA: 'docpocket_mapa_records_v1',
  MAIL_HISTORY: 'docpocket_mail_history_v1',
  MAIL_TEMPLATES: 'docpocket_mail_templates_v1',
  SMS_HISTORY: 'docpocket_sms_history_v1',
  SMS_TEMPLATES: 'docpocket_sms_templates_v1',
  SCORES_HISTORY: 'docpocket_scores_history_v1',
  ADDICTO_HISTORY: 'docpocket_addicto_records_v1'
};

function getKey(baseKey) {
  const partition = getActiveLicensePartitionId ? getActiveLicensePartitionId() : 'primary';
  const activeId = getActivePractitionerId();
  if (partition === 'primary' && (!activeId || activeId === 'primary')) return baseKey;
  const cleanPart = partition.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanId = (activeId || 'primary').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${baseKey}_${cleanPart}_${cleanId}`;
}

// ==========================================
// 1. DOCPOCKET MAPA
// ==========================================

export function getMapaRecords(patientId = null) {
  try {
    const raw = localStorage.getItem(getKey(STORAGE_KEYS.MAPA));
    const records = raw ? JSON.parse(raw) : [];
    if (patientId) {
      return records.filter(r => String(r.patientId) === String(patientId));
    }
    return records;
  } catch (e) {
    console.error('Erreur lecture enregistrements MAPA:', e);
    return [];
  }
}

export function saveMapaRecord(record) {
  try {
    const records = getMapaRecords();
    const existingIndex = records.findIndex(r => r.id === record.id);
    const enriched = {
      ...record,
      updatedAt: new Date().toISOString()
    };
    if (existingIndex >= 0) {
      records[existingIndex] = enriched;
    } else {
      enriched.id = enriched.id || 'mapa_' + Date.now();
      enriched.createdAt = enriched.createdAt || new Date().toISOString();
      records.unshift(enriched);
    }
    localStorage.setItem(getKey(STORAGE_KEYS.MAPA), JSON.stringify(records));
    return enriched;
  } catch (e) {
    console.error('Erreur sauvegarde MAPA:', e);
    return record;
  }
}

export function deleteMapaRecord(id) {
  try {
    const records = getMapaRecords().filter(r => r.id !== id);
    localStorage.setItem(getKey(STORAGE_KEYS.MAPA), JSON.stringify(records));
    return true;
  } catch (e) {
    console.error('Erreur suppression MAPA:', e);
    return false;
  }
}

/**
 * Génère un enregistrement type MAPA 24h pour démonstration / test clinique
 */
export function generateSampleMapaReadings(profile = 'dipper_normal') {
  const readings = [];
  // Période Diurne (07:00 -> 22:00) : mesures toutes les 30 min ou 1h
  const dayHours = [
    { time: '07:30', pas: 128, pad: 78, fc: 74, act: 'Réveil, petit-déjeuner' },
    { time: '08:30', pas: 132, pad: 82, fc: 78, act: 'Trajet travail' },
    { time: '09:30', pas: 126, pad: 80, fc: 72, act: 'Activité de bureau' },
    { time: '10:30', pas: 134, pad: 84, fc: 80, act: 'Réunion' },
    { time: '11:30', pas: 124, pad: 76, fc: 70, act: 'Calme' },
    { time: '12:30', pas: 130, pad: 80, fc: 76, act: 'Déjeuner' },
    { time: '13:30', pas: 122, pad: 75, fc: 68, act: 'Repos digestif' },
    { time: '14:30', pas: 128, pad: 79, fc: 72, act: 'Travail' },
    { time: '15:30', pas: 136, pad: 85, fc: 82, act: 'Stress modéré' },
    { time: '16:30', pas: 125, pad: 78, fc: 74, act: 'Activité normale' },
    { time: '17:30', pas: 129, pad: 81, fc: 75, act: 'Fin de journée' },
    { time: '18:30', pas: 131, pad: 82, fc: 79, act: 'Trajet retour' },
    { time: '19:30', pas: 126, pad: 78, fc: 71, act: 'Détente à domicile' },
    { time: '20:30', pas: 123, pad: 76, fc: 69, act: 'Dîner' },
    { time: '21:30', pas: 120, pad: 74, fc: 66, act: 'Télévision / Lecture' }
  ];

  // Période Nocturne (22:00 -> 07:00) : mesures toutes les heures
  let nightHours = [];
  if (profile === 'dipper_normal') {
    nightHours = [
      { time: '22:30', pas: 114, pad: 68, fc: 62, act: 'Coucher / Endormissement' },
      { time: '23:30', pas: 108, pad: 64, fc: 59, act: 'Sommeil' },
      { time: '00:30', pas: 105, pad: 62, fc: 58, act: 'Sommeil' },
      { time: '01:30', pas: 106, pad: 63, fc: 56, act: 'Sommeil' },
      { time: '02:30', pas: 102, pad: 60, fc: 55, act: 'Sommeil' },
      { time: '03:30', pas: 104, pad: 61, fc: 54, act: 'Sommeil' },
      { time: '04:30', pas: 107, pad: 63, fc: 57, act: 'Sommeil' },
      { time: '05:30', pas: 110, pad: 65, fc: 60, act: 'Sommeil' },
      { time: '06:30', pas: 118, pad: 72, fc: 68, act: 'Pré-réveil' }
    ];
  } else if (profile === 'non_dipper') {
    nightHours = [
      { time: '22:30', pas: 130, pad: 82, fc: 68, act: 'Coucher' },
      { time: '23:30', pas: 128, pad: 80, fc: 65, act: 'Sommeil' },
      { time: '00:30', pas: 127, pad: 81, fc: 64, act: 'Sommeil' },
      { time: '01:30', pas: 126, pad: 79, fc: 63, act: 'Sommeil' },
      { time: '02:30', pas: 125, pad: 78, fc: 62, act: 'Sommeil' },
      { time: '03:30', pas: 126, pad: 80, fc: 63, act: 'Sommeil' },
      { time: '04:30', pas: 128, pad: 82, fc: 65, act: 'Sommeil' },
      { time: '05:30', pas: 132, pad: 84, fc: 69, act: 'Sommeil' },
      { time: '06:30', pas: 135, pad: 86, fc: 74, act: 'Réveil' }
    ];
  } else {
    // Profil HTA globale
    nightHours = [
      { time: '22:30', pas: 135, pad: 85, fc: 70, act: 'Coucher' },
      { time: '23:30', pas: 132, pad: 84, fc: 68, act: 'Sommeil' },
      { time: '00:30', pas: 130, pad: 82, fc: 66, act: 'Sommeil' },
      { time: '01:30', pas: 129, pad: 81, fc: 65, act: 'Sommeil' },
      { time: '02:30', pas: 128, pad: 80, fc: 64, act: 'Sommeil' },
      { time: '03:30', pas: 130, pad: 82, fc: 65, act: 'Sommeil' },
      { time: '04:30', pas: 133, pad: 85, fc: 68, act: 'Sommeil' },
      { time: '05:30', pas: 138, pad: 88, fc: 72, act: 'Sommeil' },
      { time: '06:30', pas: 142, pad: 90, fc: 78, act: 'Réveil' }
    ];
  }

  return [...dayHours, ...nightHours];
}

// ==========================================
// 2. MAILPOCKET PRO
// ==========================================

export const DEFAULT_MAIL_TEMPLATES = [
  {
    id: 'bilan_bio',
    titre: 'Résultats de Bilan Biologique & Avis',
    objet: 'Cabinet Médical - Communication des résultats de votre bilan biologique',
    corps: `Bonjour,\n\nJ'ai bien pris connaissance des résultats de votre bilan biologique récent.\n\n[Insérer vos commentaires médicaux ici : ex. Bilan lipidique satisfaisant, glycémie à surveiller, etc.]\n\nLe traitement actuel est maintenu. En cas d'apparition de symptômes inhabituels, n'hésitez pas à reprendre contact avec le cabinet.\n\nBien confraternellement,\nDr. Hamed BEN KHALIFA`
  },
  {
    id: 'ordonnance',
    titre: 'Transmission d\'Ordonnance Médicale',
    objet: 'Cabinet Médical - Votre ordonnance médicale actualisée',
    corps: `Bonjour,\n\nVeuillez trouver ci-joint votre ordonnance médicale suite à notre dernière consultation.\n\nMerci de bien respecter la posologie indiquée et de renouveler vos examens de contrôle comme convenu.\n\nPrenez bien soin de vous,\nDr. Hamed BEN KHALIFA`
  },
  {
    id: 'adressage',
    titre: 'Courrier d\'Adressage Confrère Spécialiste',
    objet: 'Cabinet Médical - Courrier de liaison et adressage pour avis spécialisé',
    corps: `Cher(e) Confrère,\n\nJe vous adresse en consultation ce/cette patient(e) pour un avis spécialisé et prise en charge concernant :\n\n[Préciser le motif, antécédents marquants et traitement en cours]\n\nJe vous remercie par avance de votre prise en charge et de votre retour confraternel.\n\nBien amicalement et confraternellement,\nDr. Hamed BEN KHALIFA`
  },
  {
    id: 'imagerie',
    titre: 'Demande d\'Examens d\'Imagerie (Écho / Scanner / IRM)',
    objet: 'Cabinet Médical - Prescription d\'imagerie médicale',
    corps: `Madame, Monsieur,\n\nVeuillez trouver ci-joint la demande d'examen d'imagerie médicale à effectuer dans le centre de radiologie de votre choix.\n\nMerci de bien vouloir vous présenter en consultation de suivi avec les clichés et le compte-rendu radiologique dès réception.\n\nCordialement,\nDr. Hamed BEN KHALIFA`
  }
];

export function getMailHistory() {
  try {
    const raw = localStorage.getItem(getKey(STORAGE_KEYS.MAIL_HISTORY));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveMailLog(logEntry) {
  try {
    const history = getMailHistory();
    const entry = {
      ...logEntry,
      id: logEntry.id || 'mail_' + Date.now(),
      date: logEntry.date || new Date().toISOString()
    };
    history.unshift(entry);
    // Limite à 100 derniers envois
    if (history.length > 100) history.pop();
    localStorage.setItem(getKey(STORAGE_KEYS.MAIL_HISTORY), JSON.stringify(history));
    return entry;
  } catch (e) {
    console.error('Erreur journalisation email:', e);
    return logEntry;
  }
}

export function getMailTemplates() {
  try {
    const raw = localStorage.getItem(getKey(STORAGE_KEYS.MAIL_TEMPLATES));
    if (!raw) return DEFAULT_MAIL_TEMPLATES;
    const parsed = JSON.parse(raw);
    return parsed.length > 0 ? parsed : DEFAULT_MAIL_TEMPLATES;
  } catch (e) {
    return DEFAULT_MAIL_TEMPLATES;
  }
}

// ==========================================
// 3. DOCPOCKET SMS RDV
// ==========================================

export const DEFAULT_SMS_TEMPLATES = {
  fr: "Cabinet Médical : Bonjour {nom}, nous vous rappelons votre RDV le {date} à {heure}. En cas d'empêchement, merci de prévenir au cabinet.",
  ar: "العيادة الطبية : تذكير بموعدكم الطبي يوم {date} على الساعة {heure}. الرجاء الاتصال بالعيادة في حالة التعذر.",
  en: "Medical Clinic: Reminder for your appointment on {date} at {heure}. Please notify us in case of cancellation."
};

export function getSmsHistory() {
  try {
    const raw = localStorage.getItem(getKey(STORAGE_KEYS.SMS_HISTORY));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveSmsLog(logEntry) {
  try {
    const history = getSmsHistory();
    const entry = {
      ...logEntry,
      id: logEntry.id || 'sms_' + Date.now(),
      date: logEntry.date || new Date().toISOString()
    };
    history.unshift(entry);
    if (history.length > 150) history.pop();
    localStorage.setItem(getKey(STORAGE_KEYS.SMS_HISTORY), JSON.stringify(history));
    return entry;
  } catch (e) {
    console.error('Erreur journalisation SMS:', e);
    return logEntry;
  }
}

// ==========================================
// 4. DOCPOCKET SCORES
// ==========================================

export function getScoresHistory(patientId = null) {
  try {
    const raw = localStorage.getItem(getKey(STORAGE_KEYS.SCORES_HISTORY));
    const scores = raw ? JSON.parse(raw) : [];
    if (patientId) {
      return scores.filter(s => String(s.patientId) === String(patientId));
    }
    return scores;
  } catch (e) {
    return [];
  }
}

export function saveScoreRecord(scoreEntry) {
  try {
    const history = getScoresHistory();
    const entry = {
      ...scoreEntry,
      id: scoreEntry.id || 'score_' + Date.now(),
      date: scoreEntry.date || new Date().toISOString()
    };
    history.unshift(entry);
    if (history.length > 200) history.pop();
    localStorage.setItem(getKey(STORAGE_KEYS.SCORES_HISTORY), JSON.stringify(history));
    return entry;
  } catch (e) {
    console.error('Erreur sauvegarde score:', e);
    return scoreEntry;
  }
}

export function deleteScoreRecord(id) {
  try {
    const history = getScoresHistory().filter(s => s.id !== id);
    localStorage.setItem(getKey(STORAGE_KEYS.SCORES_HISTORY), JSON.stringify(history));
    return true;
  } catch (e) {
    return false;
  }
}

// ==========================================
// 5. DOCPOCKET ADDICTO (SCORES D'ADDICTIONS)
// ==========================================

export function getAddictoHistory(patientId = null) {
  try {
    const raw = localStorage.getItem(getKey(STORAGE_KEYS.ADDICTO_HISTORY));
    const records = raw ? JSON.parse(raw) : [];
    if (patientId) {
      return records.filter(r => String(r.patientId) === String(patientId));
    }
    return records;
  } catch (e) {
    return [];
  }
}

export function saveAddictoRecord(record) {
  try {
    const history = getAddictoHistory();
    const entry = {
      ...record,
      id: record.id || 'addicto_' + Date.now(),
      date: record.date || new Date().toISOString()
    };
    history.unshift(entry);
    if (history.length > 200) history.pop();
    localStorage.setItem(getKey(STORAGE_KEYS.ADDICTO_HISTORY), JSON.stringify(history));
    return entry;
  } catch (e) {
    console.error('Erreur sauvegarde addictologie:', e);
    return record;
  }
}

export function deleteAddictoRecord(id) {
  try {
    const history = getAddictoHistory().filter(r => r.id !== id);
    localStorage.setItem(getKey(STORAGE_KEYS.ADDICTO_HISTORY), JSON.stringify(history));
    return true;
  } catch (e) {
    return false;
  }
}
