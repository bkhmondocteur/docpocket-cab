// ==============================================================
// DOCPOCKET CABINET - ANNUAIRE MÉDICAL DES CONFRÈRES (RÉSEAU PARTAGÉ)
// ==============================================================
// Permet à tous les médecins utilisateurs de DocPocket Cab :
// 1. D'avoir leurs données cliniques et financières 100% indépendantes et isolées
// 2. De partager uniquement leurs coordonnées professionnelles dans un annuaire commun
// 3. De rechercher des confrères par nom, spécialité et ville pour les contacter ou leur adresser des patients
// 4. De générer des lettres d'orientation et de liaison médicale en 1 clic

import { getBridgeBaseUrl } from './firebaseBridgeSyncService';

const DIRECTORY_CACHE_KEY = 'docpocket_annuaire_confreres_v1';
const MY_DIRECTORY_PUBLISHED_KEY = 'docpocket_my_directory_published';

/**
 * Liste initiale de référence des praticiens du Réseau Médical DocPocket Cab
 */
export const INITIAL_CONFRERES = [
  {
    id: 'dr_hamed_ben_khalifa',
    titre: 'Dr.',
    nom: 'BEN KHALIFA',
    prenom: 'Hamed',
    specialite: 'Médecine Générale',
    ville: 'Mahdia',
    gouvernorat: 'Mahdia',
    adresse: 'Complexe Médical Dar Attabib',
    telephone: '31 576 900 / 53 573 117',
    email: 'bkhmondocteur@yahoo.com',
    cnamId: '010002763183',
    ordreId: '12052',
    fiscId: '856103/M',
    isFoundingDoctor: true,
    publishedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'dr_karim_zouari',
    titre: 'Dr.',
    nom: 'ZOUARI',
    prenom: 'Karim',
    specialite: 'Cardiologie & Maladies Vasculaires',
    ville: 'Sousse',
    gouvernorat: 'Sousse',
    adresse: 'Avenue Habib Bourguiba, Centre Médical Les Oliviers',
    telephone: '73 224 500 / 98 450 120',
    email: 'dr.zouari.cardio@gmail.com',
    cnamId: '010004561234',
    ordreId: '14210',
    publishedAt: '2026-01-05T09:00:00.000Z'
  },
  {
    id: 'dr_monia_trabelsi',
    titre: 'Dr.',
    nom: 'TRABELSI',
    prenom: 'Monia',
    specialite: 'Pédiatrie & Néonatologie',
    ville: 'Tunis',
    gouvernorat: 'Tunis',
    adresse: 'Centre Médical Le Bardo, Avenue Habib Bougatfa',
    telephone: '71 580 320 / 97 120 450',
    email: 'dr.monia.pedia@topnet.tn',
    cnamId: '010007891230',
    ordreId: '11890',
    publishedAt: '2026-01-10T10:00:00.000Z'
  },
  {
    id: 'dr_mehdi_chaabane',
    titre: 'Dr.',
    nom: 'CHAABANE',
    prenom: 'Mehdi',
    specialite: 'Gastro-Entérologie & Hépatologie',
    ville: 'Sfax',
    gouvernorat: 'Sfax',
    adresse: 'Route de Téniour Km 1.5, Immeuble El Hana',
    telephone: '74 241 800 / 98 330 770',
    email: 'dr.chaabane.gastro@gmail.com',
    cnamId: '010003216540',
    ordreId: '13550',
    publishedAt: '2026-01-12T11:00:00.000Z'
  },
  {
    id: 'dr_sonia_ben_salah',
    titre: 'Dr.',
    nom: 'BEN SALAH',
    prenom: 'Sonia',
    specialite: 'Gynécologie-Obstétrique',
    ville: 'Monastir',
    gouvernorat: 'Monastir',
    adresse: 'Rue de la République, Face Hôpital Fattouma Bourguiba',
    telephone: '73 461 100 / 98 620 310',
    email: 'dr.bensalah.gyneco@gnet.tn',
    cnamId: '010009874561',
    ordreId: '15400',
    publishedAt: '2026-01-15T14:00:00.000Z'
  },
  {
    id: 'dr_anis_gharbi',
    titre: 'Dr.',
    nom: 'GHARBI',
    prenom: 'Anis',
    specialite: 'Ophtalmologie & Chirurgie Réfractive',
    ville: 'Nabeul',
    gouvernorat: 'Nabeul',
    adresse: 'Avenue Habib Thameur, Immeuble La Jarre',
    telephone: '72 285 400 / 98 710 880',
    email: 'dr.gharbi.ophtalmo@gmail.com',
    cnamId: '010006549870',
    ordreId: '12770',
    publishedAt: '2026-01-20T09:30:00.000Z'
  },
  {
    id: 'dr_fatma_mansouri',
    titre: 'Dr.',
    nom: 'MANSOURI',
    prenom: 'Fatma',
    specialite: 'Dermatologie & Vénéréologie',
    ville: 'Tunis',
    gouvernorat: 'Tunis',
    adresse: 'Centre Médical Pasteur, Avenue de la Liberté',
    telephone: '71 845 600 / 98 900 140',
    email: 'dr.mansouri.dermato@gmail.com',
    cnamId: '010001237890',
    ordreId: '16120',
    publishedAt: '2026-01-22T11:15:00.000Z'
  },
  {
    id: 'dr_hichem_dridi',
    titre: 'Dr.',
    nom: 'DRIDI',
    prenom: 'Hichem',
    specialite: 'O.R.L & Chirurgie Cervico-Faciale',
    ville: 'Bizerte',
    gouvernorat: 'Bizerte',
    adresse: 'Rue Hédi Chaker, Immeuble Corniche Médical',
    telephone: '72 431 200 / 98 550 440',
    email: 'dr.dridi.orl@yahoo.fr',
    cnamId: '010008523690',
    ordreId: '10980',
    publishedAt: '2026-01-25T15:00:00.000Z'
  },
  {
    id: 'dr_leila_khechine',
    titre: 'Dr.',
    nom: 'KHECHINE',
    prenom: 'Leila',
    specialite: 'Radiologie & Imagerie Médicale',
    ville: 'Kairouan',
    gouvernorat: 'Kairouan',
    adresse: 'Avenue Ali Belhouane, Centre d\'Imagerie Les Aghlabides',
    telephone: '77 230 150 / 98 410 700',
    email: 'imagerie.khechine@gmail.com',
    cnamId: '010007418520',
    ordreId: '13890',
    publishedAt: '2026-02-01T10:00:00.000Z'
  },
  {
    id: 'dr_walid_ben_amor',
    titre: 'Dr.',
    nom: 'BEN AMOR',
    prenom: 'Walid',
    specialite: 'Chirurgie Orthopédique & Traumatologie',
    ville: 'Gabès',
    gouvernorat: 'Gabès',
    adresse: 'Rue d\'Algérie, Immeuble Oasis Santé',
    telephone: '75 270 400 / 98 670 220',
    email: 'dr.benamor.ortho@topnet.tn',
    cnamId: '010009632580',
    ordreId: '14780',
    publishedAt: '2026-02-05T16:00:00.000Z'
  },
  {
    id: 'dr_samia_ayadi',
    titre: 'Dr.',
    nom: 'AYADI',
    prenom: 'Samia',
    specialite: 'Neurologie & Explorations Fonctionnelles',
    ville: 'Tunis',
    gouvernorat: 'Tunis',
    adresse: 'Les Berges du Lac 2, Complexe Médical La Perle',
    telephone: '71 190 800 / 98 320 990',
    email: 'dr.ayadi.neuro@gmail.com',
    cnamId: '010001472580',
    ordreId: '15890',
    publishedAt: '2026-02-10T12:00:00.000Z'
  },
  {
    id: 'dr_slim_cherif',
    titre: 'Dr.',
    nom: 'CHERIF',
    prenom: 'Slim',
    specialite: 'Psychiatrie & Addictologie',
    ville: 'Sousse',
    gouvernorat: 'Sousse',
    adresse: 'Rue Ibn Khaldoun, Khezama Ouest',
    telephone: '73 330 900 / 98 480 330',
    email: 'dr.cherif.psy@gmail.com',
    cnamId: '010002583690',
    ordreId: '11450',
    publishedAt: '2026-02-15T09:00:00.000Z'
  }
];

