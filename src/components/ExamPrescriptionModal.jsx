// ==============================================================
// DOCPOCKET CABINET - MODALE DE PRESCRIPTION D'EXAMENS
// BIOLOGIE MÉDICALE & IMAGERIE RADIOLOGIQUE
// Menu complet avec cases à cocher, recherche, ajout d'examens
// et aperçu avant impression (conforme aux habitudes de cabinet)
// ==============================================================

import React, { useState, useEffect, useMemo } from 'react';
import examensData from '../data/examensAvicenna.json';
import { savePrescription } from '../services/patientStorage';
import { generatePrescriptionReport } from '../services/prescriptionReportGenerator';
import { getPrescriptionSettings, savePrescriptionSettings } from '../services/prescriptionSettingsService';
import PrintPreviewModal from './PrintPreviewModal';

const BASE_BIO_EXAMS = examensData?.biologie || [];
const BASE_IMG_EXAMS = examensData?.imagerie || [];

// Profils rapides usuels
const BIO_QUICK_PROFILES = [
  {
    name: 'Bilan Standard / Routine',
    icon: '🩸',
    exams: ['NFS', 'GLYCÉMIE À JEUN', 'URÉE SANGUINE', 'CRÉATININÉMIE', 'IONOGRAMME SANGUIN']
  },
  {
    name: 'Bilan Lipidique',
    icon: '🫀',
    exams: ['CHOLESTÉROLÉMIE', 'HDL CHOLESTEROL', 'LDL CHOLESTEROL', 'TRIGLYCÉRIDÉMIE']
  },
  {
    name: 'Bilan Hépatique',
    icon: '🧪',
    exams: ['ASAT', 'ALAT', 'GAMMA GT', 'PHOSPHATASES ALCALINES', 'BILIRUBINE TOTALE']
  },
  {
    name: 'Bilan Rénal & Urinaire',
    icon: '🧬',
    exams: ['CRÉATININÉMIE', 'URÉE SANGUINE', 'PROTEINURIE DE 24H', 'ECBU']
  },
  {
    name: 'Inflammatoire & Infectieux',
    icon: '🦠',
    exams: ['CRP', 'VS', 'NFS']
  },
  {
    name: 'Bilan Diabète Suivi',
    icon: '🍬',
    exams: ['GLYCÉMIE À JEUN', 'HÉMOGLOBINE GLYCOSYLÉE', 'MICROALBUMINURIE', 'CRÉATININÉMIE', 'BILAN MARTIAL']
  },
  {
    name: 'Thyroïde & Vitamines',
    icon: '🦋',
    exams: ['TSH', 'FT4 L', 'VITAMINE D', 'FERRITINEMIE']
  },
  {
    name: 'Hémostase & Pré-op',
    icon: '🩺',
    exams: ['NFS', 'TP', 'TCK', 'INR', 'GS']
  }
];

const IMG_QUICK_PROFILES = [
  {
    name: 'Thorax & Poumons',
    icon: '🩻',
    exams: ['RADIOGRAPHIE DU THORAX F', 'RADIOGRAPHIE DU THORAX : UNE INCIDENCE']
  },
  {
    name: 'Abdomen & Pelvis',
    icon: '🔊',
    exams: ['ECHOGRAPHIE ABDOMINALE', 'ECHOGRAPHIE ABDOMINO-PELVIENNE', 'RADIOGRAPHIE ASP']
  },
  {
    name: 'Rachis & Dos',
    icon: '🦴',
    exams: ['RADIOGRAPHIE RACHIS LOMBAIRE F ET P', 'RADIOGRAPHIE DU RACHIS CERVICAL F+ P', 'IRM DU RACHIS LOMBAIRE']
  },
  {
    name: 'Articulations & Membres',
    icon: '🦵',
    exams: ['RADIOGRAPHIE DES GENOUS DROIT ET GAUCHE F+P', 'RADIOGRAPHIE DE L\'EPAULE DROIT F ET P', 'ECHOGRAPHIE ARTICULAIRE']
  },
  {
    name: 'Cerveau & Crâne',
    icon: '🧠',
    exams: ['SCANNER CEREBRAL', 'TDM CÉRÉBRALE', 'IRM CÉRÉBRALE']
  },
  {
    name: 'Doppler Vasculaire',
    icon: '🩸',
    exams: ['ECHO DOPPLER DES VAISSEAUX DU COU', 'ECHO-DOPPLER DES VAISSEAUX DES MEMBRES INFERIEURS']
  },
  {
    name: 'Sénologie',
    icon: '🎗️',
    exams: ['MAMMOGRAPHIE + ÉCHO : EXAMEN COMPLET', 'ECHOGRAPHIE MAMMAIRE']
  },
  {
    name: 'Scanners (TDM)',
    icon: '📡',
    exams: ['TDM THORACIQUE', 'TDM ABDOMINO-PELVIENNE', 'TDM THORACO-ABDOMINALE']
  }
];

