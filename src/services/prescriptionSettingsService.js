// ==============================================================
// DOCPOCKET CABINET - SERVICE DE PERSONNALISATION DES ORDONNANCES
// ==============================================================
// Gestion complète du format, mise en page, mode papier pré-imprimé,
// marges, mentions légales et aperçu des ordonnances médicales.

import { getActiveLicensePartitionId } from './licenseService';
import { getActivePractitionerId } from './practitionerService';

export const DEFAULT_PRESCRIPTION_SETTINGS = {
  // Format et géométrie papier
  pageSize: 'A4',                // 'A4' (210x297mm) ou 'A5' (148x210mm)
  orientation: 'portrait',
  fontSize: 'normal',            // 'compact' | 'normal' | 'large'
  
  // Mode papier à en-tête pré-imprimé par un imprimeur
  hideHeader: false,             // Masquer l'en-tête logiciel pour imprimer sur papier pré-imprimé
  headerTopMargin: 45,           // Espace vierge réservé en haut en millimètres (20 à 80 mm)

  // Mentions d'en-tête et localisation
  showCityDate: true,            // Afficher "Mahdia, le ..." ou juste "Le ..."
  cityOverride: '',              // Ville de rédaction (vide = ville du praticien)

  // Mentions et Formules personnalisées de bas de page
  showLineCount: true,           // "Arrêtée la présente ordonnance à X ligne(s)"
  customFooterNote: "En cas de persistance ou d'aggravation des symptômes, veuillez reconsulter.",
  showValidityNote: true,        // "Ordonnance valable 3 mois sauf mention contraire."
  validityNote: "Ordonnance valable 3 mois sauf mention contraire.",

  // Zone de signature et cachet
  showSignatureBox: true,
  signatureTitle: "Cachet & Signature du Médecin",

  // Éléments du cartouche patient
  showPatientAge: true,
  showPatientPhone: true,
  showPatientCin: true,

  // Style visuel et format par défaut
  accentColor: '#0284c7',        // Couleur principale du titre et séparateurs (#0284c7, #059669, #475569, #7c3aed, etc.)
  defaultFormat: 'normale',      // 'normale' | 'cnam_mo' | 'cnam_apci'
  watermarkText: ''              // Filigrane discret éventuel
};

/**
 * Clé de stockage cloisonnée par partition de licence et par praticien
 */
function getScopedKey() {
  try {
    const partition = (typeof getActiveLicensePartitionId === 'function' ? getActiveLicensePartitionId() : 'primary') || 'primary';
    const docId = (typeof getActivePractitionerId === 'function' ? getActivePractitionerId() : 'primary') || 'primary';
    return `docpocket_presc_settings_${partition}_${docId}`;
  } catch {
    return 'docpocket_presc_settings_primary_primary';
  }
}

/**
 * Récupère les paramètres de personnalisation d'ordonnance actifs
 */
export function getPrescriptionSettings() {
  try {
    const raw = localStorage.getItem(getScopedKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_PRESCRIPTION_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn("Erreur lecture paramètres ordonnance:", e);
  }
  return { ...DEFAULT_PRESCRIPTION_SETTINGS };
}

/**
 * Enregistre les nouveaux paramètres d'ordonnance
 */
export function savePrescriptionSettings(settings) {
  try {
    const current = getPrescriptionSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(getScopedKey(), JSON.stringify(updated));
    return { success: true, settings: updated };
  } catch (e) {
    console.error("Erreur enregistrement paramètres ordonnance:", e);
    return { success: false, error: e.message };
  }
}

/**
 * Réinitialise aux réglages d'usine
 */
export function resetPrescriptionSettings() {
  try {
    localStorage.removeItem(getScopedKey());
    return { success: true, settings: { ...DEFAULT_PRESCRIPTION_SETTINGS } };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