export const SPECIALITES_LIST = [
  'Toutes les Spécialités',
  'Médecine Générale',
  'Cardiologie & Maladies Vasculaires',
  'Pédiatrie & Néonatologie',
  'Gastro-Entérologie & Hépatologie',
  'Gynécologie-Obstétrique',
  'Dermatologie & Vénéréologie',
  'Ophtalmologie & Chirurgie Réfractive',
  'O.R.L & Chirurgie Cervico-Faciale',
  'Radiologie & Imagerie Médicale',
  'Chirurgie Orthopédique & Traumatologie',
  'Neurologie & Explorations Fonctionnelles',
  'Psychiatrie & Addictologie',
  'Pneumologie & Allergologie',
  'Endocrinologie & Diabétologie',
  'Urologie & Chirurgie Urologique',
  'Néphrologie & Hémodialyse',
  'Rhumatologie',
  'Médecine Physique & Réadaptation',
  'Biologie Médicale'
];

export const VILLES_LIST = [
  'Toutes les Villes',
  'Mahdia',
  'Tunis',
  'Sousse',
  'Sfax',
  'Monastir',
  'Nabeul',
  'Bizerte',
  'Kairouan',
  'Gabès',
  'Ariana',
  'Ben Arous',
  'Manouba',
  'Médenine',
  'Gafsa',
  'Jendouba',
  'Kasserine',
  'Béja',
  'Le Kef',
  'Siliana',
  'Sidi Bouzid',
  'Zaghouan',
  'Tozeur',
  'Kébili',
  'Tataouine'
];