// Catégories thématiques
const BIO_CATEGORIES = [
  { id: 'all', label: 'Toutes les analyses (A-Z)', icon: '📋' },
  { id: 'custom', label: 'Mes analyses ajoutées', icon: '⭐' },
  { id: 'hemato', label: 'Hématologie & Coagulation', icon: '🩸', pattern: /nfs|plaquette|reticulo|frottis|coombs|sang|tp|tck|inr|dimer|vgm|hb|hemoglob|groupage|gs|tc/i },
  { id: 'biochimie', label: 'Biochimie & Diabète', icon: '🍬', pattern: /glycem|sucre|ur[eé]e|creat|ionog|calc|phosph|magnes|acide urique|uric|protid|albumin|epp|fer|ferrit|martial/i },
  { id: 'lipides', label: 'Lipides & Cardiaque', icon: '🫀', pattern: /cholest|hdl|ldl|triglyc|cpk|tropo|bnp|ldh|apolip/i },
  { id: 'hepatique', label: 'Hépatique & Pancréatique', icon: '🧪', pattern: /asat|alat|transam|gamma|ggt|phosphatase|bilirub|lipase|amylas/i },
  { id: 'infectieux', label: 'Infectieux, Urines & Bactério', icon: '🦠', pattern: /ecbu|urines|culot|copro|selle|parasit|strep|crp|vs|vitesse|pylori|chlam|leish|goutte/i },
  { id: 'serologie', label: 'Sérologies & Virologie', icon: '🧬', pattern: /hepati|hiv|sida|covid|pcr|serolog|vdrl|tpha|varicelle/i },
  { id: 'hormones', label: 'Hormones & Vitamines', icon: '🦋', pattern: /tsh|t3|t4|thyro|vitam|d3|b12|folate|cortis|acth|prolact|testost|oestrad|fsh|lh|hcg|bhcg|psa|insul/i }
];

const IMG_CATEGORIES = [
  { id: 'all', label: 'Tous les examens (A-Z)', icon: '📋' },
  { id: 'custom', label: 'Mes examens ajoutés', icon: '⭐' },
  { id: 'radio', label: 'Radiographie Standard', icon: '🩻', pattern: /radiograph|radio|rachis|asp|thorax|bassin|genou|epaule|cheville|main|pied|poignet|blond|gril|incidence/i },
  { id: 'echo', label: 'Échographie & Doppler', icon: '🔊', pattern: /echo|doppler|ultras/i },
  { id: 'tdm', label: 'Scanner (TDM)', icon: '📡', pattern: /scanner|tdm|angioscan/i },
  { id: 'irm', label: 'IRM (Résonance Magnétique)', icon: '🧲', pattern: /irm|reson/i },
  { id: 'seno', label: 'Sénologie & Densitométrie', icon: '🎗️', pattern: /mammo|osteo|densit/i }
];

