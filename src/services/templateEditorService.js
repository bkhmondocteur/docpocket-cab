// ==============================================================
// DOCPOCKET CABINET - SERVICE ÉDITEUR DE MODÈLES & VARIABLES DYNAMIQUES
// MOTEUR DE MISE EN PAGE UNIFIÉ POUR ORDONNANCES ET CERTIFICATS
// ==============================================================

const STORAGE_KEY_TEMPLATES = 'docpocket_custom_templates_v2';
const STORAGE_KEY_PRESCRIPTION_LAYOUT = 'docpocket_prescription_layout_config';
const STORAGE_KEY_CERTIFICATE_LAYOUT = 'docpocket_certificate_layout_config';

/**
 * Liste complète des variables dynamiques disponibles
 */
export const AVAILABLE_VARIABLES = [
  // Patient
  { tag: '{nom}', label: 'Nom du patient', category: 'patient', example: 'BEN KHALIFA' },
  { tag: '{prenom}', label: 'Prénom du patient', category: 'patient', example: 'Hamed' },
  { tag: '{nom_complet}', label: 'Nom & Prénom complets', category: 'patient', example: 'M. Hamed BEN KHALIFA' },
  { tag: '{civilite}', label: 'Civilité (M., Mme, Enfant)', category: 'patient', example: 'M.' },
  { tag: '{age}', label: 'Âge calculé', category: 'patient', example: '45 ans' },
  { tag: '{date_naissance}', label: 'Date de naissance', category: 'patient', example: '15/12/1980' },
  { tag: '{cin}', label: 'Numéro de CIN', category: 'patient', example: '08123456' },
  { tag: '{passeport}', label: 'Numéro de Passeport', category: 'patient', example: 'M123456' },
  { tag: '{telephone}', label: 'Téléphone du patient', category: 'patient', example: '98 123 456' },
  { tag: '{adresse}', label: 'Adresse du patient', category: 'patient', example: 'Avenue Habib Bourguiba' },
  { tag: '{ville}', label: 'Ville de résidence', category: 'patient', example: 'Mahdia' },
  { tag: '{cnam_id}', label: 'N° Carnet / Identifiant CNAM', category: 'patient', example: '2008923676' },
  { tag: '{caisse}', label: 'Caisse (CNSS / CNRPS)', category: 'patient', example: 'CNSS' },
  { tag: '{apci}', label: 'Code & Libellé APCI', category: 'patient', example: 'APCI Code 05' },

  // Arrêt de travail & Repos
  { tag: '{nombre_jours_repos}', label: 'Nombre de jours (chiffre)', category: 'repos', example: '3' },
  { tag: '{jours_repos_lettres}', label: 'Nombre de jours (en lettres)', category: 'repos', example: 'trois' },
  { tag: '{date_debut_repos}', label: 'Date début du repos', category: 'repos', example: '24/11/2026' },
  { tag: '{date_fin_repos}', label: 'Date fin du repos', category: 'repos', example: '27/11/2026' },
  { tag: '{date_reprise}', label: 'Date reprise du travail', category: 'repos', example: '28/11/2026' },

  // Consultation & Médical
  { tag: '{date_du_jour}', label: 'Date du jour', category: 'consultation', example: '24/11/2026' },
  { tag: '{diagnostic}', label: 'Diagnostic médical', category: 'consultation', example: 'Rhinopharyngite aiguë' },
  { tag: '{motif}', label: 'Motif de consultation', category: 'consultation', example: 'Contrôle médical' },
  { tag: '{constantes}', label: 'Constantes (TA, Pouls, Poids)', category: 'consultation', example: 'TA: 12/8, Poids: 75 kg' },

  // Praticien & Cabinet
  { tag: '{nom_medecin}', label: 'Nom du médecin', category: 'cabinet', example: 'Dr. Hamed BEN KHALIFA' },
  { tag: '{specialite_medecin}', label: 'Spécialité', category: 'cabinet', example: 'Médecine Générale' },
  { tag: '{ordre_medecin}', label: 'N° Ordre des Médecins', category: 'cabinet', example: '12052' },
  { tag: '{code_cnam_medecin}', label: 'Code Conventionnel CNAM', category: 'cabinet', example: '010002763183' },
  { tag: '{adresse_cabinet}', label: 'Adresse du cabinet', category: 'cabinet', example: 'Dar Attabib, Mahdia' },
  { tag: '{telephone_cabinet}', label: 'Téléphone du cabinet', category: 'cabinet', example: '31 576 900' },

  // Ordonnance
  { tag: '{liste_medicaments}', label: 'Liste des médicaments prescrits', category: 'ordonnance', example: '1. Paracétamol 1g...' }
];