/**
 * Récupère l'annuaire complet des confrères (Cache local + synchronisation serveur)
 */
export async function getConfreresDirectory(forceSync = false) {
  let localList = [];
  try {
    const raw = localStorage.getItem(DIRECTORY_CACHE_KEY);
    if (raw) {
      localList = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Erreur lecture cache annuaire:", e);
  }

  // Si premier lancement ou liste vide, initialise avec les médecins de référence
  if (!Array.isArray(localList) || localList.length === 0) {
    localList = [...INITIAL_CONFRERES];
    saveLocalDirectory(localList);
  }

  // Synchronisation Cloud en arrière-plan via Firebase
  try {
    const cloudUrl = `${getBridgeBaseUrl()}/docpocket_annuaire_confreres.json`;
    const res = await fetch(cloudUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        const cloudList = Object.values(data).filter(item => item && item.nom);
        if (cloudList.length > 0) {
          // Fusion intelligente par ID
          const mergedMap = new Map();
          localList.forEach(c => mergedMap.set(c.id, c));
          cloudList.forEach(c => mergedMap.set(c.id, c));
          const merged = Array.from(mergedMap.values());
          saveLocalDirectory(merged);
          return merged;
        }
      }
    }
  } catch (err) {
    // Mode hors-ligne : renvoie silencieusement la copie en cache
    console.log("Annuaire en mode cache hors-ligne :", err.message);
  }

  return localList;
}

