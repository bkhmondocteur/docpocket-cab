// ==============================================================
// DOCPOCKET CABINET - PASSERELLE DOCPOCKET SMS RDV
// INTERCONNEXION DIRECTE AVEC L'APPLICATION MOBILE ANDROID
// & LE CLOUD FIREBASE (docpocket-rdv) + API VERCEL CRON
// ==============================================================

import { isSmsRdvActivated, getSmsLicenseStatus } from './smsLicenseService.js';

// Configuration officielle du projet Cloud DocPocket SMS RDV
export const CLOUD_CONFIG = {
  projectId: 'docpocket-rdv',
  apiKey: 'AIzaSyBHfojIB8BfwbJpbpwLJMm2RhGKmUnS8M4',
  cronUrl: 'https://docpocket-sms-rdv.vercel.app/api/cron',
  firestoreBase: 'https://firestore.googleapis.com/v1/projects/docpocket-rdv/databases/(default)/documents',
  defaultDoctorId: 'dr_hamed_ben_khalifa',
  defaultDoctorName: 'DR HAMED BEN KHALIFA'
};

const DEFAULT_LOCAL_GATEWAY_URL = 'http://localhost:3000/api/appointments';
const SMS_QUEUE_STORAGE_KEY = 'docpocket_sms_rdv_queue';
const DOCTOR_DEVICE_CACHE_KEY = 'docpocket_sms_doctor_device';

// Récupère ou enregistre l'URL du serveur passerelle local
export function getGatewayUrl() {
  return localStorage.getItem('sms_gateway_url') || DEFAULT_LOCAL_GATEWAY_URL;
}

export function setGatewayUrl(url) {
  localStorage.setItem('sms_gateway_url', url);
}

/**
 * Récupère l'état et l'identifiant FCM du smartphone Android (Infinix) enregistré dans Firestore
 */
export async function fetchDoctorDeviceStatus() {
  try {
    const url = `${CLOUD_CONFIG.firestoreBase}/devices/doctor_device?key=${CLOUD_CONFIG.apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Erreur Firestore devices: HTTP ${res.status}`);
    }

    const data = await res.json();
    const fields = data.fields || {};

    const status = {
      connected: true,
      doctorName: fields.doctorName?.stringValue || CLOUD_CONFIG.defaultDoctorName,
      doctorId: fields.doctorId?.stringValue || CLOUD_CONFIG.defaultDoctorId,
      deviceModel: fields.deviceModel?.stringValue || 'Android Smartphone',
      androidVersion: fields.androidVersion?.stringValue || 'Android',
      fcmToken: fields.fcmToken?.stringValue || '',
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
        return { ...JSON.parse(cached), connected: false, fromCache: true };
      }
    } catch {}
    return {
      connected: false,
      doctorName: CLOUD_CONFIG.defaultDoctorName,
      doctorId: CLOUD_CONFIG.defaultDoctorId,
      deviceModel: 'INFINIX Infinix X6726B',
      androidVersion: '15',
      fcmToken: '',
      lastUpdated: Date.now()
    };
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
export function buildSmsText(nomPatient, dateRdv, heureRdv, doctorName = 'Dr. Hamed BEN KHALIFA', lang = 'fr') {
  let dateFormatted = dateRdv;
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateRdv)) {
      const [y, m, d] = dateRdv.split('-');
      dateFormatted = `${d}/${m}/${y}`;
    }
  } catch {}

  const cleanName = nomPatient || 'Cher Patient';

  if (lang === 'ar') {
    return `مرحباً ${cleanName} ، تذكير بموعدك الطبي يوم ${dateFormatted} على الساعة ${heureRdv} في عيادة الدكتور ${doctorName}.`;
  }
  if (lang === 'en') {
    return `Hello ${cleanName}, reminder for your medical appointment on ${dateFormatted} at ${heureRdv} at ${doctorName}'s clinic.`;
  }
  return `Bonjour ${cleanName}, nous vous rappelons votre RDV médical le ${dateFormatted} à ${heureRdv} au cabinet du ${doctorName}.`;
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
export async function transmitAppointmentToMobile(appointment) {
  // 1. VÉRIFICATION STRICTE DE LA LICENCE DOCPOCKET SMS RDV
  if (!isSmsRdvActivated()) {
    console.info("ℹ️ DocPocket SMS RDV non activé : le rendez-vous reste dans DocPocket Cab uniquement.");
    return {
      success: false,
      notActivated: true,
      message: "DocPocket SMS RDV n'est pas activé. Le rendez-vous reste uniquement dans DocPocket Cab."
    };
  }

  // 2. Enregistrement immédiat dans la file locale DocPocket Cab
  const queuedEntry = recordTransmittedAppointment(appointment);

  // 3. Récupération des infos du smartphone Android (Infinix)
  const device = await fetchDoctorDeviceStatus();
  const doctorName = device.doctorName || CLOUD_CONFIG.defaultDoctorName;
  const doctorId = device.doctorId || CLOUD_CONFIG.defaultDoctorId;
  const fcmToken = device.fcmToken || '';

  const nomPatient = appointment.patientName || appointment.nomPatient || 'Patient';
  const telephone = (appointment.telephone || '').replace(/\s+/g, '');
  const dateRdv = appointment.rdvDate || appointment.dateRdv;
  const heureRdv = appointment.rdvTime || appointment.heureRdv || '10:00';
  const language = appointment.language || 'fr';
  const texteSms = appointment.notes || appointment.texteSms || buildSmsText(nomPatient, dateRdv, heureRdv, doctorName, language);
  const reminderTimestamp = calculateReminderEpochMs(dateRdv, heureRdv);

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

  // 5. Déclenchement de l'API Vercel Cron de réveil si le rappel est dû immédiatement
  const now = Date.now();
  if (reminderTimestamp <= (now + 60000)) {
    try {
      fetch(CLOUD_CONFIG.cronUrl).catch(() => {});
    } catch {}
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
      reminderHours: 48,
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
    success: true,
    cloudSuccess,
    localServerSuccess,
    cloudDocId,
    deviceModel: device.deviceModel,
    message: cloudSuccess 
      ? `✓ RDV transmis à DocPocket SMS RDV (Synchronisé avec votre smartphone ${device.deviceModel}).`
      : `✓ RDV enregistré dans DocPocket SMS RDV (en attente de synchronisation).`
  };
}

/**
 * Déclenche un envoi SMS immédiat via le smartphone Android
 */
export async function triggerInstantSmsPush(appointment) {
  try {
    const res = await transmitAppointmentToMobile({
      ...appointment,
      // Date/heure actuelles pour forcer le déclenchement immédiat
      rdvDate: appointment.dateRdv || new Date().toISOString().slice(0, 10),
      rdvTime: appointment.heureRdv || '10:00'
    });

    // Appel direct au cron Vercel pour expédier immédiatement
    const cronRes = await fetch(CLOUD_CONFIG.cronUrl);
    const cronData = await cronRes.json();

    return {
      success: true,
      cronData,
      message: "Signal de réveil et ordre d'envoi SMS transmis à votre smartphone Infinix !"
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
