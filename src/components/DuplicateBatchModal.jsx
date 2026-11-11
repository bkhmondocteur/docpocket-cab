import React, { useState } from 'react';
import { mergeMultipleDuplicateGroups } from '../services/patientStorage';

export default function DuplicateBatchModal({ duplicateGroups = [], onClose, onMerged }) {
  // Initialiser les sélections : par défaut, tous les cas de doublons sont cochés
  const [selections, setSelections] = useState(() => {
    const init = {};
    for (const grp of duplicateGroups) {
      if (grp.patients && grp.patients.length >= 2) {
        init[grp.key] = {
          checked: true,
          targetId: grp.patients[0].id,
          sourceIds: grp.patients.slice(1).map(p => p.id)
        };
      }
    }
    return init;
  });

  const [isMerging, setIsMerging] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [summaryReport, setSummaryReport] = useState(null);

  const totalGroups = duplicateGroups.length;
  const checkedCount = Object.values(selections).filter(s => s.checked).length;
  const allChecked = totalGroups > 0 && checkedCount === totalGroups;

  // Cocher / Décocher un cas
  const toggleGroup = (key) => {
    setSelections(prev => ({
      ...prev,
      [key]: { ...prev[key], checked: !prev[key]?.checked }
    }));
  };

  // Tout cocher / Décocher
  const toggleAll = () => {
    const newChecked = !allChecked;
    setSelections(prev => {
      const updated = {};
      for (const k of Object.keys(prev)) {
        updated[k] = { ...prev[k], checked: newChecked };
      }
      return updated;
    });
  };

  // Inverser la fiche cible et la fiche source pour un cas spécifique
  const swapTargetAndSource = (groupKey, patientAId, patientBId) => {
    setSelections(prev => {
      const current = prev[groupKey];
      if (!current) return prev;
      const isTargetA = String(current.targetId) === String(patientAId);
      return {
        ...prev,
        [groupKey]: {
          ...current,
          targetId: isTargetA ? patientBId : patientAId,
          sourceIds: [isTargetA ? patientAId : patientBId]
        }
      };
    });
  };

  // Lancement de la fusion globale par lots
  const handleExecuteBatchMerge = async () => {
    const groupsToProcess = [];
    for (const [key, sel] of Object.entries(selections)) {
      if (sel.checked && sel.targetId && sel.sourceIds && sel.sourceIds.length > 0) {
        groupsToProcess.push({
          key,
          targetId: sel.targetId,
          sourceIds: sel.sourceIds
        });
      }
    }

    if (groupsToProcess.length === 0) {
      alert("Aucun cas de doublon n'est coché.");
      return;
    }

    if (!window.confirm(`Confirmez-vous la fusion groupée de ${groupsToProcess.length} cas de doublons ?\n\nToutes les consultations, ordonnances et antécédents seront transférés sans aucune perte vers chaque dossier principal.`)) {
      return;
    }

    try {
      setIsMerging(true);
      setProgress({ current: 0, total: groupsToProcess.length });

      const report = await mergeMultipleDuplicateGroups(groupsToProcess, (p) => {
        setProgress({ current: p.current, total: p.total });
      });

      setSummaryReport(report);
    } catch (err) {
      alert("Erreur lors de la fusion groupée : " + err.message);
    } finally {
      setIsMerging(false);
    }
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
      zIndex: 99999,
      padding: '10px'
    }}>
      <div className="animate-fade-in" style={{
        width: '100%',
        maxWidth: '920px',
        maxHeight: 'calc(100dvh - 20px)',
        background: '#0f172a',
        border: '1.5px solid #38bdf8',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 30px rgba(56, 189, 248, 0.25)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* En-tête */}
        <div style={{
          padding: '18px 24px',
          background: '#1e293b',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.4rem' }}>🔀</span>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc', fontWeight: 700 }}>
                Traitement Groupé des Doublons
              </h2>
              <span style={{
                background: 'rgba(234, 179, 8, 0.2)',
                color: '#facc15',
                border: '1px solid rgba(234, 179, 8, 0.4)',
                padding: '2px 8px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700
              }}>
                {totalGroups} groupe(s) détecté(s)
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
              Cochez les cas que vous souhaitez fusionner. Toutes les consultations et ordonnances seront rattachées au dossier principal.
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={isMerging}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.4rem',
              cursor: isMerging ? 'not-allowed' : 'pointer',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Barre de commandes et sélection globale */}
        {!summaryReport && (
          <div style={{
            padding: '12px 24px',
            background: 'rgba(30, 41, 59, 0.7)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                disabled={isMerging}
                style={{ width: '18px', height: '18px', accentColor: '#0284c7', cursor: 'pointer' }}
              />
              <span>Tout cocher / Tout décocher ({checkedCount}/{totalGroups} cas sélectionnés)</span>
            </label>

            <button
              onClick={handleExecuteBatchMerge}
              disabled={isMerging || checkedCount === 0}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                background: checkedCount === 0 || isMerging ? '#334155' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: checkedCount === 0 || isMerging ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: checkedCount > 0 && !isMerging ? '0 4px 14px rgba(2, 132, 199, 0.4)' : 'none'
              }}
            >
              <span>⚡</span> Fusionner les {checkedCount} cas cochés en 1 clic
            </button>
          </div>
        )}

        {/* Corps de la modale */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Si fusion en cours */}
          {isMerging && (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{ fontSize: '2.5rem' }}>🔄</div>
              <h3 style={{ margin: 0, color: '#38bdf8' }}>
                Fusion groupée en cours... ({progress.current} / {progress.total})
              </h3>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem' }}>
                Transfert sécurisé des consultations, ordonnances et quittances sans doublons.
              </p>
              <div style={{ width: '100%', maxWidth: '400px', height: '8px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #38bdf8, #22c55e)',
                  transition: 'width 0.2s ease'
                }} />
              </div>
            </div>
          )}

          {/* Si rapport terminé */}
          {summaryReport && (
            <div style={{
              padding: '30px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{ fontSize: '3rem' }}>🎉</div>
              <h3 style={{ margin: 0, color: '#4ade80', fontSize: '1.3rem' }}>
                Fusion groupée terminée avec succès !
              </h3>
              <div style={{
                background: '#1e293b',
                border: '1px solid rgba(74, 222, 128, 0.3)',
                borderRadius: '12px',
                padding: '20px 30px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '16px',
                width: '100%',
                maxWidth: '600px'
              }}>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8' }}>
                    {summaryReport.processedCount}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Cas traités</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#facc15' }}>
                    {summaryReport.totalPatientsMerged}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Fiches absorbées</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#4ade80' }}>
                    +{summaryReport.totalConsults}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Consultations liées</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#c084fc' }}>
                    +{summaryReport.totalPrescs}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Ordonnances liées</div>
                </div>
              </div>

              <button
                onClick={onMerged}
                style={{
                  marginTop: '10px',
                  padding: '10px 28px',
                  borderRadius: '8px',
                  background: '#22c55e',
                  color: '#0f172a',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer'
                }}
              >
                ✓ Terminé (Fermer)
              </button>
            </div>
          )}

          {/* Liste des groupes de doublons si pas en cours de fusion */}
          {!isMerging && !summaryReport && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {duplicateGroups.map((group, idx) => {
                const sel = selections[group.key] || { checked: true, targetId: group.patients[0].id, sourceIds: [group.patients[1].id] };
                const patientA = group.patients[0];
                const patientB = group.patients[1];
                const isTargetA = String(sel.targetId) === String(patientA.id);

                const targetPat = isTargetA ? patientA : patientB;
                const sourcePat = isTargetA ? patientB : patientA;

                return (
                  <div
                    key={group.key || idx}
                    style={{
                      background: sel.checked ? '#1e293b' : 'rgba(30, 41, 59, 0.4)',
                      border: sel.checked ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      opacity: sel.checked ? 1 : 0.65,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Ligne En-tête du groupe avec case à cocher */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={sel.checked}
                          onChange={() => toggleGroup(group.key)}
                          style={{ width: '18px', height: '18px', accentColor: '#0284c7', cursor: 'pointer' }}
                        />
                        <strong style={{ color: sel.checked ? '#38bdf8' : '#cbd5e1', fontSize: '0.92rem' }}>
                          Cas #{idx + 1} : {group.reason}
                        </strong>
                      </label>

                      <button
                        type="button"
                        onClick={() => swapTargetAndSource(group.key, patientA.id, patientB.id)}
                        disabled={!sel.checked}
                        style={{
                          background: 'rgba(56, 189, 248, 0.12)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#38bdf8',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: sel.checked ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        title="Permuter la fiche principale et la fiche doublon"
                      >
                        <span>⇄</span> Inverser le dossier principal
                      </button>
                    </div>

                    {/* Comparatif Cible vs Doublon */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                      {/* Fiche Cible */}
                      <div style={{
                        background: '#0f172a',
                        border: '1.5px solid #22c55e',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            background: 'rgba(34, 197, 94, 0.2)',
                            color: '#4ade80',
                            padding: '2px 8px',
                            borderRadius: '5px',
                            fontSize: '0.72rem',
                            fontWeight: 700
                          }}>
                            ✓ Dossier Principal (Conservé)
                          </span>
                          <span style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 600 }}>
                            N° {targetPat.numfch || targetPat.id}
                          </span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc', marginTop: '2px' }}>
                          {targetPat.civility || ''} {targetPat.nom.toUpperCase()} {targetPat.prenom}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div>🎂 Né(e) : {targetPat.birthdate || 'Inconnu'} • 📞 Tél : {targetPat.telephone || 'Non renseigné'}</div>
                          <div>🪪 CIN : {targetPat.cin || '-'} {targetPat.cin_date ? `(délivrée le ${targetPat.cin_date})` : ''} • 🏛️ {targetPat.caisse || 'Sans caisse'}</div>
                          {targetPat.derniere_visite && <div style={{ color: '#38bdf8' }}>📅 Dernière visite : {targetPat.derniere_visite}</div>}
                        </div>
                      </div>

                      {/* Fiche Source (Doublon) */}
                      <div style={{
                        background: '#0f172a',
                        border: '1.5px dashed #f59e0b',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            background: 'rgba(245, 158, 11, 0.2)',
                            color: '#fbbf24',
                            padding: '2px 8px',
                            borderRadius: '5px',
                            fontSize: '0.72rem',
                            fontWeight: 700
                          }}>
                            ➔ Fiche Doublon (Sera absorbée)
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                            N° {sourcePat.numfch || sourcePat.id}
                          </span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#cbd5e1', marginTop: '2px' }}>
                          {sourcePat.civility || ''} {sourcePat.nom.toUpperCase()} {sourcePat.prenom}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div>🎂 Né(e) : {sourcePat.birthdate || 'Inconnu'} • 📞 Tél : {sourcePat.telephone || 'Non renseigné'}</div>
                          <div>🪪 CIN : {sourcePat.cin || '-'} {sourcePat.cin_date ? `(délivrée le ${sourcePat.cin_date})` : ''} • 🏛️ {sourcePat.caisse || 'Sans caisse'}</div>
                          {sourcePat.derniere_visite && <div>📅 Dernière visite : {sourcePat.derniere_visite}</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
