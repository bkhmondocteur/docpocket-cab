import React, { useState, useEffect } from 'react';
import { 
  getAllPatients, 
  getAllPrescriptions, 
  getPrescriptionsByPatient, 
  savePrescription, 
  deletePrescriptionById 
} from '../services/patientStorage';
import { 
  searchMedicaments, 
  filterMedicaments,
  getAllFormes,
  checkPrescriptionInteractions, 
  getMedocsStats 
} from '../services/medocsService';
import { generatePrescriptionReport } from '../services/prescriptionReportGenerator';
import { getPrescriptionSettings } from '../services/prescriptionSettingsService';
import { APCI_LIST } from '../constants/medicalConstants';

export default function PrescriptionView({
  initialPatient = null,
  initialConsultation = null,
  onFinished = null
}) {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatient ? String(initialPatient.id) : '');
  const [selectedPatient, setSelectedPatient] = useState(initialPatient || null);
  const [searchPatient, setSearchPatient] = useState('');
  const [patientPrescriptions, setPatientPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Configuration de l'ordonnance
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [indication, setIndication] = useState(initialConsultation?.diagnostic || '');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  // Format d'impression sélectionné : 'normale' | 'cnam_mo' | 'cnam_apci'
  const [printFormat, setPrintFormat] = useState(() => getPrescriptionSettings().defaultFormat || 'normale');

  // Champs spécifiques CNAM : Numéro de carnet et choix de l'APCI par le médecin
  const [numCarnet, setNumCarnet] = useState(initialPatient?.cnamid || '');
  const [selectedApci, setSelectedApci] = useState(initialPatient?.apci || (APCI_LIST[0]?.code || '001'));

  // MODE 1 : Saisie libre avec suggestions rapides (Nom commercial OU DCI)
  const [searchBy, setSearchBy] = useState('commercial'); // 'commercial' | 'dci'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // MODE 2 : Grand Explorateur de la Base Médicamenteuse Médocs
  const [showMedocsModal, setShowMedocsModal] = useState(false);
  const [explorerSearch, setExplorerSearch] = useState('');
  const [explorerSearchBy, setExplorerSearchBy] = useState('all');
  const [explorerForme, setExplorerForme] = useState('');
  const [explorerApciOnly, setExplorerApciOnly] = useState(false);
  const [explorerPage, setExplorerPage] = useState(1);
  const [selectedMedsMap, setSelectedMedsMap] = useState(new Map());

  // Alertes d'interactions médicamenteuses
  const [interactions, setInteractions] = useState([]);

  // Formes galéniques pour le filtre de l'explorateur
  const allFormes = getAllFormes();
  const stats = getMedocsStats();

  // Initialisation patients
  useEffect(() => {
    loadPatients();
  }, []);

  // Synchronisation dynamique si un patient est transmis depuis Consultation ou Dossier
  useEffect(() => {
    if (initialPatient) {
      setSelectedPatient(initialPatient);
      setSelectedPatientId(String(initialPatient.id));
      setNumCarnet(initialPatient.cnamid || '');
      setSelectedApci(initialPatient.apci || (APCI_LIST[0]?.code || '001'));
      loadPatientHistory(initialPatient.id);
      if (initialPatient.apci) {
        setPrintFormat('cnam_apci');
      } else if (initialPatient.cnamid) {
        setPrintFormat('cnam_mo');
      } else {
        setPrintFormat('normale');
      }
    }
  }, [initialPatient]);

  useEffect(() => {
    if (initialConsultation?.diagnostic) {
      setIndication(initialConsultation.diagnostic);
    }
  }, [initialConsultation]);

  // Détection du patient
  useEffect(() => {
    if (selectedPatientId) {
      const found = patients.find(p => String(p.id) === String(selectedPatientId));
      setSelectedPatient(found || null);
      if (found) {
        setNumCarnet(found.cnamid || '');
        setSelectedApci(found.apci || (APCI_LIST[0]?.code || '001'));
        if (found.apci) {
          setPrintFormat('cnam_apci');
        } else if (found.cnamid) {
          setPrintFormat('cnam_mo');
        } else {
          setPrintFormat('normale');
        }
      }
      loadPatientHistory(selectedPatientId);
    } else {
      setSelectedPatient(null);
      setPatientPrescriptions([]);
    }
  }, [selectedPatientId, patients]);

  // Mode 1 : Recherche instantanée dès la saisie
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const results = searchMedicaments(searchQuery, searchBy, false, 25);
    setSearchResults(results);
  }, [searchQuery, searchBy]);

  // Analyse en temps réel des interactions médicamenteuses Médocs
  useEffect(() => {
    const warns = checkPrescriptionInteractions(items);
    setInteractions(warns);
  }, [items]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const list = await getAllPatients();
      setPatients(list);
      if (initialPatient) {
        setSelectedPatient(initialPatient);
        setSelectedPatientId(String(initialPatient.id));
      }
    } catch (err) {
      console.error("Erreur chargement patients:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadPatientHistory = async (patId) => {
    try {
      const history = await getPrescriptionsByPatient(patId);
      setPatientPrescriptions(history);
    } catch (err) {
      console.error("Erreur historique ordonnances:", err);
    }
  };

  // Ajout depuis suggestion Mode 1
  const handleSelectSuggestion = (med) => {
    const newItem = {
      id: Date.now() + Math.random(),
      nom: med.nom,
      court: med.court || '',
      dci: med.dci || '',
      forme: med.forme || '',
      dosage: med.dosage || '',
      famille: med.famille || '',
      apci: Boolean(med.apci),
      posologie: med.poso || '1 prise x 3 / jour',
      duree: med.duree || '7 jours',
      quantite: '1 boîte',
      consigne: ''
    };

    setItems(prev => [...prev, newItem]);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };

  // Ajout direct de texte libre dans Mode 1 (appui sur Entrée ou bouton)
  const handleAddDirectFreeText = (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    const newItem = {
      id: Date.now() + Math.random(),
      nom: searchQuery.trim(),
      forme: 'Saisie Libre',
      dci: '',
      posologie: 'Selon prescription',
      duree: '7 jours',
      quantite: '1 boîte',
      consigne: ''
    };

    setItems(prev => [...prev, newItem]);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };

  // Mode 2 : Ouvrir l'explorateur
  const handleOpenExplorer = () => {
    setSelectedMedsMap(new Map());
    setExplorerSearch('');
    setExplorerPage(1);
    setShowMedocsModal(true);
  };

  // Mode 2 : Cocher / décocher un médicament un par un
  const handleToggleMedInExplorer = (med) => {
    setSelectedMedsMap(prev => {
      const updated = new Map(prev);
      if (updated.has(med.id)) {
        updated.delete(med.id);
      } else {
        updated.set(med.id, med);
      }
      return updated;
    });
  };

  // Mode 2 : Valider et insérer tous les médicaments cochés
  const handleConfirmExplorerSelection = () => {
    const selectedList = Array.from(selectedMedsMap.values());
    if (selectedList.length === 0) {
      setShowMedocsModal(false);
      return;
    }

    const newItems = selectedList.map(med => ({
      id: Date.now() + Math.random(),
      nom: med.nom,
      court: med.court || '',
      dci: med.dci || '',
      forme: med.forme || '',
      dosage: med.dosage || '',
      famille: med.famille || '',
      apci: Boolean(med.apci),
      posologie: med.poso || '1 prise x 3 / jour',
      duree: med.duree || '7 jours',
      quantite: '1 boîte',
      consigne: ''
    }));

    setItems(prev => [...prev, ...newItems]);
    setShowMedocsModal(false);
    setSelectedMedsMap(new Map());
  };

  // Mettre à jour une ligne de l'ordonnance
  const handleUpdateItem = (itemId, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Supprimer une ligne
  const handleRemoveItem = (itemId) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  // Renouveler une ordonnance passée
  const handleRenewPrescription = (pastPresc) => {
    if (!pastPresc || !pastPresc.items) return;
    setPrintFormat(pastPresc.printFormat || pastPresc.type || 'normale');
    if (pastPresc.numCarnet) setNumCarnet(pastPresc.numCarnet);
    if (pastPresc.selectedApci) setSelectedApci(pastPresc.selectedApci);
    setIndication(pastPresc.indication || '');
    setNotes(pastPresc.notes || '');

    const renewedItems = pastPresc.items.map(it => ({
      ...it,
      id: Date.now() + Math.random()
    }));
    setItems(renewedItems);
    alert(`✓ Ordonnance du ${pastPresc.date} chargée avec succès pour renouvellement.`);
  };

  // Obtenir le libellé complet de l'APCI choisie
  const getSelectedApciLabel = () => {
    const found = APCI_LIST.find(a => a.code === selectedApci);
    return found ? found.label : (selectedApci ? `APCI Code ${selectedApci}` : '');
  };

  // Enregistrer l'ordonnance
  const handleSave = async () => {
    if (!selectedPatient) {
      alert("Veuillez sélectionner un patient.");
      return;
    }
    if (items.length === 0) {
      alert("L'ordonnance ne contient aucun médicament.");
      return;
    }

    try {
      setSaving(true);
      const apciFullLabel = getSelectedApciLabel();

      const prescData = {
        patientId: selectedPatient.id,
        patientName: `${selectedPatient.nom} ${selectedPatient.prenom}`,
        consultationId: initialConsultation?.id || null,
        date: date,
        type: printFormat,
        printFormat: printFormat,
        numCarnet: numCarnet || selectedPatient.cnamid || '',
        selectedApci: selectedApci,
        apciLabel: apciFullLabel,
        indication: indication,
        notes: notes,
        items: items
      };

      const prescId = await savePrescription(prescData);
      prescData.id = prescId;

      await loadPatientHistory(selectedPatient.id);
      alert("✓ Ordonnance médicale enregistrée avec succès !");

      // Impression automatique avec le modèle choisi, N° Carnet et APCI
      generatePrescriptionReport(selectedPatient, prescData, printFormat);

      if (initialConsultation && onFinished) {
        if (window.confirm("✓ Ordonnance enregistrée avec succès ! Souhaitez-vous retourner à la consultation en cours ?")) {
          onFinished();
        }
      }
    } catch (err) {
      alert("Erreur lors de l'enregistrement : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Données filtrées pour l'explorateur Mode 2
  const explorerData = filterMedicaments({
    search: explorerSearch,
    searchBy: explorerSearchBy,
    forme: explorerForme,
    apciOnly: explorerApciOnly,
    page: explorerPage,
    pageSize: 30
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '16px 16px' }}>
      {/* En-tête du Module Adaptatif */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        background: '#0f172a',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem'
          }}>
            💊
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
              Prescriptions & Ordonnances Médicales
            </h1>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Base Médicamenteuse Médocs ({stats.totalMedicaments.toLocaleString()} médicaments • {stats.totalInteractions.toLocaleString()} règles d'interactions)
            </span>
          </div>
        </div>

        {/* Sélecteur de Patient sans menu déroulant avec recherche réactive */}
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
            <div style={{ position: 'relative', minWidth: '280px' }}>
              <input
                type="text"
                placeholder="🔍 Rechercher patient (nom, prénom, CIN...)"
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

      {/* BANNIÈRE RATTACHÉE À LA CONSULTATION EN COURS */}
      {initialConsultation && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.2) 0%, rgba(3, 105, 161, 0.2) 100%)',
          border: '1.5px solid #0284c7',
          padding: '12px 18px',
          borderRadius: '10px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          boxShadow: '0 4px 14px rgba(2, 132, 199, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.4rem' }}>🩺</span>
            <div>
              <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.92rem' }}>
                Ordonnance rattachée à la consultation du {initialConsultation.date || 'jour'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                Patient : <strong style={{ color: '#fff' }}>{selectedPatient ? `${selectedPatient.nom} ${selectedPatient.prenom}` : ''}</strong>
                {initialConsultation.diagnostic && (
                  <span> • Diagnostic : <strong style={{ color: '#34d399' }}>{initialConsultation.diagnostic}</strong></span>
                )}
              </div>
            </div>
          </div>
          {onFinished && (
            <button
              type="button"
              onClick={onFinished}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: '#0284c7',
                border: 'none',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)'
              }}
              title="Revenir à l'examen clinique de la consultation"
            >
              <span>⬅️</span> Revenir à la Consultation
            </button>
          )}
        </div>
      )}

      {!selectedPatient ? (
        <div style={{
          padding: '60px',
          textAlign: 'center',
          background: '#0f172a',
          borderRadius: '12px',
          border: '1px dashed rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>👤</div>
          <h3 style={{ color: '#f8fafc', margin: '0 0 6px 0' }}>Aucun patient sélectionné</h3>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>
            Veuillez sélectionner un patient ci-dessus ou depuis la fiche patient pour rédiger une ordonnance.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Colonne Principale : Rédaction de l'Ordonnance */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Bandeau Patient & Informations de Couverture */}
            <div style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '12px 18px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <strong style={{ fontSize: '1.05rem', color: '#38bdf8' }}>
                  {(selectedPatient.civility && !/mari|celib|veuf|divorc/i.test(selectedPatient.civility))
                    ? selectedPatient.civility
                    : (selectedPatient.gender === 'F' ? ((selectedPatient.etat_civil === 'Célibataire' || /celib/i.test(selectedPatient.civility || '')) ? 'Mlle' : 'Mme') : 'M.')
                  } {selectedPatient.nom} {selectedPatient.prenom}
                </strong>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                  {selectedPatient.gender === 'F' ? 'Femme' : 'Homme'} • 💍 {selectedPatient.etat_civil || (/mari/i.test(selectedPatient.civility || '') ? 'Marié(e)' : 'Célibataire')} • Né(e) le : {selectedPatient.birthdate || 'Inconnue'} • Caisse : <strong>{selectedPatient.caisse || 'Sans caisse'}</strong>
                  {selectedPatient.cnamid && ` • Identifiant CNAM : ${selectedPatient.cnamid}`}
                </div>
              </div>
              {selectedPatient.apci && (
                <div style={{
                  background: 'rgba(234, 179, 8, 0.15)',
                  border: '1px solid #eab308',
                  color: '#facc15',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}>
                  ★ APCI : {selectedPatient.apci}
                </div>
              )}
            </div>

            {/* ZONE DE SÉLECTION DU MODE DE PRESCRIPTION */}
            <div style={{
              background: '#0f172a',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '18px'
            }}>
              {/* Entête avec Bouton d'accès au Mode 2 (Grand Explorateur Médocs) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
                    Saisie Ordonnance :
                  </span>

                  {/* CASES À COCHER : NOM COMMERCIAL ou DCI (DEMANDE UTILISATEUR) */}
                  <label style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.85rem',
                    color: searchBy === 'commercial' ? '#38bdf8' : '#94a3b8',
                    fontWeight: searchBy === 'commercial' ? 700 : 500,
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="searchMode"
                      checked={searchBy === 'commercial'}
                      onChange={() => setSearchBy('commercial')}
                      style={{ cursor: 'pointer', accentColor: '#0284c7' }}
                    />
                    Nom commercial
                  </label>

                  <label style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.85rem',
                    color: searchBy === 'dci' ? '#38bdf8' : '#94a3b8',
                    fontWeight: searchBy === 'dci' ? 700 : 500,
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="searchMode"
                      checked={searchBy === 'dci'}
                      onChange={() => setSearchBy('dci')}
                      style={{ cursor: 'pointer', accentColor: '#0284c7' }}
                    />
                    DCI (Molécule)
                  </label>
                </div>

                {/* BOUTON MODE 2 : OUVRIR LA BASE DE DONNÉES MÉDICAMENTEUSE COMPLÈTE */}
                <button
                  type="button"
                  onClick={handleOpenExplorer}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35)'
                  }}
                  title="Ouvrir le dictionnaire complet Médocs et sélectionner les médicaments un par un"
                >
                  📚 Ouvrir la Base Médicamenteuse Médocs
                </button>
              </div>

              {/* MODE 1 : BARRE DE SAISIE LIBRE AVEC SUGGESTIONS RAPIDES */}
              <div style={{ position: 'relative' }}>
                <form onSubmit={handleAddDirectFreeText} style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        searchBy === 'commercial' 
                          ? 'Saisie libre / Tapez un nom commercial (ex: Clamoxyl, Stopalgic, Doliprane...)' 
                          : 'Saisie libre / Tapez une DCI (ex: Paracétamol, Amoxicilline, Oméprazole...)'
                      }
                      style={{
                        width: '100%',
                        padding: '12px 14px 12px 38px',
                        borderRadius: '8px',
                        background: '#1e293b',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        color: '#fff',
                        fontSize: '0.95rem'
                      }}
                    />
                    <span style={{ position: 'absolute', left: '12px', top: '12px', fontSize: '1rem', color: '#94a3b8' }}>
                      🔍
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={!searchQuery.trim()}
                    style={{
                      padding: '0 18px',
                      borderRadius: '8px',
                      background: searchQuery.trim() ? '#0284c7' : '#334155',
                      color: '#fff',
                      border: 'none',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: searchQuery.trim() ? 'pointer' : 'not-allowed',
                      whiteSpace: 'nowrap'
                    }}
                    title="Ajouter directement le texte saisi dans l'ordonnance (saisie libre)"
                  >
                    + Ajouter
                  </button>
                </form>

                {/* Suggestions déroulantes Médocs (Mode 1) */}
                {isSearching && searchResults.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: '#0f172a',
                    border: '1px solid #38bdf8',
                    borderRadius: '8px',
                    maxHeight: '320px',
                    overflowY: 'auto',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    marginTop: '4px'
                  }}>
                    {searchResults.map((med) => (
                      <div
                        key={med.id}
                        onClick={() => handleSelectSuggestion(med)}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>
                            {med.nom}
                          </span>
                          {med.apci && (
                            <span style={{ fontSize: '0.75rem', background: 'rgba(234, 179, 8, 0.2)', color: '#facc15', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              APCI
                            </span>
                          )}
                        </div>

                        {med.dci && (
                          <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '2px' }}>
                            DCI : <strong>{med.dci}</strong> {med.forme ? `• ${med.forme}` : ''}
                          </div>
                        )}

                        {med.poso && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '1px' }}>
                            Posologie recommandée : {med.poso}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ALERTE D'INTERACTION MÉDICAMENTEUSE EN TEMPS RÉEL (BASE MÉDOCS) */}
            {interactions.length > 0 && (
              <div style={{
                background: 'rgba(220, 38, 38, 0.12)',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                padding: '14px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 700 }}>
                  <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                  <span>Alerte d'Interaction Médicamenteuse (Base Médocs)</span>
                </div>
                {interactions.map((warn, index) => (
                  <div key={index} style={{ fontSize: '0.85rem', color: '#fecaca', borderTop: index > 0 ? '1px dashed rgba(239, 68, 68, 0.3)' : 'none', paddingTop: index > 0 ? '6px' : '0' }}>
                    <strong>{warn.medA}</strong> ⚡ <strong>{warn.medB}</strong>
                    <div style={{ color: '#cbd5e1', marginTop: '2px' }}>{warn.description}</div>
                    {warn.precautions && (
                      <div style={{ color: '#facc15', marginTop: '2px', fontWeight: 600 }}>
                        👉 Conduite à tenir : {warn.precautions}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* CONTENU DE L'ORDONNANCE (LIGNES PRESCRITES) */}
            <div style={{
              background: '#0f172a',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#38bdf8' }}>
                  📋 Lignes de Prescription ({items.length} produit{items.length > 1 ? 's' : ''})
                </h3>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setItems([])}
                    style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    Tout effacer
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  L'ordonnance est vide. Utilisez la saisie libre ci-dessus ou cliquez sur <strong>« Ouvrir la Base Médicamenteuse Médocs »</strong> pour ajouter des médicaments.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      style={{
                        background: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        padding: '14px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <strong style={{ color: '#f8fafc', fontSize: '0.95rem' }}>
                            {idx + 1}. {item.nom}
                          </strong>
                          {item.forme && <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: '6px' }}>({item.forme})</span>}
                          {item.dci && <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>DCI : {item.dci}</div>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                          title="Supprimer cette ligne"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Champs Posologie, Durée, Boîtes */}
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.8fr 1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Posologie</label>
                          <input
                            type="text"
                            value={item.posologie}
                            onChange={(e) => handleUpdateItem(item.id, 'posologie', e.target.value)}
                            placeholder="ex: 1 cp 3 fois par jour"
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              background: '#0f172a',
                              border: '1px solid #334155',
                              borderRadius: '4px',
                              color: '#fff',
                              fontSize: '0.85rem'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Durée</label>
                          <input
                            type="text"
                            value={item.duree}
                            onChange={(e) => handleUpdateItem(item.id, 'duree', e.target.value)}
                            placeholder="ex: 7 jours"
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              background: '#0f172a',
                              border: '1px solid #334155',
                              borderRadius: '4px',
                              color: '#fff',
                              fontSize: '0.85rem'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Quantité</label>
                          <input
                            type="text"
                            value={item.quantite}
                            onChange={(e) => handleUpdateItem(item.id, 'quantite', e.target.value)}
                            placeholder="ex: 1 boîte"
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              background: '#0f172a',
                              border: '1px solid #334155',
                              borderRadius: '4px',
                              color: '#fff',
                              fontSize: '0.85rem'
                            }}
                          />
                        </div>
                      </div>

                      {/* Consigne ou remarque spécifique */}
                      <div style={{ marginTop: '8px' }}>
                        <input
                          type="text"
                          value={item.consigne || ''}
                          onChange={(e) => handleUpdateItem(item.id, 'consigne', e.target.value)}
                          placeholder="Consigne spécifique (ex: au cours des repas, ne pas écraser...)"
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            background: '#0f172a',
                            border: '1px dashed #334155',
                            borderRadius: '4px',
                            color: '#cbd5e1',
                            fontSize: '0.8rem'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Remarques globales / Notes */}
              <div style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Recommandations / Conseils médicaux sur l'ordonnance :
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Conseils hygiéno-diététiques, hydratation, surveillance..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {/* CHOIX DU FORMAT D'IMPRESSION (DEMANDE UTILISATEUR : NORMALE, CNAM MO OU CNAM APCI) */}
              <div style={{
                marginTop: '20px',
                padding: '16px 20px',
                background: '#1e293b',
                borderRadius: '10px',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                      Type d'Ordonnance à l'Impression / PDF :
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                      Le modèle réglementaire et les mentions officielles seront appliqués sur le PDF
                    </span>
                  </div>

                  {/* 3 boutons de sélection de modèle */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
                    <button
                      type="button"
                      onClick={() => setPrintFormat('normale')}
                      style={{
                        flex: isMobile ? 1 : 'none',
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        background: printFormat === 'normale' ? '#0284c7' : '#0f172a',
                        color: printFormat === 'normale' ? '#fff' : '#94a3b8',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      📄 Normale
                    </button>

                    <button
                      type="button"
                      onClick={() => setPrintFormat('cnam_mo')}
                      style={{
                        flex: isMobile ? 1 : 'none',
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        background: printFormat === 'cnam_mo' ? '#059669' : '#0f172a',
                        color: printFormat === 'cnam_mo' ? '#fff' : '#94a3b8',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      🏛️ CNAM MO
                    </button>

                    <button
                      type="button"
                      onClick={() => setPrintFormat('cnam_apci')}
                      style={{
                        flex: isMobile ? 1 : 'none',
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        background: printFormat === 'cnam_apci' ? '#d97706' : '#0f172a',
                        color: printFormat === 'cnam_apci' ? '#fff' : '#94a3b8',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      ★ CNAM APCI
                    </button>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      fontSize: '0.75rem',
                      color: '#38bdf8',
                      marginLeft: isMobile ? '0' : 'auto'
                    }}>
                      <span>📐</span>
                      <span>{getPrescriptionSettings().pageSize || 'A4'}</span>
                      {getPrescriptionSettings().hideHeader && (
                        <span style={{ color: '#fbbf24', fontWeight: 600 }}>• Pré-imprimé</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* SI CNAM MO : Affichage & Saisie du N° de Carnet CNAM */}
                {printFormat === 'cnam_mo' && (
                  <div style={{
                    background: 'rgba(5, 150, 105, 0.1)',
                    border: '1px solid rgba(5, 150, 105, 0.35)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr',
                    gap: '14px',
                    alignItems: 'center'
                  }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#6ee7b7', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                        Numéro du Carnet CNAM (inséré sur l'ordonnance MO) :
                      </label>
                      <input
                        type="text"
                        value={numCarnet}
                        onChange={(e) => setNumCarnet(e.target.value)}
                        placeholder="ex: 12345678-01"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: '#0f172a',
                          border: '1px solid #059669',
                          borderRadius: '6px',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.95rem'
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      Caisse : <strong style={{ color: '#fff' }}>{selectedPatient.caisse || 'CNSS'}</strong><br />
                      Filière : <strong style={{ color: '#34d399' }}>Privée (Médecin de Famille)</strong>
                    </div>
                  </div>
                )}

                {/* SI CNAM APCI : N° de Carnet CNAM + Choix du type d'APCI par le médecin */}
                {printFormat === 'cnam_apci' && (
                  <div style={{
                    background: 'rgba(217, 119, 6, 0.1)',
                    border: '1px solid rgba(217, 119, 6, 0.35)',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 2fr', gap: '14px' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#fcd34d', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                          Numéro du Carnet CNAM :
                        </label>
                        <input
                          type="text"
                          value={numCarnet}
                          onChange={(e) => setNumCarnet(e.target.value)}
                          placeholder="ex: 12345678-01"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: '#0f172a',
                            border: '1px solid #d97706',
                            borderRadius: '6px',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '0.95rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#fcd34d', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                          Type d'APCI retenu (au choix du médecin) :
                        </label>
                        <select
                          value={selectedApci}
                          onChange={(e) => setSelectedApci(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: '#0f172a',
                            border: '1px solid #d97706',
                            borderRadius: '6px',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                          }}
                        >
                          {APCI_LIST.map(a => (
                            <option key={a.code} value={a.code}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#fbbf24' }}>
                      ★ Ce type d'APCI et le N° de carnet seront directement imprimés dans l'encadré officiel de conformité CNAM.
                    </div>
                  </div>
                )}
              </div>

              {/* Boutons d'Action Ordonnance */}
              <div style={{ display: 'flex', justifyContent: isMobile ? 'stretch' : 'flex-end', flexWrap: 'wrap', gap: '10px', marginTop: '18px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const apciFullLabel = getSelectedApciLabel();
                    generatePrescriptionReport(selectedPatient, {
                      date,
                      type: printFormat,
                      printFormat,
                      numCarnet: numCarnet || selectedPatient.cnamid || '',
                      selectedApci,
                      apciLabel: apciFullLabel,
                      indication,
                      notes,
                      items
                    }, printFormat);
                  }}
                  disabled={items.length === 0}
                  style={{
                    flex: isMobile ? '1 1 100%' : 'none',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#38bdf8',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: items.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  📄 Aperçu PDF
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || items.length === 0}
                  style={{
                    flex: isMobile ? '1 1 100%' : 'none',
                    padding: '10px 24px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    border: 'none',
                    cursor: (saving || items.length === 0) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
                  }}
                >
                  {saving ? 'Enregistrement...' : "💾 Valider & Imprimer l'Ordonnance"}
                </button>
              </div>
            </div>
          </div>

          {/* Colonne Latérale Droite : Historique des Ordonnances du Patient & Renouvellement */}
          <div style={{
            background: '#0f172a',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '750px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#38bdf8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
              📜 Historique des Ordonnances ({patientPrescriptions.length})
            </h3>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {patientPrescriptions.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  Aucune ordonnance antérieure enregistrée pour ce patient.
                </div>
              ) : (
                patientPrescriptions.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: '#1e293b',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      borderLeft: `4px solid ${p.type === 'cnam_apci' ? '#d97706' : p.type === 'cnam_ordinaire' ? '#059669' : '#0284c7'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ color: '#fff', fontSize: '0.85rem' }}>📅 {p.date}</strong>
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: p.type === 'cnam_apci' ? 'rgba(217, 119, 6, 0.2)' : p.type === 'cnam_ordinaire' ? 'rgba(5, 150, 105, 0.2)' : 'rgba(2, 132, 199, 0.2)',
                        color: p.type === 'cnam_apci' ? '#fbbf24' : p.type === 'cnam_ordinaire' ? '#34d399' : '#38bdf8'
                      }}>
                        {p.type === 'cnam_apci' ? 'CNAM APCI' : p.type === 'cnam_ordinaire' ? 'CNAM Ordinaire' : 'Normale'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '8px' }}>
                      {(p.items || []).slice(0, 3).map((it, idx) => (
                        <div key={idx} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          • {it.nom}
                        </div>
                      ))}
                      {(p.items || []).length > 3 && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          + {(p.items || []).length - 3} autre(s) ligne(s)
                        </div>
                      )}
                    </div>

                    {/* Actions sur l'ordonnance archivée */}
                    <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleRenewPrescription(p)}
                        style={{
                          flex: 1,
                          padding: '5px 8px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#38bdf8',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        title="Recharger cette ordonnance pour renouvellement"
                      >
                        🔄 Renouveler
                      </button>

                      <button
                        type="button"
                        onClick={() => generatePrescriptionReport(selectedPatient, p, p.printFormat || p.type)}
                        style={{
                          padding: '5px 8px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: '#34d399',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        title="Imprimer ou réexporter en PDF"
                      >
                        📄 PDF
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm("Supprimer cette ordonnance de l'historique ?")) {
                            await deletePrescriptionById(p.id);
                            await loadPatientHistory(selectedPatientId);
                          }
                        }}
                        style={{
                          padding: '5px 8px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                        title="Supprimer cette ordonnance"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODE 2 : GRAND EXPLORATEUR DE LA BASE MÉDICAMENTEUSE MÉDOCS (MODAL PLEIN ÉCRAN) */}
      {showMedocsModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.82)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: isMobile ? '8px' : '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid #38bdf8',
            borderRadius: '16px',
            width: isMobile ? '98vw' : '95vw',
            maxWidth: '1100px',
            height: isMobile ? 'calc(100dvh - 16px)' : '88vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px rgba(0,0,0,0.7)',
            overflow: 'hidden'
          }}>
            {/* Header de l'explorateur */}
            <div style={{
              padding: isMobile ? '12px 16px' : '18px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#1e293b'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.2rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📚</span> Explorateur Base Médocs
                </h2>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Cochez les médicaments un par un puis validez
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowMedocsModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.4rem',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {/* Filtres de l'explorateur */}
            <div style={{
              padding: isMobile ? '10px 14px' : '14px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1.2fr auto',
              gap: '10px',
              alignItems: 'center',
              background: '#0f172a'
            }}>
              {/* Champ recherche */}
              <input
                type="text"
                value={explorerSearch}
                onChange={(e) => { setExplorerSearch(e.target.value); setExplorerPage(1); }}
                placeholder="Rechercher par spécialité ou DCI..."
                style={{
                  padding: '9px 12px',
                  borderRadius: '6px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              />

              {/* Mode recherche */}
              <select
                value={explorerSearchBy}
                onChange={(e) => { setExplorerSearchBy(e.target.value); setExplorerPage(1); }}
                style={{
                  padding: '9px 12px',
                  borderRadius: '6px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#fff',
                  fontSize: '0.85rem'
                }}
              >
                <option value="all">Tous (Spécialité & DCI)</option>
                <option value="commercial">Nom commercial uniquement</option>
                <option value="dci">DCI uniquement</option>
              </select>

              {/* Forme galénique */}
              <select
                value={explorerForme}
                onChange={(e) => { setExplorerForme(e.target.value); setExplorerPage(1); }}
                style={{
                  padding: '9px 12px',
                  borderRadius: '6px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#fff',
                  fontSize: '0.85rem'
                }}
              >
                <option value="">Toutes les formes galéniques</option>
                {allFormes.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>

              {/* Filtre APCI */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#facc15', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={explorerApciOnly}
                  onChange={(e) => { setExplorerApciOnly(e.target.checked); setExplorerPage(1); }}
                  style={{ accentColor: '#eab308' }}
                />
                APCI 100%
              </label>
            </div>

            {/* Tableau des médicaments Médocs avec sélection un par un */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#1e293b', position: 'sticky', top: 0, zIndex: 10, color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <th style={{ padding: '10px 14px', width: '40px', textAlign: 'center' }}>Choix</th>
                    <th style={{ padding: '10px 14px' }}>Médicament (Nom Commercial)</th>
                    <th style={{ padding: '10px 14px' }}>DCI (Molécule)</th>
                    <th style={{ padding: '10px 14px' }}>Forme</th>
                    <th style={{ padding: '10px 14px' }}>Posologie usuelle</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>APCI</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Prix</th>
                  </tr>
                </thead>
                <tbody>
                  {explorerData.items.map((med) => {
                    const isSelected = selectedMedsMap.has(med.id);
                    return (
                      <tr
                        key={med.id}
                        onClick={() => handleToggleMedInExplorer(med)}
                        style={{
                          background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // géré par le onClick du tr
                            style={{ cursor: 'pointer', accentColor: '#0284c7' }}
                          />
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#f8fafc' }}>
                          {med.nom}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#38bdf8' }}>
                          {med.dci || '-'}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                          {med.forme || '-'}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#cbd5e1', fontSize: '0.8rem' }}>
                          {med.poso || '-'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {med.apci ? (
                            <span style={{ fontSize: '0.7rem', background: 'rgba(234, 179, 8, 0.2)', color: '#facc15', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              APCI
                            </span>
                          ) : (
                            <span style={{ color: '#475569' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8' }}>
                          {med.prix > 0 ? `${med.prix.toFixed(3)} DT` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination et validation de l'explorateur */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#1e293b'
            }}>
              {/* Infos pagination */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  {explorerData.total} résultat(s) • Page {explorerData.page} / {explorerData.totalPages}
                </span>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    disabled={explorerPage <= 1}
                    onClick={() => setExplorerPage(prev => Math.max(1, prev - 1))}
                    style={{
                      padding: '4px 10px',
                      background: '#0f172a',
                      border: '1px solid #475569',
                      color: '#fff',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      cursor: explorerPage <= 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    ◀ Précédent
                  </button>
                  <button
                    type="button"
                    disabled={explorerPage >= explorerData.totalPages}
                    onClick={() => setExplorerPage(prev => Math.min(explorerData.totalPages, prev + 1))}
                    style={{
                      padding: '4px 10px',
                      background: '#0f172a',
                      border: '1px solid #475569',
                      color: '#fff',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      cursor: explorerPage >= explorerData.totalPages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Suivant ▶
                  </button>
                </div>
              </div>

              {/* Récapitulatif sélection & Validation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '0.9rem', color: selectedMedsMap.size > 0 ? '#38bdf8' : '#94a3b8', fontWeight: 600 }}>
                  {selectedMedsMap.size} médicament(s) sélectionné(s)
                </span>

                <button
                  type="button"
                  onClick={() => setShowMedocsModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid #475569',
                    color: '#cbd5e1',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={handleConfirmExplorerSelection}
                  disabled={selectedMedsMap.size === 0}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '8px',
                    background: selectedMedsMap.size > 0 
                      ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' 
                      : '#334155',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: selectedMedsMap.size > 0 ? 'pointer' : 'not-allowed',
                    boxShadow: selectedMedsMap.size > 0 ? '0 4px 14px rgba(5, 150, 105, 0.4)' : 'none'
                  }}
                >
                  ✓ Valider la sélection et Insérer ({selectedMedsMap.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
