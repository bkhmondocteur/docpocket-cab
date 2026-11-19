// ==============================================================
// DOCPOCKET CABINET - PASSERELLE DOCPOCKET SMS RDV
// GESTION DE LA TRANSMISSION DES RENDEZ-VOUS VERS LE SMARTPHONE
// ==============================================================

import { isSmsRdvActivated, getSmsLicenseStatus } from './smsLicenseService.js';

const DEFAULT_GATEWAY_URL = 'http://localhost:3000/api/appointments';
const SMS_QUEUE_STORAGE_KEY = 'docpocket_sms_rdv_queue';

// Récupère ou enregistre l'URL du serveur passerelle (configurable dans les paramètres)
export function getGatewayUrl() {
  return localStorage.getItem('sms_gateway_url') || DEFAULT_GATEWAY_URL;
}

export function setGatewayUrl(url) {
  localStorage.setItem('sms_gateway_url', url);
}

/**
 * Récupère la file d'attente des rendez-vous transmis à DocPocket SMS RDV
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
 * Enregistre un rendez-vous dans la file d'attente DocPocket SMS RDV
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
      status: 'en_attente' // 'en_attente' | 'envoye' | 'erreur'
    };

    // Éviter les doublons
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
    console.error("Erreur enregistrement file DocPocket SMS RDV:", e);
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
 * Envoie un rendez-vous vers le serveur de synchronisation mobile (DocPocket SMS RDV).
 * CONDITION STRICTE : DocPocket SMS RDV doit être activé par sa propre licence.
 * Si non activé : le rendez-vous reste dans DocPocket Cab uniquement.
 */
export async function transmitAppointmentToMobile(appointment) {
  // 1. VÉRIFICATION STRICTE DE LA LICENCE DOCPOCKET SMS RDV
  if (!isSmsRdvActivated()) {
    console.info("ℹ️ DocPocket SMS RDV non activé : le rendez-vous est conservé dans DocPocket Cab uniquement.");
    return {
      success: false,
      notActivated: true,
      message: "DocPocket SMS RDV n'est pas activé. Le rendez-vous reste uniquement dans DocPocket Cab."
    };
  }

  // 2. Enregistrement immédiat dans la file locale DocPocket SMS RDV
  const queuedEntry = recordTransmittedAppointment(appointment);

  // 3. Transmission HTTP vers le serveur passerelle local (port 3000 / mobile Wi-Fi)
  const url = getGatewayUrl();
  const payload = {
    id: queuedEntry?.id || appointment.id,
    nomPatient: appointment.patientName,
    telephone: appointment.telephone || '',
    email: appointment.email || '',
    dateRdv: appointment.rdvDate,     // Format YYYY-MM-DD
    heureRdv: appointment.rdvTime,    // Format HH:MM
    texteSms: appointment.notes || '',
    language: appointment.language || 'fr',
    reminderHours: 48,               // Rappel automatique 48h avant
    synced: false,
    smsEnvoye: false,
    emailEnvoye: false,
    timestamp: Date.now()
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Erreur serveur passerelle (Code HTTP: ${response.status})`);
    }

    const result = await response.json();
    return { success: true, id: result.id, data: result.data, queued: true };
  } catch (err) {
    // Si le serveur passerelle local n'est pas encore démarré, la file d'attente locale conserve le RDV
    console.warn("Passerelle locale en attente : RDV placé en file d'attente DocPocket SMS RDV :", err.message);
    return {
      success: true,
      queuedLocally: true,
      message: "RDV transmis à DocPocket SMS RDV (en attente de synchronisation Wi-Fi avec le smartphone)."
    };
  }
}

/**
 * Teste si le serveur passerelle DocPocket SMS RDV est actif
 */
export async function testGatewayConnection() {
  const url = getGatewayUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok;
  } catch (e) {
    return false;
  }
}
