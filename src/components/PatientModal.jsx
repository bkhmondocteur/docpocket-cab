import React, { useState } from 'react';
import { APCI_LIST, CAISSES, FILIERES, QUALITES, ETAT_CIVIL_OPTIONS, CIVILITY_OPTIONS } from '../constants/medicalConstants';
import { normalizeStrForMatch } from '../services/patientStorage';

export default function PatientModal({ patient, onClose, onSave, existingPatients = [], onSwitchToExisting = null }) {
  const isEditing = Boolean(patient && patient.id);

  // Assainissement au chargement si l'ancienne civilité contenait l'état matrimonial
  const rawCiv = patient?.civility || '';
  const isMatrimonial = /mari|celib|veuf|divorc/i.test(rawCiv);
  const initialEtatCivil = patient?.etat_civil || (isMatrimonial ? (
    /mari/i.test(rawCiv) ? 'Marié(e)' :
    /divorc/i.test(rawCiv) ? 'Divorcé(e)' :
    /veuf/i.test(rawCiv) ? 'Veuf(ve)' : 'Célibataire'
  ) : 'Célibataire');
  const initialCivility = isMatrimonial ? (patient?.gender === 'F' ? 'Mme' : 'M.') : (patient?.civility || (patient?.gender === 'F' ? 'Mme' : 'M.'));

  // Conversion de la date de naissance initiale pour affichage au format jj/mm/aaaa
  const initialBirthDisplay = (() => {
    const raw = patient?.birthdate || '';
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-');
      return `${d}/${m}/${y}`;
    }
    return raw;
  })();

  // Conversion de la date de création/délivrance CIN pour affichage au format jj/mm/aaaa
  const initialCinDateDisplay = (() => {
    const raw = patient?.cin_date || '';
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-');
      return `${d}/${m}/${y}`;
    }
    return raw;
  })();

  const [birthdateDisplay, setBirthdateDisplay] = useState(initialBirthDisplay);
  const [cinDateDisplay, setCinDateDisplay] = useState(initialCinDateDisplay);
  const [ageDirectVal, setAgeDirectVal] = useState('');
  const [duplicateWarningPatient, setDuplicateWarningPatient] = useState(null);

  const [formData, setFormData] = useState({
    id: patient?.id || null,
    nom: patient?.nom || '',
    prenom: patient?.prenom || '',
    gender: patient?.gender || 'M',
    civility: initialCivility,
    etat_civil: initialEtatCivil,
    birthdate: patient?.birthdate || '',
    telephone: patient?.telephone || '',
    cin: patient?.cin || '',
    cin_date: patient?.cin_date || '',
    city: patient?.city || '',
    adress: patient?.adress || '',
    numfch: patient?.numfch || `F-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    // Données CNAM
    cnamid: patient?.cnamid || '',
    caisse: patient?.caisse || 'CNSS',
    quality: patient?.quality || 'Assuré(e)',
    filiere: patient?.filiere || 'Privée (Médecin de famille)',
    apci: patient?.apci || '',
    apciLabel: patient?.apciLabel || '',
    solde: patient?.solde || 0.000,
    // Dossier médical
    atcd_medicaux: patient?.atcd_medicaux || '',
    atcd_chirurgicaux: patient?.atcd_chirurgicaux || '',
    atcd_familiaux: patient?.atcd_familiaux || '',
    allergies: patient?.allergies || ''
  });

  const [activeTab, setActiveTab] = useState('identite'); // 'identite' | 'cnam' | 'atcd'

  const formatNom = (val) => val.toUpperCase();
  const formatCapitalize = (val) => {
    if (!val) return '';
    // Met en majuscule la première lettre de chaque mot (gère les noms composés ex: Mohamed Ali, La Marsa)
    return val.replace(/(?:^|\s|-)\S/g, (a) => a.toUpperCase());
  };

  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === 'nom') {
      value = formatNom(value);
    } else if (name === 'prenom' || name === 'city') {
      value = formatCapitalize(value);
    }

    if (name === 'apci') {
      const selected = APCI_LIST.find(a => a.code === value);
      setFormData(prev => ({
        ...prev,
        apci: value,
        apciLabel: selected ? selected.label : ''
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Saisie de la date de naissance au format jj/mm/aaaa avec insertion automatique du /
  const handleBirthdateChange = (e) => {
    setAgeDirectVal(''); // Efface la valeur directe pour que le calcul automatique prenne le relais
    const val = e.target.value;
    const prev = birthdateDisplay;

    let formatted = '';
    // Si l'utilisateur efface avec retour arrière sur un slash
    if (prev && prev.endsWith('/') && val === prev.slice(0, -1)) {
      formatted = val.slice(0, -1);
    } else {
      const digits = val.replace(/\D/g, '').slice(0, 8);
      if (digits.length <= 2) {
        formatted = (digits.length === 2 && !prev.endsWith('/')) ? `${digits}/` : digits;
      } else if (digits.length <= 4) {
        const d = digits.slice(0, 2);
        const m = digits.slice(2);
        formatted = (digits.length === 4 && !prev.endsWith('/')) ? `${d}/${m}/` : `${d}/${m}`;
      } else {
        formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
      }
    }

    setBirthdateDisplay(formatted);

    // Mettre à jour formData.birthdate
    if (formatted.length === 10) {
      const [d, m, y] = formatted.split('/');
      setFormData(prevForm => ({ ...prevForm, birthdate: `${y}-${m}-${d}` }));
    } else {
      setFormData(prevForm => ({ ...prevForm, birthdate: formatted }));
    }
  };

  // Saisie directe de l'âge dans la case Âge : calcule automatiquement l'année de naissance
  const handleAgeInputChange = (e) => {
    const val = e.target.value;
    const digits = val.replace(/\D/g, '').slice(0, 3);
    setAgeDirectVal(digits);

    if (digits) {
      const ageNum = parseInt(digits, 10);
      if (ageNum >= 0 && ageNum <= 125) {
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - ageNum;
        const formatted = `01/01/${birthYear}`;
        setBirthdateDisplay(formatted);
        setFormData(prev => ({ ...prev, birthdate: `${birthYear}-01-01` }));
      }
    } else {
      setBirthdateDisplay('');
      setFormData(prev => ({ ...prev, birthdate: '' }));
    }
  };

  // Saisie de la date de délivrance/création de la CIN au format jj/mm/aaaa avec insertion automatique du /
  const handleCinDateChange = (e) => {
    const val = e.target.value;
    const prev = cinDateDisplay;

    let formatted = '';
    if (prev && prev.endsWith('/') && val === prev.slice(0, -1)) {
      formatted = val.slice(0, -1);
    } else {
      const digits = val.replace(/\D/g, '').slice(0, 8);
      if (digits.length <= 2) {
        formatted = (digits.length === 2 && !prev.endsWith('/')) ? `${digits}/` : digits;
      } else if (digits.length <= 4) {
        const d = digits.slice(0, 2);
        const m = digits.slice(2);
        formatted = (digits.length === 4 && !prev.endsWith('/')) ? `${d}/${m}/` : `${d}/${m}`;
      } else {
        formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
      }
    }

    setCinDateDisplay(formatted);

    if (formatted.length === 10) {
      const [d, m, y] = formatted.split('/');
      setFormData(prevForm => ({ ...prevForm, cin_date: `${y}-${m}-${d}` }));
    } else {
      setFormData(prevForm => ({ ...prevForm, cin_date: formatted }));
    }
  };

  // Calcul dynamique de l'âge pour affichage immédiat
  const computedAge = (() => {
    if (!birthdateDisplay || birthdateDisplay.length < 10) return null;
    const parts = birthdateDisplay.split('/');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts.map(Number);
    if (!d || !m || !y || y < 1880 || y > new Date().getFullYear() || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const birth = new Date(y, m - 1, d);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    if (age < 0) return null;
    if (age === 0) {
      let ageMonths = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
      if (today.getDate() < birth.getDate()) ageMonths--;
      if (ageMonths <= 0) {
        const days = Math.floor((today - birth) / (1000 * 60 * 60 * 24));
        return `${Math.max(0, days)} jour(s)`;
      }
      return `${ageMonths} mois`;
    }
    return `${age} an${age > 1 ? 's' : ''}`;
  })();

  // Valeur calculée automatiquement pour la case Âge
  const displayAgeValue = computedAge || (ageDirectVal ? `${ageDirectVal} ans` : '');

  const handleSubmit = (e, forceCreate = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formData.nom.trim() || !formData.prenom.trim()) {
      alert('Veuillez renseigner au moins le nom et le prénom.');
      return;
    }

    let finalBirthdate = formData.birthdate;
    if (birthdateDisplay && birthdateDisplay.length === 10) {
      const [d, m, y] = birthdateDisplay.split('/');
      finalBirthdate = `${y}-${m}-${d}`;
    }

    let finalCinDate = formData.cin_date;
    if (cinDateDisplay && cinDateDisplay.length === 10) {
      const [d, m, y] = cinDateDisplay.split('/');
      finalCinDate = `${y}-${m}-${d}`;
    }

    // Détection anti-doublon lors de la création d'un NOUVEAU patient
    if (!isEditing && !forceCreate && existingPatients && existingPatients.length > 0) {
      const nomInput = normalizeStrForMatch(formData.nom);
      const prenomInput = normalizeStrForMatch(formData.prenom);
      const cinInput = (formData.cin || '').trim();
      const telInput = (formData.telephone || '').replace(/\s+/g, '');

      const found = existingPatients.find(p => {
        // Règle 1 : Même CIN non vide
        if (cinInput && cinInput.length >= 6 && p.cin && p.cin.trim() === cinInput) {
          return true;
        }
        // Règle 2 : Même nom et même prénom
        const nomExist = normalizeStrForMatch(p.nom);
        const prenomExist = normalizeStrForMatch(p.prenom);
        if (nomInput && prenomInput && nomInput === nomExist && prenomInput === prenomExist) {
          if (finalBirthdate && p.birthdate && finalBirthdate === p.birthdate) {
            return true;
          }
          if (telInput && p.telephone && p.telephone.replace(/\s+/g, '') === telInput) {
            return true;
          }
          return true;
        }
        return false;
      });

      if (found) {
        setDuplicateWarningPatient(found);
        return; // Alerte déclenchée
      }
    }

    onSave({
      ...formData,
      birthdate: finalBirthdate,
      cin_date: finalCinDate
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(10, 15, 29, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '10px'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '750px',
        maxHeight: 'calc(100dvh - 20px)',
        display: 'flex',
        flexDirection: 'column',
        background: '#0f172a',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        borderRadius: '16px',
        overflow: 'hidden'
      }}>
        {/* Header Modal */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(30, 41, 59, 0.6)',
          flexShrink: 0
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#38bdf8', fontWeight: 600 }}>
              {isEditing ? `Modifier la fiche : ${formData.nom} ${formData.prenom}` : 'Créer un nouveau Dossier Patient'}
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              N° Fiche : <strong style={{ color: '#e2e8f0' }}>{formData.numfch}</strong>
            </span>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            &times;
          </button>
        </div>

        {/* Onglets Navigation Interne Adaptatifs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.6)',
          padding: '0 14px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          flexShrink: 0
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('identite')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'identite' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'identite' ? '#38bdf8' : '#94a3b8',
              fontWeight: activeTab === 'identite' ? 600 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            1. État Civil & Contact
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cnam')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'cnam' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'cnam' ? '#38bdf8' : '#94a3b8',
              fontWeight: activeTab === 'cnam' ? 600 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            2. Couverture CNAM & APCI
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('atcd')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'atcd' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'atcd' ? '#38bdf8' : '#94a3b8',
              fontWeight: activeTab === 'atcd' ? 600 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            3. Antécédents Médicaux
          </button>
        </div>

        {/* Corps du Formulaire */}
        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '18px 20px 0 20px'
        }}>
          {activeTab === 'identite' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Civilité</label>
                  <select 
                    name="civility" 
                    value={formData.civility} 
                    onChange={handleChange}
                    className="input-field"
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%' }}
                  >
                    <option value="M.">M.</option>
                    <option value="Mme">Mme</option>
                    <option value="Mlle">Mlle</option>
                    <option value="Enfant">Enfant</option>
                    <option value="Nourrisson">Nourrisson</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Nom (MAJUSCULES) *</label>
                  <input
                    type="text"
                    name="nom"
                    required
                    value={formData.nom}
                    onChange={handleChange}
                    placeholder="Nom de famille"
                    className="input-field"
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%', textTransform: 'uppercase' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Prénom (1ère lettre Maj) *</label>
                  <input
                    type="text"
                    name="prenom"
                    required
                    value={formData.prenom}
                    onChange={handleChange}
                    placeholder="Prénom"
                    className="input-field"
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%', textTransform: 'capitalize' }}
                  />
                </div>
              </div>

              {/* Rangée 2 : Démographie & État Civil (4 colonnes parfaitement alignées) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Genre</label>
                  <select 
                    name="gender" 
                    value={formData.gender} 
                    onChange={handleChange}
                    className="input-field"
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%' }}
                  >
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600, marginBottom: '6px' }}>
                    💍 État Civil
                  </label>
                  <select 
                    name="etat_civil" 
                    value={formData.etat_civil} 
                    onChange={handleChange}
                    className="input-field"
                    style={{ background: '#1e293b', border: '1px solid #0284c7', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%' }}
                  >
                    {ETAT_CIVIL_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* Case 1 : Date de Naissance (jj/mm/aaaa avec insertion auto du /) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                    📅 Date de Naissance
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="birthdate"
                    placeholder="jj/mm/aaaa"
                    value={birthdateDisplay}
                    onChange={handleBirthdateChange}
                    maxLength={10}
                    className="input-field"
                    style={{
                      background: '#1e293b',
                      border: birthdateDisplay.length === 10 ? '1.5px solid #22c55e' : '1px solid #334155',
                      color: '#fff',
                      borderRadius: '8px',
                      padding: '10px',
                      width: '100%',
                      fontSize: '0.95rem',
                      fontWeight: 500,
                      letterSpacing: '0.5px'
                    }}
                  />
                </div>

                {/* Case 2 : Calcul automatique de l'âge (ou saisie directe d'âge) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>
                      🎂 Âge (auto)
                    </label>
                    <span style={{
                      fontSize: '0.7rem',
                      background: displayAgeValue ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.12)',
                      color: displayAgeValue ? '#4ade80' : '#94a3b8',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      border: displayAgeValue ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(148, 163, 184, 0.2)',
                      fontWeight: 600
                    }}>
                      Calcul auto
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: 45 ans"
                    value={displayAgeValue}
                    onChange={handleAgeInputChange}
                    className="input-field"
                    style={{
                      background: '#1e293b',
                      border: displayAgeValue ? '1.5px solid #22c55e' : '1px solid #334155',
                      color: displayAgeValue ? '#4ade80' : '#cbd5e1',
                      borderRadius: '8px',
                      padding: '10px',
                      width: '100%',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      textAlign: 'center',
                      letterSpacing: '0.5px'
                    }}
                    title="Âge calculé automatiquement à partir de la date de naissance (ou tapez un âge directement)"
                  />
                </div>
              </div>

              {/* Rangée 3 : Pièce d'Identité (CIN) & Coordonnées (4 colonnes parfaitement alignées) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                    🪪 N° CIN
                  </label>
                  <input
                    type="text"
                    name="cin"
                    value={formData.cin}
                    onChange={handleChange}
                    placeholder="8 chiffres"
                    maxLength={8}
                    className="input-field"
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                    📅 Date Création CIN
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="cin_date"
                    value={cinDateDisplay}
                    onChange={handleCinDateChange}
                    placeholder="jj/mm/aaaa"
                    maxLength={10}
                    className="input-field"
                    style={{
                      background: '#1e293b',
                      border: cinDateDisplay.length === 10 ? '1.5px solid #22c55e' : '1px solid #334155',
                      color: '#fff',
                      borderRadius: '8px',
                      padding: '10px',
                      width: '100%',
                      fontSize: '0.95rem',
                      fontWeight: 500,
                      letterSpacing: '0.5px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                    📞 Téléphone Portable
                  </label>
                  <input
                    type="tel"
                    name="telephone"
                    value={formData.telephone}
                    onChange={handleChange}
                    placeholder="Ex: 98 123 456"
                    className="input-field"
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                    📍 Ville
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Ex: Tunis, Ariana..."
                    className="input-field"
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%', textTransform: 'capitalize' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Adresse Complète</label>
                <input
                  type="text"
                  name="adress"
                  value={formData.adress}
                  onChange={handleChange}
                  placeholder="Rue, Immeuble, Appartement..."
                  className="input-field"
                  style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%' }}
                />
              </div>
            </div>
          )}

          {activeTab === 'cnam' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Identifiant Unique CNAM</label>
                  <input
                    type="text"
                    name="cnamid"
                    value={formData.cnamid}
                    onChange={handleChange}
                    placeholder="Matricule CNAM (ex: 1025489632)"
                    maxLength={12}
                    className="input-field"
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Caisse d'Affiliation</label>
                  <select
                    name="caisse"
                    value={formData.caisse}
                    onChange={handleChange}
                    className="input-field"
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%' }}
                  >
                    {CAISSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Qualité / Lien</label>
                  <select
                    name="quality"
                    value={formData.quality}
                    onChange={handleChange}
                    className="input-field"
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%' }}
                  >
                    {QUALITES.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Filière de Soins</label>
                  <select
                    name="filiere"
                    value={formData.filiere}
                    onChange={handleChange}
                    className="input-field"
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%' }}
                  >
                    {FILIERES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#38bdf8', marginBottom: '6px', fontWeight: 600 }}>
                  Prise en charge intégrale (APCI)
                </label>
                <select
                  name="apci"
                  value={formData.apci}
                  onChange={handleChange}
                  className="input-field"
                  style={{ background: '#1e293b', border: '1px solid #38bdf8', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%' }}
                >
                  <option value="">-- Aucune Affection Longue Durée (Sans APCI) --</option>
                  {APCI_LIST.map(a => (
                    <option key={a.code} value={a.code}>{a.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginTop: '10px', padding: '14px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '8px', borderLeft: '4px solid #38bdf8' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>
                  ℹ️ <strong>Rappel CNAM :</strong> Si le patient est couvert par une APCI, les consultations, examens et ordonnances rattachés à cette pathologie bénéficient de la dispense d'avance des frais selon le plafond en vigueur.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'atcd' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#f87171', marginBottom: '6px', fontWeight: 600 }}>
                  ⚠️ Allergies & Intolérances Médicamenteuses
                </label>
                <input
                  type="text"
                  name="allergies"
                  value={formData.allergies}
                  onChange={handleChange}
                  placeholder="Ex: Pénicilline, Aspirine, Produits de contraste..."
                  className="input-field"
                  style={{ background: '#1e293b', border: '1px solid #f87171', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Antécédents Médicaux</label>
                <textarea
                  name="atcd_medicaux"
                  rows="3"
                  value={formData.atcd_medicaux}
                  onChange={handleChange}
                  placeholder="Pathologies chroniques, diabète, HTA, cardiopathies..."
                  className="input-field"
                  style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Antécédents Chirurgicaux</label>
                <textarea
                  name="atcd_chirurgicaux"
                  rows="2"
                  value={formData.atcd_chirurgicaux}
                  onChange={handleChange}
                  placeholder="Interventions, dates, hospitalisations..."
                  className="input-field"
                  style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Antécédents Familiaux</label>
                <textarea
                  name="atcd_familiaux"
                  rows="2"
                  value={formData.atcd_familiaux}
                  onChange={handleChange}
                  placeholder="Antécédents chez les parents, fratrie..."
                  className="input-field"
                  style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', padding: '10px', width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div style={{
            position: 'sticky',
            bottom: 0,
            background: '#0f172a',
            zIndex: 10,
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            paddingTop: '14px',
            paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 -4px 15px rgba(0, 0, 0, 0.5)'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
              }}
            >
              {isEditing ? 'Enregistrer les modifications' : 'Créer le Dossier'}
            </button>
          </div>
        </form>
      </div>

      {/* Fenêtre d'alerte : Patient déjà existant détecté dans la base */}
      {duplicateWarningPatient && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10, 15, 29, 0.88)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '12px'
        }}>
          <div className="animate-fade-in" style={{
            width: '100%',
            maxWidth: '560px',
            maxHeight: 'calc(100dvh - 24px)',
            overflowY: 'auto',
            background: '#1e293b',
            border: '2px solid #eab308',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 25px rgba(234, 179, 8, 0.25)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '2.2rem' }}>⚠️</span>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#facc15', fontWeight: 700 }}>
                  Ce patient existe déjà dans votre cabinet !
                </h2>
                <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                  Une fiche active correspondante a été identifiée dans votre base de données.
                </span>
              </div>
            </div>

            {/* Fiche récapitulative du patient trouvé */}
            <div style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                    {duplicateWarningPatient.civility || ''} {duplicateWarningPatient.nom.toUpperCase()} {duplicateWarningPatient.prenom}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }}>
                    Fiche N° {duplicateWarningPatient.numfch || duplicateWarningPatient.id}
                  </div>
                </div>
                {duplicateWarningPatient.derniere_visite && (
                  <span style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    fontSize: '0.75rem',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontWeight: 600
                  }}>
                    Dernière visite : {duplicateWarningPatient.derniere_visite}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.82rem', color: '#94a3b8', marginTop: '6px' }}>
                <div>🎂 Né(e) le : <strong style={{ color: '#fff' }}>{duplicateWarningPatient.birthdate || 'Inconnu'}</strong></div>
                <div>📞 Tél : <strong style={{ color: '#fff' }}>{duplicateWarningPatient.telephone || 'Non renseigné'}</strong></div>
                <div>🪪 CIN : <strong style={{ color: '#fff' }}>{duplicateWarningPatient.cin || 'Non renseigné'}{duplicateWarningPatient.cin_date ? ` (${duplicateWarningPatient.cin_date})` : ''}</strong></div>
                <div>🏛️ Caisse : <strong style={{ color: '#fff' }}>{duplicateWarningPatient.caisse || 'Sans caisse'}</strong></div>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.88rem', color: '#e2e8f0', lineHeight: 1.4 }}>
              Souhaitez-vous basculer directement sur ce dossier existant pour démarrer une nouvelle consultation, ou s'agit-il d'un patient homonyme distinct ?
            </p>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => {
                  if (onSwitchToExisting) {
                    onSwitchToExisting(duplicateWarningPatient);
                  }
                }}
                style={{
                  padding: '12px 18px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)'
                }}
              >
                <span>🩺</span> Basculer sur ce patient & Démarrer la consultation
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleSubmit(null, true)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'rgba(234, 179, 8, 0.15)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    color: '#facc15',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Créer quand même (Homonyme distinct)
                </button>

                <button
                  type="button"
                  onClick={() => setDuplicateWarningPatient(null)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#94a3b8',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Modifier la saisie
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
