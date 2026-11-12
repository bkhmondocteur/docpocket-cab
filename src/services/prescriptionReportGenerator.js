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
 * Adaptée automatiquement aux formats A5 (carnet) et A4 (page entière),
 * avec calibration visuelle sur papier pré-imprimé et respect strict de la confidentialité.
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
  const sideMarginMm = settings.sideMargin || (isA5 ? 8 : 14);
  const bottomMarginMm = settings.bottomMargin || (isA5 ? 10 : 16);
  const headerTopMarginMm = settings.headerTopMargin || 42;

  // Gestion des couleurs et titres par format
  let titreOrdonnance = 'ORDONNANCE MÉDICALE';
  let badgeColor = settings.accentColor || '#0284c7';
  let cnamCardHtml = '';

  if (activeFormat === 'cnam_apci' || activeFormat === 'apci') {
    titreOrdonnance = 'ORDONNANCE MÉDICALE CNAM — PRISE EN CHARGE INTÉGRALE APCI';
    badgeColor = '#d97706';
    cnamCardHtml = `
      <div style="background: #fffbeb; border: 1.5px solid #d97706; border-radius: 6px; padding: ${isA5 ? '6px 10px' : '10px 16px'}; margin-bottom: ${isA5 ? '10px' : '16px'};">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #fde68a; padding-bottom: 4px; margin-bottom: 6px;">
          <span style="font-weight: 800; color: #92400e; font-size: ${isA5 ? '10.5px' : '12.5px'}; text-transform: uppercase; letter-spacing: 0.5px;">
            ★ CONVENTION CNAM — PRISE EN CHARGE INTÉGRALE APCI (100%)
          </span>
          <span style="font-size: ${isA5 ? '9.5px' : '11.5px'}; color: #b45309; font-weight: 700;">
            Dispense d'avance des frais (Tiers-Payant 100%)
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: ${isA5 ? '11px' : '12.5px'}; margin-bottom: 6px;">
          <div>
            <span style="color: #78350f; font-weight: 600;">N° DU CARNET CNAM :</span>
            <strong style="color: #0f172a; font-size: ${isA5 ? '12.5px' : '14px'}; margin-left: 6px; letter-spacing: 0.5px; background: #fef3c7; padding: 1px 6px; border-radius: 4px; border: 1px solid #fcd34d;">
              ${numCarnet}
            </strong>
          </div>
          <div>
            <span style="color: #78350f;">Caisse :</span>
            <strong style="color: #0f172a; margin-left: 4px;">${patient.caisse || 'CNSS'}</strong>
          </div>
        </div>
        <div style="background: rgba(217, 119, 6, 0.08); padding: 5px 8px; border-radius: 4px; border-left: 3px solid #d97706;">
          <span style="color: #92400e; font-weight: 800; font-size: ${isA5 ? '10px' : '11px'}; text-transform: uppercase;">AFFECTION(S) APCI RETENUE(S) :</span>
          <div style="color: #0f172a; font-weight: 700; font-size: ${isA5 ? '11.5px' : '13px'}; margin-top: 1px;">
            ${apciLabel}
          </div>
        </div>
      </div>
    `;
  } else if (activeFormat === 'cnam_mo' || activeFormat === 'cnam_ordinaire') {
    titreOrdonnance = 'ORDONNANCE MÉDICALE CONVENTIONNÉE CNAM — MALADIE ORDINAIRE';
    badgeColor = '#059669';
    cnamCardHtml = `
      <div style="background: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 6px; padding: ${isA5 ? '6px 10px' : '10px 16px'}; margin-bottom: ${isA5 ? '10px' : '16px'};">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #bbf7d0; padding-bottom: 4px; margin-bottom: 6px;">
          <span style="font-weight: 800; color: #166534; font-size: ${isA5 ? '10.5px' : '12.5px'}; text-transform: uppercase; letter-spacing: 0.5px;">
            🏛️ CONVENTION CNAM — RÉGIME MALADIE ORDINAIRE (MO)
          </span>
          <span style="font-size: ${isA5 ? '9.5px' : '11.5px'}; color: #15803d; font-weight: 600;">
            Filière Privée / Tiers-Payant
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: ${isA5 ? '11px' : '12.5px'};">
          <div>
            <span style="color: #166534; font-weight: 600;">N° DU CARNET CNAM :</span>
            <strong style="color: #0f172a; font-size: ${isA5 ? '12.5px' : '14px'}; margin-left: 6px; letter-spacing: 0.5px; background: #dcfce7; padding: 1px 6px; border-radius: 4px; border: 1px solid #86efac;">
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

  // Calibrage des polices selon A5 / A4 et taille choisie
  const fontMultiplier = settings.fontSize === 'compact' ? 0.92 : (settings.fontSize === 'large' ? 1.1 : 1.0);
  const baseFontSize = isA5 ? (11 * fontMultiplier) : (13.5 * fontMultiplier);

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Ordonnance Médicale - ${patient.nom} ${patient.prenom} - ${dateStr}</title>
  <style>
    @page {
      size: ${isA5 ? 'A5' : 'A4'} ${settings.orientation || 'portrait'};
      margin: ${isA5 ? '4mm 6mm 4mm 6mm' : '8mm 12mm 10mm 12mm'};
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: ${baseFontSize}px;
      line-height: ${isA5 ? 1.35 : 1.5};
      -webkit-font-smoothing: antialiased;
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
      .no-print { display: none !important; }
      body { padding: 0; background: #ffffff !important; }
      .preprinted-spacer { border: none !important; border-bottom: none !important; }
      ${!settings.printTemplateBackground ? `
        .template-bg-layer { display: none !important; }
      ` : `
        .template-bg-layer { display: block !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}
    }

    .prescription-container {
      width: 100%;
      max-width: ${isA5 ? '138mm' : '188mm'};
      min-height: ${isA5 ? '198mm' : '275mm'};
      box-sizing: border-box;
      padding-left: ${sideMarginMm}mm;
      padding-right: ${sideMarginMm}mm;
      padding-bottom: ${bottomMarginMm}mm;
      margin: 0 auto;
      position: relative;
      background: transparent;
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
      font-size: ${isA5 ? '15px' : '20px'};
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-sub {
      color: #475569;
      font-size: ${isA5 ? '10px' : '12px'};
      margin: 1px 0 0 0;
    }
    .doc-id {
      color: #64748b;
      font-size: ${isA5 ? '9px' : '11px'};
      margin: 3px 0 0 0;
    }

    /* Cartouche Patient Allégé (Zéro CIN, Zéro Tél, Zéro Date Naissance) */
    .patient-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: ${isA5 ? '6px 10px' : '8px 14px'};
      margin-bottom: ${isA5 ? '10px' : '14px'};
    }
    .patient-name {
      font-size: ${isA5 ? '13px' : '15.5px'};
      font-weight: 700;
      color: #0f172a;
    }
    .patient-age {
      font-size: ${isA5 ? '11px' : '13px'};
      font-weight: 600;
      color: #64748b;
      margin-left: 6px;
    }

    /* Titre Document */
    .prescription-title-box {
      text-align: center;
      margin-bottom: ${isA5 ? '10px' : '16px'};
    }
    .prescription-title {
      display: inline-block;
      font-size: ${isA5 ? '12px' : '14px'};
      font-weight: 800;
      color: ${badgeColor};
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 2px 10px;
      border-bottom: 2px dashed ${badgeColor};
    }

    /* Corps de Prescription */
    .presc-list {
      margin: 0;
      padding: 0;
      list-style-type: none;
    }
    .presc-item {
      margin-bottom: ${isA5 ? '8px' : '14px'};
      padding-bottom: ${isA5 ? '6px' : '10px'};
      border-bottom: 1px dashed #e2e8f0;
      page-break-inside: avoid;
    }
    .presc-item:last-child {
      border-bottom: none;
    }
    .item-header {
      display: flex;
      align-items: baseline;
      gap: 5px;
    }
    .item-number {
      font-weight: 800;
      color: ${badgeColor};
      font-size: ${isA5 ? '11.5px' : '14px'};
      min-width: 18px;
    }
    .item-name {
      font-size: ${isA5 ? '12px' : '14.5px'};
      font-weight: 700;
      color: #0f172a;
    }
    .item-forme {
      font-size: ${isA5 ? '10px' : '11.5px'};
      color: #64748b;
      font-style: italic;
    }
    .item-posology {
      margin-left: ${isA5 ? '18px' : '24px'};
      margin-top: 2px;
      font-size: ${isA5 ? '11px' : '13px'};
      font-weight: 600;
      color: #1e293b;
    }
    .item-meta {
      margin-left: ${isA5 ? '18px' : '24px'};
      font-size: ${isA5 ? '10px' : '11.5px'};
      color: #64748b;
      margin-top: 2px;
    }
    .item-consigne {
      margin-left: ${isA5 ? '18px' : '24px'};
      font-size: ${isA5 ? '10px' : '11.5px'};
      color: #d97706;
      font-weight: 500;
      margin-top: 2px;
    }

    /* Zone Bas de Page */
    .prescription-footer {
      margin-top: ${isA5 ? '16px' : '28px'};
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      page-break-inside: avoid;
    }
    .arrete-box {
      font-size: ${isA5 ? '9.5px' : '11px'};
      color: #64748b;
      line-height: 1.4;
    }
    .signature-area {
      width: ${isA5 ? '175px' : '230px'};
      text-align: center;
      border-top: 1px dashed #94a3b8;
      padding-top: 4px;
      color: #475569;
      font-size: ${isA5 ? '10px' : '11.5px'};
    }
    .signature-space {
      height: ${isA5 ? '38px' : '58px'};
    }
  </style>