function saveLocalDirectory(list) {
  try {
    localStorage.setItem(DIRECTORY_CACHE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("Erreur sauvegarde locale annuaire:", e);
  }
}

/**
 * Publie ou met à jour les coordonnées professionnelles du médecin dans l'annuaire partagé
 */
export async function publishDoctorToDirectory(doctorProfile) {
  if (!doctorProfile || !doctorProfile.nom) {
    return { success: false, error: "Coordonnées incomplètes." };
  }

  const cleanNom = (doctorProfile.nomSeul || doctorProfile.nom || '').trim();
  const cleanPrenom = (doctorProfile.prenomSeul || doctorProfile.prenom || '').trim();
  const docId = 'doc_' + (cleanNom + '_' + cleanPrenom).toLowerCase().replace(/[^a-z0-9]/g, '_') || ('doc_' + Date.now());

  const payload = {
    id: docId,
    titre: doctorProfile.titre || 'Dr.',
    nom: cleanNom.toUpperCase(),
    prenom: cleanPrenom,
    specialite: doctorProfile.specialite || 'Médecine Générale',
    ville: doctorProfile.ville || 'Mahdia',
    gouvernorat: doctorProfile.ville || 'Mahdia',
    adresse: doctorProfile.adresse || '',
    telephone: doctorProfile.telephone || '',
    email: doctorProfile.email || '',
    cnamId: doctorProfile.cnamId || '',
    ordreId: doctorProfile.ordreId || '',
    fiscId: doctorProfile.fiscId || '',
    publishedAt: new Date().toISOString()
  };

  // 1. Sauvegarde dans le cache local
  const current = await getConfreresDirectory();
  const idx = current.findIndex(c => c.id === docId);
  if (idx >= 0) {
    current[idx] = payload;
  } else {
    current.unshift(payload);
  }
  saveLocalDirectory(current);
  localStorage.setItem(MY_DIRECTORY_PUBLISHED_KEY, 'true');

  // 2. Publication vers le Cloud Firebase partagé
  try {
    const cloudUrl = `${getBridgeBaseUrl()}/docpocket_annuaire_confreres/${docId}.json`;
    await fetch(cloudUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.warn("Publication cloud différée (sera synchronisée lors de la reconnexion) :", e.message);
  }

  return { success: true, confrere: payload };
}

/**
 * Vérifie si le médecin courant est publié dans l'annuaire
 */
export function isMyProfilePublishedInDirectory() {
  try {
    return localStorage.getItem(MY_DIRECTORY_PUBLISHED_KEY) === 'true';
  } catch {
    return true;
  }
}

/**
 * Générateur officiel de « Lettre d'Orientation / Fiche de Liaison Médicale »
 * Imprime ou exporte en PDF une lettre professionnelle d'adressage d'un patient vers un confrère spécialiste
 */
export function generateOrientationReport(patient, destinationConfrere, orientationDetails = {}) {
  if (!patient || !destinationConfrere) {
    alert("Veuillez sélectionner un patient et un confrère destinataire.");
    return;
  }

  const printWindow = window.open('', '_blank', 'width=880,height=960');
  if (!printWindow) {
    alert("Veuillez autoriser les fenêtres pop-up pour afficher et imprimer la lettre d'orientation.");
    return;
  }

  // Profil du médecin expéditeur (Dr. titulaire)
  let docProfile = {};
  try {
    const raw = localStorage.getItem('docpocket_doctor_profile');
    if (raw) docProfile = JSON.parse(raw);
  } catch {}

  const senderNom = docProfile.nom ? `Dr. ${docProfile.nom}` : 'Dr. Hamed BEN KHALIFA';
  const senderSpec = docProfile.specialite || 'Médecine Générale';
  const senderAdresse = [docProfile.adresse, docProfile.ville].filter(Boolean).join(', ') || 'Complexe Médical Dar Attabib, Mahdia';
  const senderTel = docProfile.telephone ? `Tél : ${docProfile.telephone}` : 'Tél : 31 576 900 / 53 573 117';
  const senderEmail = docProfile.email ? ` • Email : ${docProfile.email}` : '';
  const senderOrdre = docProfile.ordreId ? `N° d'Ordre : ${docProfile.ordreId}` : "N° d'Ordre : 12052";
  const senderCnam = docProfile.cnamId ? ` • Code CNAM : ${docProfile.cnamId}` : ' • Code CNAM : 010002763183';
  const today = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

  const patientCivility = (patient.civility && !/mari|celib|veuf|divorc/i.test(patient.civility))
    ? patient.civility
    : (patient.gender === 'F' ? 'Mme' : 'M.');
  const patientFullname = `${patientCivility} ${(patient.nom || '').toUpperCase()} ${patient.prenom || ''}`.trim();

  const motif = orientationDetails.motif || "Avis spécialisé et prise en charge conjointe";
  const antecedents = orientationDetails.antecedents || patient.antecedents || patient.notes || "Non renseigné";
  const observations = orientationDetails.observations || "Examen clinique complet et éléments du dossier ci-joints.";
  const traitement = orientationDetails.traitement || "Traitement médical habituel";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Lettre d'Orientation Médicale - ${patientFullname}</title>
  <style>
    @page { size: A4 portrait; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #0f172a;
      background: #fff;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.5;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .sender-box h1 {
      margin: 0 0 4px;
      font-size: 19px;
      color: #0369a1;
      font-weight: 800;
    }
    .sender-box p {
      margin: 2px 0;
      font-size: 11px;
      color: #475569;
    }
    .date-box {
      text-align: right;
      font-size: 12px;
      color: #64748b;
    }
    .confrere-card {
      background: #f0f9ff;
      border: 1.5px solid #bae6fd;
      border-radius: 10px;
      padding: 12px 18px;
      margin-bottom: 22px;
      margin-left: auto;
      max-width: 380px;
    }
    .confrere-title {
      font-size: 11px;
      font-weight: 700;
      color: #0284c7;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .confrere-name {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }
    .confrere-sub {
      font-size: 11px;
      color: #475569;
      margin-top: 2px;
    }
    .patient-banner {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .subject-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      text-align: center;
      margin-bottom: 22px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding-bottom: 6px;
      border-bottom: 1px dashed #cbd5e1;
    }
    .content-section {
      margin-bottom: 18px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #0284c7;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 6px;
    }
    .section-body {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 13px;
      color: #1e293b;
      white-space: pre-wrap;
    }
    .signature-row {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .signature-box {
      text-align: right;
      width: 250px;
    }
    .sig-line {
      height: 60px;
    }
    .no-print {
      position: fixed;
      top: 12px;
      right: 16px;
      display: flex;
      gap: 10px;
      z-index: 1000;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 12px;
      border: none;
      cursor: pointer;
    }
    .btn-print { background: #0284c7; color: #fff; }
    .btn-close { background: #64748b; color: #fff; }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn btn-print" onclick="window.print()">🖨️ Imprimer / PDF</button>
    <button class="btn btn-close" onclick="window.close()">✕ Fermer</button>
  </div>

  <div class="header-bar">
    <div class="sender-box">
      <h1>${senderNom}</h1>
      <p><strong>${senderSpec}</strong></p>
      <p>${senderAdresse}</p>
      <p>${senderTel}${senderEmail}</p>
      <p>${senderOrdre}${senderCnam}</p>
    </div>
    <div class="date-box">
      <div>${docProfile.ville || 'Mahdia'}, le</div>
      <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 2px;">${today}</div>
    </div>
  </div>

  <div class="confrere-card">
    <div class="confrere-title">À l'attention confraternelle de :</div>
    <div class="confrere-name">${destinationConfrere.titre || 'Dr.'} ${destinationConfrere.prenom} ${destinationConfrere.nom}</div>
    <div class="confrere-sub"><strong>${destinationConfrere.specialite}</strong></div>
    <div class="confrere-sub">${destinationConfrere.adresse ? destinationConfrere.adresse + ', ' : ''}${destinationConfrere.ville}</div>
    <div class="confrere-sub">Tél : ${destinationConfrere.telephone || '-'}</div>
  </div>

  <div class="patient-banner">
    <div>
      <span style="font-size: 11px; color: #64748b; text-transform: uppercase;">Patient(e) : </span>
      <strong style="font-size: 14px; color: #0f172a;">${patientFullname}</strong>
      ${patient.birthdate ? `<span style="font-size: 12px; color: #475569;"> (Né(e) le : ${patient.birthdate})</span>` : ''}
    </div>
    <div style="font-size: 11px; color: #64748b;">
      ${patient.cnamid ? `N° CNAM : <strong style="color: #0284c7;">${patient.cnamid}</strong>` : ''}
    </div>
  </div>

  <div class="subject-title">
    Fiche de Liaison Médicale & Demande d'Avis Spécialisé
  </div>

  <p style="font-size: 13px; margin-bottom: 16px;">
    Cher(e) Confrère,<br>
    Je vous adresse en consultation ce jour ${patientCivility} <strong>${(patient.nom || '').toUpperCase()} ${patient.prenom || ''}</strong> pour :
  </p>

  <div class="content-section">
    <div class="section-title">📌 Motif d'adressage & Histoire clinique</div>
    <div class="section-body">${motif}</div>
  </div>

  <div class="content-section">
    <div class="section-title">🩺 Données cliniques & Antécédents notables</div>
    <div class="section-body">${antecedents}</div>
  </div>

  <div class="content-section">
    <div class="section-title">🔬 Constatations & Traitement actuel</div>
    <div class="section-body">${observations}

<strong>Traitement en cours :</strong> ${traitement}</div>
  </div>

  <p style="font-size: 13px; margin-top: 20px;">
    En vous remerciant vivement pour votre prise en charge confraternelle et dans l'attente de votre avis spécialisé.<br>
    Bien confraternellement,
  </p>

  <div class="signature-row">
    <div></div>
    <div class="signature-box">
      <div style="font-size: 11px; color: #64748b;">Signature & Cachet du Médecin Traitant</div>
      <div class="sig-line"></div>
      <div style="font-weight: 700; color: #0f172a;">${senderNom}</div>
    </div>
  </div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