/**
 * Modèles par défaut intégrés (Certificats & Ordonnances)
 */
export const DEFAULT_BUILTIN_TEMPLATES = [
  // 1. Repos Médical Standard
  {
    id: 'cert_repos_standard',
    type: 'certificate',
    category: 'travail',
    title: 'Certificat de Repos Médical (Standard)',
    description: 'Modèle officiel d\'arrêt de travail avec calcul automatique des jours en chiffres et en lettres',
    paperFormat: 'A5',
    orientation: 'portrait',
    fontSize: '11pt',
    margins: { top: 35, bottom: 25, left: 20, right: 20 },
    showHeader: true,
    showStamp: true,
    showSignature: true,
    body: `Je soussigné, {nom_medecin}, certifie avoir examiné ce jour :

{nom_complet}, {civilite} né(e) le {date_naissance} ({age}), titulaire de la CIN n° {cin}.

À l'issue de cet examen clinique, son état de santé justifie un repos médical et des soins d'une durée de {nombre_jours_repos} ({jours_repos_lettres}) jours, à compter du {date_debut_repos} jusqu'au {date_fin_repos} inclus, sous réserve de complication ultérieure.

Certificat délivré à la demande de l'intéressé(e) pour servir et faire valoir ce que de droit.`
  },

  // 2. Prolongation de Repos Médical
  {
    id: 'cert_prolongation_repos',
    type: 'certificate',
    category: 'travail',
    title: 'Prolongation d\'Arrêt de Travail',
    description: 'Prolongation de repos faisant suite à une première période d\'arrêt',
    paperFormat: 'A5',
    orientation: 'portrait',
    fontSize: '11pt',
    margins: { top: 35, bottom: 25, left: 20, right: 20 },
    showHeader: true,
    showStamp: true,
    showSignature: true,
    body: `Je soussigné, {nom_medecin}, certifie avoir examiné ce jour :

{nom_complet}, né(e) le {date_naissance} ({age}), titulaire de la CIN n° {cin}.

Et atteste que l'évolution de son état de santé nécessite une PROLONGATION de son repos médical pour une durée de {nombre_jours_repos} ({jours_repos_lettres}) jours, à compter du {date_debut_repos} jusqu'au {date_fin_repos} inclus.

Délivré à l'intéressé(e) pour servir et faire valoir ce que de droit.`
  },

  // 3. Certificat de Reprise de Travail / Guérison
  {
    id: 'cert_reprise_travail',
    type: 'certificate',
    category: 'travail',
    title: 'Certificat de Reprise de Travail / Guérison',
    description: 'Constat de guérison clinique et aptitude à la reprise d\'activité',
    paperFormat: 'A5',
    orientation: 'portrait',
    fontSize: '11pt',
    margins: { top: 35, bottom: 25, left: 20, right: 20 },
    showHeader: true,
    showStamp: true,
    showSignature: true,
    body: `Je soussigné, {nom_medecin}, certifie avoir examiné ce jour :

{nom_complet}, né(e) le {date_naissance} ({age}), titulaire de la CIN n° {cin}.

À l'issue de cet examen de contrôle, je constate la guérison clinique de l'affection en cause et l'aptitude médicale du/de la patient(e) à reprendre son activité professionnelle à compter du {date_reprise}.

Délivré à la demande de l'intéressé(e) pour faire valoir ce que de droit.`
  },

  // 4. Aptitude Sportive
  {
    id: 'cert_aptitude_sport',
    type: 'certificate',
    category: 'aptitude',
    title: 'Certificat Médical d\'Aptitude au Sport',
    description: 'Examen de non contre-indication à la pratique des activités physiques et sportives',
    paperFormat: 'A5',
    orientation: 'portrait',
    fontSize: '11pt',
    margins: { top: 35, bottom: 25, left: 20, right: 20 },
    showHeader: true,
    showStamp: true,
    showSignature: true,
    body: `Je soussigné, {nom_medecin}, certifie avoir examiné ce jour :

{nom_complet}, né(e) le {date_naissance} ({age}), titulaire de la CIN n° {cin}.

Et atteste que l'examen clinique cardio-vasculaire et pleuro-pulmonaire ne révèle, ce jour, aucun signe décelable de contre-indication médicale à la pratique des activités physiques et sportives d'entraînement et de compétition.

Certificat délivré pour l'obtention de licence sportive.`
  },

  // 5. Aptitude à l'Embauche
  {
    id: 'cert_aptitude_embauche',
    type: 'certificate',
    category: 'aptitude',
    title: 'Certificat d\'Aptitude à l\'Embauche / Travail',
    description: 'Constat d\'aptitude physique et mentale à l\'exercice d\'une fonction professionnelle',
    paperFormat: 'A5',
    orientation: 'portrait',
    fontSize: '11pt',
    margins: { top: 35, bottom: 25, left: 20, right: 20 },
    showHeader: true,
    showStamp: true,
    showSignature: true,
    body: `Je soussigné, {nom_medecin}, certifie avoir examiné ce jour :

{nom_complet}, né(e) le {date_naissance} ({age}), titulaire de la CIN n° {cin}.

Et atteste qu'au vu de cet examen clinique général, il(elle) ne présente aucun signe d'affection contagieuse ou évolutive décelable cliniquement, et qu'il(elle) est apte physiquement et mentalement à l'exercice de son activité professionnelle.

Certificat délivré pour dossier d'embauche administrative.`
  },

  // 6. Certificat Médicolégal Initial (CMI avec ITT)
  {
    id: 'cert_cmi_itt',
    type: 'certificate',
    category: 'legal',
    title: 'Certificat Médicolégal Initial (CMI avec ITT)',
    description: 'Constat descriptif des lésions traumatiques avec fixation de l\'Incapacité Totale de Travail',
    paperFormat: 'A4',
    orientation: 'portrait',
    fontSize: '11pt',
    margins: { top: 35, bottom: 25, left: 20, right: 20 },
    showHeader: true,
    showStamp: true,
    showSignature: true,
    body: `CERTIFICAT MÉDICAL INITIAL (MÉDICOLÉGAL)

Je soussigné, {nom_medecin}, certifie avoir examiné ce jour, le {date_du_jour} :

{nom_complet}, né(e) le {date_naissance} ({age}), titulaire de la CIN n° {cin}, demeurant à {adresse}, {ville}.

Qui déclare avoir été victime d'une agression physique / accident de la voie publique le {date_du_jour}.

CONSTATATIONS CLINIQUES :
L'examen clinique approfondi met en évidence les lésions suivantes :
- [Décrire précisément la nature, le siège et les dimensions des lésions : ecchymoses, plaies, hématomes...]
- Examen ostéo-articulaire et neurologique de débrouillage : sans anomalie neurologique focale décelable ce jour.

CONCLUSION :
Ces lésions entraînent, sous réserve de complications ultérieures ou d'examens complémentaires, une Incapacité Totale de Travail (I.T.T.) fixée à {nombre_jours_repos} ({jours_repos_lettres}) jours.

Certificat délivré en mains propres à l'intéressé(e) pour faire valoir ce que de droit.`
  },

  // 7. Attestation de Présence / Accompagnant
  {
    id: 'cert_presence_accompagnant',
    type: 'certificate',
    category: 'attestation',
    title: 'Attestation de Présence / Accompagnant',
    description: 'Attestation de présence au cabinet pour consultation ou accompagnement d\'un proche',
    paperFormat: 'A5',
    orientation: 'portrait',
    fontSize: '11pt',
    margins: { top: 35, bottom: 25, left: 20, right: 20 },
    showHeader: true,
    showStamp: true,
    showSignature: true,
    body: `ATTESTATION DE PRÉSENCE AU CABINET

Je soussigné, {nom_medecin}, atteste par la présente que :

{nom_complet}, titulaire de la CIN n° {cin},

Était présent(e) ce jour, {date_du_jour}, à mon cabinet médical pour consultation médicale et soins.

La présente attestation lui est délivrée pour justifier de son absence auprès de son administration ou employeur.`
  },

  // 8. Modèle Ordonnance Standard
  {
    id: 'presc_ordonnance_standard',
    type: 'prescription',
    category: 'ordonnance',
    title: 'Ordonnance Médicale Standard',
    description: 'Modèle officiel d\'ordonnance médicale avec cartouche patient et liste des médicaments',
    paperFormat: 'A5',
    orientation: 'portrait',
    fontSize: '11pt',
    margins: { top: 40, bottom: 25, left: 18, right: 18 },
    showHeader: true,
    showStamp: true,
    showSignature: true,
    body: `Patient(e) : {nom_complet}
Âge : {age} | Date : {date_du_jour}
Affiliation CNAM : {cnam_id} ({caisse})

PRESCRIPTION MÉDICALE :

{liste_medicaments}

Arrêtée la présente ordonnance aux prescriptions ci-dessus mentionnées.
Ordonnance valable 3 mois sauf mention contraire.`
  },

  // 9. Modèle Ordonnance APCI (Prise en Charge 100%)
  {
    id: 'presc_ordonnance_apci',
    type: 'prescription',
    category: 'ordonnance',
    title: 'Ordonnance Prise en Charge APCI (100% CNAM)',
    description: 'Ordonnance conventionnée avec mention expresse de l\'APCI et du numéro de carnet',
    paperFormat: 'A5',
    orientation: 'portrait',
    fontSize: '11pt',
    margins: { top: 40, bottom: 25, left: 18, right: 18 },
    showHeader: true,
    showStamp: true,
    showSignature: true,
    body: `CONVENTION CNAM — PRISE EN CHARGE INTÉGRALE APCI (100%)

Bénéficiaire : {nom_complet}
N° Carnet CNAM : {cnam_id} | Caisse : {caisse}
Affection Exonérante : {apci}
Date de délivrance : {date_du_jour}

TRAITEMENT CHRONIQUE :

{liste_medicaments}

Durée du traitement : 3 mois renouvelable.
Arrêtée la présente ordonnance APCI aux lignes prescrites.`
  },

  // 10. Modèle Ordonnance Bilan Biologique
  {
    id: 'presc_bilan_biologique',
    type: 'prescription',
    category: 'ordonnance',
    title: 'Ordonnance Bilan Biologique & Analyses',
    description: 'Demande d\'analyses de laboratoire pré-remplie avec bilan usuel',
    paperFormat: 'A5',
    orientation: 'portrait',
    fontSize: '11pt',
    margins: { top: 40, bottom: 25, left: 18, right: 18 },
    showHeader: true,
    showStamp: true,
    showSignature: true,
    body: `Patient(e) : {nom_complet}
Âge : {age} | Date : {date_du_jour}

Prière au laboratoire d'analyses médicales d'effectuer pour le/la patient(e) :

- Numération Formule Sanguine (NFS / Plaquettes)
- Glycémie à jeun + Hémoglobine glyquée (HbA1c)
- Bilan Rénal : Urée sanguine, Créatininémie, Clairance estimée
- Bilan Lipidique complet : Cholestérol Total, HDL, LDL, Triglycérides
- Bilan Hépatique : ASAT, ALAT, GGT, Phosphatases Alcalines
- Ionogramme sanguin (Na+, K+)
- Examen Cytobactériologique des Urines (ECBU) si leucocyturie

Résultats à communiquer au médecin traitant.`
  },

  // 11. Modèle Demande d'Imagerie Médicale & Radiologie
  {
    id: 'presc_demande_imagerie',
    type: 'prescription',
    category: 'ordonnance',
    title: 'Demande d\'Imagerie Médicale & Radiologie',
    description: 'Prescription d\'examens radiologiques, échographie, scanner ou IRM',
    paperFormat: 'A5',
    orientation: 'portrait',
    fontSize: '11pt',
    margins: { top: 40, bottom: 25, left: 18, right: 18 },
    showHeader: true,
    showStamp: true,
    showSignature: true,
    body: `Patient(e) : {nom_complet}
Âge : {age} | Date : {date_du_jour}

Prière au centre de radiologie et d'imagerie médicale d'effectuer pour le/la patient(e) :

- {liste_medicaments}

Renseignements cliniques :
{diagnostic}

Merci de bien vouloir communiquer les clichés et le compte-rendu radiologique.`
  }
];

