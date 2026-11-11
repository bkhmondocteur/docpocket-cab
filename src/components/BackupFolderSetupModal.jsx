import React, { useState, useEffect } from 'react';
import {
  selectBackupDirectory,
  setManualBackupPath,
  getBackupFolderInfo,
  dismissInitialFolderSetup,
  isDirectoryPickerSupported
} from '../services/backupFolderService';

export default function BackupFolderSetupModal({ onClose, onConfigured }) {
  const [folderInfo, setFolderInfo] = useState({ folderName: '', isConfigured: false });
  const [manualPath, setManualPath] = useState('');
  const [useManual, setUseManual] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const supported = isDirectoryPickerSupported();

  useEffect(() => {
    getBackupFolderInfo().then(info => {
      setFolderInfo(info);
      if (info.manualPath) setManualPath(info.manualPath);
    });
  }, []);

  const handleSelectFolder = async () => {
    setErrorMsg('');
    setStatusMsg('');
    setLoading(true);

    try {
      const res = await selectBackupDirectory();
      setStatusMsg(`✓ Dossier "${res.folderName}" sélectionné avec succès !`);
      setTimeout(() => {
        setLoading(false);
        if (onConfigured) onConfigured(res);
        onClose();
      }, 1000);
    } catch (err) {
      setLoading(false);
      if (err.name !== 'AbortError') {
        setErrorMsg(err.message || 'Impossible de sélectionner le dossier.');
      }
    }
  };

  const handleSaveManual = (e) => {
    e.preventDefault();
    if (!manualPath.trim()) {
      setErrorMsg('Veuillez renseigner le nom ou le chemin du dossier.');
      return;
    }
    setManualBackupPath(manualPath.trim());
    setStatusMsg(`✓ Dossier local "${manualPath.trim()}" enregistré.`);
    setTimeout(() => {
      if (onConfigured) onConfigured({ folderName: manualPath.trim() });
      onClose();
    }, 800);
  };

  const handleSkip = () => {
    dismissInitialFolderSetup();
    onClose();
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
      zIndex: 999999,
      padding: '14px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '560px',
        maxHeight: '92vh',
        overflowY: 'auto',
        background: '#0f172a',
        border: '1.5px solid rgba(56, 189, 248, 0.4)',
        borderRadius: '18px',
        padding: '24px 20px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9)',
        color: '#f8fafc'
      }}>
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem'
          }}>
            📁
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc', fontWeight: 700 }}>
              Dossier de Sauvegarde Local
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>
              Configuration du stockage de vos données médicales
            </span>
          </div>
        </div>

        {/* Bannière de confidentialité 100% Locale */}
        <div style={{
          background: 'rgba(34, 197, 94, 0.12)',
          border: '1px solid rgba(34, 197, 94, 0.35)',
          borderRadius: '10px',
          padding: '12px 14px',
          marginBottom: '20px',
          fontSize: '0.85rem',
          color: '#86efac',
          display: 'flex',
          gap: '10px',
          lineHeight: 1.45
        }}>
          <span style={{ fontSize: '1.3rem' }}>🔒</span>
          <div>
            <strong>Confidentialité & Secret Médical Garanti :</strong>
            <div style={{ marginTop: '3px', color: '#cbd5e1' }}>
              Toutes les données (patients, consultations, ordonnances, sauvegardes) restent <strong>exclusivement sur votre machine locale</strong>. Rien n'est envoyé sur un serveur ou dans le cloud.
            </div>
          </div>
        </div>

        <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 18px 0' }}>
          Veuillez choisir le dossier de votre ordinateur (disque dur ou clé USB) où seront automatiquement enregistrées vos sauvegardes. Vous pourrez le modifier à tout moment dans les <strong>Paramètres</strong>.
        </p>

        {/* Sélection principale */}
        {!useManual && supported ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleSelectFolder}
              disabled={loading}
              style={{
                padding: '14px 18px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: 'none',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)'
              }}
            >
              <span>📂</span> Sélectionner un Dossier sur mon Ordinateur
            </button>

            <button
              type="button"
              onClick={() => setUseManual(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.8rem',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Ou saisir le chemin manuellement (ex: D:\Sauvegardes_Cabinet)
            </button>
          </div>
        ) : (
          <form onSubmit={handleSaveManual} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Chemin du dossier de sauvegarde :</label>
            <input
              type="text"
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              placeholder="Ex: C:\Sauvegardes_DocPocket ou D:\Cabinet"
              style={{
                width: '100%',
                padding: '12px 14px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.9rem',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: '#0284c7',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Enregistrer ce chemin
              </button>
              {supported && (
                <button
                  type="button"
                  onClick={() => setUseManual(false)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#cbd5e1',
                    cursor: 'pointer'
                  }}
                >
                  Retour
                </button>
              )}
            </div>
          </form>
        )}

        {/* Message d'état */}
        {statusMsg && (
          <div style={{
            marginTop: '16px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid #22c55e',
            color: '#86efac',
            fontSize: '0.85rem'
          }}>
            {statusMsg}
          </div>
        )}

        {errorMsg && (
          <div style={{
            marginTop: '16px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            fontSize: '0.85rem'
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Bouton ignorer / plus tard */}
        <div style={{ marginTop: '22px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
          <button
            type="button"
            onClick={handleSkip}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '0.85rem',
              cursor: 'pointer',
              padding: '6px 12px'
            }}
          >
            Configurer plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
