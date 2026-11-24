// ==============================================================
// DOCPOCKET CABINET - SERVICE DE SURVEILLANCE DES ÉCHÉANCES CNAM (2 MOIS)
// RÈGLE : Toute consultation > 2 mois le jour du dépôt est rejetée et impayée.
// NOTIFICATION : J-10 à J-5 (Jaune) -> J-4 à J-3 (Orange) -> J-2 à J-0 (Rouge)
// DISPARITION : Clic sur "Bordereau livré à la CNAM" & Archivage.
// ==============================================================

import { saveBordereau } from './patientStorage.js';

/**
 * Analyse et convertit une chaîne de date en objet Date valide.
 * Supporte : YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, ISO strings.
 */
export function parseDateSafe(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
  }

  const str = String(dateInput).trim();
  // Format DD/MM/YYYY ou DD-MM-YYYY
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(str)) {
    const parts = str.split(/[\/\-]/);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }

  // Format YYYY-MM-DD
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(str)) {
    const parts = str.split(/[\/\-]/);
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  return null;
}

/**
 * Formate une date en JJ/MM/AAAA
 */
export function formatDateFr(date) {
  if (!date) return '';
  const d = parseDateSafe(date);
  if (!d) return String(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Calcule l'échéance des 2 mois pour un bordereau CNAM et détermine le niveau d'alerte.
 * Règle CNAM : 60 jours calendrier (ou 2 mois) à compter de la date de la première consultation.
 */
export function calculateBordereauCnamDeadline(bordereau) {
  if (!bordereau) {
    return { isAlertActive: false, alertLevel: 'none', daysRemaining: 999 };
  }

  // Si le bordereau a déjà été livré à la CNAM, déposé ou archivé -> Aucune alerte requise
  const isDelivered = Boolean(
    bordereau.livreCnam || 
    bordereau.archive || 
    bordereau.statut === 'depose' || 
    bordereau.statut === 'regle' ||
    bordereau.statut === 'archive' ||
    bordereau.dateDepot
  );

  if (isDelivered) {
    return {
      isAlertActive: false,
      isDelivered: true,
      alertLevel: 'none',
      daysRemaining: 999
    };
  }

  // Identifier la date de la plus ancienne consultation dans le bordereau
  let earliestDate = null;
  let earliestPatient = null;
  let earliestActe = null;

  if (Array.isArray(bordereau.lignes) && bordereau.lignes.length > 0) {
    bordereau.lignes.forEach(l => {
      const d = parseDateSafe(l.date);
      if (d) {
        if (!earliestDate || d < earliestDate) {
          earliestDate = d;
          earliestPatient = l.patientName || 'Patient';
          earliestActe = l.nomActe || l.codeActe || 'Consultation';
        }
      }
    });
  }

  // Si aucune ligne n'a pu fournir de date, se rabattre sur periodeDebut puis dateCreation
  if (!earliestDate && bordereau.periodeDebut) {
    earliestDate = parseDateSafe(bordereau.periodeDebut);
  }
  if (!earliestDate && bordereau.dateCreation) {
    earliestDate = parseDateSafe(bordereau.dateCreation);
  }

  // Si aucune date trouvée, impossible de calculer l'échéance
  if (!earliestDate) {
    return { isAlertActive: false, alertLevel: 'none', daysRemaining: 999 };
  }

  // Échéance exacte des 2 mois CNAM (60 jours calendaires stricts)
  const deadlineDate = new Date(earliestDate.getTime() + (60 * 24 * 60 * 60 * 1000));
  
  // Date du jour à minuit
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Nombre de jours restants jusqu'à l'échéance de 2 mois
  const diffTime = deadlineDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Nombre de jours écoulés depuis la première consultation
  const daysElapsed = Math.floor((today.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24));

  // Détermination du palier d'alerte conformément à la demande exacte :
  // - De J-10 à J-5 : Infobulle Jaune
  // - De J-4 à J-3 : Infobulle Orange
  // - De J-2 à J-0 : Infobulle Rouge
  // - J < 0 : Dépassé / Forclos (Rouge critique clignotant)
  let alertLevel = 'none';
  let badgeLabel = '';
  let colorTheme = {};

  if (daysRemaining > 10) {
    alertLevel = 'none';
  } else if (daysRemaining >= 5 && daysRemaining <= 10) {
    alertLevel = 'yellow';
    badgeLabel = `J-${daysRemaining}`;
    colorTheme = {
      bg: 'linear-gradient(135deg, rgba(161, 98, 7, 0.95) 0%, rgba(133, 77, 14, 0.95) 100%)',
      border: '#eab308',
      text: '#fef08a',
      badgeBg: '#facc15',
      badgeText: '#713f12',
      glow: '0 0 15px rgba(234, 179, 8, 0.45)',
      levelLabel: 'Avertissement CNAM (J-10 à J-5)',
      icon: '🟡'
    };
  } else if (daysRemaining >= 3 && daysRemaining <= 4) {
    alertLevel = 'orange';
    badgeLabel = `J-${daysRemaining}`;
    colorTheme = {
      bg: 'linear-gradient(135deg, rgba(194, 65, 12, 0.95) 0%, rgba(154, 52, 18, 0.95) 100%)',
      border: '#f97316',
      text: '#ffedd5',
      badgeBg: '#fb923c',
      badgeText: '#7c2d12',
      glow: '0 0 20px rgba(249, 115, 22, 0.55)',
      levelLabel: 'Vigilance CNAM Renforcée (J-4 à J-3)',
      icon: '🟠'
    };
  } else if (daysRemaining >= 0 && daysRemaining <= 2) {
    alertLevel = 'red';
    badgeLabel = daysRemaining === 0 ? 'AUJOURD\'HUI (J-0)' : `J-${daysRemaining} URGENT`;
    colorTheme = {
      bg: 'linear-gradient(135deg, rgba(185, 28, 28, 0.97) 0%, rgba(127, 29, 29, 0.97) 100%)',
      border: '#ef4444',
      text: '#fee2e2',
      badgeBg: '#ef4444',
      badgeText: '#ffffff',
      glow: '0 0 25px rgba(239, 68, 68, 0.7)',
      levelLabel: 'Alerte Critique CNAM (J-2 à J-0)',
      icon: '🔴'
    };
  } else {
    // daysRemaining < 0 -> Forclusion atteinte
    alertLevel = 'expired';
    badgeLabel = `DÉPASSÉ DE ${Math.abs(daysRemaining)}j`;
    colorTheme = {
      bg: 'linear-gradient(135deg, rgba(153, 27, 27, 0.98) 0%, rgba(69, 10, 10, 0.98) 100%)',
      border: '#dc2626',
      text: '#fecaca',
      badgeBg: '#dc2626',
      badgeText: '#ffffff',
      glow: '0 0 30px rgba(220, 38, 38, 0.85)',
      levelLabel: 'FORCLUSION DÉPASSÉE - DÉPÔT IMMÉDIAT REQUIS',
      icon: '🚨'
    };
  }

  const isAlertActive = alertLevel !== 'none';

  return {
    isAlertActive,
    isDelivered: false,
    alertLevel,
    badgeLabel,
    daysRemaining,
    daysElapsed,
    earliestDate,
    earliestDateFormatted: formatDateFr(earliestDate),
    deadlineDate,
    deadlineDateFormatted: formatDateFr(deadlineDate),
    earliestPatient,
    earliestActe,
    numBordereau: bordereau.numBordereau || 'BORD-CNAM',
    montantCnam: Number(bordereau.montantTotalCnam) || 0,
    totalActes: bordereau.totalFactures || bordereau.lignes?.length || 0,
    colorTheme
  };
}

/**
 * Parcourt l'ensemble des bordereaux et extrait toutes les alertes actives.
 * Trié par ordre de criticité croissante (les plus urgents en premier).
 */
export function getAllActiveCnamAlerts(bordereauxList) {
  if (!Array.isArray(bordereauxList) || bordereauxList.length === 0) {
    return [];
  }

  const alerts = [];
  bordereauxList.forEach(bord => {
    const analysis = calculateBordereauCnamDeadline(bord);
    if (analysis.isAlertActive) {
      alerts.push({
        bordereau: bord,
        ...analysis
      });
    }
  });

  // Trier les alertes : les plus proches de l'échéance (ou forclos) en premier
  alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return alerts;
}

/**
 * Action officielle demandée :
 * Clic sur "Bordereau livré à la CNAM" et archivage du bordereau.
 * Met à jour le bordereau dans la base de données, ce qui fait disparaître
 * immédiatement la notification quotidienne.
 */
export async function deliverAndArchiveBordereau(bordereau) {
  if (!bordereau) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  const updatedBordereau = {
    ...bordereau,
    statut: 'depose',
    livreCnam: true,
    archive: true,
    dateDepot: bordereau.dateDepot || todayStr,
    dateLivraison: nowIso,
    dateArchivage: nowIso,
    historiqueStatuts: [
      ...(bordereau.historiqueStatuts || []),
      {
        statut: 'depose_et_archive',
        date: nowIso,
        commentaire: "Bordereau livré à la CNAM et archivé par le praticien. Alertes d'échéance des 2 mois désactivées."
      }
    ]
  };

  await saveBordereau(updatedBordereau);
  return updatedBordereau;
}