/**
 * Récupère tous les modèles (intégrés d'usine + personnalisés du médecin)
 */
export function getAllTemplates(filterType = 'all') {
  let custom = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEMPLATES);
    custom = raw ? JSON.parse(raw) : [];
  } catch (e) {
    custom = [];
  }

  // Fusionner les modèles d'usine et les personnalisés
  const customIds = new Set(custom.map(t => t.id));
  const builtInFiltered = DEFAULT_BUILTIN_TEMPLATES.filter(t => !customIds.has(t.id));
  const all = [...custom, ...builtInFiltered];

  if (filterType === 'all') return all;
  return all.filter(t => t.type === filterType);
}

/**
 * Enregistre ou met à jour un modèle personnalisé
 */
export function saveCustomTemplate(template) {
  if (!template || !template.title) {
    throw new Error("Le titre du modèle est obligatoire.");
  }

  const all = getAllTemplates('all');
  const id = template.id || `custom_${template.type || 'cert'}_${Date.now()}`;
  const now = new Date().toISOString();

  const toSave = {
    ...template,
    id,
    updatedAt: now,
    isCustom: true
  };

  let customList = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEMPLATES);
    customList = raw ? JSON.parse(raw) : [];
  } catch (e) {
    customList = [];
  }

  const existingIdx = customList.findIndex(t => t.id === id);
  if (existingIdx >= 0) {
    customList[existingIdx] = toSave;
  } else {
    customList.unshift(toSave);
  }

  localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(customList));

  // Déclencher un événement de mise à jour pour réactivité instantanée
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('docpocket_templates_updated', { detail: toSave }));
  }

  return toSave;
}

