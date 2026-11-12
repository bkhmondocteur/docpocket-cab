import { APCI_LIST } from '../constants/medicalConstants';
import { getPrescriptionSettings } from './prescriptionSettingsService';
import { getActivePractitioner } from './practitionerService';

/**
 * Construit le code HTML complet et autonome d'une ordonnance médicale officielle.
 * Utilisable pour l'impression haute définition, l'export PDF et la prévisualisation en direct.
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

  // Gestion des couleurs et titres par format
  let titreOrdonnance = 'ORDONNANCE MÉDICALE';
  let badgeColor = settings.accentColor || '#0284c7';
  let cnamCardHtml = '';

  if (activeFormat === 'cnam_apci' || activeFormat === 'apci') {
    titreOrdonnance = 'ORDONNANCE MÉDICALE CNAM — PRISE EN CHARGE INTÉGRALE APCI';
    badgeColor = '#d97706';
    cnamCardHtml = `
      <div style="background: #fffbeb; border: 1.5px solid #d97706; border-radius: 8px; padding: 12px 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #fde68a; padding-bottom: 8px; margin-bottom: 8px;">
          <span style="font-weight: 800; color: #92400e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
            ★ CONVENTION CNAM — PRISE EN CHARGE INTÉGRALE APCI (100%)
          </span>
          <span style="font-size: 12px; color: #b45309; font-weight: 700;">
            Dispense d'avance des frais (Tiers-Payant 100%)
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; margin-bottom: 8px;">
          <div>
            <span style="color: #78350f; font-weight: 600;">N° DU CARNET CNAM :</span>
            <strong style="color: #0f172a; font-size: 15px; margin-left: 6px; letter-spacing: 0.5px; background: #fef3c7; padding: 2px 8px; border-radius: 4px; border: 1px solid #fcd34d;">
              ${numCarnet}
            </strong>
          </div>
          <div>
            <span style="color: #78350f;">Caisse d'affiliation :</span>
            <strong style="color: #0f172a; margin-left: 4px;">${patient.caisse || 'CNSS'}</strong>
          </div>
        </div>
        <div style="background: rgba(217, 119, 6, 0.08); padding: 8px 12px; border-radius: 6px; border-left: 4px solid #d97706;">
          <span style="color: #92400e; font-weight: 800; font-size: 12px; text-transform: uppercase;">AFFECTION(S) APCI RETENUE(S) :</span>
          <div style="color: #0f172a; font-weight: 700; font-size: 13.5px; margin-top: 2px;">
            ${apciLabel}
          </div>
        </div>
      </div>
    `;
  } else if (activeFormat === 'cnam_mo' || activeFormat === 'cnam_ordinaire') {
    titreOrdonnance = 'ORDONNANCE MÉDICALE CONVENTIONNÉE CNAM — MALADIE ORDINAIRE';
    badgeColor = '#059669';
    cnamCardHtml = `
      <div style="background: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 8px; padding: 12px 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #bbf7d0; padding-bottom: 8px; margin-bottom: 8px;">
          <span style="font-weight: 800; color: #166534; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
            🏛️ CONVENTION CNAM — RÉGIME MALADIE ORDINAIRE (MO)
          </span>
          <span style="font-size: 12px; color: #15803d; font-weight: 600;">
            Filière Privée / Tiers-Payant
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
          <div>
            <span style="color: #166534; font-weight: 600;">N° DU CARNET CNAM :</span>
            <strong style="color: #0f172a; font-size: 15px; margin-left: 6px; letter-spacing: 0.5px; background: #dcfce7; padding: 2px 8px; border-radius: 4px; border: 1px solid #86efac;">
              ${numCarnet}
            </strong>
          </div>
          <div>
            <span style="color: #166534;">Caisse d'affiliation :</span>
            <strong style="color: #0f172a; margin-left: 4px;">${patient.caisse || 'CNSS'}</strong>
          </div>
        </div>
        <div style="font-size: 11px; color: #15803d; margin-top: 6px; font-style: italic;">
          Ordonnance délivrée dans le cadre de la convention sectorielle CNAM - Régime Maladie Ordinaire.
        </div>
      </div>
    `;
  }

  const items = prescription.items || [];

  // Configuration géométrique selon le format de page (A4 ou A5)
  const isA5 = settings.pageSize === 'A5';
  const pageMargin = isA5 ? '8mm 10mm 10mm 10mm' : '15mm 18mm 20mm 18mm';
  const baseFontSize = isA5 ? '12px' : (settings.fontSize === 'compact' ? '12.5px' : settings.fontSize === 'large' ? '15px' : '14px');
  const containerPadding = isA5 ? '15px 20px' : '25px 35px';

  // En-tête logiciel ou Espace vierge pour papier pré-imprimé
  const cityDateText = settings.showCityDate ? `${docCity}, le ${dateStr}` : `Le ${dateStr}`;

  const headerHtml = settings.hideHeader ? `
    <!-- Espace réservé pour papier à en-tête d'imprimerie -->
    <div style="height: ${settings.headerTopMargin || 45}mm; display: flex; justify-content: flex-end; align-items: flex-end; padding-bottom: 6px; margin-bottom: 12px; border-bottom: 1px dashed #cbd5e1;">
      <div style="text-align: right;">
        <div style="font-size: 13px; font-weight: 600; color: #334155;">${cityDateText}</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Réf: ORD-${prescription.id || 'NOUV'}</div>
      </div>
    </div>
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
          <div style="font-size: 13px; color: #475569;">${settings.showCityDate ? `${docCity}, le` : 'Le'}</div>
          <div style="font-size: ${isA5 ? '15px' : '17px'}; font-weight: 700; color: #0f172a; margin-top: 2px;">${dateStr}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Réf: ORD-${prescription.id || 'NOUV'}</div>
        </td>
      </tr>
    </table>
  `;

  // Filigrane discret si renseigné
  const watermarkHtml = settings.watermarkText ? `
    <div style="position: fixed; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: ${isA5 ? '50px' : '75px'}; font-weight: 900; color: rgba(15, 23, 42, 0.04); text-transform: uppercase; letter-spacing: 6px; pointer-events: none; z-index: 0; white-space: nowrap;">
      ${settings.watermarkText}
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Ordonnance Médicale - ${patient.nom} ${patient.prenom} - ${dateStr}</title>
  <style>
    @page {
      size: ${settings.pageSize || 'A4'} ${settings.orientation || 'portrait'};
      margin: ${pageMargin};
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
      font-size: ${baseFontSize};
      line-height: 1.5;
    }
    .no-print {
      background: #0f172a;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-print { background: #0284c7; color: #fff; }
    .btn-email { background: #059669; color: #fff; margin-left: 8px; }
    .btn-close { background: #475569; color: #fff; margin-left: 8px; }

    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
    }

    .prescription-container {
      padding: ${containerPadding};
      max-width: ${isA5 ? '580px' : '820px'};
      margin: 0 auto;
      position: relative;
    }

    /* En-tête Cabinet */
    .header-table {
      width: 100%;
      border-bottom: 2px solid ${badgeColor};
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .doc-name {
      font-size: ${isA5 ? '17px' : '20px'};
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-sub {
      color: #475569;
      font-size: ${isA5 ? '11px' : '12px'};
      margin: 2px 0 0 0;
    }
    .doc-id {
      color: #64748b;
      font-size: ${isA5 ? '10px' : '11px'};
      margin: 4px 0 0 0;
    }

    /* Cartouche Patient */
    .patient-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: ${isA5 ? '8px 12px' : '10px 16px'};
      margin-bottom: 16px;
    }
    .patient-name {
      font-size: ${isA5 ? '14px' : '16px'};
      font-weight: 700;
      color: #0f172a;
    }
    .patient-details {
      font-size: ${isA5 ? '11px' : '12px'};
      color: #475569;
      margin-top: 2px;
    }

    /* Titre Document */
    .prescription-title-box {
      text-align: center;
      margin-bottom: 18px;
    }
    .prescription-title {
      display: inline-block;
      font-size: ${isA5 ? '13px' : '14.5px'};
      font-weight: 800;
      color: ${badgeColor};
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 3px 14px;
      border-bottom: 2px dashed ${badgeColor};
    }

    /* Corps de Prescription */
    .presc-list {
      margin: 0;
      padding: 0;
      list-style-type: none;
    }
    .presc-item {
      margin-bottom: ${isA5 ? '12px' : '16px'};
      padding-bottom: ${isA5 ? '10px' : '12px'};
      border-bottom: 1px dashed #e2e8f0;
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
      font-weight: 800;
      color: ${badgeColor};
      font-size: ${isA5 ? '13px' : '14.5px'};
      min-width: 20px;
    }
    .item-name {
      font-size: ${isA5 ? '13.5px' : '15px'};
      font-weight: 700;
      color: #0f172a;
    }
    .item-forme {
      font-size: 11.5px;
      color: #64748b;
      font-style: italic;
    }
    .item-posology {
      margin-left: 24px;
      margin-top: 3px;
      font-size: ${isA5 ? '12.5px' : '13.5px'};
      font-weight: 600;
      color: #1e293b;
    }
    .item-meta {
      margin-left: 24px;
      font-size: 11.5px;
      color: #64748b;
      margin-top: 2px;
    }
    .item-consigne {
      margin-left: 24px;
      font-size: 11.5px;
      color: #d97706;
      font-weight: 500;
      margin-top: 2px;
    }

    /* Zone Bas de Page */
    .prescription-footer {
      margin-top: ${isA5 ? '25px' : '35px'};
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      page-break-inside: avoid;
    }
    .arrete-box {
      font-size: ${isA5 ? '10.5px' : '11.5px'};
      color: #64748b;
      line-height: 1.45;
    }
    .signature-area {
      width: ${isA5 ? '200px' : '240px'};
      text-align: center;
      border-top: 1px dashed #94a3b8;
      padding-top: 6px;
      color: #475569;
      font-size: ${isA5 ? '11px' : '12px'};
    }
  </style>
</head>
<body>
  ${watermarkHtml}

  <!-- Barre d'outils (masquée à l'impression) -->
  <div class="no-print">
    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
      <span style="color: #fff; font-weight: 600; font-size: 13.5px;">
        💊 Ordonnance : ${patient.nom} ${patient.prenom}
      </span>

      <!-- Sélecteur rapide de modèle d'impression -->
      <select id="formatSelect" onchange="changerModele(this.value)" style="padding: 5px 10px; border-radius: 6px; background: #1e293b; color: #fff; border: 1px solid #38bdf8; font-size: 12px; font-weight: 600; cursor: pointer;">
        <option value="normale" ${activeFormat === 'normale' ? 'selected' : ''}>📄 Normale (${settings.pageSize || 'A4'})</option>
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
    ${headerHtml}

    <!-- Cartouche Patient -->
    <div class="patient-bar">
      <div>
        <div class="patient-name">${(patient.civility && !/mari|celib|veuf|divorc/i.test(patient.civility)) ? patient.civility : (patient.gender === 'F' ? ((patient.etat_civil === 'Célibataire' || /celib/i.test(patient.civility || '')) ? 'Mlle' : 'Mme') : 'M.')} ${patient.nom.toUpperCase()} ${patient.prenom}</div>
        <div class="patient-details">
          ${(settings.showPatientAge && patient.birthdate) ? `Né(e) le : <strong>${patient.birthdate}</strong>` : ''} 
          ${(settings.showPatientPhone && patient.telephone) ? `• Tél : <strong>${patient.telephone}</strong>` : ''}
          ${(settings.showPatientCin && patient.cin) ? `• CIN : <strong>${patient.cin}</strong>` : ''}
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 12px; color: #475569;">
          Caisse : <strong>${patient.caisse || 'Sans Caisse'}</strong>
        </div>
        ${numCarnet && numCarnet !== 'Non renseigné' ? `
          <div style="font-size: 11px; color: #64748b;">
            N° Carnet CNAM : <strong>${numCarnet}</strong>
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
        <div style="font-size: 12px; color: #64748b; margin-top: 5px; font-style: italic;">
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
            ${item.apci ? `<span style="font-size: 10px; background: #fef3c7; color: #b45309; padding: 1px 6px; border-radius: 4px; font-weight: 700;">APCI</span>` : ''}
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
      <div style="margin-top: 18px; padding: 8px 12px; background: #f8fafc; border-left: 3px solid ${badgeColor}; border-radius: 4px; font-size: 12px; color: #334155;">
        <strong>Recommandations médicales :</strong> ${prescription.notes}
      </div>
    ` : ''}

    <!-- Bas de Page & Signature -->
    <div class="prescription-footer">
      <div class="arrete-box">
        ${settings.showLineCount ? `Arrêtée la présente ordonnance à <strong>${items.length}</strong> ligne(s).<br>` : ''}
        ${settings.customFooterNote ? `<div>${settings.customFooterNote}</div>` : ''}
        ${(settings.showValidityNote && settings.validityNote) ? `<div style="margin-top: 4px; font-weight: 600; color: #334155;">📌 ${settings.validityNote}</div>` : ''}
      </div>

      ${settings.showSignatureBox ? `
        <div class="signature-area">
          <div>${cityDateText}</div>
          <div style="margin-top: 4px; font-weight: 700; color: #0f172a;">${settings.signatureTitle || 'Cachet & Signature du Médecin'}</div>
          <div style="height: ${isA5 ? '50px' : '65px'};"></div>
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
