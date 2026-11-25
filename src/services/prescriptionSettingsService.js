// ==============================================================
// DOCPOCKET CABINET - SERVICE DE PERSONNALISATION DES ORDONNANCES
// ==============================================================
// Gestion complète du format, mise en page, mode papier pré-imprimé,
// marges de calibration, modèle scanné A5/A4, mentions et aperçu.

import { getActiveLicensePartitionId } from './licenseService';
import { getActivePractitionerId } from './practitionerService';

export const DEFAULT_PRESCRIPTION_SETTINGS = {
  // Format et géométrie papier
  pageSize: 'A5',                // 'A5' (148x210mm) par défaut ou 'A4' (210x297mm)
  orientation: 'portrait',
  fontSize: 'normal',            // 'compact' | 'normal' | 'large'
  
  // Marges et calibration d'impression (en millimètres)
  headerTopMargin: 38,           // Marge supérieure en mm (38mm pour démarrer immédiatement sous Mahdia le:....)
  sideMargin: 10,                // Marge latérale gauche/droite en mm (10mm pour centrage parfait sans couper le bord droit)
  bottomMargin: 30,              // Marge inférieure en mm (30mm pour ne JAMAIS chevaucher le pied de page pré-imprimé du cabinet)

  // Mode papier à en-tête pré-imprimé par un imprimeur
  hideHeader: false,             // Masquer l'en-tête logiciel (zéro date en haut, texte calé sur papier pré-imprimé)
  
  // Modèle scanné du médecin pour calibration visuelle
  templateImage: null,           // DataURL base64 de l'ordonnance papier scannée
  showTemplateInPreview: true,   // Afficher le modèle scanné sous le texte dans l'aperçu
  templateOpacity: 0.5,          // Opacité du modèle (0.1 à 1.0)
  printTemplateBackground: false,// Si true, imprime aussi le modèle scanné (test sur feuille blanche vierge)

  // Mentions d'en-tête et localisation
  showCityDate: true,            // Afficher "Mahdia, le ..." en bas dans la signature
  cityOverride: '',              // Ville de rédaction (vide = ville du praticien)

  // Mentions et Formules personnalisées de bas de page
  showLineCount: true,           // "Arrêtée la présente ordonnance à X ligne(s)"
  customFooterNote: "En cas de persistance ou d'aggravation des symptômes, veuillez reconsulter.",
  showValidityNote: true,        // "Ordonnance valable 3 mois sauf mention contraire."
  validityNote: "Ordonnance valable 3 mois sauf mention contraire.",

  // Zone de signature et cachet
  showSignatureBox: true,
  signatureTitle: "Cachet & Signature du Médecin",

  // Style visuel et format par défaut
  accentColor: '#0284c7',        // Couleur principale du titre et séparateurs (#0284c7, #059669, #475569, #7c3aed, etc.)
  defaultFormat: 'normale',      // 'normale' | 'cnam_mo' | 'cnam_apci'
  watermarkText: ''              // Filigrane discret éventuel
};

/**
 * Clé de stockage cloisonnée par partition de licence et par praticien
 */
function getScopedKey(suffix = 'settings') {
  try {
    const partition = (typeof getActiveLicensePartitionId === 'function' ? getActiveLicensePartitionId() : 'primary') || 'primary';
    const docId = (typeof getActivePractitionerId === 'function' ? getActivePractitionerId() : 'primary') || 'primary';
    return `docpocket_presc_${suffix}_${partition}_${docId}`;
  } catch {
    return `docpocket_presc_${suffix}_primary_primary`;
  }
}

/**
 * Récupère les paramètres de personnalisation d'ordonnance actifs
 */
export function getPrescriptionSettings() {
  try {
    let parsed = {};
    const scopedRaw = localStorage.getItem(getScopedKey('settings'));
    const globalRaw = localStorage.getItem('docpocket_presc_settings_global');
    
    if (scopedRaw) {
      try { parsed = JSON.parse(scopedRaw); } catch {}
    } else if (globalRaw) {
      try { parsed = JSON.parse(globalRaw); } catch {}
    }

    // Récupération prioritaire des choix explicites du médecin (taille de papier et format par défaut)
    const explicitPaperSize = localStorage.getItem('docpocket_active_print_paper_size');
    const explicitDefaultFormat = localStorage.getItem('docpocket_default_print_format');

    // Charge également l'image modèle si sauvegardée séparément
    const templateImg = localStorage.getItem(getScopedKey('template_img')) || localStorage.getItem('docpocket_presc_template_img_global');
    return {
      ...DEFAULT_PRESCRIPTION_SETTINGS,
      ...parsed,
      ...(explicitPaperSize ? { pageSize: explicitPaperSize } : {}),
      ...(explicitDefaultFormat ? { defaultFormat: explicitDefaultFormat } : {}),
      templateImage: templateImg || parsed.templateImage || null
    };
  } catch (e) {
    console.warn("Erreur lecture paramètres ordonnance:", e);
  }
  return { ...DEFAULT_PRESCRIPTION_SETTINGS };
}

/**
 * Enregistre les nouveaux paramètres d'ordonnance de manière persistante
 */
export function savePrescriptionSettings(settings) {
  try {
    const current = getPrescriptionSettings();
    const { templateImage, ...settingsWithoutImage } = settings;
    const updated = { ...current, ...settingsWithoutImage };

    const jsonStr = JSON.stringify(updated);
    // Sauvegarde cloisonnée et globale pour garantir la persistance quoi qu'il arrive
    localStorage.setItem(getScopedKey('settings'), jsonStr);
    localStorage.setItem('docpocket_presc_settings_global', jsonStr);

    if (updated.pageSize) {
      localStorage.setItem('docpocket_active_print_paper_size', updated.pageSize);
    }
    if (updated.defaultFormat) {
      localStorage.setItem('docpocket_default_print_format', updated.defaultFormat);
    }

    // Sauvegarde l'image modèle scannée séparément
    if (templateImage !== undefined) {
      if (templateImage) {
        localStorage.setItem(getScopedKey('template_img'), templateImage);
        localStorage.setItem('docpocket_presc_template_img_global', templateImage);
        updated.templateImage = templateImage;
      } else {
        localStorage.removeItem(getScopedKey('template_img'));
        localStorage.removeItem('docpocket_presc_template_img_global');
        updated.templateImage = null;
      }
    }

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
    localStorage.removeItem(getScopedKey('settings'));
    localStorage.removeItem(getScopedKey('template_img'));
    return { success: true, settings: { ...DEFAULT_PRESCRIPTION_SETTINGS } };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Compresse et redimensionne une image de modèle d'ordonnance uploadée
 * pour la stocker de façon ultra légère en base64 (~60 à 100 Ko).
 */
export function compressTemplateImage(file, maxWidth = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      return reject(new Error("Veuillez sélectionner un fichier image valide (JPG, PNG ou WEBP)."));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Erreur lors de la lecture du fichier image."));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Impossible de décoder l'image sélectionnée."));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
