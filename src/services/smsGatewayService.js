// ==============================================================
// DOCPOCKET CABINET - PASSERELLE DOCPOCKET SMS RDV
// INTERCONNEXION DIRECTE AVEC L'APPLICATION MOBILE ANDROID
// & LE CLOUD FIREBASE (docpocket-rdv) + API VERCEL CRON
// ==============================================================

import { isSmsRdvActivated, getSmsLicenseStatus, activateSmsLicense, deactivateSmsLicense } from './smsLicenseService.js';
import { getActivePractitioner } from './practitionerService.js';

// Configuration officielle du projet Cloud DocPocket SMS RDV
export const CLOUD_CONFIG = {
  projectId: 'docpocket-rdv',
  apiKey: 'AIzaSyBHfojIB8BfwbJpbpwLJMm2RhGKmUnS8M4',
  cronUrl: 'https://docpocket-sms-rdv.vercel.app/api/cron',
  firestoreBase: 'https://firestore.googleapis.com/v1/projects/docpocket-rdv/databases/(default)/documents',
  defaultDoctorId: 'hamed_ben_khalifa',
  defaultDoctorName: 'Hamed BEN KHALIFA'
};

const DEFAULT_LOCAL_GATEWAY_URL = 'http://localhost:3000/api/appointments';
const SMS_QUEUE_STORAGE_KEY = 'docpocket_sms_rdv_queue';
const DOCTOR_DEVICE_CACHE_KEY = 'docpocket_sms_doctor_device';

export function cleanDoctorDisplayName(rawName) {
  return String(rawName || '').trim().replace(/^(docteur|dr\.?)\s+/i, '').trim() || CLOUD_CONFIG.defaultDoctorName;
}

export function cleanDoctorId(rawName) {
  const clean = cleanDoctorDisplayName(rawName)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || CLOUD_CONFIG.defaultDoctorId;
}

function getTargetDoctorProfile() {
  try {
    const p = getActivePractitioner();
    if (p && (p.nom || p.prenom)) {
      const fullName = cleanDoctorDisplayName(`${p.prenom || ''} ${p.nom || ''}`);
      return { doctorId: cleanDoctorId(fullName), doctorName: fullName };
    }
  } catch {}
  return { doctorId: CLOUD_CONFIG.defaultDoctorId, doctorName: CLOUD_CONFIG.defaultDoctorName };
}

function formatDateDdMmYyyy(dateStr) {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();
  const iso = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (iso) {
    return `${iso[3].padStart(2, '0')}/${iso[2].padStart(2, '0')}/${iso[1]}`;
  }
  return clean;
}

// Récupère ou enregistre l'URL du serveur passerelle local
export function getGatewayUrl() {
  return localStorage.getItem('sms_gateway_url') || DEFAULT_LOCAL_GATEWAY_URL;
}

export function setGatewayUrl(url) {
  localStorage.setItem('sms_gateway_url', url);
}

/**
 * Récupère l'état et l'identifiant FCM du smartphone Android enregistré dans Firestore
 * Avec cache court (60s) et lecture unifiée sur devices/{doctorId} (sans doc parasite doctor_device).
 */