/**
 * Supprime un modèle personnalisé (si modèle d'usine, le réinitialise)
 */
export function deleteCustomTemplate(templateId) {
  let customList = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEMPLATES);
    customList = raw ? JSON.parse(raw) : [];
  } catch (e) {
    customList = [];
  }

  customList = customList.filter(t => t.id !== templateId);
  localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(customList));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('docpocket_templates_updated', { detail: { deletedId: templateId } }));
  }
  return true;
}

/**
 * Convertit un nombre en toutes lettres françaises (1..365) pour la mention légale d'ITT / repos
 */
export function convertNumberToFrenchWords(n) {
  const num = parseInt(n, 10);
  if (isNaN(num)) return String(n || '');
  const unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
    'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const dizaines = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingts', 'quatre-vingt-dix'];

  if (num === 0) return 'zéro';
  if (num === 1) return 'un';
  if (num < 20) return unites[num];
  if (num < 100) {
    const d = Math.floor(num / 10);
    const u = num % 10;
    if (d === 7) return `soixante-${u === 1 ? 'et-onze' : unites[10 + u]}`;
    if (d === 9) return `quatre-vingt-${unites[10 + u]}`;
    if (u === 0) return dizaines[d];
    if (u === 1 && d < 8) return `${dizaines[d]}-et-un`;
    return `${dizaines[d]}-${unites[u]}`;
  }
  if (num < 200) {
    const rest = num - 100;
    return rest === 0 ? 'cent' : `cent ${convertNumberToFrenchWords(rest)}`;
  }
  if (num < 1000) {
    const c = Math.floor(num / 100);
    const rest = num % 100;
    const cStr = `${unites[c]} cent${c > 1 && rest === 0 ? 's' : ''}`;
    return rest === 0 ? cStr : `${cStr} ${convertNumberToFrenchWords(rest)}`;
  }
  return String(num);
}

