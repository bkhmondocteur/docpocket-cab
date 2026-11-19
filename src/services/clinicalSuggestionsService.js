// ==============================================================
// DOCPOCKET CABINET - SERVICE DE SUGGESTIONS CLINIQUES INTELLIGENTES
// ==============================================================
// Gestion de la base de données locale des Motifs de Consultation
// et des Diagnostics Médicaux avec auto-apprentissage au fil des saisies.

const STORAGE_KEY_MOTIFS = 'docpocket_saved_motifs_v1';
const STORAGE_KEY_DIAGNOSTICS = 'docpocket_saved_diagnostics_v1';

export const DEFAULT_CLINICAL_MOTIFS = [
  "Syndrome grippal fébrile",
  "Asthénie fébrile et courbatures",
  "Toux sèche quinteuse",
  "Toux grasse productive",
  "Odynophagie et maux de gorge",
  "Fièvre et frissons",
  "Céphalées et vertiges",
  "Douleurs abdominales aiguës",
  "Épigastralgies et brûlures d'estomac",
  "Gastro-entérite aiguë (vomissements, diarrhée)",
  "Lombalgies aiguës / Lumbago",
  "Dorsalgies et cervicalgies",
  "Asthénie et fatigabilité anormale",
  "Prurit et éruption cutanée",
  "Dyspnée d'effort",
  "Palpitations et précordialgies",
  "Brûlures mictionnelles et pollakiurie",
  "Renouvellement d'ordonnance",
  "Consultation de contrôle",
  "Suivi HTA et diabète",
  "Bilan de santé systématique",
  "Certificat médical d'aptitude physique",
  "Certificat médical de repos"
];

export const DEFAULT_CLINICAL_DIAGNOSTICS = [
  "Trachéo-bronchite aiguë fébrile",
  "Rhinopharyngite aiguë fébrile",
  "Rhinopharyngite aiguë et bronchite catarrhale",
  "Angine érythémato-pultacée bactérienne",
  "Angine érythémateuse virale",
  "Otite moyenne aiguë (OMA)",
  "Sinusite maxillaire aiguë",
  "Gastro-entérite aiguë virale",
  "Infection urinaire basse (Cystite aiguë)",
  "Lombalgie aiguë commune",
  "Lombosciatique L5-S1",
  "HTA essentielle équilibrée",
  "Diabète type 2 non insulino-dépendant",
  "Gastrite aiguë / Dyspepsie",
  "Reflux gastro-œsophagien (RGO)",
  "Syndrome grippal fébrile",
  "Dermatite de contact allergique",
  "Urticaire aiguë",
  "Crise d'angoisse / Spasmophilie",
  "Asthénie réactionnelle",
  "Broncho-pneumopathie chronique obstructive (BPCO)",
  "Pneumopathie franche lobaire aiguë (PFLA)",
  "Colopathie fonctionnelle / Syndrome de l'intestin irritable"
];

function normalizeText(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Récupère l'ensemble des motifs enregistrés (personnalisés + standards)
 */
export function getSavedMotifs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MOTIFS);
    let custom = [];
    if (raw) {
      custom = JSON.parse(raw);
      if (!Array.isArray(custom)) custom = [];
    }
    const combined = [...custom, ...DEFAULT_CLINICAL_MOTIFS];
    const unique = [];
    const seen = new Set();
    for (const item of combined) {
      const clean = (item || '').trim();
      if (!clean) continue;
      const norm = normalizeText(clean);
      if (!seen.has(norm)) {
        seen.add(norm);
        unique.push(clean);
      }
    }
    return unique;
  } catch (e) {
    console.warn("Erreur lecture motifs sauvegardés:", e);
    return DEFAULT_CLINICAL_MOTIFS;
  }
}

/**
 * Récupère l'ensemble des diagnostics enregistrés (personnalisés + standards)
 */
export function getSavedDiagnostics() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DIAGNOSTICS);
    let custom = [];
    if (raw) {
      custom = JSON.parse(raw);
      if (!Array.isArray(custom)) custom = [];
    }
    const combined = [...custom, ...DEFAULT_CLINICAL_DIAGNOSTICS];
    const unique = [];
    const seen = new Set();
    for (const item of combined) {
      const clean = (item || '').trim();
      if (!clean) continue;
      const norm = normalizeText(clean);
      if (!seen.has(norm)) {
        seen.add(norm);
        unique.push(clean);
      }
    }
    return unique;
  } catch (e) {
    console.warn("Erreur lecture diagnostics sauvegardés:", e);
    return DEFAULT_CLINICAL_DIAGNOSTICS;
  }
}

/**
 * Enregistre un motif dans la base de données locale du cabinet
 */
export function saveMotifSuggestion(motif) {
  if (!motif || typeof motif !== 'string') return;
  const clean = motif.trim();
  if (clean.length < 2) return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_MOTIFS);
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];

    const norm = normalizeText(clean);
    list = list.filter(m => normalizeText(m) !== norm);
    list.unshift(clean); // Place en tête des suggestions récentes
    if (list.length > 200) list = list.slice(0, 200);

    localStorage.setItem(STORAGE_KEY_MOTIFS, JSON.stringify(list));
  } catch (e) {
    console.warn("Erreur enregistrement motif suggestion:", e);
  }
}

/**
 * Enregistre un diagnostic dans la base de données locale du cabinet
 */
export function saveDiagnosticSuggestion(diagnostic) {
  if (!diagnostic || typeof diagnostic !== 'string') return;
  const clean = diagnostic.trim();
  if (clean.length < 2) return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_DIAGNOSTICS);
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];

    const norm = normalizeText(clean);
    list = list.filter(d => normalizeText(d) !== norm);
    list.unshift(clean); // Place en tête des suggestions récentes
    if (list.length > 250) list = list.slice(0, 250);

    localStorage.setItem(STORAGE_KEY_DIAGNOSTICS, JSON.stringify(list));
  } catch (e) {
    console.warn("Erreur enregistrement diagnostic suggestion:", e);
  }
}

/**
 * Filtre les suggestions de motif selon la saisie en cours
 */
export function filterMotifSuggestions(query, limit = 8) {
  const all = getSavedMotifs();
  if (!query || !query.trim()) return all.slice(0, limit);
  const qNorm = normalizeText(query);
  return all
    .filter(m => normalizeText(m).includes(qNorm))
    .slice(0, limit);
}

/**
 * Filtre les suggestions de diagnostic selon la saisie en cours
 */
export function filterDiagnosticSuggestions(query, limit = 8) {
  const all = getSavedDiagnostics();
  if (!query || !query.trim()) return all.slice(0, limit);
  const qNorm = normalizeText(query);
  return all
    .filter(d => normalizeText(d).includes(qNorm))
    .slice(0, limit);
}
