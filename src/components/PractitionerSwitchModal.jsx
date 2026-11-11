import React, { useState } from 'react';
import {
  getAllPractitioners,
  getActivePractitioner,
  getActivePractitionerId,
  savePractitioner,
  deletePractitioner,
  switchPractitioner,
  formatDoctorDisplayName,
  PRACTITIONER_COLORS
} from '../services/practitionerService';

export default function PractitionerSwitchModal({ isOpen, onClose, onPractitionerSwitched }) {
  if (!isOpen) return null;

  const [practitioners, setPractitioners] = useState(() => getAllPractitioners());
  const [activeDoctor, setActiveDoctor] = useState(() => getActivePractitioner());
  const [editingDoc, setEditingDoc] = useState(null); // null | practitioner object (new or edit)
  const [isNewDoc, setIsNewDoc] = useState(false);
  const [pinTargetDoc, setPinTargetDoc] = useState(null); // practitioner awaiting PIN entry
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);

  const refreshList = () => {
    const list = getAllPractitioners();
    setPractitioners(list);
    setActiveDoctor(getActivePractitioner());
  };

  const handleStartAdd = () => {
    setIsNewDoc(true);
    setEditingDoc({
      titre: 'Dr.',
      nom: '',
      prenom: '',
      specialite: 'Médecine Générale',
      telephone: '',
      email: '',
      adresse: activeDoctor?.adresse || '',
      ville: activeDoctor?.ville || 'Mahdia',
      cnamId: '',
      fiscId: '',
      ordreId: '',
      pinCode: '',
      color: PRACTITIONER_COLORS[practitioners.length % PRACTITIONER_COLORS.length]
    });
  };

  const handleStartEdit = (doc) => {
    setIsNewDoc(false);
    setEditingDoc({ ...doc });
  };

  const handleSaveForm = (e) => {
    e.preventDefault();
    if (!editingDoc.nom.trim()) {
      alert("Veuillez renseigner le nom de famille du médecin.");
      return;
    }

    const res = savePractitioner(editingDoc);
    if (res.success) {
      refreshList();
      setEditingDoc(null);
      setStatusMessage({ type: 'success', text: `✓ Praticien ${formatDoctorDisplayName(res.practitioner)} enregistré avec succès !` });
      setTimeout(() => setStatusMessage(null), 3500);
    } else {
      alert("Erreur lors de l'enregistrement : " + res.error);
    }
  };

  const handleDelete = (doc) => {
    if (doc.id === 'primary') {
      alert("Le praticien principal originel du cabinet ne peut pas être supprimé.");
      return;
    }
    const confirmMsg = `Êtes-vous certain de vouloir supprimer le compte du ${formatDoctorDisplayName(doc)} ?\n\n⚠️ Sa base de données indépendante sera conservée dans le navigateur mais ne sera plus accessible via le menu.`;
    if (window.confirm(confirmMsg)) {
      const res = deletePractitioner(doc.id);
      if (res.success) {
        refreshList();
        setStatusMessage({ type: 'info', text: `Praticien supprimé de la liste.` });
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        alert(res.error);
      }
    }
  };

  const handleSwitchClick = (doc) => {
    if (doc.id === activeDoctor.id) {
      // Déjà actif
      onClose();
      return;
    }

    // Si le médecin cible a un PIN code configuré
    if (doc.pinCode && doc.pinCode.trim()) {
      setPinTargetDoc(doc);
      setEnteredPin('');
      setPinError('');
      return;
    }

    // Bascule directe sans PIN
    executeSwitch(doc.id, null);
  };

  const executeSwitch = (targetId, pin) => {
    const res = switchPractitioner(targetId, pin);
    if (res.success) {
      setPinTargetDoc(null);
      setEnteredPin('');
      refreshList();
      if (onPractitionerSwitched) {
        onPractitionerSwitched(res.practitioner);
      }
      onClose();
    } else {
      if (res.needsPin) {
        setPinError("Code PIN incorrect. Veuillez vérifier.");
      } else {
        alert(res.error || "Erreur de bascule de médecin.");
      }
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (!pinTargetDoc) return;
    executeSwitch(pinTargetDoc.id, enteredPin);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(6px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      overflowY: 'auto'
    }}>
      <div style={{
        background: '#1e293b',
        border: '1.5px solid #334155',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden'
      }}>
        {/* En-tête */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.3rem',
              boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)'
            }}>
              🩺
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 800 }}>
                Médecins & Praticiens du Cabinet
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                Cloisonnement étanche : chaque médecin gère ses propres dossiers, CNAM et quittances
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.4rem',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
            title="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Message de statut toast */}
        {statusMessage && (
          <div style={{
            background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
            borderLeft: `4px solid ${statusMessage.type === 'success' ? '#10b981' : '#38bdf8'}`,
            padding: '10px 16px',
            color: '#fff',
            fontSize: '0.85rem',
            fontWeight: 600
          }}>
            {statusMessage.text}
          </div>
        )}

        {/* Corps principal : Modal de saisie PIN ou Formulaire ou Liste */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* DIALOGUE DE SAISIE DU CODE PIN POUR BASCULER VERS UN MÉDECIN PROTÉGÉ */}
          {pinTargetDoc ? (
            <div style={{
              background: '#0f172a',
              border: '1.5px solid #0284c7',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              maxWidth: '380px',
              margin: '20px auto'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🔒</div>
              <h3 style={{ margin: '0 0 6px', color: '#f8fafc', fontSize: '1.1rem' }}>
                Session Protégée par PIN
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '0 0 16px' }}>
                Veuillez saisir le code confidentiel du <strong style={{ color: '#38bdf8' }}>{formatDoctorDisplayName(pinTargetDoc)}</strong>
              </p>

              <form onSubmit={handlePinSubmit}>
                <input
                  type="password"
                  maxLength={8}
                  autoFocus
                  placeholder="••••"
                  value={enteredPin}
                  onChange={(e) => {
                    setEnteredPin(e.target.value);
                    setPinError('');
                  }}
                  style={{
                    width: '180px',
                    textAlign: 'center',
                    fontSize: '1.6rem',
                    letterSpacing: '8px',
                    padding: '10px',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: pinError ? '2px solid #ef4444' : '2px solid #38bdf8',
                    color: '#fff',
                    outline: 'none',
                    marginBottom: '10px'
                  }}
                />

                {pinError && (
                  <div style={{ color: '#f87171', fontSize: '0.78rem', marginBottom: '12px', fontWeight: 600 }}>
                    {pinError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPinTargetDoc(null);
                      setEnteredPin('');
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: 'transparent',
                      border: '1px solid #475569',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      border: 'none',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    Déverrouiller
                  </button>
                </div>
              </form>
            </div>
          ) : editingDoc ? (
            /* FORMULAIRE D'AJOUT OU D'ÉDITION D'UN MÉDECIN */
            <form onSubmit={handleSaveForm} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{isNewDoc ? '➕' : '✏️'}</span>
                  {isNewDoc ? 'Nouveau Médecin Associé ou Remplaçant' : `Modifier la fiche du ${formatDoctorDisplayName(editingDoc)}`}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem' }}
                >
                  ✕ Annuler
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Titre</label>
                  <select
                    value={editingDoc.titre || 'Dr.'}
                    onChange={(e) => setEditingDoc({ ...editingDoc, titre: e.target.value })}
                    style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  >
                    <option value="Dr.">Dr.</option>
                    <option value="Pr.">Pr.</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Nom *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: BEN KHALIFA"
                    value={editingDoc.nom}
                    onChange={(e) => setEditingDoc({ ...editingDoc, nom: e.target.value.toUpperCase() })}
                    style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Prénom</label>
                  <input
                    type="text"
                    placeholder="ex: Hamed"
                    value={editingDoc.prenom}
                    onChange={(e) => setEditingDoc({ ...editingDoc, prenom: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Spécialité Médicale</label>
                  <input
                    type="text"
                    placeholder="ex: Médecine Générale, Pédiatrie..."
                    value={editingDoc.specialite}
                    onChange={(e) => setEditingDoc({ ...editingDoc, specialite: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Code Conventionnel CNAM</label>
                  <input
                    type="text"
                    placeholder="ex: 010002763183"
                    value={editingDoc.cnamId}
                    onChange={(e) => setEditingDoc({ ...editingDoc, cnamId: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>N° d'Ordre des Médecins</label>
                  <input
                    type="text"
                    placeholder="ex: 12052"
                    value={editingDoc.ordreId}
                    onChange={(e) => setEditingDoc({ ...editingDoc, ordreId: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Identifiant Fiscal (Matricule)</label>
                  <input
                    type="text"
                    placeholder="ex: 856103/M"
                    value={editingDoc.fiscId}
                    onChange={(e) => setEditingDoc({ ...editingDoc, fiscId: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Téléphone de Contact</label>
                  <input
                    type="text"
                    placeholder="ex: 73 000 000"
                    value={editingDoc.telephone}
                    onChange={(e) => setEditingDoc({ ...editingDoc, telephone: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Email Professionnel</label>
                  <input
                    type="email"
                    placeholder="ex: dr.contact@docpocket.tn"
                    value={editingDoc.email}
                    onChange={(e) => setEditingDoc({ ...editingDoc, email: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Adresse du Cabinet</label>
                  <input
                    type="text"
                    placeholder="ex: Complexe Médical Dar Attabib"
                    value={editingDoc.adresse}
                    onChange={(e) => setEditingDoc({ ...editingDoc, adresse: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Ville</label>
                  <input
                    type="text"
                    placeholder="ex: Mahdia"
                    value={editingDoc.ville}
                    onChange={(e) => setEditingDoc({ ...editingDoc, ville: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
              </div>

              {/* Code PIN de protection */}
              <div style={{ background: '#0f172a', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>
                      🔒 Code PIN de Protection de Session (Optionnel)
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      Empêche un confrère de basculer vers votre compte sans saisir ce code
                    </div>
                  </div>
                  <input
                    type="password"
                    maxLength={8}
                    placeholder="ex: 1234"
                    value={editingDoc.pinCode || ''}
                    onChange={(e) => setEditingDoc({ ...editingDoc, pinCode: e.target.value })}
                    style={{ width: '100px', textAlign: 'center', letterSpacing: '4px', padding: '6px 10px', background: '#1e293b', border: '1px solid #38bdf8', borderRadius: '6px', color: '#fff', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid #475569', color: '#94a3b8', cursor: 'pointer' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 22px', borderRadius: '8px', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  💾 Enregistrer le Praticien
                </button>
              </div>
            </form>
          ) : (
            /* LISTE DES PRATICIENS DU CABINET */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  {practitioners.length} praticien{practitioners.length > 1 ? 's' : ''} enregistré{practitioners.length > 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={handleStartAdd}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
                  }}
                >
                  <span>➕</span> Ajouter un Confrère / Remplaçant
                </button>
              </div>

              {practitioners.map(doc => {
                const isActive = doc.id === activeDoctor.id;
                const initials = `${(doc.prenom || 'M')[0]}${(doc.nom || 'D')[0]}`.toUpperCase();

                return (
                  <div
                    key={doc.id}
                    style={{
                      background: isActive ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%)' : '#0f172a',
                      border: isActive ? '2px solid #0284c7' : '1px solid #334155',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      boxShadow: isActive ? '0 4px 14px rgba(2, 132, 199, 0.25)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Avatar avec initiales */}
                        <div style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '12px',
                          background: doc.color || '#0284c7',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '1.1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                          flexShrink: 0
                        }}>
                          {initials}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: '1rem' }}>
                              {formatDoctorDisplayName(doc)}
                            </span>
                            {doc.id === 'primary' && (
                              <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontWeight: 700 }}>
                                Titulaire Principal
                              </span>
                            )}
                            {doc.pinCode && (
                              <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.2)', color: '#facc15' }} title="Session protégée par PIN">
                                🔒 Protégé
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                            {doc.specialite || 'Médecine Générale'} • Ville : {doc.ville || 'Mahdia'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                            Code CNAM : <strong style={{ color: '#cbd5e1' }}>{doc.cnamId || 'Non défini'}</strong> • Ordre : <strong style={{ color: '#cbd5e1' }}>{doc.ordreId || 'Non défini'}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Badge Session active */}
                      {isActive && (
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#4ade80',
                          border: '1px solid #10b981',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }}></span>
                          Session en cours
                        </span>
                      )}
                    </div>

                    {/* Actions : Basculer, Éditer, Supprimer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(doc)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            color: '#94a3b8',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          ✏️ Modifier coordonnées
                        </button>

                        {doc.id !== 'primary' && (
                          <button
                            type="button"
                            onClick={() => handleDelete(doc)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#f87171',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            🗑️ Supprimer
                          </button>
                        )}
                      </div>

                      {!isActive ? (
                        <button
                          type="button"
                          onClick={() => handleSwitchClick(doc)}
                          style={{
                            padding: '7px 14px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                            border: 'none',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
                          }}
                        >
                          <span>🔄</span> Basculer sur cette session
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                          Base de données connectée
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pied de page informatif */}
        <div style={{
          padding: '12px 20px',
          background: '#0f172a',
          borderTop: '1px solid #334155',
          fontSize: '0.75rem',
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            🛡️ <strong>Partitionnement strict :</strong> Les dossiers et quittances d'un confrère ne sont jamais mélangés avec les vôtres.
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              background: '#334155',
              border: 'none',
              color: '#fff',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
