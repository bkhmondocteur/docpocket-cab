import medicamentsData from '../data/medicamentsAvicenna.json';
import interactionsData from '../data/interactionsAvicenna.json';
import examensData from '../data/examensAvicenna.json';

// Indexation optimisée en mémoire pour recherche instantanée
const ALL_MEDICAMENTS = medicamentsData || [];
const ALL_INTERACTIONS = interactionsData || [];
const ALL_BIO_EXAMS = examensData?.biologie || [];
const ALL_IMG_EXAMS = examensData?.imagerie || [];

// Extraction de toutes les formes galéniques uniques pour filtrage
const ALL_FORMES = Array.from(new Set(ALL_MEDICAMENTS.map(m => m.forme).filter(Boolean))).sort();

/**
 * Obtenir l'ensemble des médicaments de la base Avicenna
 */
export function getAllMedicaments() {
  return ALL_MEDICAMENTS;
}

/**
 * Obtenir la liste des formes galéniques
 */
export function getAllFormes() {
  return ALL_FORMES;
}

/**
 * Recherche instantanée multi-critères dans le catalogue Avicenna (5 112 médicaments)
 * @param {string} query - Terme recherché
 * @param {'commercial' | 'dci' | 'all'} searchBy - 'commercial' (nom commercial) | 'dci' (DCI) | 'all' (les deux)
 * @param {boolean} onlyApci - Filtrer uniquement les médicaments pris en charge APCI (100% CNAM)
 * @param {number} limit - Nombre maximal de résultats (par défaut 30)
 */
export function searchMedicaments(query = '', searchBy = 'all', onlyApci = false, limit = 30) {
  if (!query || query.trim().length === 0) {
    if (onlyApci) {
      return ALL_MEDICAMENTS.filter(m => m.apci).slice(0, limit);
    }
    return ALL_MEDICAMENTS.slice(0, limit);
  }

  const cleanQuery = query.trim().toUpperCase();
  const tokens = cleanQuery.split(/\s+/).filter(Boolean);

  const results = [];
  for (let i = 0; i < ALL_MEDICAMENTS.length; i++) {
    const med = ALL_MEDICAMENTS[i];

    if (onlyApci && !med.apci) continue;

    const nom = (med.nom || '').toUpperCase();
    const court = (med.court || '').toUpperCase();
    const dci = (med.dci || '').toUpperCase();

    let matches = false;
    if (searchBy === 'commercial') {
      matches = tokens.every(t => nom.includes(t) || court.includes(t));
    } else if (searchBy === 'dci') {
      matches = tokens.every(t => dci.includes(t));
    } else {
      matches = tokens.every(t => nom.includes(t) || court.includes(t) || dci.includes(t));
    }

    if (matches) {
      results.push(med);
      if (results.length >= limit) break;
    }
  }

  return results;
}

/**
 * Filtrage paginé complet pour le Grand Explorateur de la Base Médicamenteuse Avicenna
 */
export function filterMedicaments({
  search = '',
  searchBy = 'all',
  forme = '',
  apciOnly = false,
  page = 1,
  pageSize = 50
} = {}) {
  const cleanSearch = (search || '').trim().toUpperCase();
  const tokens = cleanSearch.split(/\s+/).filter(Boolean);

  const filtered = ALL_MEDICAMENTS.filter(med => {
    if (apciOnly && !med.apci) return false;
    if (forme && med.forme !== forme) return false;

    if (tokens.length > 0) {
      const nom = (med.nom || '').toUpperCase();
      const court = (med.court || '').toUpperCase();
      const dci = (med.dci || '').toUpperCase();

      if (searchBy === 'commercial') {
        return tokens.every(t => nom.includes(t) || court.includes(t));
      } else if (searchBy === 'dci') {
        return tokens.every(t => dci.includes(t));
      } else {
        return tokens.every(t => nom.includes(t) || court.includes(t) || dci.includes(t));
      }
    }

    return true;
  });

  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (currentPage - 1) * pageSize;
  const items = filtered.slice(startIndex, startIndex + pageSize);

  return {
    items,
    total,
    totalPages,
    page: currentPage,
    pageSize
  };
}

/**
 * Détection en temps réel des interactions médicamenteuses Avicenna
 * @param {Array} items - Liste des médicaments prescrits (contenant .nom, .dci, .famille)
 * @returns {Array} Liste des interactions détectées avec mécanisme et précautions
 */
export function checkPrescriptionInteractions(items = []) {
  if (!items || items.length < 2) return [];

  const warnings = [];

  // Comparer chaque paire de médicaments dans l'ordonnance
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const medA = items[i];
      const medB = items[j];

      const dciA = (medA.dci || '').toUpperCase().trim();
      const dciB = (medB.dci || '').toUpperCase().trim();
      const famA = (medA.famille || '').toUpperCase().trim();
      const famB = (medB.famille || '').toUpperCase().trim();

      // Décomposer les DCIs multiples (ex: "AMOXICILLINE,ACIDE CLAVULANIQUE")
      const dciListA = dciA.split(/[,;+]/).map(s => s.trim()).filter(Boolean);
      const dciListB = dciB.split(/[,;+]/).map(s => s.trim()).filter(Boolean);

      for (let k = 0; k < ALL_INTERACTIONS.length; k++) {
        const rule = ALL_INTERACTIONS[k];
        const ruleP = rule.p; // principal
        const ruleA = rule.a; // associe

        // Vérification sens A -> B ou B -> A
        const matchForward = (
          (dciListA.includes(ruleP) || famA.includes(ruleP)) &&
          (dciListB.includes(ruleA) || famB.includes(ruleA))
        );

        const matchBackward = (
          (dciListB.includes(ruleP) || famB.includes(ruleP)) &&
          (dciListA.includes(ruleA) || famA.includes(ruleA))
        );

        if (matchForward || matchBackward) {
          // Éviter les doublons
          const exists = warnings.some(w => 
            (w.medA === medA.nom && w.medB === medB.nom) ||
            (w.medA === medB.nom && w.medB === medA.nom)
          );

          if (!exists) {
            warnings.push({
              medA: medA.nom,
              medB: medB.nom,
              dciA: medA.dci,
              dciB: medB.dci,
              ruleP: rule.p,
              ruleA: rule.a,
              description: rule.desc,
              precautions: rule.caut,
              severite: rule.sev // 0: attention, 1: contre-indication majeure
            });
          }
        }
      }
    }
  }

  return warnings;
}

/**
 * Recherche rapide d'examens biologiques
 */
export function searchBioExams(query = '', limit = 30) {
  if (!query || !query.trim()) return ALL_BIO_EXAMS.slice(0, limit);
  const q = query.trim().toUpperCase();
  return ALL_BIO_EXAMS.filter(e => e.toUpperCase().includes(q)).slice(0, limit);
}

/**
 * Recherche rapide d'examens d'imagerie
 */
export function searchImgExams(query = '', limit = 30) {
  if (!query || !query.trim()) return ALL_IMG_EXAMS.slice(0, limit);
  const q = query.trim().toUpperCase();
  return ALL_IMG_EXAMS.filter(e => e.toUpperCase().includes(q)).slice(0, limit);
}

/**
 * Obtenir les métadonnées globales de la base Avicenna
 */
export function getAvicennaStats() {
  return {
    totalMedicaments: ALL_MEDICAMENTS.length,
    totalInteractions: ALL_INTERACTIONS.length,
    totalBioExams: ALL_BIO_EXAMS.length,
    totalImgExams: ALL_IMG_EXAMS.length,
    version: 'Avicenna Pharmacopée Tunisienne 2026'
  };
}
