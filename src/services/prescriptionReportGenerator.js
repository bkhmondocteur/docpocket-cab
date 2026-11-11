import { APCI_LIST } from '../constants/medicalConstants';

/**
 * Générateur et visualiseur d'Ordonnance Médicale Officielle (PDF Haute Définition)
 * Permet l'impression directe, l'enregistrement en PDF local et l'envoi par email.
 * Supporte :
 *  - 'normale' : Ordonnance Médicale Standard de Cabinet
 *  - 'cnam_mo' : Ordonnance Conventionnée CNAM - Maladie Ordinaire (avec N° Carnet CNAM)
 *  - 'cnam_apci' : Ordonnance CNAM - Prise en charge intégrale APCI 100% (avec N° Carnet CNAM et type d'APCI choisi)
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

  const now = new Date();
  const dateStr = prescription.date || now.toLocaleDateString('fr-FR');
  const activeFormat = chosenFormat || prescription.printFormat || prescription.type || 'normale';

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

  // Profil praticien actif
  let docProfile = {};
  try {
    const raw = localStorage.getItem('docpocket_doctor_profile');
    if (raw) docProfile = JSON.parse(raw);
  } catch (e) {}

  const docTitre = docProfile.titre || 'Dr.';
  const docNom = docProfile.nom ? `${docTitre} ${docProfile.nom}` : 'Dr. Hamed BEN KHALIFA';
  const docSpecialite = docProfile.specialite || 'Médecine Générale';
  const docAdresse = [docProfile.adresse, docProfile.ville].filter(Boolean).join(', ') || 'Complexe Médical Dar Attabib, Mahdia';
  const docTel = docProfile.telephone ? `Tél : ${docProfile.telephone}` : 'Tél : 31 576 900 / 53 573 117';
  const docEmail = docProfile.email ? ` • Email : ${docProfile.email}` : '';
  const docOrdre = docProfile.ordreId ? `N° d'Ordre Médecins : ${docProfile.ordreId}` : "N° d'Ordre Médecins : 12052";
  const docCnam = docProfile.cnamId ? ` • Code CNAM : ${docProfile.cnamId}` : ' • Code CNAM : 010002763183';
  const docFisc = docProfile.fiscId ? ` • Identifiant Fiscal : ${docProfile.fiscId}` : ' • Identifiant Fiscal : 856103/M';
  const docCity = docProfile.ville || 'Mahdia';

  let titreOrdonnance = 'ORDONNANCE MÉDICALE';
  let badgeColor = '#0284c7';
  let cnamCardHtml = '';

  if (activeFormat === 'cnam_apci' || activeFormat === 'apci') {
    titreOrdonnance = 'ORDONNANCE MÉDICALE CNAM — PRISE EN CHARGE INTÉGRALE APCI';
    badgeColor = '#d97706';
    cnamCardHtml = `
      <div style="background: #fffbeb; border: 1.5px solid #d97706; border-radius: 8px; padding: 12px 18px; margin-bottom: 22px;">
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
      <div style="background: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 8px; padding: 12px 18px; margin-bottom: 22px;">
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

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Ordonnance Médicale - ${patient.nom} ${patient.prenom} - ${dateStr}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 18mm 20mm 18mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 14px;
      line-height: 1.6;
    }
    .no-print {
      background: #0f172a;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .btn {
      padding: 8px 18px;
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
    .btn-email { background: #059669; color: #fff; margin-left: 10px; }
    .btn-close { background: #475569; color: #fff; margin-left: 10px; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
    }

    .prescription-container {
      padding: 30px 40px;
      max-width: 800px;
      margin: 0 auto;
    }

    /* En-tête Cabinet */
    .header-table {
      width: 100%;
      border-bottom: 2px solid ${badgeColor};
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .doc-name {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-sub {
      color: #475569;
      font-size: 12px;
      margin: 2px 0 0 0;
    }
    .doc-id {
      color: #64748b;
      font-size: 11px;
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
      padding: 12px 18px;
      margin-bottom: 20px;
    }
    .patient-name {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }
    .patient-details {
      font-size: 12px;
      color: #475569;
      margin-top: 2px;
    }

    /* Titre Document */
    .prescription-title-box {
      text-align: center;
      margin-bottom: 24px;
    }
    .prescription-title {
      display: inline-block;
      font-size: 15px;
      font-weight: 800;
      color: ${badgeColor};
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 4px 16px;
      border-bottom: 2px dashed ${badgeColor};
    }

    /* Corps de Prescription */
    .presc-list {
      margin: 0;
      padding: 0;
      list-style-type: none;
    }
    .presc-item {
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px dashed #e2e8f0;
      page-break-inside: avoid;
    }
    .presc-item:last-child {
      border-bottom: none;
    }
    .item-header {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .item-number {
      font-weight: 800;
      color: ${badgeColor};
      font-size: 15px;
      min-width: 22px;
    }
    .item-name {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
    }
    .item-forme {
      font-size: 12px;
      color: #64748b;
      font-style: italic;
    }
    .item-posology {
      margin-left: 28px;
      margin-top: 4px;
      font-size: 13.5px;
      font-weight: 600;
      color: #1e293b;
    }
    .item-meta {
      margin-left: 28px;
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }
    .item-consigne {
      margin-left: 28px;
      font-size: 12px;
      color: #d97706;
      font-weight: 500;
      margin-top: 2px;
    }

    /* Zone Bas de Page */
    .prescription-footer {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      page-break-inside: avoid;
    }
    .arrete-box {
      font-size: 11px;
      color: #64748b;
      font-style: italic;
    }
    .signature-area {
      width: 250px;
      text-align: center;
      border-top: 1px dashed #94a3b8;
      padding-top: 8px;
      color: #475569;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <!-- Barre d'outils (masquée à l'impression) -->
  <div class="no-print">
    <div style="display: flex; align-items: center; gap: 14px;">
      <span style="color: #fff; font-weight: 600; font-size: 14px;">
        💊 Ordonnance : ${patient.nom} ${patient.prenom}
      </span>

      <!-- Sélecteur rapide de modèle d'impression -->
      <select id="formatSelect" onchange="changerModele(this.value)" style="padding: 6px 12px; border-radius: 6px; background: #1e293b; color: #fff; border: 1px solid #38bdf8; font-size: 12px; font-weight: 600; cursor: pointer;">
        <option value="normale" ${activeFormat === 'normale' ? 'selected' : ''}>📄 Ordonnance Normale</option>
        <option value="cnam_mo" ${activeFormat === 'cnam_mo' || activeFormat === 'cnam_ordinaire' ? 'selected' : ''}>🏛️ CNAM MO (Maladie Ordinaire)</option>
        <option value="cnam_apci" ${activeFormat === 'cnam_apci' || activeFormat === 'apci' ? 'selected' : ''}>★ CNAM APCI (100%)</option>
      </select>
    </div>

    <div>
      <button class="btn btn-print" onclick="window.print()">
        🖨️ Imprimer / Sauvegarder en PDF
      </button>
      <button class="btn btn-email" onclick="envoyerEmail()">
        ✉️ Envoyer par Email
      </button>
      <button class="btn btn-close" onclick="window.close()">
        ✕ Fermer
      </button>
    </div>
  </div>

  <div class="prescription-container">
    <!-- En-tête Cabinet -->
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
          <div style="font-size: 13px; color: #475569;">${docCity}, le</div>
          <div style="font-size: 17px; font-weight: 700; color: #0f172a; margin-top: 2px;">${dateStr}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Réf: ORD-${prescription.id || 'NOUV'}</div>
        </td>
      </tr>
    </table>

    <!-- Cartouche Patient -->
    <div class="patient-bar">
      <div>
        <div class="patient-name">${(patient.civility && !/mari|celib|veuf|divorc/i.test(patient.civility)) ? patient.civility : (patient.gender === 'F' ? ((patient.etat_civil === 'Célibataire' || /celib/i.test(patient.civility || '')) ? 'Mlle' : 'Mme') : 'M.')} ${patient.nom.toUpperCase()} ${patient.prenom}</div>
        <div class="patient-details">
          ${patient.birthdate ? `Né(e) le : <strong>${patient.birthdate}</strong>` : ''} 
          ${patient.telephone ? `• Tél : <strong>${patient.telephone}</strong>` : ''}
          ${patient.cin ? `• CIN : <strong>${patient.cin}</strong>` : ''}
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
        <div style="font-size: 12px; color: #64748b; margin-top: 6px; font-style: italic;">
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
      <div style="margin-top: 25px; padding: 10px 14px; background: #f8fafc; border-left: 3px solid #0284c7; border-radius: 4px; font-size: 12px; color: #334155;">
        <strong>Recommandations médicales :</strong> ${prescription.notes}
      </div>
    ` : ''}

    <!-- Bas de Page & Signature -->
    <div class="prescription-footer">
      <div class="arrete-box">
        Arrêtée la présente ordonnance à <strong>${items.length}</strong> ligne(s).<br>
        En cas de persistance des symptômes, veuillez reconsulter.
      </div>
      <div class="signature-area">
        <div>Fait à Tunis, le ${dateStr}</div>
        <div style="margin-top: 6px; font-weight: 700; color: #0f172a;">Cachet & Signature du Médecin</div>
        <div style="height: 65px;"></div>
      </div>
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

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
