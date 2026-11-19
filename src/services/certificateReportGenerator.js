// ==============================================================
// DOCPOCKET CABINET - GÉNÉRATEUR OFFICIEL DE CERTIFICAT MÉDICAL DE REPOS
// ==============================================================
// Établit un certificat médical de repos / arrêt de travail conforme
// aux exigences légales, déontologiques et au secret médical (zéro diagnostic).
// Compatible carnet A5 pré-imprimé ou pleine page A4.

import { getActivePractitioner } from './practitionerService';
import { getPrescriptionSettings } from './prescriptionSettingsService';

function numberToFrenchWords(n) {
  const num = parseInt(n, 10);
  const words = [
    'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
    'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf', 'vingt',
    'vingt-et-un', 'vingt-deux', 'vingt-trois', 'vingt-quatre', 'vingt-cinq', 'vingt-six', 'vingt-sept', 'vingt-huit', 'vingt-neuf', 'trente',
    'trente-et-un', 'quarante', 'quarante-cinq', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingts', 'quatre-vingt-dix', 'cent'
  ];
  if (num >= 0 && num <= 31) return words[num];
  return String(num);
}

function calculateEndDate(startDateStr, days) {
  try {
    const parts = (startDateStr || '').split(/[-/]/);
    let d;
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else {
        d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    } else {
      d = new Date();
    }
    const dayCount = Math.max(1, parseInt(days, 10) || 1);
    // Le repos inclut le premier jour, donc fin = début + (days - 1)
    d.setDate(d.getDate() + (dayCount - 1));
    return d.toLocaleDateString('fr-FR');
  } catch {
    return startDateStr;
  }
}