export default function ExamPrescriptionModal({
  isOpen = false,
  onClose = () => {},
  initialType = 'biologie', // 'biologie' | 'imagerie'
  patient = null,
  consultation = null,
  onPrescriptionSaved = null,
  onOpenLayoutEditor = null
}) {
  const [activeType, setActiveType] = useState(initialType);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedExamsMap, setSelectedExamsMap] = useState(new Map()); // name -> instruction
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [indication, setIndication] = useState('');
  const [notes, setNotes] = useState('');
  const [newExamInput, setNewExamInput] = useState('');
  const [paperFormat, setPaperFormat] = useState(() => getPrescriptionSettings().pageSize || 'A5');
  const [customBioList, setCustomBioList] = useState([]);
  const [customImgList, setCustomImgList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Charger les examens personnalisés depuis localStorage
  useEffect(() => {
    try {
      const bioRaw = localStorage.getItem('docpocket_custom_bio_exams');
      if (bioRaw) setCustomBioList(JSON.parse(bioRaw));
      const imgRaw = localStorage.getItem('docpocket_custom_img_exams');
      if (imgRaw) setCustomImgList(JSON.parse(imgRaw));
    } catch (e) {
      console.warn("Erreur lecture examens personnalisés:", e);
    }
  }, []);

  // Synchronisation lors de l'ouverture
  useEffect(() => {
    if (isOpen) {
      setActiveType(initialType || 'biologie');
      setDate(new Date().toISOString().split('T')[0]);
      setIndication(consultation?.diagnostic || consultation?.motif || '');
      setNotes(initialType === 'biologie' ? 'À jeun le matin du prélèvement.' : '');
      setSelectedExamsMap(new Map());
      setSearchQuery('');
      setSelectedCategory('all');
      setNewExamInput('');
      setSavedSuccess(false);
      setShowPrintPreview(false);
      const s = getPrescriptionSettings();
      setPaperFormat(s.pageSize || 'A5');
    }
  }, [isOpen, initialType, consultation]);

  const isBio = activeType === 'biologie';
  const themeColor = isBio ? '#059669' : '#0284c7';
  const themeBg = isBio ? 'rgba(5, 150, 105, 0.15)' : 'rgba(2, 132, 199, 0.15)';
  const themeBorder = isBio ? 'rgba(5, 150, 105, 0.35)' : 'rgba(2, 132, 199, 0.35)';

  // Fusionner la base d'origine et les examens personnalisés du médecin
  const allAvailableExams = useMemo(() => {
    const base = isBio ? BASE_BIO_EXAMS : BASE_IMG_EXAMS;
    const custom = isBio ? customBioList : customImgList;
    const set = new Set([...custom, ...base]);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }, [isBio, customBioList, customImgList]);

  // Filtrage selon catégorie et recherche
  const filteredExams = useMemo(() => {
    let list = allAvailableExams;
    const categories = isBio ? BIO_CATEGORIES : IMG_CATEGORIES;
    const currentCatObj = categories.find(c => c.id === selectedCategory);

    if (selectedCategory === 'custom') {
      const customSet = new Set(isBio ? customBioList : customImgList);
      list = list.filter(ex => customSet.has(ex));
    } else if (currentCatObj && currentCatObj.pattern) {
      list = list.filter(ex => currentCatObj.pattern.test(ex));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      list = list.filter(ex => ex.toUpperCase().includes(q));
    }

    return list;
  }, [allAvailableExams, selectedCategory, searchQuery, isBio, customBioList, customImgList]);

  // Ajouter un nouvel examen personnalisé au catalogue
  const handleAddNewExam = (e) => {
    e?.preventDefault();
    if (!newExamInput.trim()) return;
    const clean = newExamInput.trim().toUpperCase();

    if (isBio) {
      if (!customBioList.includes(clean)) {
        const updated = [clean, ...customBioList];
        setCustomBioList(updated);
        localStorage.setItem('docpocket_custom_bio_exams', JSON.stringify(updated));
      }
    } else {
      if (!customImgList.includes(clean)) {
        const updated = [clean, ...customImgList];
        setCustomImgList(updated);
        localStorage.setItem('docpocket_custom_img_exams', JSON.stringify(updated));
      }
    }

    // Cocher automatiquement le nouvel examen
    toggleExam(clean);
    setNewExamInput('');
  };

  // Supprimer un examen personnalisé
  const handleDeleteCustomExam = (examName, e) => {
    e?.stopPropagation();
    if (!window.confirm(`Supprimer « ${examName} » de vos examens personnalisés ?`)) return;
    if (isBio) {
      const updated = customBioList.filter(x => x !== examName);
      setCustomBioList(updated);
      localStorage.setItem('docpocket_custom_bio_exams', JSON.stringify(updated));
    } else {
      const updated = customImgList.filter(x => x !== examName);
      setCustomImgList(updated);
      localStorage.setItem('docpocket_custom_img_exams', JSON.stringify(updated));
    }
    // Décocher si présent
    if (selectedExamsMap.has(examName)) {
      setSelectedExamsMap(prev => {
        const next = new Map(prev);
        next.delete(examName);
        return next;
      });
    }
  };

  // Cocher / Décocher un examen
  const toggleExam = (examName) => {
    setSelectedExamsMap(prev => {
      const next = new Map(prev);
      if (next.has(examName)) {
        next.delete(examName);
      } else {
        next.set(examName, isBio ? 'À jeun' : '');
      }
      return next;
    });
  };

  // Mettre à jour la consigne/précision d'un examen coché
  const updateInstruction = (examName, instruction) => {
    setSelectedExamsMap(prev => {
      const next = new Map(prev);
      next.set(examName, instruction);
      return next;
    });
  };

  // Cocher tout un profil rapide en 1 clic
  const handleApplyProfile = (profile) => {
    setSelectedExamsMap(prev => {
      const next = new Map(prev);
      profile.exams.forEach(ex => {
        if (!next.has(ex)) {
          next.set(ex, '');
        }
      });
      return next;
    });
  };

  // Tout décocher
  const handleUncheckAll = () => {
    setSelectedExamsMap(new Map());
  };

  // Changement de format papier (A5 ou A4) avec sauvegarde permanente
  const handleChangePaperFormat = (fmt) => {
    setPaperFormat(fmt);
    savePrescriptionSettings({ pageSize: fmt });
    localStorage.setItem('docpocket_active_print_paper_size', fmt);
  };

  // Construction de l'objet prescription
  const buildPrescriptionObject = () => {
    const items = Array.from(selectedExamsMap.entries()).map(([nom, posologie]) => ({
      nom,
      posologie: posologie || (isBio ? 'Laboratoire d\'analyses médicales' : 'Centre d\'imagerie médicale'),
      forme: isBio ? 'Bilan Bio' : 'Imagerie'
    }));

    return {
      patientId: patient ? patient.id : null,
      consultationId: consultation ? consultation.id : null,
      type: isBio ? 'biologie' : 'imagerie',
      printFormat: isBio ? 'biologie' : 'imagerie',
      date: date || new Date().toISOString().split('T')[0],
      indication: indication.trim(),
      notes: notes.trim(),
      items
    };
  };

  // Enregistrement dans IndexedDB
  const handleSave = async () => {
    if (selectedExamsMap.size === 0) {
      alert("Veuillez cocher au moins une analyse ou un examen médical.");
      return;
    }
    try {
      setSaving(true);
      const prescObj = buildPrescriptionObject();
      const id = await savePrescription(prescObj);
      setSavedSuccess(true);
      if (onPrescriptionSaved) {
        onPrescriptionSaved({ ...prescObj, id });
      }
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      alert("Erreur lors de l'enregistrement : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const quickProfiles = isBio ? BIO_QUICK_PROFILES : IMG_QUICK_PROFILES;
  const categories = isBio ? BIO_CATEGORIES : IMG_CATEGORIES;
  const selectedCount = selectedExamsMap.size;
  const prescObjForPreview = buildPrescriptionObject();

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          style={{
            background: '#0f172a',
            border: `1.5px solid ${themeBorder}`,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '1220px',
            height: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: `0 24px 50px rgba(0, 0, 0, 0.7), 0 0 35px ${themeBg}`,
            color: '#f8fafc',
            overflow: 'hidden'
          }}
        >
          {/* En-tête Supérieur */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.6rem' }}>{isBio ? '🧪' : '🩻'}</span>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{isBio ? 'Prescription de Bilan Biologique' : 'Prescription d\'Imagerie Médicale & Radiologie'}</span>
                  <span style={{
                    fontSize: '0.78rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: selectedCount > 0 ? themeBg : 'rgba(255,255,255,0.06)',
                    color: selectedCount > 0 ? (isBio ? '#34d399' : '#38bdf8') : '#94a3b8',
                    border: `1px solid ${selectedCount > 0 ? themeBorder : 'rgba(255,255,255,0.1)'}`,
                    fontWeight: 700
                  }}>
                    {selectedCount} coché{selectedCount > 1 ? 's' : ''}
                  </span>
                </h2>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                  {patient ? (
                    <>
                      Patient : <strong style={{ color: '#38bdf8' }}>{patient.prenom} {patient.nom}</strong>
                      {patient.age && ` • ${patient.age} ans`}
                      {patient.cin && ` • CIN: ${patient.cin}`}
                    </>
                  ) : (
                    'Sélectionnez et cochez les examens demandés'
                  )}
                </div>
              </div>
            </div>

            {/* Bascule Type d'Examen (Biologie / Imagerie) & Format Papier */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Bascule Bio / Imagerie */}
              <div style={{ display: 'flex', background: '#1e293b', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveType('biologie');
                    setSelectedCategory('all');
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: isBio ? '#059669' : 'transparent',
                    color: isBio ? '#fff' : '#94a3b8',
                    fontWeight: isBio ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>🧪</span> Analyses Biologiques
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveType('imagerie');
                    setSelectedCategory('all');
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: !isBio ? '#0284c7' : 'transparent',
                    color: !isBio ? '#fff' : '#94a3b8',
                    fontWeight: !isBio ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>🩻</span> Imagerie & Radiologie
                </button>
              </div>

              {/* Format Papier A5 / A4 (Persistant) */}
              <div style={{ display: 'flex', background: '#1e293b', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <button
                  type="button"
                  onClick={() => handleChangePaperFormat('A5')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: paperFormat === 'A5' ? '#0284c7' : 'transparent',
                    color: paperFormat === 'A5' ? '#fff' : '#94a3b8',
                    fontWeight: paperFormat === 'A5' ? 700 : 500,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                  title="Format A5 (148 x 210 mm) - Sauvegarde automatique"
                >
                  📑 A5
                </button>
                <button
                  type="button"
                  onClick={() => handleChangePaperFormat('A4')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: paperFormat === 'A4' ? '#0284c7' : 'transparent',
                    color: paperFormat === 'A4' ? '#fff' : '#94a3b8',
                    fontWeight: paperFormat === 'A4' ? 700 : 500,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                  title="Format A4 (210 x 297 mm) - Sauvegarde automatique"
                >
                  📄 A4
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '1.1rem'
                }}
                title="Fermer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Corps en 2 Colonnes (Menu à gauche, Ordonnance à droite) */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            
            {/* COLONNE GAUCHE : Menu avec cases à cocher, recherche et ajout */}
            <div style={{ flex: '1 1 65%', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255, 255, 255, 0.08)', background: '#0b1120' }}>
              
              {/* Barre de Recherche Rapide & Ajout de Nouvel Examen */}
              <div style={{ padding: '12px 16px', background: '#0f172a', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 300px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>🔍</span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={isBio ? "Rechercher parmi les analyses (ex: NFS, Glycémie, TSH, Urée...)" : "Rechercher un examen (ex: Thorax, Écho abdominale, Scanner...)"}
                      style={{
                        width: '100%',
                        padding: '9px 12px 9px 36px',
                        borderRadius: '8px',
                        border: '1px solid #334155',
                        background: '#1e293b',
                        color: '#fff',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Saisie & Ajout d'un nouvel examen personnalisé */}
                  <form onSubmit={handleAddNewExam} style={{ display: 'flex', gap: '6px', flex: '1 1 240px' }}>
                    <input
                      type="text"
                      value={newExamInput}
                      onChange={(e) => setNewExamInput(e.target.value)}
                      placeholder="+ Ajouter un nouvel examen..."
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px dashed #475569',
                        background: '#0f172a',
                        color: '#cbd5e1',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!newExamInput.trim()}
                      style={{
                        padding: '9px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: newExamInput.trim() ? themeColor : '#334155',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        cursor: newExamInput.trim() ? 'pointer' : 'default',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Ajouter
                    </button>
                  </form>
                </div>

                {/* Filtres par Catégories */}
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                  {categories.map(cat => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: isSelected ? `1px solid ${themeColor}` : '1px solid rgba(255, 255, 255, 0.08)',
                          background: isSelected ? themeBg : '#1e293b',
                          color: isSelected ? '#fff' : '#94a3b8',
                          fontSize: '0.78rem',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Raccourcis Profils Types en 1 Clic */}
              <div style={{ padding: '8px 16px', background: '#0b1120', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>⚡ Profils usuels :</span>
                {quickProfiles.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyProfile(p)}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '16px',
                      background: 'rgba(30, 41, 59, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#cbd5e1',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = themeColor;
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.color = '#cbd5e1';
                    }}
                  >
                    <span>{p.icon}</span>
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>

              {/* Liste de TOUTES les analyses / examens avec CASES À COCHER */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    Affichage de <strong style={{ color: '#fff' }}>{filteredExams.length}</strong> examen(s) — Cochez les cases souhaitées :
                  </div>
                  {selectedCount > 0 && (
                    <button
                      type="button"
                      onClick={handleUncheckAll}
                      style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.76rem', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Tout décocher
                    </button>
                  )}
                </div>

                {filteredExams.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                    Aucun examen ne correspond à votre recherche. Vous pouvez l'ajouter directement via le champ ci-dessus.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '6px' }}>
                    {filteredExams.map((examName) => {
                      const isChecked = selectedExamsMap.has(examName);
                      const isCustom = isBio ? customBioList.includes(examName) : customImgList.includes(examName);

                      return (
                        <div
                          key={examName}
                          onClick={() => toggleExam(examName)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: isChecked ? themeBg : '#1e293b',
                            border: isChecked ? `1.5px solid ${themeColor}` : '1px solid rgba(255, 255, 255, 0.06)',
                            cursor: 'pointer',
                            userSelect: 'none',
                            transition: 'all 0.1s ease'
                          }}
                        >
                          {/* Case à cocher native et stylée */}
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // géré par le clic sur le conteneur
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: 'pointer',
                              accentColor: themeColor
                            }}
                          />

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '0.86rem',
                              fontWeight: isChecked ? 700 : 500,
                              color: isChecked ? '#fff' : '#e2e8f0',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {examName}
                            </div>
                          </div>

                          {isCustom && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                                Perso
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteCustomExam(examName, e)}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
                                title="Supprimer cet examen personnalisé"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* COLONNE DROITE : Ordonnance / Demande d'examen en cours de rédaction */}
            <div style={{ flex: '1 1 35%', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
              
              {/* En-tête de la demande */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📋</span> Demande en cours ({selectedCount})
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Date :</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid #334155',
                      background: '#0f172a',
                      color: '#fff',
                      fontSize: '0.78rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Liste des examens cochés */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedCount === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📝</div>
                    Aucun examen sélectionné.<br />
                    Cochez les analyses ou examens souhaités dans le menu de gauche.
                  </div>
                ) : (
                  Array.from(selectedExamsMap.entries()).map(([examName, instruction], idx) => (
                    <div
                      key={examName}
                      style={{
                        background: '#1e293b',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, color: themeColor, fontSize: '0.82rem' }}>{idx + 1}.</span>
                          <strong style={{ fontSize: '0.85rem', color: '#fff' }}>{examName}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExam(examName)}
                          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem' }}
                          title="Décocher cet examen"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Consigne optionnelle pour cet examen */}
                      <input
                        type="text"
                        value={instruction}
                        onChange={(e) => updateInstruction(examName, e.target.value)}
                        placeholder={isBio ? "Consigne (ex: À jeun 12h, 2ème fraction)..." : "Précision (ex: Face et profil, bilatéral)..."}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid #334155',
                          background: '#0f172a',
                          color: '#cbd5e1',
                          fontSize: '0.78rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                  ))
                )}
              </div>

              {/* Renseignements cliniques & Consignes globales */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', background: '#1e293b', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600, marginBottom: '3px' }}>
                    🎯 Renseignements cliniques / Diagnostic :
                  </label>
                  <input
                    type="text"
                    value={indication}
                    onChange={(e) => setIndication(e.target.value)}
                    placeholder="Ex: Diabète de type 2, HTA, Douleur lombaire..."
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #334155',
                      background: '#0f172a',
                      color: '#fff',
                      fontSize: '0.82rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600, marginBottom: '3px' }}>
                    📝 Consigne générale imprimée :
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isBio ? "Ex: À jeun. Résultats à communiquer au médecin traitant." : "Ex: En urgence. Communiquer les clichés."}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #334155',
                      background: '#0f172a',
                      color: '#fff',
                      fontSize: '0.82rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {savedSuccess && (
                  <div style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.2)', border: '1px solid #22c55e', color: '#4ade80', fontSize: '0.8rem', textAlign: 'center' }}>
                    ✓ Enregistré dans le dossier patient !
                  </div>
                )}
              </div>

              {/* Boutons d'Action : Aperçu, Imprimer, Enregistrer */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', background: '#0f172a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Bouton APERÇU AVANT IMPRESSION */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (selectedCount === 0) {
                        alert("Veuillez cocher au moins une analyse ou un examen.");
                        return;
                      }
                      try {
                        const prescObj = buildPrescriptionObject();
                        const id = await savePrescription(prescObj);
                        if (onPrescriptionSaved) {
                          onPrescriptionSaved({ ...prescObj, id });
                        }
                      } catch (e) {
                        console.warn("Sauvegarde préalable avant aperçu:", e);
                      }
                      setShowPrintPreview(true);
                    }}
                    disabled={selectedCount === 0}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #38bdf8',
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
                      opacity: selectedCount === 0 ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    title="Voir l'aperçu exact de la feuille A5/A4 avant d'imprimer"
                  >
                    <span>👁️</span> Aperçu avant impression
                  </button>

                  {/* Bouton IMPRESSION DIRECTE AVEC SAUVEGARDE AUTOMATIQUE */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (selectedCount === 0) {
                        alert("Veuillez cocher au moins une analyse ou un examen.");
                        return;
                      }
                      try {
                        setSaving(true);
                        const prescObj = buildPrescriptionObject();
                        // Enregistrement automatique immédiat dans le dossier du patient
                        const id = await savePrescription(prescObj);
                        setSavedSuccess(true);
                        if (onPrescriptionSaved) {
                          onPrescriptionSaved({ ...prescObj, id });
                        }
                        // Lancement de l'impression physique
                        generatePrescriptionReport(patient || { nom: 'Patient', prenom: '' }, { ...prescObj, id });
                      } catch (err) {
                        console.warn("Erreur sauvegarde auto avant impression:", err);
                        generatePrescriptionReport(patient || { nom: 'Patient', prenom: '' }, buildPrescriptionObject());
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving || selectedCount === 0}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: (saving || selectedCount === 0) ? 'not-allowed' : 'pointer',
                      opacity: (saving || selectedCount === 0) ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>🖨️</span> {saving ? 'Enregistrement...' : 'Imprimer'}
                  </button>
                </div>

                {/* Bouton ENREGISTRER DANS LE DOSSIER */}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || selectedCount === 0}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: isBio 
                      ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' 
                      : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: (saving || selectedCount === 0) ? 'not-allowed' : 'pointer',
                    opacity: (saving || selectedCount === 0) ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <span>💾</span> {saving ? 'Enregistrement...' : 'Enregistrer dans le dossier patient'}
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Modale d'Aperçu avant impression dédiée */}
      {showPrintPreview && (
        <PrintPreviewModal
          isOpen={showPrintPreview}
          onClose={() => setShowPrintPreview(false)}
          title={isBio ? "Demande d'Analyses Biologiques" : "Demande d'Imagerie Médicale"}
          patient={patient || { nom: 'Patient', prenom: '' }}
          prescription={prescObjForPreview}
          onOpenLayoutEditor={onOpenLayoutEditor}
        />
      )}
    </>
  );
}