export async function fetchDoctorDeviceStatus(forceRefresh = false) {
  const target = getTargetDoctorProfile();

  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(DOCTOR_DEVICE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const age = Date.now() - (parsed.fetchedAt || 0);
        // Invalider immédiatement tout cache obsolète utilisant l'ancien ID dr_hamed_ben_khalifa
        if (parsed.doctorId === target.doctorId && age < 60000 && parsed.connected && parsed.fcmToken) {
          return parsed;
        }
      }
    } catch {}
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let data = null;
    const directUrl = `${CLOUD_CONFIG.firestoreBase}/devices/${encodeURIComponent(target.doctorId)}?key=${CLOUD_CONFIG.apiKey}`;
    const res = await fetch(directUrl, { signal: controller.signal });

    if (res.ok) {
      data = await res.json();
    } else {
      // Fallback : lister devices et trouver le profil correspondant
      const listRes = await fetch(`${CLOUD_CONFIG.firestoreBase}/devices?pageSize=50&key=${CLOUD_CONFIG.apiKey}`, { signal: controller.signal });
      if (listRes.ok) {
        const listJson = await listRes.json();
        const docs = listJson.documents || [];
        data = docs.find(d => d.name.endsWith('/' + target.doctorId))
          || docs.find(d => cleanDoctorId(d.fields?.doctorName?.stringValue || '') === target.doctorId)
          || docs[0]
          || null;
      }
    }
    clearTimeout(timeoutId);

    if (!data || !data.fields) {
      throw new Error('Aucun appareil enregistré dans Firestore');
    }

    const fields = data.fields || {};
    const resolvedName = cleanDoctorDisplayName(fields.doctorName?.stringValue || target.doctorName);
    const resolvedId = cleanDoctorId(fields.doctorId?.stringValue || resolvedName);
    const isLicensed = fields.isLicensed?.booleanValue !== false && fields.licenseActive?.booleanValue !== false;

    const status = {
      connected: true,
      doctorName: resolvedName,
      doctorId: resolvedId,
      deviceModel: fields.deviceModel?.stringValue || 'Android Smartphone',
      androidVersion: fields.androidVersion?.stringValue || 'Android',
      fcmToken: fields.fcmToken?.stringValue || '',
      isLicensed,
      licenseActive: isLicensed,
      licenseKey: fields.licenseKey?.stringValue || '',
      licenseActivatedAt: fields.licenseActivatedAt?.integerValue ? Number(fields.licenseActivatedAt.integerValue) : null,
      lastUpdated: fields.lastUpdated?.integerValue ? Number(fields.lastUpdated.integerValue) : Date.now(),
      fetchedAt: Date.now()
    };

    localStorage.setItem(DOCTOR_DEVICE_CACHE_KEY, JSON.stringify(status));
    return status;
  } catch (e) {
    console.warn("Utilisation du cache terminal DocPocket SMS RDV :", e.message);
    try {
      const cached = localStorage.getItem(DOCTOR_DEVICE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.doctorId && !String(parsed.doctorId).startsWith('dr_')) {
          return { ...parsed, connected: false, fromCache: true };
        }
      }
    } catch {}
    return {
      connected: false,
      doctorName: target.doctorName,
      doctorId: target.doctorId,
      deviceModel: 'INFINIX Infinix X6726B',
      androidVersion: '15',
      fcmToken: '',
      isLicensed: false,
      licenseActive: false,
      licenseKey: '',
      lastUpdated: Date.now()
    };
  }
}

/**
 * Synchronise le statut de licence avec Firestore (activation ou révocation à distance via le Keygen).
 */
export async function checkAndSyncCloudLicense() {
  try {
    const device = await fetchDoctorDeviceStatus();
    if (!device) return { synced: false, reason: "Aucun appareil détecté" };

    // Si le Cloud confirme explicitement que la licence est révoquée, bloquer aussi DocPocket Cab
    if (device.connected && (!device.isLicensed || !device.licenseActive)) {
      if (isSmsRdvActivated()) {
        deactivateSmsLicense();
      }
      return { synced: false, revoked: true, reason: "Licence révoquée depuis l'administration." };
    }

    const isMobileLicensed = Boolean(device.connected && device.isLicensed && device.licenseActive);
    if (isMobileLicensed) {
      const current = getSmsLicenseStatus();
      if (!current.isLicensed) {
        const key = device.licenseKey || 'DPSMS-PRO-2026';
        const res = activateSmsLicense(key, device.doctorName, { fromMobile: true, source: 'firebase_signal' });
        if (res.valid) {
          console.log(`✓ Signal Firebase reçu : DocPocket SMS RDV activé sur ${device.deviceModel} -> Déverrouillage automatique DocPocket Cab`);
          return {
            synced: true,
            autoActivated: true,
            doctorName: device.doctorName,
            deviceModel: device.deviceModel,
            key
          };
        }
      }
      return { synced: true, alreadyActive: true, deviceModel: device.deviceModel };
    }
    return { synced: false, reason: "En attente du signal d'activation sur smartphone" };
  } catch (err) {
    return { synced: false, error: err.message };
  }
}

/**
 * Publie le signal d'activation de la licence vers le profil unique du médecin dans Firestore
 */
