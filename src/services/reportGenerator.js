/**
 * Génère et affiche le document médical officiel (PDF Haute Définition)
 * avec mise en page normalisée (en-tête cabinet, coordonnées patient,
 * constantes cliniques sous forme de cartouche, examen par appareil et conclusion).
 * Permet l'impression directe, l'enregistrement en PDF local et le partage par email.
 */
export function generateConsultationReport(patient, consultation) {
  if (!patient || !consultation) {
    alert("Données insuffisantes pour générer le rapport médical.");
    return;
  }

  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) {
    alert("Veuillez autoriser les fenêtres pop-up dans votre navigateur pour afficher et imprimer le rapport PDF.");
    return;
  }

  const now = new Date();
  const dateStr = consultation.date || now.toLocaleDateString('fr-FR');
  const heureStr = consultation.heure || now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // Calcul IMC et interprétation
  let bmiHtml = '';
  if (consultation.bmi) {
    const bmiNum = parseFloat(consultation.bmi);
    let bmiLabel = '';
    let bmiColor = '#0284c7';
    if (bmiNum < 18.5) { bmiLabel = 'Insuffisance pondérale'; bmiColor = '#0284c7'; }
    else if (bmiNum < 25) { bmiLabel = 'Corpulence normale'; bmiColor = '#16a34a'; }
    else if (bmiNum < 30) { bmiLabel = 'Surpoids'; bmiColor = '#d97706'; }
    else { bmiLabel = 'Obésité'; bmiColor = '#dc2626'; }

    bmiHtml = `${consultation.bmi} <span style="font-size: 11px; color: ${bmiColor}; font-weight: normal;">(${bmiLabel})</span>`;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport Médical - ${patient.nom} ${patient.prenom} - ${dateStr}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 15mm 18mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.5;
    }
    .no-print {
      background: #0f172a;
      padding: 12px 20px;
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
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .doc-title {
      color: #0284c7;
      font-size: 18px;
      font-weight: 700;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-subtitle {
      color: #64748b;
      font-size: 12px;
      margin: 2px 0 0 0;
    }
    .patient-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 18px;
    }
    .patient-grid {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 12px;
    }
    .vitals-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .vital-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      text-align: center;
    }
    .vital-title {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .vital-value {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #0284c7;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin: 16px 0 10px 0;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .exam-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    .exam-table td {
      padding: 6px 8px;
      vertical-align: top;
      border-bottom: 1px solid #f1f5f9;
    }
    .exam-label {
      width: 28%;
      color: #475569;
      font-weight: 600;
    }
    .exam-content {
      width: 72%;
      color: #1e293b;
    }
    .conclusion-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-left: 4px solid #16a34a;
      border-radius: 6px;
      padding: 12px 16px;
      margin-top: 14px;
    }
    .signature-area {
      margin-top: 35px;
      display: flex;
      justify-content: flex-end;
      page-break-inside: avoid;
    }
    .signature-box {
      width: 250px;
      text-align: center;
      border-top: 1px dashed #cbd5e1;
      padding-top: 8px;
      color: #64748b;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <!-- Barre d'outils d'action (masquée à l'impression) -->
  <div class="no-print">
    <div style="color: #fff; font-weight: 600; font-size: 14px;">
      📄 Aperçu du Document Médical : Consultation du ${dateStr}
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

  <div style="padding: 25px 35px;">
    <!-- En-tête Cabinet Médical -->
    <table class="header-table">
      <tr>
        <td style="vertical-align: top;">
          <h1 class="doc-title">Cabinet Médical de Médecine Générale & Spécialisée</h1>
          <p class="doc-subtitle">Cabinet Médical • Tunisie</p>
          <p class="doc-subtitle">Tél : 71 000 000 • Email : cabinet.medical@docpocket.tn</p>
        </td>
        <td style="text-align: right; vertical-align: top;">
          <div style="font-size: 18px; font-weight: 700; color: #0f172a;">RAPPORT MÉDICAL</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Date : <strong>${dateStr}</strong> (${heureStr})</div>
          <div style="font-size: 11px; color: #94a3b8;">Réf. Consultation : #${consultation.id || 'NOUVEAU'}</div>
        </td>
      </tr>
    </table>

    <!-- Cartouche Patient -->
    <div class="patient-box">
      <div class="patient-grid">
        <div>
          <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
            ${(patient.civility && !/mari|celib|veuf|divorc/i.test(patient.civility)) ? patient.civility : (patient.gender === 'F' ? ((patient.etat_civil === 'Célibataire' || /celib/i.test(patient.civility || '')) ? 'Mlle' : 'Mme') : 'M.')} ${patient.nom.toUpperCase()} ${patient.prenom}
          </div>
          <div style="font-size: 12px; color: #475569;">
            N° Fiche : <strong>${patient.numfch || '-'}</strong> • Date de Naissance : <strong>${patient.birthdate || 'Non renseignée'}</strong>
          </div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">
            Tél : <strong>${patient.telephone || 'Non renseigné'}</strong> • N° CIN : <strong>${patient.cin || 'Non renseigné'}</strong>
          </div>
        </div>
        <div style="text-align: right; border-left: 1px solid #e2e8f0; padding-left: 14px;">
          <div style="font-size: 12px; color: #475569;">
            Régime CNAM : <strong style="color: #0284c7;">${patient.caisse || 'Sans Caisse'}</strong>
          </div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">
            Identifiant CNAM : <strong>${patient.cnamid || 'Non affilié'}</strong>
          </div>
          ${patient.apci ? `
            <div style="font-size: 11px; color: #d97706; margin-top: 4px; font-weight: 600;">
              ✓ Prise en charge intégrale (APCI : ${patient.apci})
            </div>
          ` : ''}
        </div>
      </div>

      ${patient.allergies ? `
        <div style="margin-top: 10px; padding: 6px 12px; background: #fee2e2; border-left: 3px solid #dc2626; border-radius: 4px; color: #b91c1c; font-size: 12px; font-weight: 600;">
          ⚠️ Terrain allergique connu : ${patient.allergies}
        </div>
      ` : ''}
    </div>

    <!-- Motif de consultation -->
    <div style="margin-bottom: 16px;">
      <span style="font-weight: 700; color: #0284c7; text-transform: uppercase; font-size: 12px;">Motif de Consultation :</span>
      <span style="font-size: 13px; font-weight: 600; color: #0f172a; margin-left: 8px;">${consultation.motif || 'Consultation générale'}</span>
    </div>

    <!-- Constantes et Signes Vitaux -->
    <div class="section-title">Signes Vitaux & Constantes Biométriques</div>
    <div class="vitals-grid">
      <div class="vital-card">
        <div class="vital-title">Tension Artérielle</div>
        <div class="vital-value">${consultation.taMax ? `${consultation.taMax} / ${consultation.taMin || 0}` : '-'} <span style="font-size: 11px; font-weight: normal; color: #64748b;">cmHg</span></div>
      </div>
      <div class="vital-card">
        <div class="vital-title">Poids & Taille</div>
        <div class="vital-value">${consultation.poids ? `${consultation.poids} kg` : '-'} ${consultation.taille ? `• ${consultation.taille} cm` : ''}</div>
      </div>
      <div class="vital-card">
        <div class="vital-title">Indice de Masse (IMC)</div>
        <div class="vital-value">${bmiHtml || '-'}</div>
      </div>
      <div class="vital-card">
        <div class="vital-title">Fréq. Card. / SpO2</div>
        <div class="vital-value">${consultation.pouls ? `${consultation.pouls} bpm` : '-'} ${consultation.spo2 ? `• ${consultation.spo2}%` : ''}</div>
      </div>
    </div>

    <!-- Examen Physique par Appareil -->
    <div class="section-title">Examen Clinique & Observations par Appareil</div>
    <table class="exam-table">
      ${consultation.examGeneral ? `
        <tr>
          <td class="exam-label">• Plan général :</td>
          <td class="exam-content">${consultation.examGeneral}</td>
        </tr>
      ` : ''}
      ${consultation.examORL ? `
        <tr>
          <td class="exam-label">• Sur le plan ORL :</td>
          <td class="exam-content">${consultation.examORL}</td>
        </tr>
      ` : ''}
      ${consultation.examRespiratoire ? `
        <tr>
          <td class="exam-label">• Plan respiratoire :</td>
          <td class="exam-content">${consultation.examRespiratoire}</td>
        </tr>
      ` : ''}
      ${consultation.examHemodynamique ? `
        <tr>
          <td class="exam-label">• Plan hémodynamique :</td>
          <td class="exam-content">${consultation.examHemodynamique}</td>
        </tr>
      ` : ''}
      ${consultation.examNeurologique ? `
        <tr>
          <td class="exam-label">• Plan neurologique :</td>
          <td class="exam-content">${consultation.examNeurologique}</td>
        </tr>
      ` : ''}
      ${consultation.examAbdominal ? `
        <tr>
          <td class="exam-label">• Plan abdominal :</td>
          <td class="exam-content">${consultation.examAbdominal}</td>
        </tr>
      ` : ''}
      ${consultation.examMusculosquelettique ? `
        <tr>
          <td class="exam-label">• Plan musculo-squelettique :</td>
          <td class="exam-content">${consultation.examMusculosquelettique}</td>
        </tr>
      ` : ''}
      ${consultation.examReste ? `
        <tr>
          <td class="exam-label">• Reste de l'examen :</td>
          <td class="exam-content">${consultation.examReste}</td>
        </tr>
      ` : ''}
      ${consultation.examenClinique ? `
        <tr>
          <td class="exam-label">• Observations complémentaires :</td>
          <td class="exam-content">${consultation.examenClinique}</td>
        </tr>
      ` : ''}
    </table>

    <!-- Diagnostic et Conduite à Tenir -->
    <div class="section-title">Diagnostic Médical & Thérapeutique</div>
    <div class="conclusion-box">
      <div style="font-size: 14px; font-weight: 700; color: #166534; margin-bottom: 4px;">
        Diagnostic retenu : ${consultation.diagnostic || 'Non spécifié'}
      </div>
      ${consultation.reposJours > 0 ? `
        <div style="font-size: 12px; color: #854d0e; font-weight: 600; margin-top: 6px;">
          🛌 Repos prescrit : ${consultation.reposJours} jours à compter du ${consultation.reposDebut || dateStr}.
        </div>
      ` : ''}
    </div>

    <!-- Zone de Cachet et Signature du Médecin -->
    <div class="signature-area">
      <div class="signature-box">
        <div>Fait à Tunis, le ${dateStr}</div>
        <div style="margin-top: 8px; font-weight: 600; color: #1e293b;">Signature et Cachet du Praticien</div>
        <div style="height: 60px;"></div>
      </div>
    </div>
  </div>

  <script>
    function envoyerEmail() {
      const email = "${patient.email || ''}";
      const subject = encodeURIComponent("Rapport médical de consultation du ${dateStr} - ${patient.nom} ${patient.prenom}");
      const body = encodeURIComponent(
        "Bonjour,\\n\\nVeuillez trouver ci-joint le résumé de votre consultation médicale du ${dateStr}.\\n\\nDiagnostic : ${consultation.diagnostic || ''}\\n\\nBien cordialement,\\nVotre Médecin"
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
