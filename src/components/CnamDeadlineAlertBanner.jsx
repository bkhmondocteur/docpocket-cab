// ==============================================================
// DOCPOCKET CABINET - INFOBULLE / NOTIFICATION D'ÉCHÉANCE CNAM (2 MOIS)
// PALIERS :
// - J-10 à J-5 : Infobulle Jaune 🟡
// - J-4 à J-3  : Infobulle Orange 🟠
// - J-2 à J-0  : Infobulle Rouge 🔴
// DISPARITION : Clic sur "Bordereau livré à la CNAM" & Archivage.
// ==============================================================

import React, { useState } from 'react';
import { deliverAndArchiveBordereau } from '../services/cnamAlertService';

export default function CnamDeadlineAlertBanner({
  alerts = [],
  onBordereauDelivered = () => {},
  onViewBordereau = null
}) {
  const [minimized, setMinimized] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  if (!alerts || alerts.length === 0) {
    return null;
  }

  // Si plusieurs alertes, prendre la plus critique pour l'affichage principal
  const currentAlert = alerts[0];
  const { colorTheme, daysRemaining, numBordereau, earliestDateFormatted, deadlineDateFormatted, earliestPatient, earliestActe, montantCnam, totalActes, bordereau } = currentAlert;

  const handleDeliverAndArchive = async (targetBordereau) => {
    const bordId = targetBordereau.id || targetBordereau.numBordereau;
    setProcessingId(bordId);
    try {
      await deliverAndArchiveBordereau(targetBordereau);
      setSuccessMsg(`✓ Bordereau ${targetBordereau.numBordereau || ''} marqué comme livré à la CNAM et archivé avec succès !`);
      setTimeout(() => {
        setSuccessMsg('');
        onBordereauDelivered(targetBordereau);
      }, 1500);
    } catch (err) {
      alert("Erreur lors de la mise à jour du bordereau : " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (minimized) {
    return (
      <div
        onClick={() => setMinimized(false)}
        style={{
          margin: '8px 16px 0',
          background: colorTheme.bg,
          border: `1.5px solid ${colorTheme.border}`,
          borderRadius: '10px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          boxShadow: colorTheme.glow,
          color: colorTheme.text,
          animation: daysRemaining <= 2 ? 'pulse 2s infinite' : 'none'
        }}
        title="Cliquer pour agrandir l'alerte CNAM"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', fontWeight: 700 }}>
          <span>{colorTheme.icon}</span>
          <span>{colorTheme.levelLabel} : {numBordereau} (Échéance dans {daysRemaining}j)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            background: colorTheme.badgeBg,
            color: colorTheme.badgeText,
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 800
          }}>
            {currentAlert.badgeLabel}
          </span>
          <span style={{ fontSize: '0.8rem', textDecoration: 'underline' }}>Afficher le détail ▼</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        margin: '10px 16px 0',
        background: colorTheme.bg,
        border: `2px solid ${colorTheme.border}`,
        borderRadius: '12px',
        padding: '14px 18px',
        boxShadow: colorTheme.glow,
        color: colorTheme.text,
        position: 'relative',
        zIndex: 100,
        transition: 'all 0.3s ease',
        animation: daysRemaining <= 2 ? 'pulse 2s infinite' : 'none'
      }}
    >
      {/* Ligne d'en-tête de l'infobulle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.4rem' }}>{colorTheme.icon}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                background: colorTheme.badgeBg,
                color: colorTheme.badgeText,
                padding: '3px 10px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 900,
                letterSpacing: '0.5px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
              }}>
                {currentAlert.badgeLabel}
              </span>
              <strong style={{ fontSize: '1rem', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                {daysRemaining > 0 
                  ? `Attention CNAM : Échéance des 2 mois dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} !`
                  : daysRemaining === 0 
                  ? `URGENT CNAM : Dernier jour pour déposer ce bordereau (J-0) !`
                  : `ALERTE CRITIQUE : Échéance dépassée de ${Math.abs(daysRemaining)} jour(s) !`}
              </strong>
            </div>
            <div style={{ fontSize: '0.82rem', marginTop: '3px', opacity: 0.95 }}>
              Règle CNAM : Les consultations dépassant 2 mois le jour du dépôt physique seront automatiquement <strong style={{ textDecoration: 'underline' }}>rejetées et non remboursées</strong>.
            </div>
          </div>
        </div>

        {/* Bouton Réduire */}
        <button
          type="button"
          onClick={() => setMinimized(true)}
          style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: 'none',
            color: '#fff',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '0.78rem',
            cursor: 'pointer',
            fontWeight: 600
          }}
          title="Réduire l'infobulle"
        >
          Réduire ▲
        </button>
      </div>

      {/* Détails du bordereau et de la première consultation */}
      <div style={{
        margin: '12px 0 14px',
        padding: '10px 14px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '10px',
        fontSize: '0.84rem'
      }}>
        <div>
          <div style={{ opacity: 0.8, fontSize: '0.74rem' }}>Bordereau concerné :</div>
          <div style={{ fontWeight: 800, color: '#fff' }}>
            🏛️ {numBordereau} ({totalActes} acte{totalActes > 1 ? 's' : ''})
          </div>
        </div>

        <div>
          <div style={{ opacity: 0.8, fontSize: '0.74rem' }}>Première consultation du bordereau :</div>
          <div style={{ fontWeight: 700, color: '#fff' }}>
            📅 {earliestDateFormatted} {earliestPatient ? `(${earliestPatient})` : ''}
          </div>
        </div>

        <div>
          <div style={{ opacity: 0.8, fontSize: '0.74rem' }}>Date limite de forclusion (2 mois) :</div>
          <div style={{ fontWeight: 800, color: '#fff' }}>
            ⏳ Au plus tard le {deadlineDateFormatted}
          </div>
        </div>

        <div>
          <div style={{ opacity: 0.8, fontSize: '0.74rem' }}>Montant CNAM en jeu :</div>
          <div style={{ fontWeight: 900, color: '#4ade80', fontSize: '0.98rem' }}>
            💰 {montantCnam.toFixed(3)} DT
          </div>
        </div>
      </div>

      {/* Message de succès temporaire */}
      {successMsg && (
        <div style={{
          background: 'rgba(22, 163, 74, 0.9)',
          color: '#fff',
          padding: '8px 14px',
          borderRadius: '6px',
          marginBottom: '10px',
          fontWeight: 700,
          fontSize: '0.85rem'
        }}>
          {successMsg}
        </div>
      )}

      {/* Actions claires : bouton de livraison et bouton d'examen */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>
          💡 Le clic sur le bouton ci-contre confirme la remise physique à l'agent CNAM, archive le dossier et désactive cette alerte quotidienne.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onViewBordereau && (
            <button
              type="button"
              onClick={() => onViewBordereau(bordereau)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              👁️ Examiner le Bordereau
            </button>
          )}

          {/* BOUTON D'ACTION PRINCIPAL REQUIS PAR L'UTILISATEUR */}
          <button
            type="button"
            disabled={processingId !== null}
            onClick={() => handleDeliverAndArchive(bordereau)}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              background: '#22c55e',
              color: '#064e3b',
              border: 'none',
              cursor: processingId ? 'wait' : 'pointer',
              fontWeight: 900,
              fontSize: '0.88rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
              transition: 'transform 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <span>🚚</span>
            <span>Bordereau livré à la CNAM & Archiver</span>
          </button>
        </div>
      </div>

      {/* Si d'autres bordereaux ont également des alertes */}
      {alerts.length > 1 && (
        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(255, 255, 255, 0.2)', fontSize: '0.78rem', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Autres bordereaux proches de l'échéance :</span>
          {alerts.slice(1).map((alt, i) => (
            <span
              key={i}
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '2px 8px',
                borderRadius: '4px',
                border: `1px solid ${alt.colorTheme.border}`,
                color: '#fff'
              }}
            >
              {alt.numBordereau} : <strong>{alt.badgeLabel}</strong> ({alt.daysRemaining}j)
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
