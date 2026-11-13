import { APCI_LIST } from '../constants/medicalConstants';
import { getPrescriptionSettings } from './prescriptionSettingsService';
import { getActivePractitioner } from './practitionerService';

/**
 * Calcule l'âge d'un patient sans divulguer sa date de naissance complète
 */
function formatPatientAge(patient) {
  if (!patient) return '';
  if (patient.age) {
    return `${patient.age} ans`;
  }
  if (!patient.birthdate) return '';
  try {
    let year = null;
    if (patient.birthdate.includes('/')) {
      const parts = patient.birthdate.split('/');
      year = parseInt(parts[2], 10);
    } else if (patient.birthdate.includes('-')) {
      year = parseInt(patient.birthdate.split('-')[0], 10);
    }
    if (year && !isNaN(year)) {
      const diff = new Date().getFullYear() - year;
      if (diff >= 0 && diff < 125) {
        return `${diff} ans`;
      }
    }
  } catch {}
  return '';
}

/**
 * Construit le code HTML complet et autonome d'une ordonnance médicale officielle.
 * Adaptée fidèlement au format A5 de cabinet médical (comme sur l'ancien logiciel),
 * sans écritures parasites du navigateur (zéro date en haut, zéro URL, zéro numéro de page).
 */
export function buildPrescriptionHtml(patient, prescription, chosenFormat = null, customSettings = null) {
  if (!patient || !prescription) {
    return '<html><body><div style="padding:20px;color:red;">Données insuffisantes pour afficher l\'ordonnance.</div></body></html>';
  }

  const settings = customSettings || getPrescriptionSettings();
  const now = new Date();
  const dateStr = prescription.date || now.toLocaleDateString('fr-FR');
  const activeFormat = chosenFormat || prescription.printFormat || prescription.type || settings.defaultFormat || 'normale';

  // N° de carnet CNAM (saisi ou hérité du patient)
  const numCarnet = prescription.numCarnet || patient.cnamid || 'Non renseigné';

  // Libellé de l'APCI retenue par le médecin
  let apciLabel = prescription.apciLabel || '';
  if (!apciLabel && prescription.selectedApci) {
    const foundApci = APCI_LIST.find(a => a.code === prescription.selectedApci);
    apciLabel = foundApci ? foundApci.label : `APCI Code ${prescription.selectedApci}`;
  }
  if (!apciLabel && patient.apci) {
    const foundPatApci = APCI_LIST.find(a => a.code === patient.apci);
    apciLabel = foundPatApci ? foundPatApci.label : patient.apciLabel || `APCI Code ${patient.apci}`;
  }
  if (!apciLabel) {
    apciLabel = 'APCI Non Spécifiée';
  }

  // Profil praticien actif (avec priorité au gestionnaire multi-praticiens)
  let docProfile = {};
  try {
    const raw = localStorage.getItem('docpocket_doctor_profile');
    if (raw) docProfile = JSON.parse(raw);
  } catch (e) {}

  const activeDoc = (typeof getActivePractitioner === 'function') ? getActivePractitioner() : null;

  const docTitre = activeDoc?.titre || docProfile.titre || 'Dr.';
  const docNomFamille = activeDoc?.nom || docProfile.nomSeul || docProfile.nom || 'BEN KHALIFA';
  const docPrenom = activeDoc?.prenom || docProfile.prenomSeul || docProfile.prenom || 'Hamed';
  const docNom = `${docTitre} ${docPrenom} ${docNomFamille}`.trim();
  const docSpecialite = activeDoc?.specialite || docProfile.specialite || 'Médecine Générale';
  const docAdresse = [activeDoc?.adresse || docProfile.adresse, activeDoc?.ville || docProfile.ville].filter(Boolean).join(', ') || 'Complexe Médical Dar Attabib, Mahdia';
  const docTel = (activeDoc?.telephone || docProfile.telephone) ? `Tél : ${activeDoc?.telephone || docProfile.telephone}` : 'Tél : 31 576 900 / 53 573 117';
  const docEmail = (activeDoc?.email || docProfile.email) ? ` • Email : ${activeDoc?.email || docProfile.email}` : '';
  const docOrdre = (activeDoc?.ordreId || docProfile.ordreId) ? `N° d'Ordre Médecins : ${activeDoc?.ordreId || docProfile.ordreId}` : "N° d'Ordre Médecins : 12052";
  const docCnam = (activeDoc?.cnamId || docProfile.cnamId) ? ` • Code CNAM : ${activeDoc?.cnamId || docProfile.cnamId}` : ' • Code CNAM : 010002763183';
  const docFisc = (activeDoc?.fiscId || docProfile.fiscId) ? ` • Identifiant Fiscal : ${activeDoc?.fiscId || docProfile.fiscId}` : ' • Identifiant Fiscal : 856103/M';
  const docCity = settings.cityOverride?.trim() || activeDoc?.ville || docProfile.ville || 'Mahdia';

  // Géométrie et adaptation au format A5 vs A4
  const isA5 = (settings.pageSize || 'A5') === 'A5';
  const pageWidthMm = isA5 ? 148 : 210;
  const pageHeightMm = isA5 ? 210 : 297;
  const sideMarginMm = settings.sideMargin || (isA5 ? 10 : 12);
  const bottomMarginMm = Math.max(settings.bottomMargin || (isA5 ? 30 : 15), isA5 ? 28 : 15);
  const headerTopMarginMm = settings.headerTopMargin || (isA5 ? 38 : 40);

  // Gestion des couleurs et titres par format
  let titreOrdonnance = 'ORDONNANCE MÉDICALE';
  let badgeColor = settings.accentColor || '#0284c7';
  let cnamCardHtml = '';

  if (activeFormat === 'cnam_apci' || activeFormat === 'apci') {
    titreOrdonnance = 'ORDONNANCE MÉDICALE CNAM — PRISE EN CHARGE INTÉGRALE APCI';
    badgeColor = '#d97706';
    cnamCardHtml = `
      <div style="background: #fffbeb; border: 1.5px solid #d97706; border-radius: 6px; padding: ${isA5 ? '6px 10px' : '10px 14px'}; margin-bottom: ${isA5 ? '10px' : '16px'};">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #fde68a; padding-bottom: 4px; margin-bottom: 5px;">
          <span style="font-weight: 800; color: #92400e; font-size: ${isA5 ? '11px' : '12.5px'}; text-transform: uppercase;">
            ★ CONVENTION CNAM — PRISE EN CHARGE INTÉGRALE APCI (100%)
          </span>
          <span style="font-size: ${isA5 ? '10px' : '11.5px'}; color: #b45309; font-weight: 700;">
            Dispense d'avance des frais (100%)
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: ${isA5 ? '11.5px' : '13px'}; margin-bottom: 5px;">
          <div>
            <span style="color: #78350f; font-weight: 600;">N° CARNET CNAM :</span>
            <strong style="color: #0f172a; font-size: ${isA5 ? '13px' : '14.5px'}; margin-left: 6px; background: #fef3c7; padding: 1px 6px; border-radius: 4px; border: 1px solid #fcd34d;">
              ${numCarnet}
            </strong>
          </div>
          <div>
            <span style="color: #78350f;">Caisse :</span>
            <strong style="color: #0f172a; margin-left: 4px;">${patient.caisse || 'CNSS'}</strong>
          </div>
        </div>
        <div style="background: rgba(217, 119, 6, 0.08); padding: 4px 8px; border-radius: 4px; border-left: 3px solid #d97706;">
          <span style="color: #92400e; font-weight: 800; font-size: ${isA5 ? '10px' : '11px'}; text-transform: uppercase;">AFFECTION(S) APCI :</span>
          <div style="color: #0f172a; font-weight: 700; font-size: ${isA5 ? '12px' : '13.5px'}; margin-top: 1px;">
            ${apciLabel}
          </div>
        </div>
      </div>
    `;
  } else if (activeFormat === 'cnam_mo' || activeFormat === 'cnam_ordinaire') {
    titreOrdonnance = 'ORDONNANCE MÉDICALE CONVENTIONNÉE CNAM — MALADIE ORDINAIRE';
    badgeColor = '#059669';
    cnamCardHtml = `
      <div style="background: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 6px; padding: ${isA5 ? '6px 10px' : '10px 14px'}; margin-bottom: ${isA5 ? '10px' : '16px'};">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #bbf7d0; padding-bottom: 4px; margin-bottom: 5px;">
          <span style="font-weight: 800; color: #166534; font-size: ${isA5 ? '11px' : '12.5px'}; text-transform: uppercase;">
            🏛️ CONVENTION CNAM — RÉGIME MALADIE ORDINAIRE (MO)
          </span>
          <span style="font-size: ${isA5 ? '10px' : '11.5px'}; color: #15803d; font-weight: 600;">
            Filière Privée / Tiers-Payant
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: ${isA5 ? '11.5px' : '13px'};">
          <div>
            <span style="color: #166534; font-weight: 600;">N° CARNET CNAM :</span>
            <strong style="color: #0f172a; font-size: ${isA5 ? '13px' : '14.5px'}; margin-left: 6px; background: #dcfce7; padding: 1px 6px; border-radius: 4px; border: 1px solid #86efac;">
              ${numCarnet}
            </strong>
          </div>
          <div>
            <span style="color: #166534;">Caisse :</span>
            <strong style="color: #0f172a; margin-left: 4px;">${patient.caisse || 'CNSS'}</strong>
          </div>
        </div>
      </div>
    `;
  }

  const items = prescription.items || [];
  const itemCount = items.length;

  // Calcul intelligent des tailles de police et espacements selon le nombre de médicaments
  // pour garantir que l'ordonnance s'adapte TOUJOURS sur UNE SEULE PAGE A5 ou A4
  let baseMedName = isA5 ? 14 : 16;
  let basePosology = isA5 ? 13 : 14.5;
  let baseMeta = isA5 ? 11.5 : 13;
  let baseConsigne = isA5 ? 11 : 12.5;
  let baseItemMargin = isA5 ? 10 : 14;
  let baseItemPadding = isA5 ? 6 : 9;
  let baseSigSpace = isA5 ? 32 : 50;
  let baseFooterMargin = isA5 ? 14 : 22;
  let basePatientBarMargin = isA5 ? 10 : 14;

  if (itemCount >= 7) {
    baseMedName = isA5 ? 11.5 : 13;
    basePosology = isA5 ? 10.5 : 12;
    baseMeta = isA5 ? 9.5 : 11;
    baseConsigne = isA5 ? 9.5 : 11;
    baseItemMargin = isA5 ? 4 : 6;
    baseItemPadding = isA5 ? 2 : 4;
    baseSigSpace = isA5 ? 12 : 20;
    baseFooterMargin = isA5 ? 6 : 10;
    basePatientBarMargin = isA5 ? 6 : 8;
  } else if (itemCount >= 5) {
    baseMedName = isA5 ? 12.5 : 14;
    basePosology = isA5 ? 11.5 : 13;
    baseMeta = isA5 ? 10.5 : 12;
    baseConsigne = isA5 ? 10 : 11.5;
    baseItemMargin = isA5 ? 6 : 8;
    baseItemPadding = isA5 ? 3 : 5;
    baseSigSpace = isA5 ? 18 : 28;
    baseFooterMargin = isA5 ? 8 : 14;
    basePatientBarMargin = isA5 ? 8 : 10;
  } else if (itemCount >= 3) {
    baseMedName = isA5 ? 13.5 : 15;
    basePosology = isA5 ? 12.5 : 14;
    baseMeta = isA5 ? 11 : 12.5;
    baseConsigne = isA5 ? 10.5 : 12;
    baseItemMargin = isA5 ? 8 : 11;
    baseItemPadding = isA5 ? 4 : 7;
    baseSigSpace = isA5 ? 24 : 38;
    baseFooterMargin = isA5 ? 10 : 16;
    basePatientBarMargin = isA5 ? 8 : 12;
  }

  const patientCivility = (patient.civility && !/mari|celib|veuf|divorc/i.test(patient.civility)) 
    ? patient.civility 
    : (patient.gender === 'F' ? ((patient.etat_civil === 'Célibataire' || /celib/i.test(patient.civility || '')) ? 'Mlle' : 'Mme') : 'M.');

  const patientAgeStr = formatPatientAge(patient);
  const cityDateText = settings.showCityDate ? `${docCity}, le ${dateStr}` : `Le ${dateStr}`;

  // EN-TÊTE DU PAPIER :
  // Si hideHeader est actif : AUCUNE date en haut, seulement un espace vierge pour caler l'en-tête de l'imprimeur
  const headerHtml = settings.hideHeader ? `
    <!-- Espace vierge réservé pour papier pré-imprimé d'imprimerie (Zéro date en haut) -->
    <div class="preprinted-spacer" style="height: ${headerTopMarginMm}mm; margin-bottom: ${isA5 ? '4px' : '8px'};"></div>
  ` : `
    <!-- En-tête Cabinet Officiel -->
    <table class="header-table">
      <tr>
        <td style="vertical-align: top;">
          <h1 class="doc-name">${docNom}</h1>
          <p class="doc-sub">${docSpecialite}</p>
          <p class="doc-sub">${docAdresse}</p>
          <p class="doc-sub">${docTel}${docEmail}</p>
          <p class="doc-id">${docOrdre}${docCnam}${docFisc}</p>
        </td>
        <td style="text-align: right; vertical-align: top;">
          <div style="font-size: ${isA5 ? '11px' : '13px'}; color: #475569;">${settings.showCityDate ? `${docCity}, le` : 'Le'}</div>
          <div style="font-size: ${isA5 ? '14px' : '17px'}; font-weight: 700; color: #0f172a; margin-top: 1px;">${dateStr}</div>
          <div style="font-size: ${isA5 ? '9.5px' : '11px'}; color: #94a3b8; margin-top: 3px;">Réf: ORD-${prescription.id || 'NOUV'}</div>
        </td>
      </tr>
    </table>
  `;

  // Modèle scanné en arrière-plan (pour calibration en direct)
  const templateBgLayer = settings.templateImage ? `
    <div class="template-bg-layer" style="
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
      background-image: url('${settings.templateImage}');
      background-size: 100% 100%;
      background-repeat: no-repeat;
      background-position: top center;
      opacity: ${settings.showTemplateInPreview ? (settings.templateOpacity ?? 0.5) : 0};
      pointer-events: none;
      z-index: 0;
    "></div>
  ` : '';

  // Filigrane discret si renseigné
  const watermarkHtml = settings.watermarkText ? `
    <div style="position: fixed; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: ${isA5 ? '44px' : '75px'}; font-weight: 900; color: rgba(15, 23, 42, 0.04); text-transform: uppercase; letter-spacing: 5px; pointer-events: none; z-index: 0; white-space: nowrap;">
      ${settings.watermarkText}
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <!-- Titre vide pour empêcher Chrome d'imprimer un titre en haut de page -->
  <title></title>
  <style>
    :root {
      --presc-scale: 1.0;
    }
    /* SUPPRESSION ABSOLUE DES EN-TÊTES ET PIEDS DE PAGE CHROME (DATE, URL, 1/1) */
    @page {
      size: ${isA5 ? 'A5' : 'A4'} ${settings.orientation === 'landscape' ? 'landscape' : 'portrait'};
      margin: 0mm !important; /* Marge zéro obligatoire pour désactiver les en-têtes et pieds de page natifs du navigateur */
    }
    @page :left { margin: 0mm !important; }
    @page :right { margin: 0mm !important; }
    @page :first { margin: 0mm !important; }

    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100%;
      min-height: 100vh;
      background: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .no-print {
      background: #0f172a;
      padding: 8px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      width: 100%;
    }
    .print-tip-bar {
      background: #0284c7;
      color: #ffffff;
      padding: 7px 16px;
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }
    .btn {
      padding: 7px 14px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .btn-print { background: #0284c7; color: #fff; }
    .btn-email { background: #059669; color: #fff; margin-left: 6px; }
    .btn-close { background: #475569; color: #fff; margin-left: 6px; }

    @media print {
      @page {
        size: ${isA5 ? 'A5' : 'A4'} ${settings.orientation === 'landscape' ? 'landscape' : 'portrait'};
        margin: 0mm !important;
      }
      html, body {
        width: ${pageWidthMm}mm !important;
        max-width: ${pageWidthMm}mm !important;
        height: ${pageHeightMm}mm !important;
        max-height: ${pageHeightMm}mm !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        overflow: hidden !important;
      }
      .no-print, .print-tip-bar {
        display: none !important;
      }
      .prescription-container {
        width: ${pageWidthMm}mm !important;
        max-width: ${pageWidthMm}mm !important;
        height: ${pageHeightMm}mm !important;
        max-height: ${pageHeightMm}mm !important;
        margin: 0 !important;
        padding-left: ${sideMarginMm}mm !important;
        padding-right: ${sideMarginMm}mm !important;
        padding-top: 0 !important;
        padding-bottom: ${bottomMarginMm}mm !important;
        box-sizing: border-box !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        background: transparent !important;
        overflow: hidden !important;
        page-break-after: avoid !important;
        page-break-inside: avoid !important;
      }
      .preprinted-spacer {
        border: none !important;
        border-bottom: none !important;
      }
      * {
        page-break-inside: avoid !important;
      }
      ${!settings.printTemplateBackground ? `
        .template-bg-layer { display: none !important; }
      ` : `
        .template-bg-layer { display: block !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}
    }

    /* CONTENEUR PRINCIPAL CALIBRÉ POUR REMPLIR EXACTEMENT LA FEUILLE A5 OU A4 */
    .prescription-container {
      width: ${pageWidthMm}mm;
      min-height: ${pageHeightMm}mm;
      box-sizing: border-box;
      padding-left: ${sideMarginMm}mm;
      padding-right: ${sideMarginMm}mm;
      padding-bottom: ${bottomMarginMm}mm;
      margin: 20px auto;
      position: relative;
      background: #ffffff;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
      border-radius: 4px;
      font-size: calc(${isA5 ? '13px' : '14px'} * var(--presc-scale, 1));
      line-height: ${itemCount >= 6 ? '1.25' : (itemCount >= 4 ? '1.32' : (isA5 ? '1.38' : '1.45'))};
    }

    .preprinted-spacer {
      display: block;
      width: 100%;
      border-bottom: 1px dashed rgba(148, 163, 184, 0.4);
    }

    /* En-tête Cabinet */
    .header-table {
      width: 100%;
      border-bottom: 2px solid ${badgeColor};
      padding-bottom: ${isA5 ? '8px' : '12px'};
      margin-bottom: ${isA5 ? '10px' : '16px'};
    }
    .doc-name {
      font-size: ${isA5 ? '16px' : '20px'};
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-sub {
      color: #475569;
      font-size: ${isA5 ? '11px' : '12px'};
      margin: 1px 0 0 0;
    }
    .doc-id {
      color: #64748b;
      font-size: ${isA5 ? '9.5px' : '11px'};
      margin: 3px 0 0 0;
    }

    /* Cartouche Patient Allégé et Lisible */
    .patient-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: calc(5px * var(--presc-scale, 1));
      margin-bottom: calc(${basePatientBarMargin}px * var(--presc-scale, 1));
    }
    .patient-label {
      font-size: calc(${isA5 ? '12.5px' : '13.5px'} * var(--presc-scale, 1));
      font-weight: 600;
      color: #475569;
      margin-right: 6px;
    }
    .patient-name {
      font-size: calc(${isA5 ? '14.5px' : '16px'} * var(--presc-scale, 1));
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.3px;
    }
    .patient-age {
      font-size: calc(${isA5 ? '12.5px' : '13.5px'} * var(--presc-scale, 1));
      font-weight: 700;
      color: #0284c7;
      margin-left: 6px;
    }

    /* Titre Document */
    .prescription-title-box {
      text-align: center;
      margin-bottom: calc(${isA5 ? '8px' : '12px'} * var(--presc-scale, 1));
    }
    .prescription-title {
      display: inline-block;
      font-size: calc(${isA5 ? '12px' : '14px'} * var(--presc-scale, 1));
      font-weight: 800;
      color: ${badgeColor};
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 1px 8px;
      border-bottom: 2px dashed ${badgeColor};
    }

    /* Corps de Prescription Lisible et Auto-Adapté sur 1 Page */
    .presc-list {
      margin: 0;
      padding: 0;
      list-style-type: none;
    }
    .presc-item {
      margin-bottom: calc(${baseItemMargin}px * var(--presc-scale, 1));
      padding-bottom: calc(${baseItemPadding}px * var(--presc-scale, 1));
      border-bottom: 1px dashed #cbd5e1;
      page-break-inside: avoid;
    }
    .presc-item:last-child {
      border-bottom: none;
    }
    .item-header {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    .item-number {
      font-weight: 900;
      color: #0f172a;
      font-size: calc(${baseMedName}px * var(--presc-scale, 1));
      min-width: 20px;
    }
    .item-name {
      font-size: calc(${baseMedName}px * var(--presc-scale, 1));
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.2px;
    }
    .item-forme {
      font-size: calc(${baseMeta}px * var(--presc-scale, 1));
      color: #64748b;
      font-style: italic;
      font-weight: 500;
    }
    .item-apci-badge {
      font-size: calc(${isA5 ? '9px' : '10.5px'} * var(--presc-scale, 1));
      background: #fef3c7;
      color: #b45309;
      padding: 1px 5px;
      border-radius: 4px;
      font-weight: 700;
    }
    .item-posology {
      margin-left: ${isA5 ? '20px' : '26px'};
      margin-top: 1.5px;
      font-size: calc(${basePosology}px * var(--presc-scale, 1));
      font-weight: 700;
      color: #1e293b;
      line-height: 1.35;
    }
    .item-meta {
      margin-left: ${isA5 ? '20px' : '26px'};
      font-size: calc(${baseMeta}px * var(--presc-scale, 1));
      color: #475569;
      margin-top: 1px;
      font-weight: 600;
    }
    .item-consigne {
      margin-left: ${isA5 ? '20px' : '26px'};
      font-size: calc(${baseConsigne}px * var(--presc-scale, 1));
      color: #b45309;
      font-weight: 600;
      margin-top: 1px;
    }

    /* Zone Bas de Page */
    .prescription-footer {
      margin-top: calc(${baseFooterMargin}px * var(--presc-scale, 1));
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      page-break-inside: avoid;
    }
    .arrete-box {
      font-size: calc(${isA5 ? '9.5px' : '11px'} * var(--presc-scale, 1));
      color: #64748b;
      line-height: 1.4;
      max-width: ${isA5 ? '52%' : '55%'};
    }
    .signature-area {
      width: ${isA5 ? '160px' : '220px'};
      max-width: 45%;
      text-align: center;
      border-top: 1px dashed #94a3b8;
      padding-top: calc(4px * var(--presc-scale, 1));
      color: #475569;
      font-size: calc(${isA5 ? '10.5px' : '12px'} * var(--presc-scale, 1));
    }
    .signature-date {
      font-weight: 700;
      color: #0f172a;
      font-size: calc(${isA5 ? '11px' : '13px'} * var(--presc-scale, 1));
    }
    .signature-title {
      margin-top: 2px;
      font-weight: 800;
      color: #0f172a;
      font-size: calc(${isA5 ? '10.5px' : '12px'} * var(--presc-scale, 1));
    }
    .signature-space {
      height: calc(${baseSigSpace}px * var(--presc-scale, 1));
    }
  </style>
</head>
<body>
  ${watermarkHtml}

  <!-- Barre d'outils (masquée à l'impression) -->
  <div class="no-print">
    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
      <span style="color: #fff; font-weight: 700; font-size: 13px;">
        💊 Ordonnance : ${patient.nom} ${patient.prenom}
      </span>

      <!-- Sélecteur rapide de modèle d'impression -->
      <select id="formatSelect" onchange="changerModele(this.value)" style="padding: 4px 8px; border-radius: 6px; background: #1e293b; color: #fff; border: 1px solid #38bdf8; font-size: 11px; font-weight: 600; cursor: pointer;">
        <option value="normale" ${activeFormat === 'normale' ? 'selected' : ''}>📄 Normale</option>
        <option value="cnam_mo" ${activeFormat === 'cnam_mo' || activeFormat === 'cnam_ordinaire' ? 'selected' : ''}>🏛️ CNAM MO</option>
        <option value="cnam_apci" ${activeFormat === 'cnam_apci' || activeFormat === 'apci' ? 'selected' : ''}>★ CNAM APCI (100%)</option>
      </select>

      <!-- Sélecteur de format papier direct -->
      <select id="pageSizeSelect" onchange="changerFormatPapier(this.value)" style="padding: 4px 8px; border-radius: 6px; background: #0f172a; color: #38bdf8; border: 1px solid #0284c7; font-size: 11px; font-weight: 700; cursor: pointer;">
        <option value="A5" ${isA5 ? 'selected' : ''}>📑 Format A5 (Carnet 148×210 mm)</option>
        <option value="A4" ${!isA5 ? 'selected' : ''}>📄 Format A4 (210×297 mm)</option>
      </select>

      <!-- Contrôles d'ajustement dynamique de taille de police / 1 page -->
      <div style="display: inline-flex; align-items: center; gap: 4px; background: #0f172a; padding: 2px 8px; border-radius: 6px; border: 1px solid #334155;">
        <span style="font-size: 11px; color: #94a3b8; font-weight: 600;">Police :</span>
        <button type="button" onclick="ajusterEchelle(-0.04)" title="Réduire la police" style="background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 2px 7px; font-weight: 800; cursor: pointer; font-size: 11px;">A−</button>
        <span id="scaleDisplay" style="font-size: 11px; font-weight: 700; color: #38bdf8; min-width: 36px; text-align: center;">100%</span>
        <button type="button" onclick="ajusterEchelle(+0.04)" title="Agrandir la police" style="background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 2px 7px; font-weight: 800; cursor: pointer; font-size: 11px;">A+</button>
        <button type="button" onclick="forcerAjustementUnePage(true)" title="Adapter automatiquement sur 1 page" style="background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 700; cursor: pointer; margin-left: 4px;">
          📄 1 Page Garantie
        </button>
      </div>
    </div>

    <div>
      <button class="btn btn-print" onclick="window.print()">
        🖨️ Imprimer l'Ordonnance
      </button>
      <button class="btn btn-email" onclick="envoyerEmail()">
        ✉️ Email
      </button>
      <button class="btn btn-close" onclick="window.close()">
        ✕ Fermer
      </button>
    </div>
  </div>

  <div class="no-print print-tip-bar" style="background: #0369a1; padding: 7px 16px; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
    <span>
      💡 <strong>Adaptation 1 Page Active :</strong> La police et les espacements s'adaptent automatiquement pour que toute l'ordonnance tienne sur une seule feuille (sans page 2).
    </span>
    <span style="font-size: 11px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px; font-weight: 600;">
      Dans Chrome : Papier = ${isA5 ? 'A5' : 'A4'} • Décochez « En-têtes et pieds de page »
    </span>
  </div>

  <div class="prescription-container">
    ${templateBgLayer}
    ${headerHtml}

    <!-- Cartouche Patient Allégé (Zéro CIN, Zéro Tél, Zéro Date Naissance) -->
    <div class="patient-bar">
      <div>
        <span class="patient-label">Patient(e) :</span>
        <span class="patient-name">${patientCivility} ${patient.nom.toUpperCase()} ${patient.prenom}</span>
        ${patientAgeStr ? `<span class="patient-age">(${patientAgeStr})</span>` : ''}
      </div>
      <div style="text-align: right;">
        ${(activeFormat === 'cnam_mo' || activeFormat === 'cnam_apci') ? `
          <span style="font-size: ${isA5 ? '11px' : '12px'}; color: #166534; font-weight: 700;">
            Caisse : <strong>${patient.caisse || 'CNSS'}</strong>
            ${numCarnet && numCarnet !== 'Non renseigné' ? ` • Carnet : <strong>${numCarnet}</strong>` : ''}
          </span>
        ` : ''}
      </div>
    </div>

    <!-- Cartouche Réglementaire CNAM (MO ou APCI avec N° Carnet et Affection) -->
    ${cnamCardHtml}

    <!-- Titre de l'Ordonnance (Zéro diagnostic affiché) -->
    <div class="prescription-title-box">
      <div class="prescription-title">${titreOrdonnance}</div>
    </div>

    <!-- Liste des Médicaments Prescrits (Adaptée à la largeur A5) -->
    <ul class="presc-list">
      ${items.map((item, idx) => `
        <li class="presc-item">
          <div class="item-header">
            <span class="item-number">${idx + 1}.</span>
            <span class="item-name">${item.nom}</span>
            ${item.forme ? `<span class="item-forme">(${item.forme})</span>` : ''}
            ${item.apci ? `<span class="item-apci-badge">APCI</span>` : ''}
          </div>

          ${item.posologie ? `
            <div class="item-posology">
              👉 ${item.posologie}
            </div>
          ` : ''}

          <div class="item-meta">
            ${item.duree ? `Durée : <strong>${item.duree}</strong>` : ''}
            ${item.duree && item.quantite ? ' • ' : ''}
            ${item.quantite ? `Quantité : <strong>${item.quantite}</strong>` : ''}
          </div>

          ${item.consigne ? `
            <div class="item-consigne">
              ⚠️ Consigne : ${item.consigne}
            </div>
          ` : ''}
        </li>
      `).join('')}
    </ul>

    ${prescription.notes ? `
      <div style="margin-top: ${isA5 ? '12px' : '16px'}; padding: 6px 10px; background: #f8fafc; border-left: 3px solid ${badgeColor}; border-radius: 4px; font-size: ${isA5 ? '11px' : '12px'}; color: #334155;">
        <strong>Recommandations médicales :</strong> ${prescription.notes}
      </div>
    ` : ''}

    <!-- Bas de Page & Signature (Date unique en bas de page) -->
    <div class="prescription-footer">
      <div class="arrete-box">
        ${settings.showLineCount ? `Arrêtée la présente ordonnance à <strong>${items.length}</strong> ligne(s).<br>` : ''}
        ${settings.customFooterNote ? `<div>${settings.customFooterNote}</div>` : ''}
        ${(settings.showValidityNote && settings.validityNote) ? `<div style="margin-top: 3px; font-weight: 600; color: #334155;">📌 ${settings.validityNote}</div>` : ''}
      </div>

      ${settings.showSignatureBox ? `
        <div class="signature-area">
          <div class="signature-date">${cityDateText}</div>
          <div class="signature-title">${settings.signatureTitle || 'Cachet & Signature du Médecin'}</div>
          <div class="signature-space"></div>
        </div>
      ` : ''}
    </div>
  </div>

  <script>
    window.__patient = ${JSON.stringify(patient)};
    window.__prescription = ${JSON.stringify(prescription)};
    window.__prescriptionSettings = ${JSON.stringify(settings)};

    let userScale = 1.0;

    function updateScaleDisplay(s) {
      userScale = s;
      const el = document.getElementById('scaleDisplay');
      if (el) el.innerText = Math.round(s * 100) + '%';
    }

    function ajusterEchelle(delta) {
      userScale = Math.max(0.55, Math.min(1.30, userScale + delta));
      document.documentElement.style.setProperty('--presc-scale', userScale.toFixed(3));
      updateScaleDisplay(userScale);
    }

    function forcerAjustementUnePage(feedback) {
      const container = document.querySelector('.prescription-container');
      if (!container) return;

      const isA5 = ${isA5 ? 'true' : 'false'};
      const pageHeightMm = isA5 ? 210 : 297;
      // 1 mm = 3.779528 px sous Chromium à 96 DPI
      // Marge de tolérance de 6px pour garantir 0 débordement vers une page 2
      const maxAllowedPx = Math.floor(pageHeightMm * 3.779528) - 6;

      let currentScale = 1.0;
      document.documentElement.style.setProperty('--presc-scale', currentScale);

      // Si le contenu dépasse la hauteur d'une seule page, on réduit progressivement la police et les espacements
      let attempts = 0;
      while (container.scrollHeight > maxAllowedPx && attempts < 25 && currentScale > 0.58) {
        currentScale -= 0.025;
        document.documentElement.style.setProperty('--presc-scale', currentScale.toFixed(3));
        attempts++;
      }

      updateScaleDisplay(currentScale);
    }

    window.addEventListener('DOMContentLoaded', () => {
      forcerAjustementUnePage(false);
    });

    window.addEventListener('load', () => {
      forcerAjustementUnePage(false);
    });

    window.addEventListener('beforeprint', () => {
      forcerAjustementUnePage(false);
    });

    function changerModele(nouveauFormat) {
      if (window.opener && window.opener.generatePrescriptionReport) {
        window.opener.generatePrescriptionReport(window.__patient, window.__prescription, nouveauFormat, window.__prescriptionSettings);
      }
      window.close();
    }

    function changerFormatPapier(nouveauFormatPapier) {
      if (window.opener && window.opener.generatePrescriptionReport) {
        const s = { ...(window.__prescriptionSettings || {}), pageSize: nouveauFormatPapier };
        window.opener.generatePrescriptionReport(window.__patient, window.__prescription, null, s);
      }
      window.close();
    }

    function envoyerEmail() {
      const email = "${patient.email || ''}";
      const subject = encodeURIComponent("Ordonnance Médicale du ${dateStr} - ${patient.nom} ${patient.prenom}");
      const body = encodeURIComponent(
        "Bonjour ${patient.prenom},\\n\\nVeuillez trouver ci-joint votre ordonnance médicale du ${dateStr}.\\n\\nBien cordialement,\\nVotre Médecin"
      );
      window.location.href = "mailto:" + email + "?subject=" + subject + "&body=" + body;
    }
  </script>
</body>
</html>
  `;
}

/**
 * Ouvre la fenêtre d'impression haute définition de l'ordonnance médicale.
 */
export function generatePrescriptionReport(patient, prescription, chosenFormat = null, customSettings = null) {
  if (!patient || !prescription) {
    alert("Données insuffisantes pour générer l'ordonnance médicale.");
    return;
  }

  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) {
    alert("Veuillez autoriser les fenêtres pop-up pour afficher et imprimer l'ordonnance PDF.");
    return;
  }

  const htmlContent = buildPrescriptionHtml(patient, prescription, chosenFormat, customSettings);

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
