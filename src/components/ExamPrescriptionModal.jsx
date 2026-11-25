import React, { useState, useEffect, useMemo } from 'react';
import { searchBioExams, searchImgExams } from '../services/medocsService';
import { savePrescription } from '../services/patientStorage';
import { generatePrescriptionReport } from '../services/prescriptionReportGenerator';

// Profils standards pour bilans biologiques usuels
const BIO_PROFILES = [
  {
    name: 'Standard / Routine',
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
    name: 'Bilan Diabète',
    icon: '🍬',
    exams: ['GLYCÉMIE À JEUN', 'HÉMOGLOBINE GLYCOSYLÉE', 'MICROALBUMINURIE', 'CRÉATININÉMIE']
  },
  {
    name: 'Thyroïde & Métabolisme',
    icon: '🦋',
    exams: ['TSH', 'FT4 L', 'VITAMINE D', 'FERRITINEMIE']
  },
  {
    name: 'Bilan Hémostase / Pré-op',
    icon: '🩺',
    exams: ['NFS', 'TP', 'TCK', 'INR', 'GS']
  }
];

// Profils standards pour examens radiologiques et imagerie usuels
const IMG_PROFILES = [
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

export default function ExamPrescriptionModal({
  isOpen = false,
  onClose = () => {},
  initialType = 'biologie', // 'biologie' | 'imagerie'
  patient = null,
  consultation = null,
  onPrescriptionSaved = null
}) {
  const [activeType, setActiveType] = useState(initialType);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [indication, setIndication] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedExams, setSelectedExams] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [customExamInput, setCustomExamInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Synchronisation lors de l'ouverture
  useEffect(() => {
    if (isOpen) {
      setActiveType(initialType || 'biologie');
      setDate(new Date().toISOString().split('T')[0]);
      setIndication(consultation?.diagnostic || consultation?.motif || '');
      setNotes(activeType === 'biologie' ? 'À jeun le matin du prélèvement.' : '');
      setSelectedExams([]);
      setSearchQuery('');
      setCustomExamInput('');
      setSavedSuccess(false);
    }
  }, [isOpen, initialType, consultation]);

  // Suggestions filtrées en direct selon la recherche
  const searchResults = useMemo(() => {
    if (activeType === 'biologie') {
      return searchBioExams(searchQuery, 12);
    } else {
      return searchImgExams(searchQuery, 12);
    }
  }, [activeType, searchQuery]);

  if (!isOpen) return null;

  const isBio = activeType === 'biologie';
  const profiles = isBio ? BIO_PROFILES : IMG_PROFILES;
  const themeColor = isBio ? '#059669' : '#0284c7';
  const themeBg = isBio ? 'rgba(5, 150, 105, 0.15)' : 'rgba(2, 132, 199, 0.15)';
  const themeBorder = isBio ? 'rgba(5, 150, 105, 0.4)' : 'rgba(2, 132, 199, 0.4)';

  const handleAddExam = (examName, instruction = '') => {
    if (!examName || !examName.trim()) return;
    const clean = examName.trim();
    if (selectedExams.some(e => e.nom.toUpperCase() === clean.toUpperCase())) {
      return; // déjà dans la liste
    }
    setSelectedExams(prev => [...prev, { nom: clean, posologie: instruction }]);
  };

  const handleRemoveExam = (index) => {
    setSelectedExams(prev => prev.filter((_, i) => i !== index));
  };

  const handleApplyProfile = (profile) => {
    const newItems = [...selectedExams];
    profile.exams.forEach(ex => {
      if (!newItems.some(item => item.nom.toUpperCase() === ex.toUpperCase())) {
        newItems.push({ nom: ex, posologie: '' });
      }
    });
    setSelectedExams(newItems);
  };

  const handleAddCustomExam = (e) => {
    e?.preventDefault();
    if (!customExamInput.trim()) return;
    handleAddExam(customExamInput.trim());
    setCustomExamInput('');
  };

  // Préparation de l'objet prescription
  const buildPrescriptionObject = () => {
    return {
      patientId: patient ? patient.id : null,
      consultationId: consultation ? consultation.id : null,
      type: isBio ? 'biologie' : 'imagerie',
      printFormat: isBio ? 'biologie' : 'imagerie',
      date: date || new Date().toISOString().split('T')[0],
      indication: indication.trim(),
      notes: notes.trim(),
      items: selectedExams.map(ex => ({
        nom: ex.nom,
        posologie: ex.posologie || (isBio ? 'Analyse au laboratoire' : 'Examen radiologique'),
        forme: isBio ? 'Bilan Bio' : 'Imagerie'
      }))
    };
  };

  // Enregistrement dans IndexedDB
  const handleSave = async () => {
    if (selectedExams.length === 0) {
      alert("Veuillez sélectionner au moins un examen à prescrire.");
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

  // Aperçu & Impression officielle
  const handlePrint = async () => {
    if (selectedExams.length === 0) {
      alert("Veuillez sélectionner au moins un examen à imprimer.");
      return;
    }
    const prescObj = buildPrescriptionObject();
    try {
      // Sauvegarde automatique en tâche de fond pour traçabilité
      savePrescription(prescObj).catch(() => {});
      generatePrescriptionReport(patient || { nom: 'Patient', prenom: '' }, prescObj);
    } catch (err) {
      alert("Erreur lors de la génération de l'impression : " + err.message);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
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
          maxWidth: '850px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: `0 20px 45px rgba(0, 0, 0, 0.6), 0 0 30px ${themeBg}`,
          color: '#f8fafc',
          overflow: 'hidden'
        }}
      >
        {/* En-tête Modale */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.6rem' }}>{isBio ? '🧪' : '🩻'}</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                {isBio ? 'Prescription de Bilan Biologique & Analyses' : 'Prescription d\'Imagerie Médicale & Radiologie'}
              </h2>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>
                {patient ? (
                  <>
                    Patient : <strong style={{ color: '#38bdf8' }}>{patient.prenom} {patient.nom}</strong>
                    {patient.cin && ` • CIN: ${patient.cin}`}
                    {patient.age && ` • ${patient.age} ans`}
                  </>
                ) : (
                  'Demande d\'examen médical'
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Bascule Rapide Biologie / Imagerie */}
            <div style={{ display: 'flex', background: '#1e293b', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button
                type="button"
                onClick={() => setActiveType('biologie')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: isBio ? '#059669' : 'transparent',
                  color: isBio ? '#fff' : '#94a3b8',
                  fontWeight: isBio ? 700 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>🧪</span> Bio
              </button>
              <button
                type="button"
                onClick={() => setActiveType('imagerie')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: !isBio ? '#0284c7' : 'transparent',
                  color: !isBio ? '#fff' : '#94a3b8',
                  fontWeight: !isBio ? 700 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>🩻</span> Imagerie
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

        {/* Corps de la modale avec défilement */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Section Profils Rapides */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚡</span> Profils Types Fréquents (Ajout en 1 Clic) :
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {profiles.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyProfile(p)}
                  title={`Ajouter : ${p.exams.join(', ')}`}
                  style={{
                    background: '#1e293b',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#e2e8f0',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = themeColor;
                    e.currentTarget.style.background = themeBg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.background = '#1e293b';
                  }}
                >
                  <span>{p.icon}</span>
                  <span>{p.name}</span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({p.exams.length})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recherche dans le Catalogue Officiel & Saisie Libre */}
          <div style={{ background: '#1e293b', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 280px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
                  🔍 Rechercher dans le catalogue {isBio ? 'biologique' : 'radiologique'} :
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isBio ? "Ex: NFS, Glycémie, Créat, TSH, Ionogramme..." : "Ex: Thorax, Écho abdominale, Scanner, IRM..."}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#fff',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ flex: '1 1 260px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
                  ✍️ Ou ajouter un examen personnalisé :
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={customExamInput}
                    onChange={(e) => setCustomExamInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCustomExam(e);
                    }}
                    placeholder="Saisie libre..."
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid #334155',
                      background: '#0f172a',
                      color: '#fff',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomExam}
                    style={{
                      padding: '9px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      background: themeColor,
                      color: '#fff',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    + Ajouter
                  </button>
                </div>
              </div>
            </div>

            {/* Nuage de suggestions issues de la recherche */}
            {searchQuery.trim().length > 0 && searchResults.length > 0 && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Résultats trouvés ({searchResults.length}) — Cliquez pour ajouter :
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                  {searchResults.map((ex, idx) => {
                    const isAlreadySelected = selectedExams.some(item => item.nom.toUpperCase() === ex.toUpperCase());
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAddExam(ex)}
                        disabled={isAlreadySelected}
                        style={{
                          background: isAlreadySelected ? 'rgba(255, 255, 255, 0.05)' : 'rgba(56, 189, 248, 0.12)',
                          border: isAlreadySelected ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(56, 189, 248, 0.3)',
                          color: isAlreadySelected ? '#64748b' : '#38bdf8',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          cursor: isAlreadySelected ? 'default' : 'pointer',
                          fontWeight: 500
                        }}
                      >
                        {isAlreadySelected ? '✓ ' : '+ '} {ex}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Liste des Examens Sélectionnés pour l'Ordonnance */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📋</span> Examens Prescrits ({selectedExams.length}) :
              </div>
              {selectedExams.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedExams([])}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#f87171',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Tout effacer
                </button>
              )}
            </div>

            {selectedExams.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', background: '#1e293b', borderRadius: '10px', border: '1px dashed #334155', color: '#94a3b8', fontSize: '0.85rem' }}>
                Aucun examen sélectionné pour le moment. Cliquez sur un profil type ci-dessus ou effectuez une recherche pour commencer la prescription.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {selectedExams.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: '#1e293b',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <span style={{ fontWeight: 700, color: themeColor, fontSize: '0.85rem', minWidth: '22px' }}>
                      {idx + 1}.
                    </span>
                    <strong style={{ flex: '1 1 240px', color: '#fff', fontSize: '0.9rem' }}>
                      {item.nom}
                    </strong>
                    <input
                      type="text"
                      value={item.posologie || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedExams(prev => prev.map((it, i) => i === idx ? { ...it, posologie: val } : it));
                      }}
                      placeholder="Précision ou consigne..."
                      style={{
                        flex: '1 1 180px',
                        padding: '5px 8px',
                        borderRadius: '4px',
                        border: '1px solid #334155',
                        background: '#0f172a',
                        color: '#cbd5e1',
                        fontSize: '0.8rem',
                        outline: 'none'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveExam(idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}
                      title="Retirer cet examen"
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Renseignements Cliniques & Notes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
                🎯 Renseignements cliniques / Diagnostic (facultatif) :
              </label>
              <input
                type="text"
                value={indication}
                onChange={(e) => setIndication(e.target.value)}
                placeholder="Ex: Diabète de type 2, HTA, Douleur fosse iliaque..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
                📝 Recommandations & Consignes particulières :
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isBio ? "Ex: À jeun depuis 12 heures." : "Ex: En urgence, apporter les anciens clichés..."}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Message de succès temporaire */}
          {savedSuccess && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.2)', border: '1px solid #22c55e', color: '#4ade80', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>✅</span> Ordonnance enregistrée avec succès dans le dossier patient !
            </div>
          )}
        </div>

        {/* Pied de Modale & Boutons d'Action */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
            background: '#0f172a'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Date :</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #334155',
                background: '#1e293b',
                color: '#fff',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #334155',
                background: 'transparent',
                color: '#94a3b8',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={selectedExams.length === 0}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: selectedExams.length === 0 ? 'not-allowed' : 'pointer',
                opacity: selectedExams.length === 0 ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 10px rgba(2, 132, 199, 0.35)'
              }}
            >
              <span>🖨️</span> Imprimer Demande
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || selectedExams.length === 0}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                background: isBio 
                  ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' 
                  : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: (saving || selectedExams.length === 0) ? 'not-allowed' : 'pointer',
                opacity: (saving || selectedExams.length === 0) ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: isBio 
                  ? '0 2px 10px rgba(5, 150, 105, 0.4)' 
                  : '0 2px 10px rgba(37, 99, 235, 0.4)'
              }}
            >
              <span>💾</span> {saving ? 'Enregistrement...' : 'Enregistrer dans le dossier'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