export async function broadcastLicenseToCloud(doctorName, key) {
  try {
    const cleanName = cleanDoctorDisplayName(doctorName);
    const doctorId = cleanDoctorId(cleanName);
    const url = `${CLOUD_CONFIG.firestoreBase}/devices/${encodeURIComponent(doctorId)}?updateMask.fieldPaths=doctorId&updateMask.fieldPaths=doctorName&updateMask.fieldPaths=isLicensed&updateMask.fieldPaths=licenseActive&updateMask.fieldPaths=licenseKey&updateMask.fieldPaths=licenseActivatedAt&key=${CLOUD_CONFIG.apiKey}`;
    const payload = {
      fields: {
        doctorId: { stringValue: doctorId },
        doctorName: { stringValue: cleanName },
        isLicensed: { booleanValue: true },
        licenseActive: { booleanValue: true },
        licenseKey: { stringValue: key || 'DPSMS-PRO-2026' },
        licenseActivatedAt: { integerValue: String(Date.now()) }
      }
    };
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Récupère les rendez-vous en direct depuis la base Cloud Firestore docpocket-rdv
 */
export async function fetchCloudAppointments() {
  try {
    const url = `${CLOUD_CONFIG.firestoreBase}/rendezvous?key=${CLOUD_CONFIG.apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Erreur récupération Firestore: HTTP ${res.status}`);
    }

    const json = await res.json();
    const docs = json.documents || [];

    return docs.map(doc => {
      const fields = doc.fields || {};
      const docPath = doc.name || '';
      const docId = docPath.split('/').pop();

      return {
        id: docId,
        docPath,
        localId: fields.localId?.integerValue ? Number(fields.localId.integerValue) : 0,
        nomPatient: fields.nomPatient?.stringValue || 'Patient',
        telephone: fields.telephone?.stringValue || '',
        dateRdv: fields.dateRdv?.stringValue || '',
        heureRdv: fields.heureRdv?.stringValue || '',
        texteSms: fields.texteSms?.stringValue || '',
        smsEnvoye: fields.smsEnvoye?.booleanValue === true,
        sentAt: fields.sentAt?.integerValue ? Number(fields.sentAt.integerValue) : null,
        reminderTimestamp: fields.reminderTimestamp?.integerValue ? Number(fields.reminderTimestamp.integerValue) : 0,
        language: fields.language?.stringValue || 'fr',
        doctorId: fields.doctorId?.stringValue || '',
        doctorName: fields.doctorName?.stringValue || '',
        source: fields.source?.stringValue || 'docpocket_sms_rdv',
        createTime: doc.createTime,
        updateTime: doc.updateTime
      };
    }).sort((a, b) => {
      // Tri par date / heure décroissante
      const tA = a.reminderTimestamp || new Date(a.updateTime || 0).getTime();
      const tB = b.reminderTimestamp || new Date(b.updateTime || 0).getTime();
      return tB - tA;
    });
  } catch (e) {
    console.warn("Échec lecture Cloud Firestore docpocket-rdv:", e.message);
    return [];
  }
}

/**
 * Supprime une instruction de rendez-vous de la base Cloud Firestore docpocket-rdv
 * (Pont Éphémère : nettoie les instructions terminées pour garder le Cloud à 0 Mo)
 */
