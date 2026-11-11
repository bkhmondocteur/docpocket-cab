import React, { useState, useEffect } from 'react';
import {
  getAllPatients,
  getConsultationsByPatient,
  getPrescriptionsByPatient,
  getInvoicesByPatient,
  mergePatients
} from '../services/patientStorage';

export default function PatientMergeModal({
  initialTargetPatient = null,
  initialSourcePatients = [],
  duplicateGroup = null,
  onClose,
  onMerged
}) {
  const [allPatients, setAllPatients] = useState([]);
  const [targetPatient, setTargetPatient] = useState(initialTargetPatient);
  const [sourcePatients, setSourcePatients] = useState(initialSourcePatients);
  const [searchQuery, setSearchQuery] = useState('');
  const [targetCounts, setTargetCounts] = useState({ consults: 0, prescs: 0, invoices: 0 });
  const [sourceCounts, setSourceCounts] = useState({ consults: 0, prescs: 0, invoices: 0 });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Initialisation à partir des props
  useEffect(() => {
    getAllPatients().then(pats => {
      setAllPatients(pats);

      if (duplicateGroup && duplicateGroup.patients && duplicateGroup.patients.length >= 2) {
        // Le 1er est la cible, le 2ème est la source
        setTargetPatient(duplicateGroup.patients[0]);
        setSourcePatients([duplicateGroup.patients[1]]);
      } else if (!targetPatient && pats.length > 0) {
        setTargetPatient(pats[0]);
      }
    });
  }, [duplicateGroup]);

  // Charger les compteurs de consultations/ordonnances pour le dossier cible
  useEffect(() => {
    if (targetPatient && targetPatient.id) {
      Promise.all([
        getConsultationsByPatient(targetPatient.id),
        getPrescriptionsByPatient(targetPatient.id),
        getInvoicesByPatient(targetPatient.id)
      ]).then(([c, p, inv]) => {
        setTargetCounts({ consults: c.length, prescs: p.length, invoices: inv.length });
      });
    }
  }, [targetPatient]);

  // Charger les compteurs pour le premier dossier source
  useEffect(() => {
    if (sourcePatients.length > 0 && sourcePatients[0].id) {
      Promise.all([
        getConsultationsByPatient(sourcePatients[0].id),
        getPrescriptionsByPatient(sourcePatients[0].id),
        getInvoicesByPatient(sourcePatients[0].id)
      ]).then(([c, p, inv]) => {
        setSourceCounts({ consults: c.length, prescs: p.length, invoices: inv.length });
      });
    } else {
      setSourceCounts({ consults: 0, prescs: 0, invoices: 0 });
    }
  }, [sourcePatients]);

  // Inverser la cible et la première source
  const handleSwap = () => {
    if (targetPatient && sourcePatients.length > 0) {
      const oldTarget = targetPatient;
      const oldSource = sourcePatients[0];
      setTargetPatient(oldSource);
      setSourcePatients([oldTarget, ...sourcePatients.slice(1)]);
    }
  };

  // Sélectionner un dossier source secondaire via recherche
  const handleSelectSource = (patient) => {
    if (targetPatient && String(patient.id) === String(targetPatient.id)) {
      alert("Ce patient est déjà sélectionné comme dossier principal.");
      return;
    }
    if (!sourcePatients.some(p => String(p.id) === String(patient.id))) {
      setSourcePatients([...sourcePatients, patient]);
    }
    setSearchQuery('');
  };

  const handleRemoveSource = (patientId) => {
    setSourcePatients(sourcePatients.filter(p => String(p.id) !== String(patientId)));
  };

  const handleConfirmMerge = async () => {
    if (!targetPatient) {
      setErrorMsg("Veuillez sélectionner le dossier cible principal.");
      return;
    }
    if (sourcePatients.length === 0) {
      setErrorMsg("Veuillez sélectionner au moins un dossier secondaire à fusionner.");
      return;
    }

    const confirmText = `Confirmez-vous la fusion de ${sourcePatients.length} dossier(s) vers le dossier principal de ${targetPatient.nom} ${targetPatient.prenom} ?\n\nCette action va transférer TOUTES les consultations, ordonnances et quittances vers ce dossier unique, puis supprimer les doublons.`;
    if (!window.confirm(confirmText)) return;

    setErrorMsg('');
    setLoading(true);

    try {
      const srcIds = sourcePatients.map(p => p.id);
      const res = await mergePatients(targetPatient.id, srcIds);

      setSuccessMsg(`✓ Fusion réussie ! ${res.consultsMoved} consultation(s), ${res.prescsMoved} ordonnance(s) et ${res.invoicesMoved} quittance(s) ont été rattachées avec succès à la fiche de ${res.targetPatient.nom} ${res.targetPatient.prenom}.`);

      setTimeout(() => {
        setLoading(false);
        if (onMerged) onMerged(res.targetPatient);
        onClose();
      }, 1500);
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message || "Erreur lors de la fusion.");
    }
  };

  const filteredPatients = searchQuery.trim() === '' ? [] : allPatients.filter(p => {
    const q = searchQuery.toLowerCase();
    const isTarget = targetPatient && String(p.id) === String(targetPatient.id);
    const isSource = sourcePatients.some(s => String(s.id) === String(p.id));
    if (isTarget || isSource) return false;
    return (p.nom && p.nom.toLowerCase().includes(q)) ||
           (p.prenom && p.prenom.toLowerCase().includes(q)) ||
           (p.numfch && p.numfch.toLowerCase().includes(q)) ||
           (p.cin && p.cin.includes(q)) ||
           (p.telephone && p.telephone.includes(q));
  });

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
      padding: '10px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '850px',
        maxHeight: '94vh',
        background: '#0f172a',
        border: '1.5px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '18px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9)',
        overflow: 'hidden'
      }}>
        {/* Header Modal */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#1e293b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>🔀</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc', fontWeight: 700 }}>
                Fusionner des Dossiers Patients (Doublons)
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>
                Rattachement de l'historique complet vers une fiche unique
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            &times;
          </button>
        </div>

        {/* Corps avec défilement */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Note explicative */}
          {duplicateGroup && (
            <div style={{
              background: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid #eab308',
              borderRadius: '10px',
              padding: '12px 16px',
              fontSize: '0.85rem',
              color: '#fef08a'
            }}>
              ⚠️ <strong>Suggestion automatique de doublon détecté :</strong> {duplicateGroup.reason}
            </div>
          )}

          {/* Comparaison côte à côte adaptative */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', alignItems: 'stretch' }}>
            {/* Dossier Cible Principal (CONSERVÉ) */}
            <div style={{
              background: '#1e293b',
              border: '2px solid #22c55e',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
                <span style={{
                  background: '#22c55e',
                  color: '#0f172a',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 800
                }}>
                  FICHE PRINCIPALE (CONSERVÉE)
                </span>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  N° {targetPatient?.numfch || targetPatient?.id || '-'}
                </span>
              </div>

              {targetPatient ? (
                <>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                    {targetPatient.civility} {targetPatient.nom} {targetPatient.prenom}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>🎂 Né(e) le : <strong>{targetPatient.birthdate || 'Non renseigné'}</strong></div>
                    <div>📞 Tél : <strong>{targetPatient.telephone || '-'}</strong></div>
                    <div>🪪 CIN : <strong>{targetPatient.cin || '-'}</strong></div>
                    <div>🏥 CNAM : <strong>{targetPatient.cnamid || 'Sans matricule'}</strong> ({targetPatient.caisse || 'CNSS'})</div>
                    {targetPatient.apci && <div>★ APCI : <strong style={{ color: '#facc15' }}>{targetPatient.apci}</strong></div>}
                  </div>

                  <div style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px dashed #334155',
                    fontSize: '0.8rem',
                    color: '#86efac',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>🩺 {targetCounts.consults} consult.</span>
                    <span>💊 {targetCounts.prescs} ordonn.</span>
                    <span>💳 {targetCounts.invoices} factures</span>
                  </div>
                </>
              ) : (
                <div style={{ color: '#64748b', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
                  Aucun dossier cible sélectionné.
                </div>
              )}
            </div>

            {/* Bouton d'inversion au centre */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={handleSwap}
                disabled={!targetPatient || sourcePatients.length === 0}
                title="Inverser le dossier principal et secondaire"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1.5px solid #38bdf8',
                  color: '#38bdf8',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
              >
                🔄
              </button>
              <span style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'center', maxWidth: '60px' }}>
                Inverser
              </span>
            </div>

            {/* Dossier Secondaire (À FUSIONNER & SUPPRIMER) */}
            <div style={{
              background: '#1e293b',
              border: '2px solid #ef4444',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
                <span style={{
                  background: '#ef4444',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 800
                }}>
                  DOSSIER DOUBLON (SUPPRIMÉ APRÈS TRANSFERT)
                </span>
                {sourcePatients.length > 0 && (
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    N° {sourcePatients[0]?.numfch || sourcePatients[0]?.id || '-'}
                  </span>
                )}
              </div>

              {sourcePatients.length > 0 ? (
                sourcePatients.map(sp => (
                  <div key={sp.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                        {sp.civility} {sp.nom} {sp.prenom}
                      </div>
                      {sourcePatients.length > 1 && (
                        <button
                          onClick={() => handleRemoveSource(sp.id)}
                          style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>🎂 Né(e) le : <strong>{sp.birthdate || 'Non renseigné'}</strong></div>
                      <div>📞 Tél : <strong>{sp.telephone || '-'}</strong></div>
                      <div>🪪 CIN : <strong>{sp.cin || '-'}</strong></div>
                      <div>🏥 CNAM : <strong>{sp.cnamid || 'Sans matricule'}</strong> ({sp.caisse || 'CNSS'})</div>
                      {sp.apci && <div>★ APCI : <strong style={{ color: '#facc15' }}>{sp.apci}</strong></div>}
                    </div>

                    <div style={{
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: '1px dashed #334155',
                      fontSize: '0.8rem',
                      color: '#fca5a5',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span>🩺 {sourceCounts.consults} consult. à transférer</span>
                      <span>💊 {sourceCounts.prescs} ordonn.</span>
                      <span>💳 {sourceCounts.invoices} factures</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: '#64748b', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
                  Aucun dossier secondaire sélectionné. Utilisez la recherche ci-dessous pour choisir le doublon.
                </div>
              )}
            </div>
          </div>

          {/* Recherche pour ajouter un autre dossier à fusionner si besoin */}
          {sourcePatients.length === 0 && (
            <div style={{ background: '#1e293b', padding: '14px', borderRadius: '10px', border: '1px solid #334155' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                🔍 Rechercher le second patient à fusionner :
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, prénom, N° fiche ou téléphone..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              />
              {filteredPatients.length > 0 && (
                <div style={{
                  marginTop: '8px',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px'
                }}>
                  {filteredPatients.slice(0, 5).map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectSource(p)}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div>
                        <strong style={{ color: '#f8fafc' }}>{p.nom} {p.prenom}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Né(e) le {p.birthdate || 'Inconnu'} • Tél: {p.telephone || '-'} • Fiche: {p.numfch || p.id}
                        </div>
                      </div>
                      <button
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: '#ef4444',
                          border: 'none',
                          color: '#fff',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}
                      >
                        Sélectionner comme doublon
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Règle et explication */}
          <div style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '10px',
            padding: '12px 16px',
            fontSize: '0.85rem',
            color: '#cbd5e1',
            lineHeight: 1.5
          }}>
            💡 <strong>Fonctionnement de la fusion :</strong>
            <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px' }}>
              <li>Toutes les <strong>consultations</strong>, <strong>ordonnances</strong> et <strong>quittances CNAM</strong> enregistrées sur le doublon seront instantanément réassignées au dossier principal.</li>
              <li>Les coordonnées manquantes (téléphone, CIN, caisse, adresse) et les antécédents médicaux/allergies seront complétés automatiquement.</li>
              <li>Le dossier doublon secondaire sera proprement supprimé de la base de données locale.</li>
            </ul>
          </div>

          {errorMsg && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              fontSize: '0.85rem'
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid #22c55e',
              color: '#86efac',
              fontSize: '0.85rem'
            }}>
              {successMsg}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: '#1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleConfirmMerge}
            disabled={loading || !targetPatient || sourcePatients.length === 0}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              background: (!targetPatient || sourcePatients.length === 0)
                ? '#475569'
                : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: (!targetPatient || sourcePatients.length === 0 || loading) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)'
            }}
          >
            <span>🔀</span> Confirmer la Fusion Définitive
          </button>
        </div>
      </div>
    </div>
  );
}
