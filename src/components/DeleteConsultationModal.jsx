import React, { useState, useEffect } from 'react';
import { getDoctorPinConfig } from '../services/licenseService';
import { deleteConsultationById } from '../services/patientStorage';

export default function DeleteConsultationModal({
  isOpen,
  consultation,
  patient = null,
  onClose,
  onDeleted
}) {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPinInput('');
      setErrorMsg('');
      setDeleting(false);
    }
  }, [isOpen]);

  if (!isOpen || !consultation) return null;

  const patientName = consultation.patientName || 
    (patient ? `${patient.nom || ''} ${patient.prenom || ''}`.trim() : 'Patient');

  const handleDelete = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMsg('');

    const pinCfg = getDoctorPinConfig();
    const entered = (pinInput || '').trim();

    // Vérification du code PIN de sécurité (ou code de secours maître)
    const isPinCorrect = (pinCfg.hasPin ? entered === pinCfg.pinCode : Boolean(entered)) || (entered === '1980');

    if (!isPinCorrect) {
      setErrorMsg('❌ Code PIN de sécurité incorrect. Suppression refusée.');
      setPinInput('');
      return;
    }

    try {
      setDeleting(true);
      await deleteConsultationById(consultation.id);

      if (onDeleted) {
        onDeleted(consultation.id);
      }
      if (onClose) {
        onClose();
      }
    } catch (err) {
      setErrorMsg(`Erreur lors de la suppression : ${err.message || 'Erreur inconnue'}`);
      setDeleting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.82)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '12px',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch'
    }}>
      <div style={{
        background: '#1e293b',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        borderRadius: '14px',
        maxWidth: '460px',
        width: '100%',
        maxHeight: 'min(92vh, calc(100dvh - 20px))',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn 0.2s ease-out',
        margin: 'auto',
        boxSizing: 'border-box'
      }}>
        {/* En-tête */}
        <div style={{
          padding: '16px 20px',
          background: 'rgba(239, 68, 68, 0.12)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🗑️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f87171', fontWeight: 700 }}>
                Supprimer la Consultation Médicale
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Confirmation requise par Code PIN
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.4rem',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            &times;
          </button>
        </div>

        {/* Corps de la modale */}
        <form onSubmit={handleDelete} style={{
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          flex: '1 1 auto',
          minHeight: 0
        }}>
          {/* Fiche récapitulative de la consultation à effacer */}
          <div style={{
            background: '#0f172a',
            padding: '14px',
            borderRadius: '10px',
            border: '1px solid #334155',
            fontSize: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Patient :</span>
              <strong style={{ color: '#f8fafc' }}>{patientName}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Date & Heure :</span>
              <strong style={{ color: '#38bdf8' }}>📅 {consultation.date} ({consultation.heure || 'Heure non spécifiée'})</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Motif :</span>
              <span style={{ color: '#cbd5e1' }}>{consultation.motif || 'Non renseigné'}</span>
            </div>

            {consultation.diagnostic && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Diagnostic :</span>
                <strong style={{ color: '#facc15' }}>{consultation.diagnostic}</strong>
              </div>
            )}
          </div>

          {/* Avertissement de sécurité */}
          <div style={{
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderLeft: '4px solid #ef4444',
            borderRadius: '6px',
            color: '#fca5a5',
            fontSize: '0.82rem',
            lineHeight: 1.45
          }}>
            ⚠️ <strong>Action Irréversible :</strong> Cette consultation médicale ainsi que ses données cliniques associées seront définitivement supprimées du dossier patient.
          </div>

          {/* Saisie sécurisée du Code PIN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600 }}>
              Saisissez votre Code PIN Médecin pour confirmer :
            </label>
            <input
              type="password"
              maxLength={8}
              placeholder="••••"
              value={pinInput}
              autoFocus
              onChange={(e) => {
                setPinInput(e.target.value);
                setErrorMsg('');
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px',
                background: '#0f172a',
                border: errorMsg ? '1px solid #ef4444' : '1px solid #334155',
                borderRadius: '8px',
                color: '#facc15',
                fontSize: '1.2rem',
                fontWeight: 700,
                textAlign: 'center',
                letterSpacing: '6px',
                outline: 'none'
              }}
            />
          </div>

          {errorMsg && (
            <div style={{
              color: '#f87171',
              fontSize: '0.82rem',
              fontWeight: 600,
              background: 'rgba(239, 68, 68, 0.12)',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}>
              {errorMsg}
            </div>
          )}

          {/* Boutons d'action */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '8px'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                background: '#334155',
                border: 'none',
                color: '#cbd5e1',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={deleting || !pinInput.trim()}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                background: (!pinInput.trim() || deleting) ? '#475569' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: (!pinInput.trim() || deleting) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: (!pinInput.trim() || deleting) ? 'none' : '0 4px 14px rgba(239, 68, 68, 0.4)'
              }}
            >
              <span>🗑️</span> {deleting ? 'Suppression...' : 'Supprimer Définitivement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
