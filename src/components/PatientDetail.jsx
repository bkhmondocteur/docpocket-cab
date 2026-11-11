import React, { useState, useEffect } from 'react';
import { getConsultationsByPatient, getPrescriptionsByPatient, getInvoicesByPatient, deleteInvoiceById } from '../services/patientStorage';
import { generateConsultationReport } from '../services/reportGenerator';
import { generatePrescriptionReport } from '../services/prescriptionReportGenerator';
import { generateReceiptReport } from '../services/receiptReportGenerator';
import DeleteConsultationModal from './DeleteConsultationModal';
import {
  getAllPractitioners,
  getActivePractitioner,
  copyPatientFromColleague,
  formatDoctorDisplayName
} from '../services/practitionerService';

export default function PatientDetail({ 
  patient, 
  onBack, 
  onEdit, 
  onDelete, 
  onAddToWaitingRoom,
  onNewConsultation,
  onOpenConsultation,
  onNewPrescription,
  onNewInvoice,
  onMerge,
  onOpenDirectory
}) {
  if (!patient) return null;

  const [consultations, setConsultations] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loadingConsults, setLoadingConsults] = useState(true);
  const [showColleagueModal, setShowColleagueModal] = useState(false);
  const [consultationToDelete, setConsultationToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoadingConsults(true);
        const [cList, pList, iList] = await Promise.all([
          getConsultationsByPatient(patient.id),
          getPrescriptionsByPatient(patient.id),
          getInvoicesByPatient(patient.id)
        ]);
        setConsultations(cList);
        setPrescriptions(pList);
        setInvoices(iList);
      } catch (e) {
        console.error("Erreur historique consultations/ordonnances/factures patient:", e);
      } finally {
        setLoadingConsults(false);
      }
    };
    fetchHistory();
  }, [patient.id]);

  const calculateAge = (birthdate) => {
    if (!birthdate) return null;
    let birth;
    if (typeof birthdate === 'string' && birthdate.includes('/')) {
      const parts = birthdate.split('/');
      if (parts.length === 3) {
        birth = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }
    if (!birth || isNaN(birth.getTime())) {
      birth = new Date(birthdate);
    }
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  };

  const formatBirthdateDisplay = (val) => {
    if (!val) return 'Non renseignée';
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split('-');
      return `${d}/${m}/${y}`;
    }
    return val;
  };

  const handleDeletePayment = async (inv) => {
    const num = inv.numFacture || `FAC-${inv.id}`;
    const mtt = (inv.totalGlobal || 0).toFixed(3);
    if (window.confirm(`Êtes-vous certain de vouloir supprimer le paiement N° ${num} (${mtt} DT) ?`)) {
      try {
        await deleteInvoiceById(inv.id);
        setInvoices(prev => prev.filter(i => i.id !== inv.id));
        alert(`✓ Le paiement N° ${num} a été supprimé avec succès.`);
      } catch (err) {
        alert("Erreur lors de la suppression du paiement : " + err.message);
      }
    }
  };

  const age = calculateAge(patient.birthdate);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Barre d'actions supérieure adaptative */}
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
          <button
            onClick={onBack}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#38bdf8',
              cursor: 'pointer',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ← Retour à la liste
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', color: '#f8fafc', fontWeight: 600 }}>
              {(patient.civility && !/mari|celib|veuf|divorc/i.test(patient.civility))
                ? patient.civility 
                : (patient.gender === 'F' ? ((patient.etat_civil === 'Célibataire' || /celib/i.test(patient.civility || '')) ? 'Mlle' : 'Mme') : 'M.')
              } {patient.nom.toUpperCase()} {patient.prenom}
            </h1>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Fiche N° <strong>{patient.numfch || 'Non assigné'}</strong> • {age !== null ? `${age} ans` : 'Âge inconnu'} ({patient.gender === 'F' ? 'Femme' : 'Homme'}) • 💍 <strong style={{ color: '#38bdf8' }}>{patient.etat_civil || (/mari/i.test(patient.civility || '') ? 'Marié(e)' : 'Célibataire')}</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {/* BOUTON CLÉ : NOUVELLE CONSULTATION */}
          <button
            onClick={() => onNewConsultation && onNewConsultation(patient)}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)'
            }}
          >
            <span>🩺</span> Nouvelle Consultation
          </button>

          {onAddToWaitingRoom && (
            <button
              onClick={() => onAddToWaitingRoom(patient)}
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ⏱️ Attente
            </button>
          )}

          {onMerge && (
            <button
              onClick={() => onMerge(patient)}
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Fusionner ce dossier avec un autre dossier patient existant"
            >
              🔀 Fusionner
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const allDocs = getAllPractitioners();
              const colleagues = allDocs.filter(d => d.id !== getActivePractitioner().id);
              if (colleagues.length === 0) {
                alert("ℹ️ Aucun confrère n'est encore enregistré dans le cabinet.\nVous pouvez en ajouter dans le menu Paramètres > Équipe & Praticiens ou via l'icône médecin dans la barre supérieure.");
                return;
              }
              setShowColleagueModal(true);
            }}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              background: 'rgba(5, 150, 105, 0.15)',
              border: '1px solid rgba(5, 150, 105, 0.4)',
              color: '#34d399',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Copier la fiche administrative de ce patient vers la base d'un confrère du cabinet"
          >
            👥 Copier vers Confrère
          </button>

          {onOpenDirectory && (
            <button
              type="button"
              onClick={() => onOpenDirectory(patient)}
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                background: 'rgba(2, 132, 199, 0.15)',
                border: '1px solid rgba(2, 132, 199, 0.4)',
                color: '#38bdf8',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Adresser ce patient à un confrère spécialiste via l'Annuaire Médical Partagé"
            >
              📄 Orienter (Annuaire)
            </button>
          )}

          <button
            onClick={() => onEdit(patient)}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            ✏️ Modifier
          </button>

          <button
            onClick={() => onDelete(patient.id)}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Cartouche d'alerte Allergie si existante */}
      {patient.allergies && patient.allergies.trim() !== '' && (
        <div style={{
          padding: '14px 20px',
          background: 'rgba(239, 68, 68, 0.12)',
          borderLeft: '5px solid #ef4444',
          borderRadius: '10px',
          color: '#fca5a5',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '1.4rem' }}>⚠️</span>
          <div>
            <strong style={{ color: '#fff', fontSize: '0.95rem' }}>Alerte Médicale - Allergie signalée :</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.9rem' }}>{patient.allergies}</p>
          </div>
        </div>
      )}

      {/* Grille d'informations démographiques & CNAM adaptative */}
      <div className="responsive-grid-2" style={{ gap: '20px' }}>
        {/* Colonne 1 : Coordonnées & Identification */}
        <div style={{
          background: '#0f172a',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', color: '#38bdf8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
            👤 Informations Civiles & Contact
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8' }}>Téléphone :</span>
              {patient.telephone ? (
                <a
                  href={`tel:${patient.telephone.replace(/\s+/g, '')}`}
                  style={{
                    color: '#38bdf8',
                    textDecoration: 'none',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'rgba(56, 189, 248, 0.1)'
                  }}
                  title="Cliquer pour composer le numéro sur smartphone ou ordinateur"
                >
                  📞 {patient.telephone}
                </a>
              ) : (
                <span style={{ color: '#64748b' }}>Non renseigné</span>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Date de naissance :</span>
              <span style={{ color: '#f1f5f9' }}>{formatBirthdateDisplay(patient.birthdate)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>💍 État Civil :</span>
              <strong style={{ color: '#38bdf8' }}>{patient.etat_civil || (/mari/i.test(patient.civility || '') ? 'Marié(e)' : 'Célibataire')}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>🪪 N° CIN :</span>
              <span style={{ color: '#f1f5f9' }}>
                {patient.cin || 'Non renseigné'}
                {patient.cin_date && (
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginLeft: '6px' }}>
                    (délivrée le {formatBirthdateDisplay(patient.cin_date)})
                  </span>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Ville :</span>
              <span style={{ color: '#f1f5f9' }}>{patient.city || 'Non renseignée'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Adresse :</span>
              <span style={{ color: '#f1f5f9', textAlign: 'right', maxWidth: '60%' }}>{patient.adress || 'Non renseignée'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '10px' }}>
              <span style={{ color: '#94a3b8' }}>Dernière consultation :</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>{patient.derniere_visite || 'Première visite'}</span>
            </div>
          </div>
        </div>

        {/* Colonne 2 : Couverture Sociale & CNAM */}
        <div style={{
          background: '#0f172a',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', color: '#38bdf8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
            🏥 Sécurité Sociale (CNAM)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Identifiant Unique CNAM :</span>
              <strong style={{ color: '#38bdf8', letterSpacing: '0.5px' }}>{patient.cnamid || 'Sans matricule'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Caisse d'Affiliation :</span>
              <span style={{ color: '#f1f5f9' }}>{patient.caisse || 'Non renseignée'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Qualité de l'assuré :</span>
              <span style={{ color: '#f1f5f9' }}>{patient.quality || 'Assuré(e)'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Filière de Soins :</span>
              <span style={{ color: '#f1f5f9' }}>{patient.filiere || 'Privée'}</span>
            </div>
            
            <div style={{ marginTop: '6px', padding: '12px', background: patient.apci ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>Statut Prise en Charge Intégrale (APCI) :</div>
              {patient.apci ? (
                <div style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.85rem' }}>
                  ✓ {patient.apciLabel || `APCI Code ${patient.apci}`}
                </div>
              ) : (
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  Aucune APCI enregistrée pour ce patient.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Antécédents Médicaux Complets */}
      <div style={{
        background: '#0f172a',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', color: '#38bdf8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
          📋 Historique Médical & Antécédents
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div style={{ background: '#1e293b', padding: '14px', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Médicaux :</span>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
              {patient.atcd_medicaux || 'Néant.'}
            </p>
          </div>
          <div style={{ background: '#1e293b', padding: '14px', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Chirurgicaux :</span>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
              {patient.atcd_chirurgicaux || 'Néant.'}
            </p>
          </div>
          <div style={{ background: '#1e293b', padding: '14px', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Familiaux :</span>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
              {patient.atcd_familiaux || 'Néant.'}
            </p>
          </div>
        </div>
      </div>

      {/* HISTORIQUE DE TOUTES LES CONSULTATIONS ANCIENNES DU PATIENT AVEC BOUTON D'OUVERTURE */}
      <div style={{
        background: '#0f172a',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#38bdf8' }}>
            🩺 Consultations Antérieures Enregistrées ({consultations.length})
          </h3>
          <button
            onClick={() => onNewConsultation && onNewConsultation(patient)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            + Nouvelle Consultation
          </button>
        </div>

        {loadingConsults ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
            Chargement de l'historique des consultations...
          </div>
        ) : consultations.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
            Aucune consultation enregistrée pour ce patient pour le moment.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {consultations.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#1e293b',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  borderLeft: '4px solid #38bdf8',
                  transition: 'background 0.2s'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <strong style={{ color: '#38bdf8', fontSize: '0.95rem' }}>📅 {c.date} ({c.heure || ''})</strong>
                    <span style={{ color: '#cbd5e1', fontWeight: 600 }}>• {c.motif}</span>
                  </div>

                  <div style={{ color: '#f8fafc', fontSize: '0.9rem', marginBottom: '4px' }}>
                    <strong>Diagnostic :</strong> {c.diagnostic || 'Non spécifié'}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: '#94a3b8' }}>
                    {c.taMax && <span>TA: <strong style={{ color: '#fff' }}>{c.taMax}/{c.taMin}</strong></span>}
                    {c.poids && <span>Poids: <strong style={{ color: '#fff' }}>{c.poids} kg</strong></span>}
                    {c.bmi && <span>IMC: <strong style={{ color: '#fff' }}>{c.bmi}</strong></span>}
                    {c.temperature && <span>T°: <strong style={{ color: '#fff' }}>{c.temperature}°C</strong></span>}
                    {c.reposJours > 0 && <span style={{ color: '#facc15' }}>🛌 Repos: {c.reposJours} j</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => generateConsultationReport(patient, c)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: '#34d399',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Générer, imprimer ou exporter en PDF ce résumé de consultation"
                  >
                    📄 Résumé PDF
                  </button>

                  <button
                    onClick={() => onOpenConsultation && onOpenConsultation(patient, c)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      color: '#38bdf8',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    📂 Consulter / Réviser
                  </button>

                  <button
                    onClick={() => {
                      setConsultationToDelete(c);
                      setIsDeleteModalOpen(true);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      color: '#f87171',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Supprimer définitivement cette consultation avec confirmation par code PIN"
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HISTORIQUE DES ORDONNANCES MÉDICALES DÉLIVRÉES AU PATIENT (AVICENNA) */}
      <div style={{
        background: '#0f172a',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#38bdf8' }}>
              💊 Ordonnances Médicales Délivrées ({prescriptions.length})
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Les nouvelles ordonnances sont rédigées et associées directement au cours de la consultation médicale.
            </span>
          </div>
          <button
            onClick={() => onNewConsultation && onNewConsultation(patient)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              background: 'rgba(5, 150, 105, 0.15)',
              border: '1px solid rgba(5, 150, 105, 0.4)',
              color: '#34d399',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Démarrer une consultation pour prescrire une ordonnance"
          >
            <span>🩺</span> Nouvelle Consultation
          </button>
        </div>

        {loadingConsults ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
            Chargement des ordonnances...
          </div>
        ) : prescriptions.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
            Aucune ordonnance archivée pour ce patient.<br />
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Pour rédiger une ordonnance, démarrez une consultation médicale afin d'y rattacher le diagnostic et le traitement.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {prescriptions.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#1e293b',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  borderLeft: `4px solid ${p.type === 'apci' ? '#d97706' : p.type === 'biologie' ? '#059669' : '#0284c7'}`
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <strong style={{ color: '#fff', fontSize: '0.95rem' }}>📅 {p.date}</strong>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 600,
                      background: p.type === 'apci' ? 'rgba(217, 119, 6, 0.2)' : 'rgba(2, 132, 199, 0.2)',
                      color: p.type === 'apci' ? '#fbbf24' : '#38bdf8'
                    }}>
                      {p.type === 'apci' ? 'Ordonnance APCI' : p.type === 'biologie' ? 'Bilan Bio' : p.type === 'imagerie' ? 'Imagerie' : 'Standard'}
                    </span>
                    {p.indication && (
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>• {p.indication}</span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                    {(p.items || []).map((it, idx) => (
                      <span key={idx} style={{ marginRight: '10px' }}>
                        <strong>{idx + 1}.</strong> {it.nom} {it.posologie ? `(${it.posologie})` : ''}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => generatePrescriptionReport(patient, p)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: '#34d399',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Générer, réimprimer ou sauvegarder le document d'ordonnance PDF"
                  >
                    📄 Imprimer / PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HISTORIQUE DES FACTURES & QUITTANCES CNAM DU PATIENT */}
      <div style={{
        background: '#0f172a',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#38bdf8' }}>
              💳 Quittances d'Honoraires & Facturation ({invoices.length})
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              La facturation et les quittances d'honoraires s'effectuent directement lors de la consultation.
            </span>
          </div>
          <button
            onClick={() => onNewConsultation && onNewConsultation(patient)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              background: 'rgba(124, 58, 237, 0.15)',
              border: '1px solid rgba(124, 58, 237, 0.4)',
              color: '#c084fc',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Démarrer une consultation pour facturer"
          >
            <span>🩺</span> Nouvelle Consultation
          </button>
        </div>

        {loadingConsults ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
            Chargement des factures...
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
            Aucun règlement enregistré pour ce patient.<br />
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Les quittances d'honoraires et actes CNAM sont saisis au cours de la consultation médicale.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {invoices.map((inv) => (
              <div
                key={inv.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#1e293b',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  borderLeft: `4px solid ${inv.modeReglement === 'cnam_apci' ? '#d97706' : inv.modeReglement === 'cnam_mo' ? '#059669' : '#0284c7'}`
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <strong style={{ color: '#fff', fontSize: '0.95rem' }}>📅 {inv.date}</strong>
                    <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>
                      N° {inv.numFacture || `FAC-${inv.id}`}
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: inv.modeReglement === 'cnam_apci' ? 'rgba(217, 119, 6, 0.2)' : inv.modeReglement === 'cnam_mo' ? 'rgba(5, 150, 105, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                      color: inv.modeReglement === 'cnam_apci' ? '#fbbf24' : inv.modeReglement === 'cnam_mo' ? '#34d399' : '#38bdf8',
                      fontWeight: 600
                    }}>
                      {inv.modeReglement === 'cnam_apci' ? '★ CNAM APCI (100%)' : inv.modeReglement === 'cnam_mo' ? '🏛️ CNAM MO' : '💵 Comptant'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                    Actes : <strong>{(inv.actes || []).map(a => a.nom).join(', ') || 'Consultation'}</strong>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                    Total : <strong>{(inv.totalGlobal || 0).toFixed(3)} DT</strong> | 
                    Part Patient : <strong style={{ color: '#4ade80' }}>{(inv.partPatient || 0).toFixed(3)} DT</strong> | 
                    Part CNAM : <strong style={{ color: '#38bdf8' }}>{(inv.partCnam || 0).toFixed(3)} DT</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => generateReceiptReport(patient, inv)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: 'rgba(2, 132, 199, 0.15)',
                      border: '1px solid rgba(2, 132, 199, 0.35)',
                      color: '#38bdf8',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Imprimer ou télécharger la quittance officielle"
                  >
                    🖨️ Quittance PDF
                  </button>

                  <button
                    onClick={() => handleDeletePayment(inv)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#f87171',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Supprimer définitivement ce paiement"
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Sélection Confrère pour Copie Dossier */}
      {showColleagueModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(5px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1.5px solid #059669',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#34d399', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>👥</span> Transmettre le Dossier à un Confrère
              </h3>
              <button
                type="button"
                onClick={() => setShowColleagueModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.45 }}>
              Sélectionnez le médecin associé auquel transmettre une copie administrative de la fiche de <strong style={{ color: '#fff' }}>{patient.nom} {patient.prenom}</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {getAllPractitioners()
                .filter(d => d.id !== getActivePractitioner().id)
                .map(colleague => (
                  <div
                    key={colleague.id}
                    onClick={async () => {
                      if (window.confirm(`Transférer une copie de la fiche administrative vers le cabinet du ${formatDoctorDisplayName(colleague)} ?\n\n(Vos consultations et quittances antérieures resteront strictement isolées dans votre session).`)) {
                        try {
                          const res = await copyPatientFromColleague(patient, colleague.id);
                          if (res.success) {
                            setShowColleagueModal(false);
                            alert(`✓ Fiche administrative transmise avec succès au ${formatDoctorDisplayName(colleague)} !`);
                          } else {
                            alert("Erreur de transmission : " + res.error);
                          }
                        } catch (err) {
                          alert("Erreur : " + err.message);
                        }
                      }
                    }}
                    style={{
                      background: '#0f172a',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #334155',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'border 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#10b981'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#334155'}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: colleague.color || '#059669',
                      color: '#fff',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.95rem',
                      flexShrink: 0
                    }}>
                      {((colleague.prenom || 'M')[0] + (colleague.nom || 'D')[0]).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
                        {formatDoctorDisplayName(colleague)}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                        {colleague.specialite || 'Médecine Générale'} • Code CNAM : {colleague.cnamId || '-'}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowColleagueModal(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  background: '#334155',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de suppression sécurisée d'une consultation par code PIN */}
      <DeleteConsultationModal
        isOpen={isDeleteModalOpen}
        consultation={consultationToDelete}
        patient={patient}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setConsultationToDelete(null);
        }}
        onDeleted={(deletedId) => {
          setConsultations(prev => prev.filter(c => c.id !== deletedId));
          setIsDeleteModalOpen(false);
          setConsultationToDelete(null);
        }}
      />
    </div>
  );
}
