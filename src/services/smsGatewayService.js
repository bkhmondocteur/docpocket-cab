// Service de passerelle vers le smartphone via le serveur local DocPocket SMS RDV
const DEFAULT_GATEWAY_URL = 'http://localhost:3000/api/appointments';

// Récupère ou enregistre l'URL du serveur passerelle (configurable dans les paramètres)
export function getGatewayUrl() {
  return localStorage.getItem('sms_gateway_url') || DEFAULT_GATEWAY_URL;
}

export function setGatewayUrl(url) {
  localStorage.setItem('sms_gateway_url', url);
}

/**
 * Envoie un rendez-vous vers le serveur de synchronisation mobile (DocPocket SMS RDV).
 * L'application mobile DocPocket connectée en Wi-Fi récupérera ce rendez-vous 
 * et déclenchera les SMS / Emails de rappel programmés 48h avant.
 */
export async function transmitAppointmentToMobile(appointment) {
  const url = getGatewayUrl();

  const payload = {
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
    return { success: true, id: result.id, data: result.data };
  } catch (err) {
    console.warn("Passerelle DocPocket SMS locale inactive ou injoignable :", err.message);
    return { success: false, error: err.message };
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
