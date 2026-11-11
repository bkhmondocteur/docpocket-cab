/**
 * Générateur et visualiseur de Bordereau de Remboursement CNAM Officiel (Tiers-Payant Médecin Conventionné)
 * Conforme aux spécifications de la Caisse Nationale d'Assurance Maladie (CNAM Tunisie).
 * Supporte :
 *  - Impression A4 Paysage haute définition
 *  - Sauvegarde locale HTML/PDF
 *  - Exportation au format CSV CNAM standard pour archivage ou transmission
 */

// Fonction de conversion de montant en lettres françaises pour formalité CNAM
export function nombreEnLettres(montant) {
  const unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const dix_dixneuf = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const dizaines = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

  function convertirEntier(n) {
    if (n === 0) return 'zéro';
    if (n < 10) return unites[n];
    if (n >= 10 && n < 20) return dix_dixneuf[n - 10];
    if (n < 70) {
      const u = n % 10;
      const d = Math.floor(n / 10);
      return dizaines[d] + (u === 1 ? ' et un' : (u > 1 ? '-' + unites[u] : ''));
    }
    if (n < 80) {
      const u = n % 10;
      return 'soixante-' + dix_dixneuf[u];
    }
    if (n < 100) {
      const u = n % 10;
      return 'quatre-vingt' + (u === 0 ? 's' : '-' + unites[u]);
    }
    if (n < 1000) {
      const c = Math.floor(n / 100);
      const reste = n % 100;
      const cStr = c === 1 ? 'cent' : unites[c] + ' cents';
      return reste > 0 ? (c === 1 ? 'cent ' : unites[c] + ' cent ') + convertirEntier(reste) : cStr;
    }
    if (n < 1000000) {
      const m = Math.floor(n / 1000);
      const reste = n % 1000;
      const mStr = m === 1 ? 'mille' : convertirEntier(m) + ' mille';
      return reste > 0 ? mStr + ' ' + convertirEntier(reste) : mStr;
    }
    return n.toString();
  }

  const num = parseFloat(montant) || 0;
  const dinars = Math.floor(num);
  const millimes = Math.round((num - dinars) * 1000);

  let res = convertirEntier(dinars) + (dinars > 1 ? ' dinars' : ' dinar');
  if (millimes > 0) {
    res += ' et ' + convertirEntier(millimes) + ' millimes';
  } else {
    res += ' et zéro millime';
  }
  return res.charAt(0).toUpperCase() + res.slice(1);
}

