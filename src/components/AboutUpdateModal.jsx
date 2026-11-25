// ==============================================================
// DOCPOCKET CABINET - MODAL « À PROPOS & MISES À JOUR »
// INFORMATIONS SYSTÈME, VÉRIFICATION ET TÉLÉCHARGEMENT DIRECT
// ==============================================================

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { CURRENT_APP_INFO, checkForAppUpdates } from '../services/updateService';
import appLogo from '../assets/logo.jpg';

export default function AboutUpdateModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const [checking, setChecking] = useState(false);
  const [updateResult, setUpdateResult] = useState(null);

  const handleCheckUpdates = async () => {
    setChecking(true);
    setUpdateResult(null);
    try {
      const res = await checkForAppUpdates();
      setUpdateResult(res);
    } catch (err) {
      setUpdateResult({
        success: false,
        hasUpdate: false,
        message: "Erreur lors de la vérification : " + err.message
      });
    } finally {
      setChecking(false);
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        background: '#0f172a',
        border: '1.5px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '16px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#f8fafc',
        fontFamily: "'Segoe UI', system-ui, sans-serif"
      }}>
        {/* En-tête */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img
              src={appLogo}
              alt="Logo"
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                objectFit: 'cover',
                border: '1.5px solid rgba(56, 189, 248, 0.4)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                {CURRENT_APP_INFO.fullName}
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600, marginTop: '2px' }}>
                Version {CURRENT_APP_INFO.version} (Édition Officielle)
              </div>
            </div>
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
              padding: '4px 8px'
            }}
          >
            &times;
          </button>
        </div>

        {/* Corps avec défilement */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Fiche d'identité médicale */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '0.85rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '6px' }}>
              <span style={{ color: '#94a3b8' }}>Praticien Titulaire :</span>
              <strong style={{ color: '#f8fafc' }}>{CURRENT_APP_INFO.author}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '6px' }}>
              <span style={{ color: '#94a3b8' }}>Spécialité :</span>
              <span style={{ color: '#cbd5e1' }}>{CURRENT_APP_INFO.specialite}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '6px' }}>
              <span style={{ color: '#94a3b8' }}>N° Ordre des Médecins :</span>
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>{CURRENT_APP_INFO.numOrdre}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '6px' }}>
              <span style={{ color: '#94a3b8' }}>Code Conventionnel CNAM :</span>
              <span style={{ color: '#4ade80', fontWeight: 700 }}>{CURRENT_APP_INFO.codeConventionnelCnam}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Cabinet Médical :</span>
              <span style={{ color: '#cbd5e1', fontSize: '0.8rem', textAlign: 'right' }}>{CURRENT_APP_INFO.cabinet}</span>
            </div>
          </div>

          {/* Architecture & Multiplateforme */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px'
          }}>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
                Plateformes supportées :
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                Windows (.exe), Android (.apk) & Web PWA Hors-Ligne
              </div>
            </div>
            <span style={{ fontSize: '1.4rem' }}>💻 📲 🌐</span>
          </div>

          {/* Section Recherche de Mise à Jour */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1.5px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🔄</span>
                  <span>Mises à Jour Logicielles</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                  Vérification en direct depuis GitHub Releases
                </div>
              </div>

              <button
                type="button"
                onClick={handleCheckUpdates}
                disabled={checking}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#fff',
                  border: 'none',
                  cursor: checking ? 'wait' : 'pointer',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)'
                }}
              >
                <span>{checking ? '⏳' : '🔍'}</span>
                <span>{checking ? 'Vérification...' : 'Rechercher une mise à jour'}</span>
              </button>
            </div>

            {/* Résultat de la vérification */}
            {updateResult && (
              <div style={{
                background: updateResult.hasUpdate ? 'rgba(234, 179, 8, 0.15)' : (updateResult.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
                border: `1px solid ${updateResult.hasUpdate ? '#eab308' : (updateResult.success ? '#22c55e' : '#ef4444')}`,
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.82rem'
              }}>
                <div style={{ fontWeight: 800, color: updateResult.hasUpdate ? '#facc15' : (updateResult.success ? '#4ade80' : '#f87171') }}>
                  {updateResult.hasUpdate 
                    ? `🚀 Nouvelle version disponible : ${updateResult.latestVersion} (publiée le ${updateResult.releaseDate})`
                    : (updateResult.success 
                    ? `✓ Votre application DocPocket Cab est parfaitement à jour (v${updateResult.currentVersion}) !`
                    : `⚠️ ${updateResult.message}`)}
                </div>

                {updateResult.hasUpdate && (
                  <div>
                    <div style={{ fontSize: '0.74rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '4px' }}>
                      Nouveautés de la mise à jour :
                    </div>
                    <div style={{
                      background: 'rgba(0,0,0,0.3)',
                      padding: '8px',
                      borderRadius: '6px',
                      color: '#94a3b8',
                      fontSize: '0.72rem',
                      whiteSpace: 'pre-line',
                      maxHeight: '120px',
                      overflowY: 'auto'
                    }}>
                      {updateResult.changelog}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Téléchargements directs des installateurs */}
            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px' }}>
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '8px' }}>
                Téléchargement direct des packages d'installation :
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                <a
                  href={CURRENT_APP_INFO.downloadExeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38bdf8',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    justifyContent: 'center'
                  }}
                >
                  <span>💻</span>
                  <span>DocPocket-Cab-Setup.exe</span>
                </a>

                <a
                  href={CURRENT_APP_INFO.downloadApkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: '#4ade80',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    justifyContent: 'center'
                  }}
                >
                  <span>📲</span>
                  <span>DocPocket-Cab.apk</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Pied de modal */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
            © 2026 DocPocket Cabinet • Mahdia, Tunisie
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              background: '#334155',
              border: 'none',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