export async function deleteCloudAppointment(docId) {
  try {
    if (!docId) return false;
    const cleanId = String(docId).split('/').pop();
    const url = `${CLOUD_CONFIG.firestoreBase}/rendezvous/${cleanId}?key=${CLOUD_CONFIG.apiKey}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (res.ok) {
      console.log(`✓ Instruction éphémère purgée du Cloud docpocket-rdv : ${cleanId}`);
      return true;
    }
    return false;
  } catch (e) {
    console.warn("Échec suppression Firestore docpocket-rdv :", e.message);
    return false;
  }
}

/**
 * Purge en masse les instructions de rendez-vous déjà envoyées par SMS (smsEnvoye === true)
 * Maintient le quota Firestore Spark gratuit et évite l'accumulation inutile de données dans le Cloud.
 */
export async function purgeSentCloudAppointments(appointments = []) {
  try {
    const sentItems = appointments.filter(a => a.smsEnvoye === true);
    let successCount = 0;
    for (const item of sentItems) {
      if (item.id) {
        const ok = await deleteCloudAppointment(item.id);
        if (ok) successCount++;
      }
    }
    return {
      total: sentItems.length,
      purged: successCount,
      success: true
    };
  } catch (e) {
    console.error("Erreur purge Cloud DocPocket SMS RDV :", e);
    return { total: 0, purged: 0, success: false, error: e.message };
  }
}

/**
 * Récupère la file d'attente locale des rendez-vous
 */
export function getTransmittedAppointmentsQueue() {
  try {
    const raw = localStorage.getItem(SMS_QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Enregistre un rendez-vous dans la file d'attente locale
 */
export function recordTransmittedAppointment(appointment) {
  try {
    const queue = getTransmittedAppointmentsQueue();
    const entry = {
      id: appointment.id || `sms_rdv_${Date.now()}`,
      patientId: appointment.patientId || '',
      nomPatient: appointment.patientName || appointment.nomPatient || 'Patient',
      telephone: appointment.telephone || '',
      email: appointment.email || '',
      dateRdv: appointment.rdvDate || appointment.dateRdv,
      heureRdv: appointment.rdvTime || appointment.heureRdv,
      notes: appointment.notes || appointment.texteSms || '',
      language: appointment.language || 'fr',
      transmittedAt: new Date().toISOString(),
      smsSent: false,
      status: 'en_attente'
    };

    const existingIndex = queue.findIndex(item =>
      item.patientId === entry.patientId &&
      item.dateRdv === entry.dateRdv &&
      item.heureRdv === entry.heureRdv
    );

    if (existingIndex >= 0) {
      queue[existingIndex] = { ...queue[existingIndex], ...entry };
    } else {
      queue.unshift(entry);
    }

    if (queue.length > 200) queue.pop();
    localStorage.setItem(SMS_QUEUE_STORAGE_KEY, JSON.stringify(queue));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('docpocket_sms_queue_updated', { detail: queue }));
    }

    return entry;
  } catch (e) {
    console.error("Erreur enregistrement file locale DocPocket SMS RDV:", e);
    return null;
  }
}

/**
 * Marque un rendez-vous comme ayant reçu son SMS de rappel
 */
export function markAppointmentSmsSent(queueId) {
  try {
    const queue = getTransmittedAppointmentsQueue();
    const item = queue.find(it => String(it.id) === String(queueId));
    if (item) {
      item.smsSent = true;
      item.status = 'envoye';
      item.sentAt = new Date().toISOString();
      localStorage.setItem(SMS_QUEUE_STORAGE_KEY, JSON.stringify(queue));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('docpocket_sms_queue_updated', { detail: queue }));
      }
    }
  } catch (e) {
    console.error("Erreur mise à jour statut SMS:", e);
  }
}

/**
 * Formate le texte standard du SMS selon la langue (FR, AR, EN)
 */
export function buildSmsText(nomPatient, dateRdv, heureRdv, doctorName = CLOUD_CONFIG.defaultDoctorName, lang = 'fr') {
  const dateFormatted = formatDateDdMmYyyy(dateRdv);
  const cleanName = nomPatient || 'Cher Patient';
  const cleanDoc = cleanDoctorDisplayName(doctorName);

  if (lang === 'ar') {
    return `مرحباً ${cleanName} ، تذكير بموعدك الطبي يوم ${dateFormatted} على الساعة ${heureRdv} في عيادة الدكتور ${cleanDoc}.`;
  }
  if (lang === 'en') {
    return `Hello ${cleanName}, reminder for your medical appointment on ${dateFormatted} at ${heureRdv} at Dr ${cleanDoc}'s clinic.`;
  }
  return `Bonjour ${cleanName}, nous vous rappelons votre RDV médical le ${dateFormatted} à ${heureRdv} au cabinet du Dr ${cleanDoc}.`;
}

/**
 * Calcule l'horodatage d'échéance du rappel SMS (48 heures avant le RDV)
 */