</head>
<body>
  ${watermarkHtml}

  <!-- Barre d'outils (masquée à l'impression) -->
  <div class="no-print">
    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
      <span style="color: #fff; font-weight: 600; font-size: 13px;">
        💊 Ordonnance : ${patient.nom} ${patient.prenom}
      </span>

      <!-- Sélecteur rapide de modèle d'impression -->
      <select id="formatSelect" onchange="changerModele(this.value)" style="padding: 4px 8px; border-radius: 6px; background: #1e293b; color: #fff; border: 1px solid #38bdf8; font-size: 11.5px; font-weight: 600; cursor: pointer;">
        <option value="normale" ${activeFormat === 'normale' ? 'selected' : ''}>📄 Normale (${isA5 ? 'A5' : 'A4'})</option>
        <option value="cnam_mo" ${activeFormat === 'cnam_mo' || activeFormat === 'cnam_ordinaire' ? 'selected' : ''}>🏛️ CNAM MO</option>
        <option value="cnam_apci" ${activeFormat === 'cnam_apci' || activeFormat === 'apci' ? 'selected' : ''}>★ CNAM APCI (100%)</option>
      </select>
    </div>

    <div>
      <button class="btn btn-print" onclick="window.print()">
        🖨️ Imprimer / PDF
      </button>
      <button class="btn btn-email" onclick="envoyerEmail()">
        ✉️ Email
      </button>
      <button class="btn btn-close" onclick="window.close()">
        ✕ Fermer
      </button>
    </div>
  </div>

  <div class="prescription-container">
    ${templateBgLayer}
    ${headerHtml}

    <!-- Cartouche Patient Allégé (Zéro CIN, Zéro Tél, Zéro Date Naissance) -->
    <div class="patient-bar">
      <div>
        <span class="patient-name">${patientCivility} ${patient.nom.toUpperCase()} ${patient.prenom}</span>
        ${patientAgeStr ? `<span class="patient-age">(${patientAgeStr})</span>` : ''}
      </div>
      <div style="text-align: right;">
        ${(activeFormat === 'cnam_mo' || activeFormat === 'cnam_apci') ? `
          <div style="font-size: ${isA5 ? '10px' : '11.5px'}; color: #166534; font-weight: 600;">
            Caisse : <strong>${patient.caisse || 'CNSS'}</strong>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Cartouche Réglementaire CNAM (MO ou APCI avec N° Carnet et Affection) -->
    ${cnamCardHtml}

    <!-- Titre de l'Ordonnance -->
    <div class="prescription-title-box">
      <div class="prescription-title">${titreOrdonnance}</div>
      ${prescription.indication ? `
        <div style="font-size: ${isA5 ? '10.5px' : '12px'}; color: #64748b; margin-top: 4px; font-style: italic;">
          Indication / Diagnostic : ${prescription.indication}
        </div>
      ` : ''}
    </div>

    <!-- Liste des Médicaments / Examens Prescrits -->
    <ul class="presc-list">
      ${items.map((item, idx) => `
        <li class="presc-item">
          <div class="item-header">
            <span class="item-number">${idx + 1}.</span>
            <span class="item-name">${item.nom}</span>
            ${item.forme ? `<span class="item-forme">(${item.forme})</span>` : ''}
            ${item.apci ? `<span style="font-size: ${isA5 ? '9px' : '10px'}; background: #fef3c7; color: #b45309; padding: 1px 5px; border-radius: 4px; font-weight: 700;">APCI</span>` : ''}
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
      <div style="margin-top: ${isA5 ? '12px' : '16px'}; padding: 6px 10px; background: #f8fafc; border-left: 3px solid ${badgeColor}; border-radius: 4px; font-size: ${isA5 ? '10px' : '12px'}; color: #334155;">
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
          <div style="font-weight: 600; color: #334155;">${cityDateText}</div>
          <div style="margin-top: 3px; font-weight: 700; color: #0f172a;">${settings.signatureTitle || 'Cachet & Signature du Médecin'}</div>
          <div class="signature-space"></div>
        </div>
      ` : ''}
    </div>
  </div>

  <script>
    window.__patient = ${JSON.stringify(patient)};
    window.__prescription = ${JSON.stringify(prescription)};

    function changerModele(nouveauFormat) {
      if (window.opener && window.opener.generatePrescriptionReport) {
        window.opener.generatePrescriptionReport(window.__patient, window.__prescription, nouveauFormat);
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
export function generatePrescriptionReport(patient, prescription, chosenFormat = null) {
  if (!patient || !prescription) {
    alert("Données insuffisantes pour générer l'ordonnance médicale.");
    return;
  }

  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) {
    alert("Veuillez autoriser les fenêtres pop-up pour afficher et imprimer l'ordonnance PDF.");
    return;
  }

  const htmlContent = buildPrescriptionHtml(patient, prescription, chosenFormat);

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
