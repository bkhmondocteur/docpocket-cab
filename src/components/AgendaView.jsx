import React, { useState, useEffect } from 'react';
import { 
  getAppointments, 
  saveAppointment, 
  deleteAppointment, 
  getAllPatients,
  addToWaitingRoom 
} from '../services/patientStorage';
import { 
  transmitAppointmentToMobile, 
  testGatewayConnection,
  getGatewayUrl,
  setGatewayUrl
} from '../services/smsGatewayService';
import { 
  isSmsRdvActivated, 
  getSmsLicenseStatus 
} from '../services/smsLicenseService';

export default function AgendaView({ 
  onNewPatient,
  initialPatient = null,
  returnToConsultation = false,
  onReturnToConsultation = null,
  onNavigateToSms = null
}) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchPatient, setSearchPatient] = useState('');
  const [formData, setFormData] = useState({
    id: null,
    patientId: '',
    patientName: '',
    rdvDate: selectedDate,
    rdvTime: '09:00',
    object: 'Consultation',
    notes: ''
  });
  const [loading, setLoading] = useState(true);
  const [gatewayOnline, setGatewayOnline] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [gatewayUrlInput, setGatewayUrlInput] = useState(getGatewayUrl());
  const [sendSmsReminder, setSendSmsReminder] = useState(true);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [smsActive, setSmsActive] = useState(() => isSmsRdvActivated());
  const [smsLicenseInfo, setSmsLicenseInfo] = useState(() => getSmsLicenseStatus());

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const checkGateway = async () => {
    const online = await testGatewayConnection();
    setGatewayOnline(online);
  };

  useEffect(() => {
    checkGateway();
    const interval = setInterval(checkGateway, 15000);

    const handleSmsLicenseChange = () => {
      setSmsActive(isSmsRdvActivated());
      setSmsLicenseInfo(getSmsLicenseStatus());
    };
    window.addEventListener('docpocket_sms_license_changed', handleSmsLicenseChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('docpocket_sms_license_changed', handleSmsLicenseChange);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [appts, pList] = await Promise.all([
        getAppointments(selectedDate),
        getAllPatients()
      ]);
      setAppointments(appts);
      setPatients(pList);
    } catch (err) {
      console.error('Erreur chargement agenda:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  useEffect(() => {
    if (initialPatient) {
      const pName = initialPatient.fullname || `${initialPatient.nom || ''} ${initialPatient.prenom || ''}`.trim() || 'Patient';
      setFormData({
        id: null,
        patientId: String(initialPatient.id || initialPatient.numfch || 'current'),
        patientName: pName,
        rdvDate: selectedDate,
        rdvTime: '09:30',
        object: 'Consultation de suivi',
        notes: ''
      });
      setSearchPatient('');
      setShowModal(true);
    }
  }, [initialPatient]);

  const handleOpenAdd = () => {
    setFormData({
      id: null,
      patientId: '',
      patientName: '',
      rdvDate: selectedDate,
      rdvTime: '09:30',
      object: 'Consultation de suivi',
      notes: ''
    });
    setSearchPatient('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.patientId) {
      alert('Veuillez sélectionner un patient pour ce rendez-vous.');
      return;
    }

    try {
      const patient = initialPatient || patients.find(p => String(p.id) === String(formData.patientId));
      const patientName = formData.patientName || (patient ? (patient.fullname || `${patient.nom} ${patient.prenom}`) : 'Patient');
      const savedData = {
        ...formData,
        patientName: patientName,
        telephone: patient?.telephone || initialPatient?.telephone || '',
        email: patient?.email || initialPatient?.email || '',
        sendSmsReminder: sendSmsReminder
      };

      await saveAppointment(savedData);

      // Si la date du rendez-vous est différente de la date visualisée, basculer sur la date du rendez-vous
      if (formData.rdvDate !== selectedDate) {
        setSelectedDate(formData.rdvDate);
      }

      // Transmission automatique conditionnelle :
      // 1. Si DocPocket SMS RDV est ACTIVÉ : transmission automatique vers DocPocket SMS RDV
      // 2. Si DocPocket SMS RDV n'est PAS ACTIVÉ : le RDV reste dans DocPocket Cab uniquement (aucun envoi externe)
      const isSmsActivatedNow = isSmsRdvActivated();
      if (isSmsActivatedNow && sendSmsReminder) {
        transmitAppointmentToMobile(savedData)
          .then(res => {
            if (res && res.success) {
              console.log("✓ RDV transmis automatiquement à DocPocket SMS RDV");
            }
          })
          .catch(err => console.warn("Erreur transmission DocPocket SMS RDV:", err));
      } else if (!isSmsActivatedNow) {
        console.info("ℹ️ DocPocket SMS RDV non activé : rendez-vous conservé dans DocPocket Cab uniquement.");
      }

      setShowModal(false);
      await loadData();

      if (returnToConsultation && onReturnToConsultation) {
        if (window.confirm("✓ Rendez-vous planifié avec succès !\n\nSouhaitez-vous retourner directement à la consultation en cours ?")) {
          onReturnToConsultation();
        }
      }
    } catch (err) {
      alert("Erreur lors de l'enregistrement du rendez-vous : " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Annuler ce rendez-vous ?")) {
      try {
        await deleteAppointment(id);
        await loadData();
      } catch (err) {
        alert("Erreur annulation : " + err.message);
      }
    }
  };

  // Transférer directement un patient RDV vers la salle d'attente à son arrivée
  const handleCheckInToWaitingRoom = async (appt) => {
    const patient = patients.find(p => p.id === Number(appt.patientId));
    if (!patient) return;

    try {
      await addToWaitingRoom(patient, `RDV ${appt.rdvTime} - ${appt.object}`);
      alert(`✓ ${patient.nom} ${patient.prenom} a été enregistré en salle d'attente !`);
    } catch (err) {
      alert("Erreur transfert salle d'attente : " + err.message);
    }
  };

  const filteredPatients = patients.filter(p => {
    if (!searchPatient) return true;
    const term = searchPatient.toLowerCase().trim();
    const fullName1 = `${p.nom || ''} ${p.prenom || ''}`.toLowerCase();
    const fullName2 = `${p.prenom || ''} ${p.nom || ''}`.toLowerCase();
    const phone = String(p.telephone || '');
    const num = String(p.numfch || p.id || '');
    return fullName1.includes(term) || fullName2.includes(term) || phone.includes(term) || num.includes(term);
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Barre supérieure adaptative */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', color: '#f8fafc', fontWeight: 600 }}>
              📅 Agenda & Rendez-Vous
            </h1>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Planification des consultations du cabinet
            </span>
          </div>

          {/* Sélecteur de date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Date :</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                background: '#0f172a',
                border: '1px solid #38bdf8',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.9rem'
              }}
            />
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              style={{
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Aujourd'hui
            </button>
          </div>

          {/* Indicateur de statut de connexion Smartphone / SMS */}
          <div 
            onClick={() => {
              if (!smsActive && onNavigateToSms) {
                onNavigateToSms();
              } else {
                setShowSettingsModal(true);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: !smsActive 
                ? 'rgba(245, 158, 11, 0.12)' 
                : (gatewayOnline ? 'rgba(34, 197, 94, 0.12)' : 'rgba(56, 189, 248, 0.12)'),
              border: `1px solid ${!smsActive ? 'rgba(245, 158, 11, 0.35)' : (gatewayOnline ? 'rgba(34, 197, 94, 0.3)' : 'rgba(56, 189, 248, 0.3)')}`,
              color: !smsActive ? '#fbbf24' : (gatewayOnline ? '#4ade80' : '#38bdf8'),
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
            title={!smsActive ? "DocPocket SMS RDV non activé - Cliquez pour activer la licence" : "Liaison DocPocket SMS RDV"}
          >
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              background: !smsActive ? '#f59e0b' : (gatewayOnline ? '#22c55e' : '#38bdf8') 
            }}></span>
            <span>
              {!smsActive 
                ? '🔒 DocPocket SMS RDV : Non activé' 
                : `📱 SMS RDV : ${gatewayOnline ? 'Passerelle Connectée' : 'Prête'}`}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{!smsActive ? '🔑' : '⚙️'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          {returnToConsultation && onReturnToConsultation && (
            <button
              type="button"
              onClick={onReturnToConsultation}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)'
              }}
              title="Retourner immédiatement à la consultation en cours"
            >
              <span>↩️</span> Retour à la Consultation
            </button>
          )}

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
            onClick={handleOpenAdd}
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
            <span>+</span> RDV
          </button>
        </div>
      </div>

      {/* Affichage adaptatif Smartphone vs Ordinateur */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', background: '#0f172a', borderRadius: '12px' }}>
              Chargement des rendez-vous...
            </div>
          ) : appointments.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', background: '#0f172a', borderRadius: '12px', border: '1px dashed rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📆</div>
              <strong style={{ color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Aucun RDV pour le {selectedDate}</strong>
              Planifiez un rendez-vous avec le bouton <strong>+ RDV</strong> ci-dessus.
            </div>
          ) : (
            appointments.map((a) => (
              <div
                key={a.id}
                style={{
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(56, 189, 248, 0.3)'
                  }}>
                    ⏰ {a.rdvTime}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {a.object}
                  </span>
                </div>

                <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1rem', marginTop: '2px' }}>
                  {a.patientName}
                </div>

                {a.notes && (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', background: 'rgba(255, 255, 255, 0.03)', padding: '6px 10px', borderRadius: '6px' }}>
                    📝 {a.notes}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px', marginTop: '4px' }}>
                  <button
                    onClick={() => handleCheckInToWaitingRoom(a)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    ⏱️ Transférer en Attente
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#f87171',
                      border: 'none',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    title="Supprimer ce rendez-vous"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Liste des rendez-vous avec défilement tactile */
        <div className="scroll-touch" style={{
          background: '#0f172a',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          overflowX: 'auto'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#1e293b', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, width: '100px' }}>Heure</th>
                <th style={{ padding: '14px 20px', fontWeight: 600 }}>Patient</th>
                <th style={{ padding: '14px 20px', fontWeight: 600 }}>Objet</th>
                <th style={{ padding: '14px 20px', fontWeight: 600 }}>Notes / Instructions</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    Chargement des rendez-vous...
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📆</div>
                    Aucun rendez-vous planifié pour le {selectedDate}.
                  </td>
                </tr>
              ) : (
                appointments.map((a) => (
                  <tr
                    key={a.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.2s'
                    }}
                  >
                    <td style={{ padding: '14px 20px', fontWeight: 700, color: '#38bdf8' }}>
                      ⏰ {a.rdvTime}
                    </td>
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: '#f8fafc' }}>
                      {a.patientName}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#cbd5e1' }}>
                      {a.object}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#94a3b8', fontStyle: 'italic' }}>
                      {a.notes || '-'}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          onClick={() => handleCheckInToWaitingRoom(a)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          ⏱️ Transférer en Attente
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Ajout Rendez-vous */}
      {showModal && (
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
            maxWidth: '520px',
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
                + Nouveau Rendez-vous
              </h2>
              <button 
                type="button" 
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch'
            }}>
              {/* Sélection du patient : Automatique si venant de la consultation, sinon sélection manuelle */}
              {initialPatient ? (
                <div style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'rgba(56, 189, 248, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem'
                    }}>
                      👤
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                        Patient en Consultation :
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                        {initialPatient.fullname || `${initialPatient.nom || ''} ${initialPatient.prenom || ''}`.trim()}
                      </div>
                      {initialPatient.telephone && (
                        <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginTop: '2px' }}>
                          📞 {initialPatient.telephone}
                        </div>
                      )}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.78rem',
                    background: '#0284c7',
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontWeight: 600
                  }}>
                    Fiche n° {initialPatient.numfch || initialPatient.id}
                  </span>
                </div>
              ) : (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                      Patient concerné <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
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
                      + Nouveau patient
                    </button>
                  </div>

                  {formData.patientId && formData.patientName ? (
                    <div style={{
                      background: '#0f172a',
                      border: '1px solid #059669',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#4ade80' }}>✓</span>
                        <strong style={{ color: '#f8fafc', fontSize: '0.95rem' }}>{formData.patientName}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, patientId: '', patientName: '' }))}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        Changer
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        placeholder="Rechercher par nom, prénom, téléphone..."
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
                      <div style={{
                        maxHeight: '140px',
                        overflowY: 'auto',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        background: '#0f172a'
                      }}>
                        {filteredPatients.length === 0 ? (
                          <div style={{ padding: '10px', fontSize: '0.82rem', color: '#94a3b8', textAlign: 'center' }}>
                            Aucun patient correspondant.
                          </div>
                        ) : (
                          filteredPatients.map(p => (
                            <div
                              key={p.id}
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  patientId: String(p.id),
                                  patientName: p.fullname || `${p.nom} ${p.prenom}`
                                }));
                              }}
                              style={{
                                padding: '8px 12px',
                                borderBottom: '1px solid #1e293b',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                color: '#e2e8f0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#1e293b'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <span><strong>{p.nom}</strong> {p.prenom}</span>
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                {p.telephone ? `📞 ${p.telephone}` : (p.numfch ? `N° ${p.numfch}` : '')}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Date</label>
                  <input
                    type="date"
                    required
                    value={formData.rdvDate}
                    onChange={(e) => setFormData({ ...formData, rdvDate: e.target.value })}
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
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Heure</label>
                  <input
                    type="time"
                    required
                    value={formData.rdvTime}
                    onChange={(e) => setFormData({ ...formData, rdvTime: e.target.value })}
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
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Objet du rendez-vous</label>
                <input
                  type="text"
                  value={formData.object}
                  onChange={(e) => setFormData({ ...formData, object: e.target.value })}
                  placeholder="Ex: Suivi APCI, Échographie, Contrôle..."
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

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Notes</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Instructions particulières..."
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

              {/* Passerelle DocPocket SMS RDV : Statut d'activation et transmission */}
              {smsActive ? (
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        id="sendSmsReminder"
                        checked={sendSmsReminder}
                        onChange={(e) => setSendSmsReminder(e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#22c55e' }}
                      />
                      <label htmlFor="sendSmsReminder" style={{ color: '#4ade80', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}>
                        📱 Transmettre automatiquement à DocPocket SMS RDV (Rappels 48h)
                      </label>
                    </div>
                    <span style={{ fontSize: '0.7rem', background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                      ✓ SMS RDV Activé
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8', paddingLeft: '28px' }}>
                    Le rendez-vous sera transmis automatiquement à la passerelle DocPocket SMS RDV pour le smartphone.
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontWeight: 700, fontSize: '0.86rem' }}>
                      <span>🔒</span>
                      <span>DocPocket SMS RDV : Non activé</span>
                    </div>
                    {onNavigateToSms && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowModal(false);
                          onNavigateToSms();
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          color: '#000',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)'
                        }}
                      >
                        ⚡ Activer dans Outils
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                    Ce rendez-vous restera conservé dans <strong>DocPocket Cab uniquement</strong>. La passerelle et la transmission vers le smartphone sont inactives tant que la clé de licence DocPocket SMS RDV n'est pas activée.
                  </div>
                </div>
              )}

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
                  onClick={() => setShowModal(false)}
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
                  Planifier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Configuration Passerelle Smartphone */}
      {showSettingsModal && (
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
            maxWidth: '520px',
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
                📱 Configuration Passerelle DocPocket SMS RDV
              </h2>
              <button 
                type="button" 
                onClick={() => setShowSettingsModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch'
            }}>
              <div style={{
                padding: '14px',
                borderRadius: '8px',
                background: gatewayOnline ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${gatewayOnline ? '#22c55e' : '#ef4444'}`,
                color: '#fff',
                fontSize: '0.85rem'
              }}>
                <div style={{ fontWeight: 600, color: gatewayOnline ? '#4ade80' : '#f87171', marginBottom: '4px' }}>
                  Statut : {gatewayOnline ? '✓ Passerelle connectée et active' : '⚠️ Serveur passerelle local non détecté'}
                </div>
                {gatewayOnline 
                  ? "Votre smartphone et l'application DocPocket SMS RDV recevront les dates et heures automatiquement en Wi-Fi."
                  : "Assurez-vous que le serveur local DocPocket SMS RDV (port 3000) est bien lancé sur votre PC."}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Adresse URL de l'API Passerelle SMS
                </label>
                <input
                  type="text"
                  value={gatewayUrlInput}
                  onChange={(e) => setGatewayUrlInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    setGatewayUrl(gatewayUrlInput);
                    await checkGateway();
                    setShowSettingsModal(false);
                  }}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    background: '#0284c7',
                    color: '#fff',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Enregistrer & Tester
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