export function calculateReminderEpochMs(dateRdv, heureRdv) {
  try {
    let y, m, d;
    if (dateRdv.includes('/')) {
      const parts = dateRdv.split('/');
      d = Number(parts[0]);
      m = Number(parts[1]) - 1;
      y = Number(parts[2]);
    } else {
      const parts = dateRdv.split('-');
      y = Number(parts[0]);
      m = Number(parts[1]) - 1;
      d = Number(parts[2]);
    }

    const [hh, mm] = (heureRdv || '10:00').split(':').map(Number);
    const rdvDate = new Date(y, m, d, hh || 10, mm || 0, 0);

    // Rappel 48h avant
    const reminderDate = new Date(rdvDate.getTime() - (48 * 3600 * 1000));
    return reminderDate.getTime();
  } catch (e) {
    return Date.now();
  }
}

/**
 * Transmet un rendez-vous vers l'application DocPocket SMS RDV (Cloud Firestore + Vercel + Passerelle Locale)
 * CONDITION STRICTE : DocPocket SMS RDV doit être activé par sa propre licence.
 * Si non activé : le rendez-vous reste dans DocPocket Cab uniquement.
 */
export async function transmitAppointmentToMobile(appointment, options = {}) {
  // 1. VÉRIFICATION STRICTE DE LA LICENCE DOCPOCKET SMS RDV
  if (!isSmsRdvActivated()) {
    console.info("ℹ️ DocPocket SMS RDV non activé : le rendez-vous reste dans DocPocket Cab uniquement.");
    return {
      success: false,
      notActivated: true,
      message: "DocPocket SMS RDV n'est pas activé. Le rendez-vous reste uniquement dans DocPocket Cab."
    };
  }

  const forceImmediate = Boolean(options.forceImmediate || appointment.forceImmediate);

  // 2. Enregistrement immédiat dans la file locale DocPocket Cab
  const queuedEntry = recordTransmittedAppointment(appointment);

  // 3. Récupération des infos fraîches du smartphone Android depuis Firestore
  const device = await fetchDoctorDeviceStatus(true);
  if (device.connected && (!device.isLicensed || !device.licenseActive)) {
    return {
      success: false,
      revoked: true,
      message: "Licence DocPocket SMS RDV révoquée. Impossible d'envoyer le rappel."
    };
  }
  const doctorName = cleanDoctorDisplayName(device.doctorName || CLOUD_CONFIG.defaultDoctorName);
  const doctorId = cleanDoctorId(device.doctorId || doctorName);
  const fcmToken = device.fcmToken || '';

  const nomPatient = appointment.patientName || appointment.nomPatient || 'Patient';
  const telephone = (appointment.telephone || '').replace(/\s+/g, '');
  const dateRdv = formatDateDdMmYyyy(appointment.rdvDate || appointment.dateRdv);
  const heureRdv = appointment.rdvTime || appointment.heureRdv || '10:00';
  const language = appointment.language || 'fr';
  const texteSms = appointment.texteSms || buildSmsText(nomPatient, dateRdv, heureRdv, doctorName, language);
  
  // Si forceImmediate : horodatage immédiat dans le passé pour déclenchement FCM sans délai
  const reminderTimestamp = forceImmediate ? (Date.now() - 5000) : calculateReminderEpochMs(dateRdv, heureRdv);

  let cloudSuccess = false;
  let cloudDocId = null;

  // 4. ÉCRITURE DIRECTE DANS LA BASE FIRESTORE DU PROJET docpocket-rdv
  try {
    const firestoreUrl = `${CLOUD_CONFIG.firestoreBase}/rendezvous?key=${CLOUD_CONFIG.apiKey}`;
    const payload = {
      fields: {
        nomPatient: { stringValue: nomPatient },
        telephone: { stringValue: telephone },
        dateRdv: { stringValue: dateRdv },
        heureRdv: { stringValue: heureRdv },
        texteSms: { stringValue: texteSms },
        language: { stringValue: language },
        smsEnvoye: { booleanValue: false },
        doctorId: { stringValue: doctorId },
        doctorName: { stringValue: doctorName },
        targetFcmToken: { stringValue: fcmToken },
        reminderTimestamp: { integerValue: String(reminderTimestamp) },
        localId: { integerValue: String(appointment.id || Date.now() % 100000) },
        source: { stringValue: 'docpocket_cab' },
        updatedAt: { integerValue: String(Date.now()) }
      }
    };

    const fsResponse = await fetch(firestoreUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (fsResponse.ok) {
      const fsData = await fsResponse.json();
      cloudDocId = fsData.name?.split('/').pop();
      cloudSuccess = true;
      console.log(`✓ RDV synchronisé avec succès sur le Cloud DocPocket SMS RDV : ${cloudDocId}`);
    } else {
      console.warn("Échec écriture Firestore REST :", await fsResponse.text());
    }
  } catch (err) {
    console.warn("Erreur transmission Cloud Firestore docpocket-rdv :", err.message);
  }

  // 5. Déclenchement de l'API Vercel Cron de réveil si le rappel est dû immédiatement (ou dans les 2 min)
  const now = Date.now();
  const isImmediate = forceImmediate || reminderTimestamp <= (now + 120000);
  let cronResult = null;
  if (isImmediate) {
    try {
      const cRes = await fetch(CLOUD_CONFIG.cronUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (cRes.ok) {
        cronResult = await cRes.json();
        console.log("✓ Vercel Cron déclenché avec succès :", cronResult);
      }
    } catch (cErr) {
      console.warn("Avertissement appel Cron Vercel :", cErr.message);
      // Déclenchement de secours en mode no-cors pour garantir le réveil Vercel sans exception réseau
      try {
        await fetch(CLOUD_CONFIG.cronUrl, { method: 'GET', mode: 'no-cors' });
      } catch {}
    }
  }

  // 6. Transmission de secours vers le serveur passerelle local (port 3000 / Wi-Fi Cabinet)
  let localServerSuccess = false;
  try {
    const localUrl = getGatewayUrl();
    const localPayload = {
      id: queuedEntry?.id || appointment.id,
      nomPatient,
      telephone,
      email: appointment.email || '',
      dateRdv,
      heureRdv,
      texteSms,
      language,
      reminderHours: forceImmediate ? 0 : 48,
      synced: cloudSuccess,
      smsEnvoye: false,
      timestamp: Date.now()
    };

    const locResponse = await fetch(localUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(localPayload)
    });
    if (locResponse.ok) {
      localServerSuccess = true;
    }
  } catch (err) {
    // Le serveur local est optionnel si le Cloud est actif
  }

  return {
    success: cloudSuccess || localServerSuccess,
    cloudDocId,
    cloudSuccess,
    localServerSuccess,
    isImmediate,
    forceImmediate,
    cronResult,
    queuedEntry,
    deviceModel: device.deviceModel,
    message: cloudSuccess 
      ? `✓ RDV transmis à DocPocket SMS RDV (Synchronisé avec votre smartphone ${device.deviceModel}).`
      : `✓ RDV enregistré dans DocPocket SMS RDV (en attente de synchronisation).`
  };
}

/**
 * Déclenche un envoi SMS immédiat via le smartphone Android (Infinix)
 * Transmet l'instruction au pont éphémère Firestore et réveille l'app via Vercel Cron
 */
export async function triggerInstantSmsPush(appointment) {
  try {
    const res = await transmitAppointmentToMobile({
      ...appointment,
      rdvDate: appointment.dateRdv || appointment.rdvDate || new Date().toISOString().slice(0, 10),
      rdvTime: appointment.heureRdv || appointment.rdvTime || '10:00'
    }, { forceImmediate: true });

    const isOk = Boolean(res && (res.cloudSuccess || res.success));
    return {
      success: isOk,
      cloudDocId: res?.cloudDocId,
      cronResult: res?.cronResult,
      deviceModel: res?.deviceModel,
      message: isOk
        ? `✓ Ordre SMS transmis avec succès ! Le réveil a été expédié à votre smartphone Infinix.`
        : (res?.message || "Ordre SMS enregistré en local.")
    };
  } catch (e) {
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Teste la connexion avec le Cloud DocPocket SMS RDV et le smartphone
 */
export async function testGatewayConnection() {
  try {
    const device = await fetchDoctorDeviceStatus();
    return device.connected || Boolean(device.fcmToken);
  } catch {
    return false;
  }
}
