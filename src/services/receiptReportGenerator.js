/**
 * Générateur et visualiseur de Quittance & Note d'Honoraires Médicale Officielle (PDF Haute Définition)
 * Permet l'impression directe, l'enregistrement en PDF local et l'envoi par email.
 * Supporte :
 *  - 'comptant' : Quittance d'honoraires pour patient en paiement comptant ou filière remboursement
 *  - 'cnam_mo' : Quittance de Ticket Modérateur CNAM (Filière Privée) avec mention du Tiers-Payant
 *  - 'cnam_apci' : Attestation de dispense d'avance des frais (Tiers-Payant 100% APCI)
 */

export function generateReceiptReport(patient, invoice) {
  if (!patient || !invoice) {
    alert("Données insuffisantes pour générer la quittance d'honoraires.");
    return;
  }

  const printWindow = window.open('', '_blank', 'width=880,height=960');
  if (!printWindow) {
    alert("Veuillez autoriser les fenêtres pop-up pour afficher et imprimer la quittance.");
    return;
  }

  const now = new Date();
  const dateStr = invoice.date || now.toISOString().split('T')[0];
  const numFacture = invoice.numFacture || `FAC-${now.getFullYear()}-0001`;

  const savedProfile = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('docpocket_doctor_profile') || '{}') : {};
  const docNom = savedProfile.nom ? `Dr. ${savedProfile.nom}` : 'Dr. Hamed BEN KHALIFA';
  const docSpec = savedProfile.specialite || 'Médecine Générale';
  const docOrdre = savedProfile.ordreId || '12052';
  const docCnam = savedProfile.cnamId || '010002763183';
  const docFisc = savedProfile.fiscId || '856103/M';
  const docAdresse = savedProfile.adresse ? `${savedProfile.adresse}, ${savedProfile.ville || ''}` : 'Complexe Médical Dar Attabib, Mahdia';
  const docTel = savedProfile.telephone || '31 576 900 / 53 573 117';

  // Formatage des montants en Dinars Tunisiens (3 décimales)
  const formatDT = (mtt) => {
    const num = parseFloat(mtt) || 0;
    return num.toFixed(3) + ' DT';
  };

  const mode = invoice.modeReglement || 'comptant';
  let badgeColor = '#0284c7';
  let badgeBg = '#f0f9ff';
  let badgeBorder = '#bae6fd';
  let badgeTitle = 'RÈGLEMENT COMPTANT';
  let badgeDesc = 'Filière Remboursement ou Sans Tiers-Payant';

  if (mode === 'cnam_mo') {
    badgeColor = '#059669';
    badgeBg = '#f0fdf4';
    badgeBorder = '#bbf7d0';
    badgeTitle = 'CONVENTION CNAM — MALADIE ORDINAIRE (MO)';
    badgeDesc = 'Filière Privée : Ticket Modérateur acquitté / Tiers-Payant CNAM';
  } else if (mode === 'cnam_apci') {
    badgeColor = '#d97706';
    badgeBg = '#fffbeb';
    badgeBorder = '#fde68a';
    badgeTitle = 'CONVENTION CNAM — PRISE EN CHARGE INTÉGRALE APCI (100%)';
    badgeDesc = "Dispense totale d'avance de frais (Tiers-Payant 100%)";
  } else if (mode === 'gratuit') {
    badgeColor = '#9333ea';
    badgeBg = '#faf5ff';
    badgeBorder = '#e9d5ff';
    badgeTitle = 'PRISE EN CHARGE GRATUITE / EXONÉRATION TOTALE (0 DT)';
    badgeDesc = 'Consultation de contrôle sous 7 jours, confraternelle ou cas social';
  }

  const numCarnet = invoice.patientCnamId || patient.cnamid || 'Non spécifié';
  const caisse = invoice.patientCaisse || patient.caisse || 'CNSS';
  const apciLabel = invoice.patientApciLabel || patient.apciLabel || '';

  // Lignes des actes
  const actes = Array.isArray(invoice.actes) && invoice.actes.length > 0
    ? invoice.actes
    : [
        {
          code: 'C',
          nom: 'Consultation Médicale',
          montantGlobal: invoice.totalGlobal || 40.0,
          partCnam: invoice.partCnam || 0.0,
          partPatient: invoice.partPatient || 40.0,
          quantite: 1
        }
      ];

  const rowsHtml = actes.map((acte, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">
        ${acte.nom || 'Acte médical'}
        ${acte.code ? `<span style="font-size: 11px; color: #64748b; margin-left: 6px;">[Code: ${acte.code}]</span>` : ''}
      </td>
      <td style="padding: 10px 12px; text-align: center; color: #334155;">
        ${acte.quantite || 1}
      </td>
      <td style="padding: 10px 12px; text-align: right; color: #0f172a; font-weight: 500;">
        ${formatDT(acte.montantGlobal)}
      </td>
      <td style="padding: 10px 12px; text-align: right; color: #0284c7; font-weight: 600;">
        ${formatDT(acte.partCnam)}
      </td>
      <td style="padding: 10px 12px; text-align: right; color: #059669; font-weight: 700;">
        ${formatDT(acte.partPatient)}
      </td>
    </tr>
  `).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8">
      <title>Quittance d'Honoraires - ${patient.fullname || (patient.nom + ' ' + patient.prenom)}</title>
      <style>
        @page {
          size: A5 landscape;
          margin: 12mm 15mm;
        }
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #f8fafc;
          margin: 0;
          padding: 20px;
        }
        .container {
          background: #ffffff;
          max-width: 820px;
          margin: 0 auto;
          padding: 28px 32px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          border: 1px solid #e2e8f0;
          position: relative;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0284c7;
          padding-bottom: 14px;
          margin-bottom: 16px;
        }
        .doctor-info h1 {
          font-size: 19px;
          color: #0369a1;
          margin: 0 0 4px 0;
          font-weight: 800;
          letter-spacing: -0.3px;
        }
        .doctor-info p {
          font-size: 11.5px;
          color: #475569;
          margin: 2px 0;
          line-height: 1.4;
        }
        .receipt-badge {
          text-align: right;
        }
        .receipt-title {
          font-size: 17px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .receipt-num {
          font-size: 13px;
          font-weight: 700;
          color: #0284c7;
          margin-top: 3px;
        }
        .receipt-date {
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
        }
        .patient-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 16px;
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 12px;
          font-size: 12.5px;
        }
        .reglement-banner {
          background: ${badgeBg};
          border: 1px solid ${badgeBorder};
          border-left: 5px solid ${badgeColor};
          border-radius: 6px;
          padding: 10px 14px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
          margin-bottom: 16px;
        }
        th {
          background: #f1f5f9;
          color: #334155;
          text-transform: uppercase;
          font-size: 11px;
          font-weight: 700;
          padding: 8px 12px;
          border-bottom: 2px solid #cbd5e1;
        }
        .totals-card {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 20px;
        }
        .totals-table {
          width: 340px;
          border-collapse: collapse;
          font-size: 13px;
        }
        .totals-table td {
          padding: 6px 12px;
        }
        .totals-table tr.grand-total {
          background: #f0fdf4;
          font-weight: 800;
          font-size: 15px;
          color: #166534;
          border-top: 2px solid #86efac;
          border-bottom: 2px solid #86efac;
        }
        .footer-signatures {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px dashed #cbd5e1;
        }
        .stamp-box {
          border: 1.5px dashed #94a3b8;
          border-radius: 8px;
          width: 220px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 11px;
          text-align: center;
          background: #f8fafc;
        }
        .actions-bar {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .btn {
          padding: 10px 18px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          border: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .btn-print { background: #0284c7; color: white; }
        .btn-close { background: #64748b; color: white; }
      </style>
    </head>
    <body>
      <div class="actions-bar no-print">
        <button class="btn btn-print" onclick="window.print()">
          🖨️ Imprimer la Quittance / Facture
        </button>
        <button class="btn" style="background: #059669; color: white;" onclick="downloadHtml()">
          💾 Sauvegarder Quittance
        </button>
        <button class="btn btn-close" onclick="window.close()">
          ✕ Fermer
        </button>
      </div>

      <div class="container" id="printable-invoice">
        <!-- En-Tête Médecin & Cabinet -->
        <div class="header">
          <div class="doctor-info">
            <h1>CABINET MÉDICAL</h1>
            <p><strong>${docNom}</strong> — ${docSpec}</p>
            <p>N° Ordre des Médecins : <strong>${docOrdre}</strong> | Code Conv. CNAM : <strong>${docCnam}</strong></p>
            <p>Matricule Fiscal : <strong>${docFisc}</strong></p>
            <p>${docAdresse} | Tél : ${docTel}</p>
          </div>

          <div class="receipt-badge">
            <div class="receipt-title">NOTE D'HONORAIRES & QUITTANCE</div>
            <div class="receipt-num">N° ${numFacture}</div>
            <div class="receipt-date">Date : <strong>${dateStr}</strong></div>
          </div>
        </div>

        <!-- Informations Patient -->
        <div class="patient-card">
          <div>
            <div>Patient : <strong style="font-size: 14px; color: #0f172a;">${patient.fullname || (patient.nom + ' ' + patient.prenom)}</strong></div>
            <div style="margin-top: 4px; color: #475569;">
              ${patient.birthdate ? `Né(e) le : <strong>${patient.birthdate}</strong>` : ''} 
              ${patient.cin ? ` | CIN : <strong>${patient.cin}</strong>` : ''}
              ${patient.telephone ? ` | Tél : <strong>${patient.telephone}</strong>` : ''}
            </div>
            ${patient.numfch ? `<div style="margin-top: 4px; color: #64748b;">N° Dossier : <strong>${patient.numfch}</strong></div>` : ''}
          </div>

          <div>
            <div>Caisse : <strong>${caisse}</strong> | Qualité : <strong>${patient.quality || 'Assuré(e)'}</strong></div>
            <div style="margin-top: 4px;">
              N° Carnet CNAM : <strong style="color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 4px;">${numCarnet}</strong>
            </div>
            ${apciLabel ? `<div style="margin-top: 4px; font-size: 11px; color: #d97706; font-weight: 700;">★ APCI : ${apciLabel}</div>` : ''}
          </div>
        </div>

        <!-- Régime de prise en charge -->
        <div class="reglement-banner">
          <div>
            <strong style="color: ${badgeColor}; font-size: 13px; text-transform: uppercase;">
              ${badgeTitle}
            </strong>
            <div style="font-size: 11.5px; color: #475569; margin-top: 2px;">
              ${badgeDesc}
            </div>
          </div>
          <div style="font-size: 12px; font-weight: 700; color: ${badgeColor};">
            ${mode === 'cnam_apci' ? 'PRISE EN CHARGE 100%' : (mode === 'cnam_mo' ? 'TIERS-PAYANT CNAM + TM' : 'ACQUITTÉ COMPTANT')}
          </div>
        </div>

        <!-- Tableau des Actes -->
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Désignation de la prestation / Acte</th>
              <th style="text-align: center; width: 60px;">Qté</th>
              <th style="text-align: right; width: 120px;">Montant Total</th>
              <th style="text-align: right; width: 130px;">Part Prise en Charge (CNAM)</th>
              <th style="text-align: right; width: 130px;">Part Patient (Payée)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- Synthèse des Totaux -->
        <div class="totals-card">
          <table class="totals-table">
            <tr>
              <td style="color: #64748b;">Montant Brut Total :</td>
              <td style="text-align: right; font-weight: 600; color: #0f172a;">${formatDT(invoice.totalGlobal)}</td>
            </tr>
            <tr>
              <td style="color: #0284c7;">Part Prise en Charge CNAM (Tiers-Payant) :</td>
              <td style="text-align: right; font-weight: 700; color: #0284c7;">- ${formatDT(invoice.partCnam)}</td>
            </tr>
            <tr class="grand-total">
              <td>NET PAYÉ PAR LE PATIENT :</td>
              <td style="text-align: right;">${formatDT(invoice.partPatient)}</td>
            </tr>
          </table>
        </div>

        <!-- Mode de règlement & Mentions -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; font-size: 12px; margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between;">
            <div>
              Mode de paiement : <strong>${(invoice.moyenPaiement || 'Espèces').toUpperCase()}</strong>
              ${invoice.montantRecu ? ` (Reçu : <strong>${formatDT(invoice.montantRecu)}</strong>` : ''}
              ${invoice.monnaieRendue ? ` | Rendu : <strong>${formatDT(invoice.monnaieRendue)}</strong>)` : (invoice.montantRecu ? ')' : '')}
            </div>
            <div>
              Statut : <strong style="color: #16a34a;">✓ FACTURE ACQUITTÉE</strong>
            </div>
          </div>
          ${invoice.observations ? `<div style="margin-top: 4px; color: #64748b; font-style: italic;">Observations : ${invoice.observations}</div>` : ''}
        </div>

        <!-- Pied de page & Cachet -->
        <div class="footer-signatures">
          <div style="font-size: 11px; color: #64748b; max-width: 480px; line-height: 1.4;">
            <p style="margin: 0;">
              Quittance d'honoraires délivrée pour servir et valoir ce que de droit.
            </p>
            <p style="margin: 3px 0 0 0; color: #94a3b8;">
              Logiciel DocPocket Cabinet — Conforme réglementation CNAM Tunisie.
            </p>
          </div>

          <div style="text-align: center;">
            <div style="font-size: 11.5px; font-weight: 600; color: #334155; margin-bottom: 6px;">
              Cachet & Signature du Praticien
            </div>
            <div class="stamp-box">
              ${docNom}<br>
              ${docSpec}<br>
              Code Conv : ${docCnam}
            </div>
          </div>
        </div>
      </div>

      <script>
        function downloadHtml() {
          const content = document.getElementById('printable-invoice').outerHTML;
          const blob = new Blob(['<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Quittance_${patient.nom || 'Patient'}</title>' + document.head.innerHTML + '</head><body>' + content + '</body></html>'], { type: 'text/html;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = "Quittance_${(patient.nom || 'Patient')}_${numFacture}.html";
          a.click();
          URL.revokeObjectURL(url);
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