export function buildMedicalRestCertificateHtml(patient, consultation, customSettings = null) {
  if (!patient || !consultation) return '';

  const settings = customSettings || getPrescriptionSettings();
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
  const docOrdre = (activeDoc?.ordreId || docProfile.ordreId) ? `N° d'Ordre Médecins : ${activeDoc?.ordreId || docProfile.ordreId}` : "N° d'Ordre Médecins : 12052";
  const docCnam = (activeDoc?.cnamId || docProfile.cnamId) ? ` • Code CNAM : ${activeDoc?.cnamId || docProfile.cnamId}` : ' • Code CNAM : 010002763183';
  const docCity = settings.cityOverride?.trim() || activeDoc?.ville || docProfile.ville || 'Mahdia';

  const isA5 = (settings.pageSize || 'A5') === 'A5';
  const pageWidthMm = isA5 ? 148 : 210;
  const pageHeightMm = isA5 ? 210 : 297;
  const sideMarginMm = settings.sideMargin || (isA5 ? 10 : 14);
  const bottomMarginMm = Math.max(settings.bottomMargin || (isA5 ? 30 : 18), isA5 ? 28 : 18);
  const headerTopMarginMm = settings.headerTopMargin || (isA5 ? 38 : 42);

  const todayStr = new Date().toLocaleDateString('fr-FR');
  const consultDateStr = consultation.date || todayStr;
  const reposJours = Math.max(1, parseInt(consultation.reposJours, 10) || 1);
  const reposDebutStr = consultation.reposDebut ? (
    consultation.reposDebut.includes('-')
      ? consultation.reposDebut.split('-').reverse().join('/')
      : consultation.reposDebut
  ) : consultDateStr;
  const reposFinStr = calculateEndDate(reposDebutStr, reposJours);
  const reposJoursEnLettres = numberToFrenchWords(reposJours);

  const patientCivility = patient.gender === 'F' ? 'Mme' : 'M.';
  const patientAge = patient.age ? `${patient.age} ans` : '';
  const cityDateText = settings.showCityDate ? `${docCity}, le ${consultDateStr}` : `Le ${consultDateStr}`;

  const headerHtml = settings.hideHeader ? `
    <!-- Espace vierge réservé pour papier pré-imprimé du cabinet (Zéro date en haut) -->
    <div style="height: ${headerTopMarginMm}mm; margin-bottom: 4px;"></div>
  ` : `
    <table style="width: 100%; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 14px;">
      <tr>
        <td style="vertical-align: top;">
          <h1 style="font-size: ${isA5 ? '16px' : '20px'}; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">${docNom}</h1>
          <p style="color: #475569; font-size: ${isA5 ? '11px' : '12px'}; margin: 1px 0 0 0;">${docSpecialite}</p>
          <p style="color: #475569; font-size: ${isA5 ? '11px' : '12px'}; margin: 1px 0 0 0;">${docAdresse}</p>
          <p style="color: #64748b; font-size: ${isA5 ? '9.5px' : '11px'}; margin: 3px 0 0 0;">${docTel} • ${docOrdre}${docCnam}</p>
        </td>
        <td style="text-align: right; vertical-align: top;">
          <div style="font-size: ${isA5 ? '11px' : '13px'}; color: #475569;">${settings.showCityDate ? `${docCity}, le` : 'Le'}</div>
          <div style="font-size: ${isA5 ? '14px' : '17px'}; font-weight: 700; color: #0f172a; margin-top: 1px;">${consultDateStr}</div>
          <div style="font-size: ${isA5 ? '9.5px' : '11px'}; color: #94a3b8; margin-top: 3px;">Réf : CERT-${consultation.id || 'REPOS'}</div>
        </td>
      </tr>
    </table>
  `;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title></title>
  <style>
    @page {
      size: ${isA5 ? 'A5' : 'A4'} portrait;
      margin: 0mm !important;
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
      background: #059669;
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
    .btn-print { background: #059669; color: #fff; }
    .btn-email { background: #0284c7; color: #fff; margin-left: 6px; }
    .btn-close { background: #475569; color: #fff; margin-left: 6px; }

    @media print {
      @page {
        size: ${isA5 ? 'A5' : 'A4'} portrait;
        margin: 0 !important;
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
      .certif-container {
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
      * {
        page-break-inside: avoid !important;
      }
    }

    .certif-container {
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
      font-size: ${isA5 ? '13px' : '14.5px'};
      line-height: ${isA5 ? 1.5 : 1.6};
    }

    .certif-title-box {
      text-align: center;
      margin: ${isA5 ? '16px 0 20px' : '24px 0 30px'};
    }
    .certif-title {
      display: inline-block;
      font-size: ${isA5 ? '14px' : '17px'};
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 3px 14px;
      border-bottom: 2px solid #0f172a;
    }

    .certif-body {
      font-size: ${isA5 ? '13px' : '15px'};
      line-height: ${isA5 ? 1.7 : 1.85};
      color: #1e293b;
      text-align: justify;
    }

    .patient-box {
      background: #f8fafc;
      border-left: 3px solid #0284c7;
      padding: 8px 14px;
      margin: 12px 0;
      border-radius: 4px;
    }

    .rest-box {
      background: #f0fdf4;
      border: 1.5px solid #16a34a;
      border-radius: 6px;
      padding: 10px 16px;
      margin: 16px 0;
      text-align: center;
    }
    .rest-days {
      font-size: ${isA5 ? '16px' : '19px'};
      font-weight: 800;
      color: #166534;
      text-transform: uppercase;
    }
    .rest-dates {
      font-size: ${isA5 ? '13px' : '14.5px'};
      color: #15803d;
      font-weight: 700;
      margin-top: 4px;
    }

    .certif-legal {
      display: block;
      margin-top: 18px;
      font-size: ${isA5 ? '10px' : '11.5px'};
      color: #64748b;
      font-style: italic;
      line-height: 1.45;
    }

    .signature-area {
      margin-top: ${isA5 ? '24px' : '36px'};
      margin-left: auto;
      width: ${isA5 ? '180px' : '230px'};
      text-align: center;
      border-top: 1px dashed #94a3b8;
      padding-top: 6px;
    }
    .signature-date {
      font-weight: 700;
      color: #0f172a;
      font-size: ${isA5 ? '12px' : '13.5px'};
    }
    .signature-title {
      margin-top: 4px;
      font-weight: 800;
      color: #0f172a;
      font-size: ${isA5 ? '11px' : '12.5px'};
    }
    .signature-space {
      height: ${isA5 ? '45px' : '65px'};
    }
  </style>
</head>
<body>
  <!-- Barre d'outils -->
  <div class="no-print">
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="color: #fff; font-weight: 700; font-size: 13px;">
        🛌 Certificat Médical de Repos : ${patient.nom} ${patient.prenom}
      </span>
      <span style="background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid #22c55e; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">
        ${reposJours} Jour(s)
      </span>
    </div>

    <div>
      <button class="btn btn-print" onclick="window.print()">
        🖨️ Imprimer le Certificat
      </button>
      <button class="btn btn-email" onclick="envoyerEmail()">
        ✉️ Email
      </button>
      <button class="btn btn-close" onclick="window.close()">
        ✕ Fermer
      </button>
    </div>
  </div>

  <div class="no-print print-tip-bar">
    <span>
      💡 <strong>Format Garanti 1 Page :</strong> Conforme au secret médical (zéro diagnostic). Dans Chrome : Format ${isA5 ? 'A5' : 'A4'} • Décochez « En-têtes et pieds de page ».
    </span>
  </div>

  <div class="certif-container">
    ${headerHtml}

    <div class="certif-title-box">
      <div class="certif-title">CERTIFICAT MÉDICAL DE REPOS</div>
    </div>

    <div class="certif-body">
      Je soussigné(e), <strong>${docNom}</strong>, Docteur en Médecine,<br>
      Certifie avoir examiné ce jour :

      <div class="patient-box">
        <strong>${patientCivility} ${patient.nom.toUpperCase()} ${patient.prenom}</strong><br>
        ${patientAge ? `Âgé(e) de : <strong>${patientAge}</strong>` : ''} 
        ${patient.identifiant_unique ? ` • Dossier N° : <strong>${patient.identifiant_unique}</strong>` : ''}
        ${patient.caisse ? ` • Caisse : <strong>${patient.caisse}</strong>` : ''}
      </div>

      Et atteste que son état de santé nécessite un arrêt de travail / repos médical de :

      <div class="rest-box">
        <div class="rest-days">
          ${reposJours} (${reposJoursEnLettres.toUpperCase()}) JOURS
        </div>
        <div class="rest-dates">
          Du <strong>${reposDebutStr}</strong> au <strong>${reposFinStr}</strong> inclus,
        </div>
      </div>

      Sauf complications ultérieures ultérieurement constatées.

      <div class="certif-legal">
        Certificat médical officiel délivré à la demande de l'intéressé(e) pour servir et valoir ce que de droit, 
        établi dans le respect strict du secret professionnel médical (sans mention de diagnostic conformément à la législation).
      </div>
    </div>

    <div class="signature-area">
      <div class="signature-date">${cityDateText}</div>
      <div class="signature-title">${settings.signatureTitle || 'Cachet & Signature du Médecin'}</div>
      <div class="signature-space"></div>
    </div>
  </div>

  <script>
    function envoyerEmail() {
      const email = "${patient.email || ''}";
      const subject = encodeURIComponent("Certificat Médical de Repos - ${patient.nom} ${patient.prenom}");
      const body = encodeURIComponent(
        "Bonjour ${patient.prenom},\\n\\nVeuillez trouver ci-joint votre certificat médical de repos du ${consultDateStr}.\\n\\nBien cordialement,\\n${docNom}"
      );
      window.location.href = "mailto:" + email + "?subject=" + subject + "&body=" + body;
    }
  </script>
</body>
</html>
  `;
}

export function generateMedicalRestCertificate(patient, consultation, customSettings = null) {
  if (!patient || !consultation) {
    alert("Données insuffisantes pour générer le certificat médical.");
    return;
  }

  const printWindow = window.open('', '_blank', 'width=900,height=950');
  if (!printWindow) {
    alert("Veuillez autoriser les fenêtres pop-up pour afficher et imprimer le certificat de repos.");
    return;
  }

  const htmlContent = buildMedicalRestCertificateHtml(patient, consultation, customSettings);
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