export function generateCnamBordereauReport(bordereau) {
  if (!bordereau) {
    alert("Aucune donnée de bordereau CNAM à afficher.");
    return;
  }

  const printWindow = window.open('', '_blank', 'width=1100,height=900');
  if (!printWindow) {
    alert("Veuillez autoriser les fenêtres pop-up pour afficher le bordereau CNAM.");
    return;
  }

  const now = new Date();
  const dateStr = bordereau.dateCreation || now.toISOString().split('T')[0];
  const numBord = bordereau.numBordereau || `BORD-CNAM-${now.getFullYear()}-001`;

  const savedProfile = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('docpocket_doctor_profile') || '{}') : {};
  const docNom = bordereau.medecinNom || (savedProfile.nom ? `Dr. ${savedProfile.nom}` : 'Dr. Hamed BEN KHALIFA');
  const docCnamId = bordereau.medecinCnamId || savedProfile.cnamId || '010002763183';
  const docSpec = savedProfile.specialite || 'Médecine Générale';
  const docAdresse = savedProfile.adresse ? `${savedProfile.adresse}, ${savedProfile.ville || ''}` : 'Complexe Médical Dar Attabib, Mahdia';
  const docTel = savedProfile.telephone || '31 576 900 / 53 573 117';
  const docRib = savedProfile.ribCnam || '08 012 0001234567890 45';

  const formatDT = (mtt) => (parseFloat(mtt) || 0).toFixed(3);

  const lignes = Array.isArray(bordereau.lignes) ? bordereau.lignes : [];
  const lignesHtml = lignes.map((ligne, idx) => `
    <tr style="border-bottom: 1px solid #cbd5e1; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; font-size: 11px;">
      <td style="padding: 7px 8px; text-align: center; color: #64748b; font-weight: bold;">
        ${idx + 1}
      </td>
      <td style="padding: 7px 8px; text-align: center; color: #0f172a; white-space: nowrap;">
        ${ligne.date || dateStr}
      </td>
      <td style="padding: 7px 8px; font-family: monospace; font-size: 11.5px; font-weight: 700; color: #0369a1; text-align: center;">
        ${ligne.cnamId || '-'}
      </td>
      <td style="padding: 7px 8px; font-weight: 600; color: #0f172a;">
        ${ligne.patientName || 'PATIENT'}
      </td>
      <td style="padding: 7px 8px; text-align: center; color: #475569;">
        ${ligne.quality || 'Assuré(e)'}
      </td>
      <td style="padding: 7px 8px; text-align: center; font-weight: 600; color: ${ligne.apci ? '#b45309' : '#94a3b8'};">
        ${ligne.apci || '-'}
      </td>
      <td style="padding: 7px 8px; text-align: center; font-weight: 700; color: #0f172a;">
        ${ligne.codeActe || 'C'}
      </td>
      <td style="padding: 7px 8px; color: #334155;">
        ${ligne.nomActe || 'Consultation'}
      </td>
      <td style="padding: 7px 8px; text-align: right; color: #0f172a; font-weight: 600;">
        ${formatDT(ligne.montantGlobal)}
      </td>
      <td style="padding: 7px 8px; text-align: right; color: #059669; font-weight: 600;">
        ${formatDT(ligne.partPatient)}
      </td>
      <td style="padding: 7px 8px; text-align: right; color: #0284c7; font-weight: 800; background: #f0f9ff;">
        ${formatDT(ligne.partCnam)}
      </td>
    </tr>
  `).join('');

  const montantLettres = nombreEnLettres(bordereau.montantTotalCnam || 0);

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8">
      <title>Bordereau CNAM - ${numBord}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 10mm 12mm;
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
          background: #f1f5f9;
          margin: 0;
          padding: 16px;
        }
        .container {
          background: #ffffff;
          max-width: 1060px;
          margin: 0 auto;
          padding: 24px 28px;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          border: 1px solid #cbd5e1;
        }
        .header-cnam {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0284c7;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .cnam-logo-box {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .cnam-badge {
          background: #0284c7;
          color: white;
          font-weight: 900;
          font-size: 20px;
          padding: 8px 14px;
          border-radius: 8px;
          letter-spacing: 1px;
        }
        .header-meta {
          text-align: right;
        }
        .bord-title {
          font-size: 16px;
          font-weight: 800;
          color: #0369a1;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .bord-sub {
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
        }
        .cards-grid {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 14px;
          margin-bottom: 16px;
        }
        .info-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px 14px;
          font-size: 12px;
        }
        .info-card h4 {
          margin: 0 0 6px 0;
          color: #0369a1;
          font-size: 12.5px;
          text-transform: uppercase;
          border-bottom: 1px dashed #cbd5e1;
          padding-bottom: 4px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11.5px;
          margin-bottom: 14px;
        }
        th {
          background: #e2e8f0;
          color: #1e293b;
          text-transform: uppercase;
          font-size: 10.5px;
          font-weight: 700;
          padding: 7px 6px;
          border-top: 1px solid #cbd5e1;
          border-bottom: 2px solid #94a3b8;
        }
        .totals-summary {
          background: #f8fafc;
          border: 1.5px solid #0284c7;
          border-radius: 8px;
          padding: 12px 18px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .lettres-box {
          background: #fefce8;
          border: 1px dashed #ca8a04;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 12px;
          color: #854d0e;
          margin-bottom: 16px;
        }
        .signatures-area {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-top: 14px;
          padding-top: 10px;
          border-top: 1px dashed #cbd5e1;
          font-size: 11.5px;
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
          background: #fafafa;
        }
        .actions-bar {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 16px;
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
        .btn-csv { background: #059669; color: white; }
        .btn-close { background: #64748b; color: white; }
      </style>
    </head>
    <body>
      <div class="actions-bar no-print">
        <button class="btn btn-print" onclick="window.print()">
          🖨️ Imprimer Bordereau A4
        </button>
        <button class="btn btn-csv" onclick="exportCsv()">
          📊 Exporter Fichier CSV CNAM
        </button>
        <button class="btn btn-close" onclick="window.close()">
          ✕ Fermer
        </button>
      </div>

      <div class="container" id="printable-bordereau">
        <!-- En-tête CNAM -->
        <div class="header-cnam">
          <div class="cnam-logo-box">
            <div class="cnam-badge">CNAM</div>
            <div>
              <div style="font-weight: 800; font-size: 14px; color: #0f172a;">RÉPUBLIQUE TUNISIENNE</div>
              <div style="font-size: 12px; color: #0369a1; font-weight: 700;">CAISSE NATIONALE D'ASSURANCE MALADIE</div>
              <div style="font-size: 11px; color: #64748b;">Centre Régional : <strong>Tunis Belvédère / Ariana</strong></div>
            </div>
          </div>

          <div class="header-meta">
            <div class="bord-title">BORDEREAU RÉCAPITULATIF DES CRÉANCES MÉDICALES</div>
            <div class="bord-sub">Convention Tiers-Payant Médecin de Famille / Spécialiste</div>
            <div style="margin-top: 4px; font-size: 13px;">
              Bordereau N° : <strong style="color: #0284c7;">${numBord}</strong>
            </div>
          </div>
        </div>

        <!-- Coordonnées Médecin et Période -->
        <div class="cards-grid">
          <div class="info-card">
            <h4>Prestataire de Soins (Médecin Conventionné)</h4>
            <div>Nom & Prénom : <strong>${docNom}</strong></div>
            <div style="margin-top: 2px;">
              Code Conventionnel CNAM : <strong style="color: #0284c7;">${docCnamId}</strong> 
              | Spécialité : <strong>${docSpec}</strong>
            </div>
            <div style="margin-top: 2px; color: #475569;">
              Adresse : ${docAdresse} | Tél : ${docTel}
            </div>
            <div style="margin-top: 2px; color: #0369a1; font-weight: 600;">
              RIB Virement CNAM : <strong>${docRib}</strong>
            </div>
          </div>

          <div class="info-card">
            <h4>Paramètres du Bordereau</h4>
            <div>Période couverte : <strong>Du ${bordereau.periodeDebut || '01/09/2026'} Au ${bordereau.periodeFin || dateStr}</strong></div>
            <div style="margin-top: 2px;">Caisse d'affiliation : <strong>${bordereau.caisse || 'TOUTES (CNSS / CNRPS)'}</strong></div>
            <div style="margin-top: 2px;">Type de facturation : <strong>${bordereau.typeBordereau || 'Filière Privée & APCI'}</strong></div>
            <div style="margin-top: 2px;">Date d'établissement : <strong>${dateStr}</strong></div>
          </div>
        </div>

        <!-- Tableau des créances -->
        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">N°</th>
              <th style="width: 75px; text-align: center;">Date</th>
              <th style="width: 105px; text-align: center;">N° Carnet CNAM</th>
              <th style="text-align: left;">Bénéficiaire (Nom & Prénom)</th>
              <th style="width: 70px; text-align: center;">Qualité</th>
              <th style="width: 55px; text-align: center;">APCI</th>
              <th style="width: 45px; text-align: center;">Acte</th>
              <th style="text-align: left;">Libellé de la Prestation</th>
              <th style="width: 80px; text-align: right;">Total (DT)</th>
              <th style="width: 80px; text-align: right;">TM Payé</th>
              <th style="width: 90px; text-align: right; background: #e0f2fe;">Net CNAM (DT)</th>
            </tr>
          </thead>
          <tbody>
            ${lignesHtml.length > 0 ? lignesHtml : '<tr><td colspan="11" style="text-align: center; padding: 20px; color: #94a3b8;">Aucune ligne de créance incluse dans ce bordereau.</td></tr>'}
          </tbody>
        </table>

        <!-- Synthèse financière -->
        <div class="totals-summary">
          <div>
            <div style="font-size: 12px; color: #64748b;">Statistiques du bordereau :</div>
            <div style="font-weight: 700; color: #0f172a; margin-top: 2px;">
              Nombre total de consultations / actes : <span style="color: #0284c7;">${bordereau.totalActes || lignes.length}</span>
            </div>
          </div>

          <div style="display: flex; gap: 24px; text-align: right;">
            <div>
              <div style="font-size: 11px; color: #64748b;">Montant Global :</div>
              <div style="font-size: 14px; font-weight: 600; color: #0f172a;">${formatDT(bordereau.montantTotalGlobal)} DT</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #059669;">Ticket Modérateur Encaissé :</div>
              <div style="font-size: 14px; font-weight: 700; color: #059669;">${formatDT(bordereau.montantTotalPatient)} DT</div>
            </div>
            <div style="background: #e0f2fe; padding: 6px 14px; border-radius: 6px; border: 1px solid #7dd3fc;">
              <div style="font-size: 11px; color: #0369a1; font-weight: 700;">TOTAL RÉCLAMÉ À LA CNAM :</div>
              <div style="font-size: 17px; font-weight: 900; color: #0284c7;">${formatDT(bordereau.montantTotalCnam)} DT</div>
            </div>
          </div>
        </div>

        <!-- Montant en toutes lettres -->
        <div class="lettres-box">
          Arrêté le présent bordereau récapitulatif à la somme nette réclamée de :<br>
          <strong style="font-size: 13px; color: #713f12;">${montantLettres}.</strong>
        </div>

        <!-- Attestation et signatures -->
        <div class="signatures-area">
          <div style="max-width: 450px;">
            <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px;">Attestation sur l'honneur du médecin traitant :</div>
            <p style="margin: 0; color: #475569; line-height: 1.4;">
              Je soussigné, certifie sur l'honneur que les prestations et actes médicaux portés sur le présent bordereau ont été réellement et personnellement dispensés conformément à la convention conclue avec la CNAM.
            </p>
            <div style="margin-top: 8px; color: #64748b; font-size: 11px;">
              Fait à Tunis, le <strong>${dateStr}</strong>
            </div>
          </div>

          <div style="display: flex; gap: 30px;">
            <div style="text-align: center;">
              <div style="font-weight: 600; color: #334155; margin-bottom: 4px;">Visa & Date CNAM</div>
              <div class="stamp-box">
                Cadre réservé aux services de la CNAM<br>
                (Date de réception et vérification)
              </div>
            </div>

            <div style="text-align: center;">
              <div style="font-weight: 600; color: #334155; margin-bottom: 4px;">Cachet & Signature du Praticien</div>
              <div class="stamp-box">
                ${docNom}<br>
                ${docSpec}<br>
                Code Conv. : ${docCnamId}
              </div>
            </div>
          </div>
        </div>
      </div>

      <script>
        function exportCsv() {
          const csvLines = [];
          csvLines.push('N_ORDRE;DATE_SOINS;NUM_CARNET_CNAM;NOM_PRENOM_PATIENT;QUALITE;CODE_APCI;CODE_ACTE;LIBELLE_ACTE;MONTANT_GLOBAL_DT;TICKET_MODERATEUR_DT;PART_CNAM_DT');
          
          const items = ${JSON.stringify(lignes)};
          items.forEach((it, idx) => {
            const line = [
              idx + 1,
              it.date || '${dateStr}',
              it.cnamId || '',
              '"' + (it.patientName || '').replace(/"/g, '""') + '"',
              it.quality || 'Assuré(e)',
              it.apci || '',
              it.codeActe || 'C',
              '"' + (it.nomActe || '').replace(/"/g, '""') + '"',
              (it.montantGlobal || 0).toFixed(3),
              (it.partPatient || 0).toFixed(3),
              (it.partCnam || 0).toFixed(3)
            ].join(';');
            csvLines.push(line);
          });

          csvLines.push('');
          csvLines.push('TOTAL_ACTES;' + items.length);
          csvLines.push('MONTANT_TOTAL_GLOBAL_DT;' + (${Number(bordereau.montantTotalGlobal) || 0}).toFixed(3));
          csvLines.push('TOTAL_TICKET_MODERATEUR_DT;' + (${Number(bordereau.montantTotalPatient) || 0}).toFixed(3));
          csvLines.push('TOTAL_NET_RECLAME_CNAM_DT;' + (${Number(bordereau.montantTotalCnam) || 0}).toFixed(3));

          const blob = new Blob(["\uFEFF" + csvLines.join('\\r\\n')], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = '${numBord}.csv';
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

export function exportCnamBordereauCSV(bordereau) {
  if (!bordereau) return;
  const dateStr = bordereau.dateCreation || new Date().toISOString().split('T')[0];
  const numBord = bordereau.numBordereau || `BORD-CNAM-${new Date().getFullYear()}-001`;
  const lignes = Array.isArray(bordereau.lignes) ? bordereau.lignes : [];

  const csvLines = [];
  csvLines.push('N_ORDRE;DATE_SOINS;NUM_CARNET_CNAM;NOM_PRENOM_PATIENT;QUALITE;CODE_APCI;CODE_ACTE;LIBELLE_ACTE;MONTANT_GLOBAL_DT;TICKET_MODERATEUR_DT;PART_CNAM_DT');

  lignes.forEach((it, idx) => {
    const line = [
      idx + 1,
      it.date || dateStr,
      it.cnamId || '',
      '"' + (it.patientName || '').replace(/"/g, '""') + '"',
      it.quality || 'Assuré(e)',
      it.apci || '',
      it.codeActe || 'C',
      '"' + (it.nomActe || '').replace(/"/g, '""') + '"',
      (it.montantGlobal || 0).toFixed(3),
      (it.partPatient || 0).toFixed(3),
      (it.partCnam || 0).toFixed(3)
    ].join(';');
    csvLines.push(line);
  });

  csvLines.push('');
  csvLines.push('TOTAL_ACTES;' + lignes.length);
  csvLines.push('MONTANT_TOTAL_GLOBAL_DT;' + (Number(bordereau.montantTotalGlobal) || 0).toFixed(3));
  csvLines.push('TOTAL_TICKET_MODERATEUR_DT;' + (Number(bordereau.montantTotalPatient) || 0).toFixed(3));
  csvLines.push('TOTAL_NET_RECLAME_CNAM_DT;' + (Number(bordereau.montantTotalCnam) || 0).toFixed(3));

  const blob = new Blob(["\uFEFF" + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${numBord}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
