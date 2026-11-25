// ==============================================================
// DOCPOCKET CABINET - MODALE D'APERÇU AVANT IMPRESSION
// Affichage fidèle du document médical (A5 / A4) à l'écran
// avec contrôles de zoom, sélection de format et impression propre
// ==============================================================

import React, { useState, useEffect, useRef } from 'react';
import { getPrescriptionSettings, savePrescriptionSettings } from '../services/prescriptionSettingsService';
import { buildPrescriptionHtml } from '../services/prescriptionReportGenerator';

export default function PrintPreviewModal({
  isOpen = false,
  onClose = () => {},
  title = "Aperçu avant impression",
  patient = null,
  prescription = null,
  rawHtml = null,
  onOpenLayoutEditor = null
}) {
  const [paperSize, setPaperSize] = useState(() => getPrescriptionSettings().pageSize || 'A5');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isPrinting, setIsPrinting] = useState(false);
  const iframeRef = useRef(null);

  // Synchronisation du format papier à l'ouverture
  useEffect(() => {
    if (isOpen) {
      const current = getPrescriptionSettings();
      setPaperSize(current.pageSize || 'A5');
      setZoomLevel(1.0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Modification et pérennisation du format papier (A5 ou A4)
  const handleChangePaperSize = (newSize) => {
    setPaperSize(newSize);
    savePrescriptionSettings({ pageSize: newSize });
    localStorage.setItem('docpocket_active_print_paper_size', newSize);
  };

  // Génération du contenu HTML selon le format papier choisi
  const currentSettings = { ...getPrescriptionSettings(), pageSize: paperSize };
  const documentHtml = rawHtml || (patient && prescription 
    ? buildPrescriptionHtml(patient, prescription, prescription.printFormat || prescription.type || 'normale', currentSettings)
    : '<div style="padding:40px;text-align:center;color:#64748b;">Aucun contenu à afficher.</div>');

  // Lancement de l'impression via iframe isolée
  const handlePrint = () => {
    try {
      setIsPrinting(true);
      const iframe = iframeRef.current;
      if (!iframe) {
        window.print();
        setIsPrinting(false);
        return;
      }

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc) {
        window.print();
        setIsPrinting(false);
        return;
      }

      doc.open();
      doc.write(documentHtml);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn("Impression iframe:", e);
        } finally {
          setIsPrinting(false);
        }
      }, 350);
    } catch (err) {
      console.error("Erreur impression:", err);
      setIsPrinting(false);
      window.print();
    }
  };

  const isA5 = paperSize === 'A5';
  // Proportions exactes A5 (148 × 210) ou A4 (210 × 297)
  const sheetWidthPx = isA5 ? 540 : 660;
  const sheetMinHeightPx = isA5 ? Math.round(540 * (210 / 148)) : Math.round(660 * (297 / 210));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        color: '#f8fafc',
        overflow: 'hidden'
      }}
    >
      {/* Barre d'outils supérieure de l'aperçu avant impression */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          background: '#0f172a',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.35)',
          flexWrap: 'wrap',
          gap: '12px',
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.4rem' }}>👁️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{title}</span>
              <span style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: '6px',
                background: isA5 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: isA5 ? '#38bdf8' : '#34d399',
                border: `1px solid ${isA5 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`
              }}>
                Format {paperSize}
              </span>
            </div>
            {patient && (
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Patient : <strong style={{ color: '#e2e8f0' }}>{patient.prenom} {patient.nom}</strong>
                {patient.age && ` • ${patient.age} ans`}
                {patient.cin && ` • CIN: ${patient.cin}`}
              </div>
            )}
          </div>
        </div>

        {/* Contrôles au centre : Format de papier & Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Bascule Rapide A5 / A4 (Persistante) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1e293b', padding: '3px 6px', borderRadius: '8px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, paddingLeft: '4px' }}>Papier :</span>
            <button
              type="button"
              onClick={() => handleChangePaperSize('A5')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                background: isA5 ? '#0284c7' : 'transparent',
                color: isA5 ? '#fff' : '#94a3b8',
                fontWeight: isA5 ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
              title="Format A5 (148 x 210 mm) - Recommandé pour carnet d'ordonnances"
            >
              📑 A5 (Carnet)
            </button>
            <button
              type="button"
              onClick={() => handleChangePaperSize('A4')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                background: !isA5 ? '#0284c7' : 'transparent',
                color: !isA5 ? '#fff' : '#94a3b8',
                fontWeight: !isA5 ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
              title="Format A4 (210 x 297 mm) - Pleine page standard"
            >
              📄 A4 (Standard)
            </button>
          </div>

          {/* Zoom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#1e293b', padding: '3px 6px', borderRadius: '8px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, paddingLeft: '4px' }}>Zoom :</span>
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.max(0.65, Math.round((prev - 0.1) * 10) / 10))}
              style={{
                padding: '4px 8px',
                background: '#0f172a',
                color: '#fff',
                border: '1px solid #334155',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.8rem'
              }}
              title="Réduire le zoom"
            >
              −
            </button>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', minWidth: '42px', textAlign: 'center' }}>
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.min(1.4, Math.round((prev + 0.1) * 10) / 10))}
              style={{
                padding: '4px 8px',
                background: '#0f172a',
                color: '#fff',
                border: '1px solid #334155',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.8rem'
              }}
              title="Agrandir le zoom"
            >
              +
            </button>
          </div>
        </div>

        {/* Boutons d'action : Imprimer, Personnaliser mise en page, Fermer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onOpenLayoutEditor && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLayoutEditor();
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: '#1e293b',
                color: '#cbd5e1',
                border: '1px solid #334155',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Ajuster la mise en page, les marges et la disposition"
            >
              <span>⚙️</span> Mise en page
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: isPrinting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.45)'
            }}
          >
            <span>🖨️</span> {isPrinting ? 'Préparation...' : 'Lancer l\'impression'}
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#94a3b8',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            ✕ Fermer
          </button>
        </div>
      </div>

      {/* Zone de prévisualisation avec feuille virtuelle réaliste */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto',
          padding: '30px 20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          background: '#090d16'
        }}
      >
        <div
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease',
            width: `${sheetWidthPx}px`,
            minHeight: `${sheetMinHeightPx}px`,
            background: '#ffffff',
            borderRadius: '2px',
            boxShadow: '0 12px 35px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.15)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Rendu HTML dans un iframe sandboxé ou directement rendu */}
          <iframe
            title="Aperçu document"
            srcDoc={documentHtml}
            style={{
              width: '100%',
              minHeight: `${sheetMinHeightPx}px`,
              border: 'none',
              display: 'block'
            }}
          />
        </div>
      </div>

      {/* Iframe invisible dédiée à l'impression propre */}
      <iframe
        ref={iframeRef}
        title="Impression iframe"
        style={{ position: 'absolute', width: 0, height: 0, border: 'none', visibility: 'hidden' }}
      />
    </div>
  );
}
