import React, { useState, useEffect } from 'react';
import { 
  getAllPatients, 
  getAllConsultations, 
  saveConsultation, 
  updateWaitingStatus,
  checkConsultationHasInvoice,
  setUnsettledConsultation
} from '../services/patientStorage';
import { generateConsultationReport } from '../services/reportGenerator';
import DeleteConsultationModal from './DeleteConsultationModal';

export default function ConsultationView({ 
  initialPatient = null, 
  waitingEntry = null, 
  consultationToEdit = null, 
  onOpenPrescription = null,
  onOpenBilling = null,
  onOpenAppointment = null,
  onPatientChange = null,
  onRequirePayment = null,
  onFinished 
}) {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatient ? String(initialPatient.id) : '');
  const [selectedPatient, setSelectedPatient] = useState(initialPatient || null);
  const [consultationsHistory, setConsultationsHistory] = useState([]);
  const [searchPatient, setSearchPatient] = useState('');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  // État pour la suppression sécurisée d'une consultation par code PIN
  const [consultationToDelete, setConsultationToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleRequestDeleteConsultation = (consult) => {
    setConsultationToDelete(consult);
    setIsDeleteModalOpen(true);
  };

  const handleConsultationDeleted = (deletedId) => {
    setConsultationsHistory(prev => prev.filter(c => c.id !== deletedId));
    if (formData.id === deletedId) {
      setFormData({
        id: null,
        patientId: selectedPatient ? String(selectedPatient.id) : '',
        patientName: selectedPatient ? `${selectedPatient.nom} ${selectedPatient.prenom}` : '',
        date: new Date().toISOString().split('T')[0],
        heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        motif: 'Consultation générale',
        taMax: '',
        taMin: '',
        poids: '',
        taille: '',
        bmi: '',
        pouls: '',
        temperature: '',
        spo2: '',
        examGeneral: '',
        examRespiratoire: '',
        examHemodynamique: '',
        examNeurologique: '',
        examAbdominal: '',
        examMusculosquelettique: '',
        examReste: '',
        examenClinique: '',
        diagnostic: '',
        isApci: false,
        reposJours: 0,
        reposDebut: ''
      });
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Formulaire d'examen clinique & constantes
  const [formData, setFormData] = useState({
    id: consultationToEdit ? consultationToEdit.id : null,
    patientId: initialPatient ? String(initialPatient.id) : (consultationToEdit ? String(consultationToEdit.patientId) : ''),
    patientName: initialPatient ? `${initialPatient.nom} ${initialPatient.prenom}` : (consultationToEdit ? consultationToEdit.patientName : ''),
    date: consultationToEdit ? consultationToEdit.date : new Date().toISOString().split('T')[0],
    heure: consultationToEdit ? consultationToEdit.heure : new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    motif: consultationToEdit ? consultationToEdit.motif : (waitingEntry ? waitingEntry.motif : 'Consultation générale'),
    // Constantes biométriques
    taMax: consultationToEdit?.taMax || '',
    taMin: consultationToEdit?.taMin || '',
    poids: consultationToEdit?.poids || '',
    taille: consultationToEdit?.taille || '',
    bmi: consultationToEdit?.bmi || '',
    pouls: consultationToEdit?.pouls || '',
    temperature: consultationToEdit?.temperature || '',
    spo2: consultationToEdit?.spo2 || '',
    // Rubriques d'examen clinique structuré
    examGeneral: consultationToEdit?.examGeneral || '',
    examRespiratoire: consultationToEdit?.examRespiratoire || '',
    examHemodynamique: consultationToEdit?.examHemodynamique || '',
    examNeurologique: consultationToEdit?.examNeurologique || '',
    examAbdominal: consultationToEdit?.examAbdominal || '',
    examMusculosquelettique: consultationToEdit?.examMusculosquelettique || '',
    examReste: consultationToEdit?.examReste || '',
    // Ancien champ rétrocompatible
    examenClinique: consultationToEdit?.examenClinique || '',
    diagnostic: consultationToEdit?.diagnostic || '',
    isApci: consultationToEdit?.isApci || false,
    // Arrêt de travail / repos
    reposJours: consultationToEdit?.reposJours || 0,
    reposDebut: consultationToEdit?.reposDebut || ''
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialPatient) {
      setSelectedPatientId(String(initialPatient.id));
      setSelectedPatient(initialPatient);
      if (onPatientChange) onPatientChange(initialPatient);
    }
  }, [initialPatient]);

  useEffect(() => {
    loadPatientsAndHistory();
  }, [selectedPatientId]);

  const loadPatientsAndHistory = async () => {
    try {
      const allP = await getAllPatients();
      setPatients(allP);

      if (selectedPatientId) {
        const found = allP.find(p => String(p.id) === String(selectedPatientId));
        setSelectedPatient(found || null);
        if (found && onPatientChange) {
          onPatientChange(found);
        }
        if (found && !consultationToEdit) {
          setFormData(prev => ({
            ...prev,
            patientId: String(found.id),
            patientName: `${found.nom} ${found.prenom}`,
            isApci: Boolean(found.apci)
          }));
        }

        const allC = await getAllConsultations();
        const patientConsults = allC.filter(c => String(c.patientId) === String(selectedPatientId));
        setConsultationsHistory(patientConsults);
      } else {
        setSelectedPatient(null);
        setConsultationsHistory([]);
      }
    } catch (err) {
      console.error('Erreur chargement données consultation:', err);
    }
  };

  // Calcul dynamique de l'IMC (Indice de Masse Corporelle)
  const calculateBMI = (poidsKg, tailleCm) => {
    if (!poidsKg || !tailleCm) return '';
    const p = parseFloat(poidsKg);
    const t = parseFloat(tailleCm) / 100;
    if (isNaN(p) || isNaN(t) || t <= 0) return '';
    const bmiVal = (p / (t * t)).toFixed(1);
    return bmiVal;
  };

  const handlePoidsChange = (val) => {
    const newBmi = calculateBMI(val, formData.taille);
    setFormData(prev => ({ ...prev, poids: val, bmi: newBmi }));
  };

  const handleTailleChange = (val) => {
    const newBmi = calculateBMI(formData.poids, val);
    setFormData(prev => ({ ...prev, taille: val, bmi: newBmi }));
  };

  const getBmiInterpretation = (bmi) => {
    const num = parseFloat(bmi);
    if (isNaN(num) || num <= 0) return null;
    if (num < 18.5) return { label: 'Insuffisance pondérale', color: '#38bdf8' };
    if (num < 25) return { label: 'Poids normal', color: '#4ade80' };
    if (num < 30) return { label: 'Surpoids', color: '#facc15' };
    return { label: 'Obésité', color: '#f87171' };
  };

  const bmiInfo = getBmiInterpretation(formData.bmi);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.patientId) {
      alert('Veuillez sélectionner un patient avant de valider la consultation.');
      return;
    }

    try {
      setSaving(true);
      const consultId = await saveConsultation(formData);
      const savedConsult = { ...formData, id: consultId || formData.id };

      // Si la consultation provenait de la salle d'attente, marquer automatiquement comme terminée
      if (waitingEntry && waitingEntry.id) {
        await updateWaitingStatus(waitingEntry.id, 'finished');
      }

      // Vérifier si cette consultation a déjà un règlement enregistré
      const hasInvoice = await checkConsultationHasInvoice(savedConsult.id);

      if (!hasInvoice) {
        const pat = selectedPatient || { id: formData.patientId, nom: formData.patientName };
        const unsettled = {
          consultationId: savedConsult.id,
          patientId: pat.id,
          patientName: pat.fullname || (pat.nom ? `${pat.nom} ${pat.prenom || ''}` : formData.patientName),
          patientCin: pat.cin || '',
          patientCnamId: pat.cnamid || '',
          patientCaisse: pat.caisse || 'CNSS',
          filiere: pat.filiere || 'Privée',
          isApci: Boolean(pat.apci && pat.apci !== 'AUCUNE'),
          date: savedConsult.date,
          heure: savedConsult.heure,
          motif: savedConsult.motif
        };
        setUnsettledConsultation(unsettled);

        if (onRequirePayment) {
          onRequirePayment(unsettled);
        } else if (onFinished) {
          onFinished();
        }
      } else {
        alert("✓ Consultation médicale enregistrée avec succès dans le dossier du patient !");
        if (onFinished) {
          onFinished();
        } else {
          // Réinitialiser les champs d'examen pour une prochaine consultation
          setFormData(prev => ({
            ...prev,
            taMax: '',
            taMin: '',
            poids: '',
            taille: '',
            bmi: '',
            pouls: '',
            temperature: '',
            spo2: '',
            examenClinique: '',
            diagnostic: '',
            reposJours: 0,
            reposDebut: ''
          }));
          await loadPatientsAndHistory();
        }
      }
    } catch (err) {
      alert("Erreur lors de l'enregistrement : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Rédiger l'ordonnance rattachée à cette consultation avec sauvegarde préalable automatique
  const handleOpenPrescriptionWithSave = async () => {
    if (!selectedPatient) {
      alert("Veuillez sélectionner un patient avant de rédiger l'ordonnance.");
      return;
    }
    try {
      setSaving(true);
      const saved = await saveConsultation(formData);
      const consultData = { ...formData, id: saved?.id || formData.id || Date.now() };
      setFormData(consultData);
      if (onOpenPrescription) {
        onOpenPrescription(selectedPatient, consultData);
      }
    } catch (e) {
      console.warn("Sauvegarde préalable consultation:", e);
      if (onOpenPrescription) {
        onOpenPrescription(selectedPatient, formData);
      }
    } finally {
      setSaving(false);
    }
  };

  // Établir la quittance / facture rattachée à cette consultation avec sauvegarde préalable automatique
  const handleOpenBillingWithSave = async () => {
    if (!selectedPatient) {
      alert("Veuillez sélectionner un patient avant d'établir la quittance.");
      return;
    }
    try {
      setSaving(true);
      const saved = await saveConsultation(formData);
      const consultData = { ...formData, id: saved?.id || formData.id || Date.now() };
      setFormData(consultData);
      if (onOpenBilling) {
        onOpenBilling(selectedPatient, consultData);
      }
    } catch (e) {
      console.warn("Sauvegarde préalable consultation:", e);
      if (onOpenBilling) {
        onOpenBilling(selectedPatient, formData);
      }
    } finally {
      setSaving(false);
    }
  };

  // Planifier un rendez-vous rattaché à cette consultation avec sauvegarde préalable automatique
  const handleOpenAppointmentWithSave = async () => {
    if (!selectedPatient) {
      alert("Veuillez sélectionner un patient avant de créer un rendez-vous.");
      return;
    }
    try {
      setSaving(true);
      const saved = await saveConsultation(formData);
      const consultData = { ...formData, id: saved?.id || formData.id || Date.now() };
      setFormData(consultData);
      if (onOpenAppointment) {
        onOpenAppointment(selectedPatient, consultData);
      }
    } catch (e) {
      console.warn("Sauvegarde préalable consultation:", e);
      if (onOpenAppointment) {
        onOpenAppointment(selectedPatient, formData);
      }
    } finally {
      setSaving(false);
    }
  };

  const filteredPatients = patients.filter(p =>
    p.nom.toLowerCase().includes(searchPatient.toLowerCase()) ||
    p.prenom.toLowerCase().includes(searchPatient.toLowerCase()) ||
    (p.telephone && p.telephone.includes(searchPatient))
  );

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* En-tête Consultation Adaptatif */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        background: '#1e293b',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', color: '#f8fafc', fontWeight: 600 }}>
              🩺 Examen Clinique & Consultation
            </h1>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Saisie des constantes biométriques, diagnostic et observations médicales
            </span>
          </div>
        </div>

        {/* Sélecteur de patient sans menu déroulant avec recherche rapide */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {selectedPatient ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1.5px solid #38bdf8',
              padding: '6px 12px',
              borderRadius: '8px'
            }}>
              <span style={{ fontSize: '1rem' }}>👤</span>
              <div>
                <strong style={{ color: '#fff', fontSize: '0.9rem' }}>
                  {selectedPatient.nom} {selectedPatient.prenom}
                </strong>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '8px' }}>
                  {selectedPatient.cin ? `CIN: ${selectedPatient.cin}` : (selectedPatient.telephone || '')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedPatientId('');
                  setSelectedPatient(null);
                  setSearchPatient('');
                }}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  padding: '3px 8px',
                  borderRadius: '5px',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
                title="Changer de patient"
              >
                ✕ Changer
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative', width: isMobile ? '100%' : '300px' }}>
              <input
                type="text"
                placeholder="🔍 Rechercher patient (nom, CIN...)"
                value={searchPatient}
                onChange={(e) => setSearchPatient(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#0f172a',
                  border: '1px solid #38bdf8',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.85rem'
                }}
              />
              {searchPatient.trim() && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: '#1e293b',
                  border: '1px solid #38bdf8',
                  borderRadius: '8px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  zIndex: 50,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                }}>
                  {patients
                    .filter(p => {
                      const q = searchPatient.trim().toLowerCase();
                      return (p.nom && p.nom.toLowerCase().includes(q)) ||
                             (p.prenom && p.prenom.toLowerCase().includes(q)) ||
                             (p.cin && p.cin.includes(q)) ||
                             (p.telephone && p.telephone.includes(q));
                    })
                    .slice(0, 8)
                    .map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedPatientId(String(p.id));
                          setSelectedPatient(p);
                          setSearchPatient('');
                          if (onPatientChange) onPatientChange(p);
                        }}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{p.nom} {p.prenom}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.cin ? `CIN: ${p.cin}` : (p.telephone || '')}</span>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!selectedPatient ? (
        <div style={{
          padding: '60px',
          textAlign: 'center',
          background: '#0f172a',
          borderRadius: '12px',
          border: '1px dashed rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>👥</div>
          <h3 style={{ color: '#f8fafc', margin: '0 0 6px 0' }}>Aucun patient sélectionné</h3>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>
            Veuillez sélectionner un patient ci-dessus ou depuis la Salle d'Attente pour débuter l'examen clinique.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Bandeau d'identité du patient & Rappels d'antécédents adaptatif */}
          <div style={{
            background: 'linear-gradient(90deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '14px',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                  {(selectedPatient.civility && !/mari|celib|veuf|divorc/i.test(selectedPatient.civility))
                    ? selectedPatient.civility
                    : (selectedPatient.gender === 'F' ? ((selectedPatient.etat_civil === 'Célibataire' || /celib/i.test(selectedPatient.civility || '')) ? 'Mlle' : 'Mme') : 'M.')
                  } {selectedPatient.nom} {selectedPatient.prenom}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '2px 8px', borderRadius: '4px' }}>
                  Fiche N° {selectedPatient.numfch || '-'}
                </span>
                {selectedPatient.apci && (
                  <span style={{ fontSize: '0.8rem', color: '#facc15', background: 'rgba(234, 179, 8, 0.15)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    APCI {selectedPatient.apci}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
                {selectedPatient.gender === 'F' ? 'Femme' : 'Homme'} • 💍 {selectedPatient.etat_civil || (/mari/i.test(selectedPatient.civility || '') ? 'Marié(e)' : 'Célibataire')} • Né(e) le {selectedPatient.birthdate || 'Inconnue'} • Tél : {selectedPatient.telephone || '-'} • Caisse : {selectedPatient.caisse || 'Sans caisse'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              {/* Alerte Allergie */}
              {selectedPatient.allergies && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#fca5a5',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}>
                  ⚠️ Allergie : {selectedPatient.allergies}
                </div>
              )}

              {/* Bouton Résumé PDF rapide */}
              <button
                type="button"
                onClick={() => generateConsultationReport(selectedPatient, formData)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)'
                }}
                title="Générer, imprimer ou sauvegarder le document médical A4"
              >
                📄 Résumé PDF
              </button>

              {/* Bouton vers Ordonnance Avicenna */}
              {onOpenPrescription && (
                <button
                  type="button"
                  onClick={() => onOpenPrescription(selectedPatient, formData)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
                  }}
                  title="Rédiger une ordonnance pour ce patient (Base Avicenna)"
                >
                  💊 Rédiger Ordonnance
                </button>
              )}

              {/* Bouton Créer un RDV */}
              {onOpenAppointment && (
                <button
                  type="button"
                  onClick={handleOpenAppointmentWithSave}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
                  }}
                  title="Planifier un rendez-vous pour ce patient"
                >
                  📅 Créer un RDV
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Colonne Gauche : Constantes & Examen */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Cadre Constantes Biométriques */}
              <div style={{
                background: '#0f172a',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '20px'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#38bdf8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
                  📊 Constantes Biométriques & Signes Vitaux
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '14px' }}>
                  {/* TA Systolique */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      TA Max (Syst.)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Ex: 12"
                        value={formData.taMax}
                        onChange={(e) => setFormData({ ...formData, taMax: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
                      />
                      <span style={{ position: 'absolute', right: '8px', top: '8px', fontSize: '0.75rem', color: '#64748b' }}>cmHg</span>
                    </div>
                  </div>

                  {/* TA Diastolique */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      TA Min (Diast.)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Ex: 8"
                        value={formData.taMin}
                        onChange={(e) => setFormData({ ...formData, taMin: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
                      />
                      <span style={{ position: 'absolute', right: '8px', top: '8px', fontSize: '0.75rem', color: '#64748b' }}>cmHg</span>
                    </div>
                  </div>

                  {/* Pouls */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      Pouls / FC
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        placeholder="Ex: 75"
                        value={formData.pouls}
                        onChange={(e) => setFormData({ ...formData, pouls: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
                      />
                      <span style={{ position: 'absolute', right: '8px', top: '8px', fontSize: '0.75rem', color: '#64748b' }}>bpm</span>
                    </div>
                  </div>

                  {/* Température */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      Température
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Ex: 37.2"
                        value={formData.temperature}
                        onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
                      />
                      <span style={{ position: 'absolute', right: '8px', top: '8px', fontSize: '0.75rem', color: '#64748b' }}>°C</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '14px', marginTop: '14px' }}>
                  {/* Poids */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      Poids
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Ex: 70"
                        value={formData.poids}
                        onChange={(e) => handlePoidsChange(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
                      />
                      <span style={{ position: 'absolute', right: '8px', top: '8px', fontSize: '0.75rem', color: '#64748b' }}>kg</span>
                    </div>
                  </div>

                  {/* Taille */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      Taille
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        placeholder="Ex: 175"
                        value={formData.taille}
                        onChange={(e) => handleTailleChange(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
                      />
                      <span style={{ position: 'absolute', right: '8px', top: '8px', fontSize: '0.75rem', color: '#64748b' }}>cm</span>
                    </div>
                  </div>

                  {/* Calcul IMC */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      IMC Calculé
                    </label>
                    <div style={{
                      padding: '8px 10px',
                      background: '#1e293b',
                      borderRadius: '6px',
                      border: '1px solid #334155',
                      fontWeight: 700,
                      color: bmiInfo ? bmiInfo.color : '#cbd5e1',
                      fontSize: '0.9rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>{formData.bmi || '-'}</span>
                      {bmiInfo && (
                        <span style={{ fontSize: '0.7rem', color: bmiInfo.color }}>
                          {bmiInfo.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* SpO2 */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      Saturation SaO2
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        placeholder="Ex: 98"
                        value={formData.spo2}
                        onChange={(e) => setFormData({ ...formData, spo2: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
                      />
                      <span style={{ position: 'absolute', right: '8px', top: '8px', fontSize: '0.75rem', color: '#64748b' }}>%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Motif, Examen Clinique & Diagnostic */}
              <div style={{
                background: '#0f172a',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Motif de la Consultation
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.motif}
                    onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
                    placeholder="Ex: Contrôle trimestriel, Céphalées, Douleurs abdominales..."
                    style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                  />
                </div>

                {/* RUBRIQUES D'EXAMEN PHYSIQUE & OBSERVATIONS */}
                <div style={{
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: '10px',
                  padding: '16px',
                  background: 'rgba(30, 41, 59, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#38bdf8', fontWeight: 600 }}>
                    🩺 Examen Physique Structuré par Appareil
                  </h4>

                  {/* 1. Plan Général */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      • Sur le plan général :
                    </label>
                    <input
                      type="text"
                      placeholder="État général, pâleur, coloration des conjonctives, déshydratation, pli cutané..."
                      value={formData.examGeneral}
                      onChange={(e) => setFormData({ ...formData, examGeneral: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* 2. Plan Respiratoire */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      • Sur le plan respiratoire :
                    </label>
                    <input
                      type="text"
                      placeholder="Murmure vésiculaire, râles crépitants/sibilants, polypnée, tirage, toux..."
                      value={formData.examRespiratoire}
                      onChange={(e) => setFormData({ ...formData, examRespiratoire: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* 3. Plan Hémodynamique */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      • Sur le plan hémodynamique :
                    </label>
                    <input
                      type="text"
                      placeholder="Bruits du cœur réguliers, souffle, œdèmes des membres inférieurs, pouls périphériques..."
                      value={formData.examHemodynamique}
                      onChange={(e) => setFormData({ ...formData, examHemodynamique: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* 4. Plan Neurologique */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      • Sur le plan neurologique :
                    </label>
                    <input
                      type="text"
                      placeholder="Conscience, réflexes ostéo-tendineux, tonus, sensibilité, force motrice..."
                      value={formData.examNeurologique}
                      onChange={(e) => setFormData({ ...formData, examNeurologique: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* 5. Plan Abdominal */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      • Sur le plan abdominal :
                    </label>
                    <input
                      type="text"
                      placeholder="Abdomen souple, dépressible, indolore, hépatomégalie, splénomégalie, transit..."
                      value={formData.examAbdominal}
                      onChange={(e) => setFormData({ ...formData, examAbdominal: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* 6. Plan Musculo-squelettique */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      • Sur le plan musculo-squelettique :
                    </label>
                    <input
                      type="text"
                      placeholder="Mobilité articulaire, rachis, déformations, raideurs, contractures musculaires..."
                      value={formData.examMusculosquelettique}
                      onChange={(e) => setFormData({ ...formData, examMusculosquelettique: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* 7. Reste de l'examen physique */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      • Reste de l'examen physique :
                    </label>
                    <textarea
                      rows="2"
                      placeholder="Examen ORL, tympans, gorge, aires ganglionnaires, peau, thyroïde, etc."
                      value={formData.examReste}
                      onChange={(e) => setFormData({ ...formData, examReste: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem', resize: 'vertical' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#38bdf8', marginBottom: '6px', fontWeight: 600 }}>
                    Diagnostic Médical / Conclusion Clinique
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.diagnostic}
                    onChange={(e) => setFormData({ ...formData, diagnostic: e.target.value })}
                    placeholder="Ex: HTA essentielle équilibrée, Angine bactérienne, Diabète type 2..."
                    style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #38bdf8', borderRadius: '8px', color: '#fff', fontWeight: 500 }}
                  />
                </div>

                {/* MODULES CLINIQUES DIRECTEMENT RATTACHÉS À LA CONSULTATION EN COURS */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  padding: '16px 18px',
                  borderRadius: '10px',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  marginTop: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <strong style={{ color: '#38bdf8', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>📋</span> Prescription & Quittance rattachées à cette consultation
                    </strong>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {formData.diagnostic ? (
                        <span>Diagnostic actif : <strong style={{ color: '#fff' }}>{formData.diagnostic}</strong></span>
                      ) : (
                        <span>Saisissez le diagnostic pour pré-remplir l'ordonnance</span>
                      )}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                    {/* Carte Ordonnance */}
                    <div style={{
                      background: '#1e293b',
                      padding: '14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(2, 132, 199, 0.35)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '10px'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#38bdf8', fontSize: '0.92rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>💊</span> Ordonnance Médicale (Base Avicenna)
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>
                          Délivrez le traitement adapté au diagnostic en cours avec posologie, DCI et APCI.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenPrescriptionWithSave}
                        disabled={saving}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '6px',
                          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          border: 'none',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
                        }}
                      >
                        <span>💊</span> Rédiger l'Ordonnance
                      </button>
                    </div>

                    {/* Carte Quittance & Facture */}
                    <div style={{
                      background: '#1e293b',
                      padding: '14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(124, 58, 237, 0.35)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '10px'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#c084fc', fontSize: '0.92rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>💳</span> Quittance d'Honoraires & Facture (CNAM)
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>
                          Enregistrez le règlement de la consultation, la part CNAM et imprimez la quittance.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenBillingWithSave}
                        disabled={saving}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '6px',
                          background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                          border: 'none',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)'
                        }}
                      >
                        <span>💳</span> Établir la Quittance
                      </button>
                    </div>
                  </div>
                </div>

                {/* Arrêt de travail / Repos */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px', marginTop: '6px', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      Arrêt de travail (Jours de repos)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.reposJours}
                      onChange={(e) => setFormData({ ...formData, reposJours: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      Date de début du repos
                    </label>
                    <input
                      type="date"
                      value={formData.reposDebut}
                      onChange={(e) => setFormData({ ...formData, reposDebut: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: isMobile ? 'stretch' : 'flex-end', alignItems: 'center', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {onOpenPrescription && (
                    <button
                      type="button"
                      onClick={handleOpenPrescriptionWithSave}
                      disabled={saving}
                      style={{
                        flex: isMobile ? '1 1 100%' : 'none',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
                      }}
                      title="Rédiger une ordonnance pour ce patient (Base Avicenna)"
                    >
                      💊 Rédiger Ordonnance
                    </button>
                  )}

                  {onOpenBilling && (
                    <button
                      type="button"
                      onClick={handleOpenBillingWithSave}
                      disabled={saving}
                      style={{
                        flex: isMobile ? '1 1 100%' : 'none',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)'
                      }}
                      title="Établir les honoraires ou la quittance CNAM pour cette consultation"
                    >
                      💳 Facturer / Quittance
                    </button>
                  )}

                  {onOpenAppointment && (
                    <button
                      type="button"
                      onClick={handleOpenAppointmentWithSave}
                      disabled={saving}
                      style={{
                        flex: isMobile ? '1 1 100%' : 'none',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
                      }}
                      title="Planifier un rendez-vous pour ce patient"
                    >
                      📅 Créer un RDV
                    </button>
                  )}

                  {formData.id && (
                    <button
                      type="button"
                      onClick={() => handleRequestDeleteConsultation(formData)}
                      style={{
                        flex: isMobile ? '1 1 100%' : 'none',
                        padding: '12px 18px',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                      title="Supprimer définitivement cette consultation avec confirmation par code PIN"
                    >
                      🗑️ Supprimer
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => generateConsultationReport(selectedPatient, formData)}
                    style={{
                      flex: isMobile ? '1 1 100%' : 'none',
                      padding: '12px 22px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)'
                    }}
                    title="Imprimer, télécharger en PDF ou envoyer par email"
                  >
                    📄 Résumé de la Consultation (PDF)
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      flex: isMobile ? '1 1 100%' : 'none',
                      padding: '12px 28px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      border: 'none',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)'
                    }}
                  >
                    {saving ? 'Enregistrement en cours...' : '💾 Valider la Consultation'}
                  </button>
                </div>
              </div>
            </div>

            {/* Colonne Droite : Historique des Consultations Antérieures */}
            <div style={{
              background: '#0f172a',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '680px'
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#38bdf8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
                📜 Historique des Consultations ({consultationsHistory.length})
              </h3>

              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {consultationsHistory.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    Aucune consultation antérieure enregistrée pour ce patient.
                  </div>
                ) : (
                  consultationsHistory.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setFormData({
                        id: c.id,
                        patientId: String(c.patientId),
                        patientName: c.patientName,
                        date: c.date,
                        heure: c.heure || '',
                        motif: c.motif || '',
                        taMax: c.taMax || '',
                        taMin: c.taMin || '',
                        poids: c.poids || '',
                        taille: c.taille || '',
                        bmi: c.bmi || '',
                        pouls: c.pouls || '',
                        temperature: c.temperature || '',
                        spo2: c.spo2 || '',
                        examGeneral: c.examGeneral || '',
                        examRespiratoire: c.examRespiratoire || '',
                        examHemodynamique: c.examHemodynamique || '',
                        examNeurologique: c.examNeurologique || '',
                        examAbdominal: c.examAbdominal || '',
                        examMusculosquelettique: c.examMusculosquelettique || '',
                        examReste: c.examReste || '',
                        examenClinique: c.examenClinique || '',
                        diagnostic: c.diagnostic || '',
                        isApci: c.isApci || false,
                        reposJours: c.reposJours || 0,
                        reposDebut: c.reposDebut || ''
                      })}
                      style={{
                        padding: '14px',
                        borderRadius: '8px',
                        background: formData.id === c.id ? 'rgba(56, 189, 248, 0.15)' : '#1e293b',
                        borderLeft: `4px solid ${formData.id === c.id ? '#38bdf8' : '#64748b'}`,
                        border: formData.id === c.id ? '1px solid #38bdf8' : 'none',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      title="Cliquer pour charger et réviser cette consultation"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#cbd5e1', marginBottom: '6px' }}>
                        <strong style={{ color: '#38bdf8' }}>📅 {c.date} ({c.heure || ''})</strong>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              generateConsultationReport(selectedPatient, c);
                            }}
                            style={{ 
                              fontSize: '0.75rem', 
                              color: '#34d399', 
                              background: 'rgba(52, 211, 153, 0.1)', 
                              padding: '2px 6px', 
                              borderRadius: '4px',
                              border: '1px solid rgba(52, 211, 153, 0.3)',
                              cursor: 'pointer' 
                            }}
                            title="Générer / Imprimer le rapport PDF"
                          >
                            📄 PDF
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#38bdf8', textDecoration: 'underline' }}>📂 Ouvrir</span>
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRequestDeleteConsultation(c);
                            }}
                            style={{ 
                              fontSize: '0.75rem', 
                              color: '#f87171', 
                              background: 'rgba(239, 68, 68, 0.12)', 
                              padding: '2px 7px', 
                              borderRadius: '4px', 
                              border: '1px solid rgba(239, 68, 68, 0.3)', 
                              cursor: 'pointer' 
                            }}
                            title="Supprimer définitivement cette consultation"
                          >
                            🗑️
                          </span>
                        </div>
                      </div>

                      {/* Constantes de la visite */}
                      <div style={{ display: 'flex', gap: '10px', fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 8px 0' }}>
                        {c.taMax && <span>TA: <strong style={{ color: '#fff' }}>{c.taMax}/{c.taMin}</strong></span>}
                        {c.poids && <span>Poids: <strong style={{ color: '#fff' }}>{c.poids} kg</strong></span>}
                        {c.temperature && <span>T°: <strong style={{ color: '#fff' }}>{c.temperature}°C</strong></span>}
                        {c.pouls && <span>FC: <strong style={{ color: '#fff' }}>{c.pouls} bpm</strong></span>}
                      </div>

                      <div style={{ color: '#f8fafc', fontWeight: 600 }}>
                        Diagnostic : {c.diagnostic}
                      </div>

                      {c.examenClinique && (
                        <p style={{ margin: '4px 0 0 0', color: '#cbd5e1', whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
                          {c.examenClinique}
                        </p>
                      )}

                      {c.reposJours > 0 && (
                        <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#facc15' }}>
                          🛌 Repos prescrit : {c.reposJours} jours (Début: {c.reposDebut || c.date})
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Modal de confirmation de suppression sécurisée par code PIN */}
      <DeleteConsultationModal
        isOpen={isDeleteModalOpen}
        consultation={consultationToDelete}
        patient={selectedPatient}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setConsultationToDelete(null);
        }}
        onDeleted={handleConsultationDeleted}
      />
    </div>
  );
}
