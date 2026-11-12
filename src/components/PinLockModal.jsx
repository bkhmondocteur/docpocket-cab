import React, { useState } from 'react';
import { verifyDoctorPin, getPinLockoutStatus } from '../services/licenseService';
import logoImg from '../assets/logo.jpg';

export default function PinLockModal({ onUnlocked, onRequireLicense }) {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [attemptsInfo, setAttemptsInfo] = useState(() => getPinLockoutStatus());

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!pinInput.trim()) {
      setErrorMsg('Veuillez saisir votre code PIN.');
      return;
    }

    const res = verifyDoctorPin(pinInput.trim());
    const updatedStatus = getPinLockoutStatus();
    setAttemptsInfo(updatedStatus);

    if (res.success) {
      if (onUnlocked) onUnlocked();
    } else {
      setPinInput('');
      if (res.isLocked) {
        if (onRequireLicense) {
          onRequireLicense(res.error);
        }
      } else {
        setErrorMsg(res.error || 'Code PIN incorrect.');
      }
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'radial-gradient(circle at 50% 30%, #0f172a 0%, #020617 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '20px',
        padding: '36px 28px',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.15)',
        textAlign: 'center'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{
            width: '84px',
            height: '84px',
            borderRadius: '18px',
            padding: '3px',
            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
            boxShadow: '0 8px 24px rgba(2, 132, 199, 0.4)'
          }}>
            <img
              src={logoImg}
              alt="Logo DocPocket Cab"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '15px',
                objectFit: 'cover'
              }}
            />
          </div>
        </div>

        <h1 style={{ margin: '0 0 6px 0', fontSize: '1.45rem', color: '#f8fafc', fontWeight: 700 }}>
          DocPocket Cab
        </h1>
        <div style={{
          display: 'inline-block',
          background: 'rgba(56, 189, 248, 0.15)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          color: '#38bdf8',
          padding: '3px 12px',
          borderRadius: '20px',
          fontSize: '0.75rem',
          fontWeight: 700,
          marginBottom: '16px',
          letterSpacing: '0.5px'
        }}>
          🛡️ PROTECTION DES DONNÉES PATIENTS
        </div>

        <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.45 }}>
          Veuillez saisir votre code PIN praticien pour accéder aux dossiers médicaux et consultations :
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
          <input
            type="password"
            maxLength={10}
            value={pinInput}
            onChange={(e) => { setPinInput(e.target.value); setErrorMsg(''); }}
            placeholder="••••"
            autoFocus
            style={{
              width: '100%',
              maxWidth: '240px',
              padding: '12px',
              background: '#020617',
              border: errorMsg ? '2px solid #ef4444' : '2px solid #38bdf8',
              borderRadius: '10px',
              color: '#facc15',
              fontSize: '1.8rem',
              fontWeight: 800,
              textAlign: 'center',
              letterSpacing: '10px',
              outline: 'none',
              boxShadow: '0 0 16px rgba(56, 189, 248, 0.2)'
            }}
          />

          {errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              width: '100%'
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <div style={{
            fontSize: '0.78rem',
            color: attemptsInfo.remainingAttempts <= 1 ? '#f87171' : '#94a3b8',
            fontWeight: 600
          }}>
            Tentatives restantes : <strong style={{ color: attemptsInfo.remainingAttempts <= 1 ? '#ef4444' : '#38bdf8' }}>{attemptsInfo.remainingAttempts} / 3</strong>
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              color: '#fff',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '6px'
            }}
          >
            <span>🔓</span> Déverrouiller le Cabinet
          </button>
        </form>

        <div style={{
          marginTop: '22px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '0.78rem'
        }}>
          <button
            type="button"
            onClick={() => onRequireLicense && onRequireLicense("Déverrouillage manuel par clé de licence")}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.78rem',
              textDecoration: 'underline'
            }}
          >
            🔑 Code PIN oublié ? Déverrouiller avec votre clé de licence
          </button>
        </div>
      </div>
    </div>
  );
}