/**
 * Formate une date en format lisible français (ex: 24/11/2026)
 */
export function formatDateFr(dateVal) {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return String(dateVal);
  }
}

/**
 * Calcule l'âge d'un patient à partir de sa date de naissance
 */
export function calculateAgeStr(birthdate) {
  if (!birthdate) return 'âge non précisé';
  try {
    const birth = new Date(birthdate);
    if (isNaN(birth.getTime())) return 'âge non précisé';
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    if (age <= 0) {
      const months = Math.max(1, Math.floor((now - birth) / (1000 * 60 * 60 * 24 * 30.5)));
      return `${months} mois`;
    }
    return `${age} ans`;
  } catch {
    return 'âge non précisé';
  }
}

/**
 * MOTEUR UNIVERSEL DE FUSION DES VARIABLES DYNAMIQUES
 * Remplace tous les tags {variable} dans le texte par les valeurs réelles du patient et de la consultation.
 */
export function renderTemplateWithVariables(templateText, context = {}) {
  if (!templateText) return '';

  const {
    patient = {},
    consultation = {},
    data = {},
    doctor = null
  } = context;

  // Récupération dynamique du profil praticien
  let docInfo = doctor;
  if (!docInfo && typeof localStorage !== 'undefined') {
    try {
      const saved = JSON.parse(localStorage.getItem('docpocket_doctor_profile') || '{}');
      docInfo = {
        nom: saved.nom ? `Dr. ${saved.nom}` : 'Dr. Hamed BEN KHALIFA',
        specialite: saved.specialite || 'Médecine Générale',
        numOrdre: saved.ordreId || '12052',
        cnamId: saved.cnamId || '010002763183',
        adresse: saved.adresse || 'Complexe Médical Dar Attabib, Mahdia',
        telephone: saved.telephone || '+216 73 680 888 / 98 250 500'
      };
    } catch {
      docInfo = null;
    }
  }

  const dNom = docInfo?.nom || 'Dr. Hamed BEN KHALIFA';
  const dSpec = docInfo?.specialite || 'Médecine Générale';
  const dOrdre = docInfo?.numOrdre || '12052';
  const dCnam = docInfo?.cnamId || '010002763183';
  const dAdresse = docInfo?.adresse || 'Complexe Médical Dar Attabib, Mahdia';
  const dTel = docInfo?.telephone || '+216 73 680 888 / 98 250 500';

  // Patient
  const pNom = (patient.nom || '').trim().toUpperCase() || '....................';
  const pPrenom = (patient.prenom || '').trim() || '....................';
  const pFullname = patient.fullname || `${pNom} ${pPrenom}`.trim() || '........................................';
  const pCivility = patient.civility || (patient.gender === 'F' ? 'Mme' : 'M.');
  const pAge = calculateAgeStr(patient.birthdate);
  const pBirthdate = formatDateFr(patient.birthdate) || '....................';
  const pCin = patient.cin || '....................';
  const pPassport = patient.passport || data.passport || '....................';
  const pTel = patient.telephone || '....................';
  const pAdresse = patient.adress || '....................';
  const pVille = patient.city || '....................';
  const pCnamId = patient.cnamid || '....................';
  const pCaisse = patient.caisse || 'CNSS';
  const pApci = patient.apciLabel || (patient.apci ? `APCI Code ${patient.apci}` : 'Non spécifié');

  // Repos / Arrêt de travail
  const nbJours = parseInt(data.dureeJours ?? consultation.reposJours ?? 3, 10) || 3;
  const joursLettres = convertNumberToFrenchWords(nbJours);
  const dateDebutRaw = data.dateDebut || consultation.reposDebut || new Date().toISOString().slice(0, 10);
  const dateDebut = formatDateFr(dateDebutRaw);

  const startDate = new Date(dateDebutRaw);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + (nbJours > 0 ? nbJours - 1 : 0));
  const dateFin = formatDateFr(endDate);

  const repriseDate = new Date(startDate);
  repriseDate.setDate(repriseDate.getDate() + nbJours);
  const dateReprise = data.dateReprise ? formatDateFr(data.dateReprise) : formatDateFr(repriseDate);

  // Consultation
  const dateJour = formatDateFr(new Date());
  const diagnostic = data.diagnostic || consultation.diagnostic || '....................';
  const motif = consultation.motif || data.motif || 'Consultation de suivi';
  const ta = consultation.taMax && consultation.taMin ? `${consultation.taMax}/${consultation.taMin}` : (data.ta || '');
  const poids = consultation.poids ? `${consultation.poids} kg` : '';
  const constantes = [ta ? `TA : ${ta}` : '', poids ? `Poids : ${poids}` : ''].filter(Boolean).join(' • ') || 'Constantes normales';

  // Médicaments (pour ordonnance)
  let listeMeds = '';
  if (Array.isArray(data.medicaments) && data.medicaments.length > 0) {
    listeMeds = data.medicaments.map((m, idx) => {
      const nom = m.nom || m.itemname || 'Médicament';
      const poso = m.posologie || m.posology || '';
      const duree = m.duree || m.ttperiod || '';
      return `${idx + 1}. ${nom}\n   ${poso ? '• Posologie : ' + poso : ''} ${duree ? '(' + duree + ')' : ''}`.trim();
    }).join('\n\n');
  } else if (typeof data.medicaments === 'string' && data.medicaments.trim()) {
    listeMeds = data.medicaments;
  } else {
    listeMeds = '1. ....................................................\n   • Posologie : ......................................';
  }

  // Dictionnaire de substitution
  const replacements = {
    '{nom}': pNom,
    '{prenom}': pPrenom,
    '{nom_complet}': `${pCivility} ${pFullname}`.trim(),
    '{civilite}': pCivility,
    '{age}': pAge,
    '{date_naissance}': pBirthdate,
    '{cin}': pCin,
    '{passeport}': pPassport,
    '{telephone}': pTel,
    '{adresse}': pAdresse,
    '{ville}': pVille,
    '{cnam_id}': pCnamId,
    '{caisse}': pCaisse,
    '{apci}': pApci,

    '{nombre_jours_repos}': String(nbJours),
    '{jours_repos_lettres}': joursLettres,
    '{date_debut_repos}': dateDebut,
    '{date_fin_repos}': dateFin,
    '{date_reprise}': dateReprise,

    '{date_du_jour}': dateJour,
    '{diagnostic}': diagnostic,
    '{motif}': motif,
    '{constantes}': constantes,

    '{nom_medecin}': dNom,
    '{specialite_medecin}': dSpec,
    '{ordre_medecin}': dOrdre,
    '{code_cnam_medecin}': dCnam,
    '{adresse_cabinet}': dAdresse,
    '{telephone_cabinet}': dTel,

    '{liste_medicaments}': listeMeds
  };

  let rendered = templateText;
  for (const [tag, val] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(tag, val);
  }

  return rendered;
}
