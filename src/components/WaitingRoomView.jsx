import React, { useState, useEffect } from 'react';
import { 
  getTodayWaitingList, 
  addToWaitingRoom, 
  updateWaitingStatus, 
  removeFromWaitingRoom,
  getAllPatients 
} from '../services/patientStorage';

export default function WaitingRoomView({ onStartConsultation, onNewPatient }) {
  const [waitingList, setWaitingList] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [motif, setMotif] = useState('Consultation standard');
  const [isUrgent, setIsUrgent] = useState(false);
  const [searchPatient, setSearchPatient] = useState('');
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [wList, pList] = await Promise.all([
        getTodayWaitingList(),
        getAllPatients()
      ]);
      setWaitingList(wList);
      setPatients(pList);
    } catch (err) {
      console.error('Erreur chargement salle attente:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Rafraîchissement automatique toutes les 30 secondes
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) {
      alert('Veuillez sélectionner un patient dans la liste.');
      return;
    }

    const patient = patients.find(p => String(p.id) === String(selectedPatientId));
    if (!patient) {
      alert('Patient introuvable. Veuillez recharger la page.');
      return;
    }

    try {
      await addToWaitingRoom(patient, motif, isUrgent);
      setShowAddModal(false);
      setSelectedPatientId('');
      setMotif('Consultation standard');
      setIsUrgent(false);
      setSearchPatient('');
      await loadData();
    } catch (err) {
      alert("Erreur lors de l'ajout en salle d'attente : " + err.message);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await updateWaitingStatus(id, status);
      await loadData();
    } catch (err) {
      alert('Erreur changement de statut : ' + err.message);
    }
  };

  const handleRemove = async (id) => {
    if (window.confirm("Retirer ce patient de la file d'attente du jour ?")) {
      try {
        await removeFromWaitingRoom(id);
        await loadData();
      } catch (err) {
        alert('Erreur suppression : ' + err.message);
      }
    }
  };

  // Filtrage des patients dans la modale d'ajout
  const filteredPatients = patients.filter(p => 
    p.nom.toLowerCase().includes(searchPatient.toLowerCase()) ||
    p.prenom.toLowerCase().includes(searchPatient.toLowerCase()) ||
    (p.telephone && p.telephone.includes(searchPatient)) ||
    (p.cin && p.cin.includes(searchPatient))
  );

  const waitingCount = waitingList.filter(w => w.status === 'waiting').length;
  const inConsultCount = waitingList.filter(w => w.status === 'in_consultation').length;
  const finishedCount = waitingList.filter(w => w.status === 'finished').length;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* En-tête et statistiques de flux adaptatifs */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
        background: '#1e293b',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', color: '#f8fafc', fontWeight: 600 }}>
            ⏱️ Salle d'Attente du Jour
          </h1>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Flux des patients en temps réel • {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          {/* Compteurs badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ padding: '5px 10px', borderRadius: '20px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '0.8rem', fontWeight: 600 }}>
              En attente : {waitingCount}
            </span>
            <span style={{ padding: '5px 10px', borderRadius: '20px', background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', fontSize: '0.8rem', fontWeight: 600 }}>
              En cours : {inConsultCount}
            </span>
            <span style={{ padding: '5px 10px', borderRadius: '20px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', fontSize: '0.8rem', fontWeight: 600 }}>
              Terminés : {finishedCount}
            </span>
          </div>

          <button
            onClick={onNewPatient}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
            }}
          >
            <span>👤+</span> Nouveau
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>+</span> Arrivée
          </button>
        </div>
      </div>

      {/* Affichage adaptatif Smartphone vs Ordinateur */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', background: '#0f172a', borderRadius: '12px' }}>
              Chargement de la file d'attente...
            </div>
          ) : waitingList.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', background: '#0f172a', borderRadius: '12px', border: '1px dashed rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>☕</div>
              <strong style={{ color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Salle d'attente vide</strong>
              Enregistrez les arrivées avec le bouton <strong>+ Arrivée</strong> ci-dessus.
            </div>
          ) : (
            waitingList.map((entry) => {
              const isWaiting = entry.status === 'waiting';
              const isInConsult = entry.status === 'in_consultation';
              const isFinished = entry.status === 'finished';

              return (
                <div
                  key={entry.id}
                  style={{
                    background: '#0f172a',
                    border: `1.5px solid ${isInConsult ? '#38bdf8' : entry.isUrgent ? '#ef4444' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: isInConsult ? '0 0 15px rgba(56, 189, 248, 0.2)' : 'none'
                  }}
                >
                  {/* Top row: Order, Time, Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        background: entry.isUrgent ? '#ef4444' : '#0284c7',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        #{entry.order}
                      </span>
                      <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}>
                        ⏰ {entry.arrivalTime}
                      </span>
                      {entry.isUrgent && (
                        <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>
                          URGENCE
                        </span>
                      )}
                    </div>
                    <div>
                      {isWaiting && (
                        <span style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', padding: '3px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>
                          ⏳ Attente
                        </span>
                      )}
                      {isInConsult && (
                        <span style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', padding: '3px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>
                          🩺 En Consultation
                        </span>
                      )}
                      {isFinished && (
                        <span style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '3px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>
                          ✓ Terminé ({entry.finishedAt || ''})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Patient name & details */}
                  <div>
                    <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1rem' }}>
                      {entry.patientName}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '3px' }}>
                      Motif : <strong style={{ color: '#cbd5e1' }}>{entry.motif}</strong>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {entry.caisse && <span>🏛️ {entry.caisse}</span>}
                      {entry.apci && <span style={{ color: '#facc15', fontWeight: 600 }}>★ APCI</span>}
                      {entry.telephone && (
                        <a href={`tel:${entry.telephone.replace(/\s+/g, '')}`} style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>
                          📞 {entry.telephone}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Bottom actions: large thumb-friendly buttons */}
                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }}>
                    {isWaiting && (
                      <button
                        onClick={() => {
                          handleStatusChange(entry.id, 'in_consultation');
                          if (onStartConsultation) onStartConsultation(entry);
                        }}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          color: '#fff',
                          border: 'none',
                          fontWeight: 600,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>🩺</span> Appeler en Consultation
                      </button>
                    )}

                    {isInConsult && (
                      <>
                        <button
                          onClick={() => {
                            if (onStartConsultation) onStartConsultation(entry);
                          }}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '8px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            border: '1px solid #38bdf8',
                            color: '#38bdf8',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                          }}
                        >
                          🩺 Ouvrir Examen
                        </button>
                        <button
                          onClick={() => handleStatusChange(entry.id, 'finished')}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '8px',
                            background: '#16a34a',
                            color: '#fff',
                            border: 'none',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                          }}
                        >
                          ✓ Clôturer
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleRemove(entry.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                        border: 'none',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      title="Retirer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Tableau Desktop pour ordinateurs */
        <div className="scroll-touch" style={{
          background: '#0f172a',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          overflowX: 'auto'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#1e293b', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, width: '70px' }}>Ordre</th>
                <th style={{ padding: '14px 20px', fontWeight: 600 }}>Heure d'arrivée</th>
                <th style={{ padding: '14px 20px', fontWeight: 600 }}>Patient</th>
                <th style={{ padding: '14px 20px', fontWeight: 600 }}>Motif de visite</th>
                <th style={{ padding: '14px 20px', fontWeight: 600 }}>Régime CNAM</th>
                <th style={{ padding: '14px 20px', fontWeight: 600 }}>Statut</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600 }}>Action Médecin</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    Chargement de la file d'attente...
                  </td>
                </tr>
              ) : waitingList.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>☕</div>
                    La salle d'attente est actuellement vide. Enregistrez les arrivées des patients au fur et à mesure.
                  </td>
                </tr>
              ) : (
                waitingList.map((entry) => {
                  const isWaiting = entry.status === 'waiting';
                  const isInConsult = entry.status === 'in_consultation';
                  const isFinished = entry.status === 'finished';

                  return (
                    <tr
                      key={entry.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        background: isInConsult ? 'rgba(56, 189, 248, 0.08)' : entry.isUrgent ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                    >
                      {/* Numéro d'ordre */}
                      <td style={{ padding: '14px 20px', fontWeight: 700, color: entry.isUrgent ? '#ef4444' : '#38bdf8' }}>
                        #{entry.order}
                        {entry.isUrgent && <span style={{ display: 'block', fontSize: '0.65rem', color: '#ef4444', textTransform: 'uppercase' }}>URGENCE</span>}
                      </td>

                      {/* Heure */}
                      <td style={{ padding: '14px 20px', color: '#cbd5e1' }}>
                        <span style={{ fontWeight: 600 }}>{entry.arrivalTime}</span>
                        {entry.consultAt && <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8' }}>Appel: {entry.consultAt}</span>}
                      </td>

                      {/* Nom Patient */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{entry.patientName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Fiche : {entry.numfch || '-'} • Tél : {entry.telephone || '-'}</div>
                      </td>

                      {/* Motif */}
                      <td style={{ padding: '14px 20px', color: '#cbd5e1' }}>
                        {entry.motif}
                      </td>

                      {/* CNAM / APCI */}
                      <td style={{ padding: '14px 20px' }}>
                        {entry.caisse ? (
                          <div>
                            <span style={{ fontSize: '0.8rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                              {entry.caisse}
                            </span>
                            {entry.apci && (
                              <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: '#facc15', background: 'rgba(234, 179, 8, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                                APCI
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Sans Caisse</span>
                        )}
                      </td>

                      {/* Statut Badge */}
                      <td style={{ padding: '14px 20px' }}>
                        {isWaiting && (
                          <span style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500 }}>
                            ⏳ En attente
                          </span>
                        )}
                        {isInConsult && (
                          <span style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
                            🩺 En Consultation
                          </span>
                        )}
                        {isFinished && (
                          <span style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500 }}>
                            ✓ Terminé ({entry.finishedAt || ''})
                          </span>
                        )}
                      </td>

                      {/* Actions Médecin */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          {isWaiting && (
                            <>
                              <button
                                onClick={() => {
                                  handleStatusChange(entry.id, 'in_consultation');
                                  if (onStartConsultation) onStartConsultation(entry);
                                }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  background: '#0284c7',
                                  color: '#fff',
                                  border: 'none',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                🔔 Consulter
                              </button>
                            </>
                          )}

                          {isInConsult && (
                            <>
                              <button
                                onClick={() => {
                                  if (onStartConsultation) onStartConsultation(entry);
                                }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  background: 'rgba(56, 189, 248, 0.15)',
                                  color: '#38bdf8',
                                  border: '1px solid rgba(56, 189, 248, 0.4)',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                🩺 Ouvrir Examen
                              </button>
                              <button
                                onClick={() => handleStatusChange(entry.id, 'finished')}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  background: '#16a34a',
                                  color: '#fff',
                                  border: 'none',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                ✓ Clôturer
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => handleRemove(entry.id)}
                            title="Retirer"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              border: 'none',
                              fontSize: '0.8rem',
                              cursor: 'pointer'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal d'ajout en salle d'attente */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10, 15, 29, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '12px'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            width: '100%',
            maxWidth: '550px',
            maxHeight: 'calc(100dvh - 24px)',
            display: 'flex',
            flexDirection: 'column',
            background: '#0f172a',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(30, 41, 59, 0.6)',
              flexShrink: 0
            }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#38bdf8', fontWeight: 600 }}>
                + Enregistrer une Arrivée en Salle d'Attente
              </h2>
              <button 
                type="button" 
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddSubmit} style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    Rechercher & Sélectionner le Patient *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      onNewPatient();
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#38bdf8',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    + Créer une nouvelle fiche
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Tapez pour filtrer la liste..."
                  value={searchPatient}
                  onChange={(e) => setSearchPatient(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#fff',
                    marginBottom: '8px',
                    fontSize: '0.85rem'
                  }}
                />
                <select
                  required
                  size={5}
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  style={{
                    width: '100%',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #38bdf8',
                    color: '#fff',
                    padding: '6px'
                  }}
                >
                  {filteredPatients.map(p => (
                    <option key={p.id} value={p.id} style={{ padding: '6px 8px' }}>
                      {p.nom} {p.prenom} {p.telephone ? `(${p.telephone})` : ''} {p.cin ? `[CIN: ${p.cin}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Motif de la visite
                </label>
                <input
                  type="text"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder="Ex: Consultation générale, Renouvellement, Fièvre..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#fff'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
                <input
                  type="checkbox"
                  id="isUrgent"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="isUrgent" style={{ color: '#f87171', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
                  🚨 Marquer comme Urgence Médicale (Prioritaire)
                </label>
              </div>

              <div style={{
                position: 'sticky',
                bottom: 0,
                background: '#0f172a',
                zIndex: 10,
                marginTop: 'auto',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                paddingTop: '14px',
                paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.4)'
              }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
                    color: '#fff',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
                  }}
                >
                  Valider l'Arrivée
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
