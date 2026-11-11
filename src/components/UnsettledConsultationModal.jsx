import React, { useState } from 'react';
import { saveInvoice, clearUnsettledConsultation } from '../services/patientStorage';
import { generateReceiptReport } from '../services/receiptReportGenerator';

export default function UnsettledConsultationModal({
  unsettledData,
  onSettled = () => {},
  onOpenFullBilling = () => {},
  onDismissTemporarily = () => {}
}) {
  if (!unsettledData) return null;

  const [modeReglement, setModeReglement] = useState(() => {
    if (unsettledData.isApci) return 'cnam_apci';
    if (unsettledData.filiere && unsettledData.filiere.toLowerCase().includes('privée')) return 'cnam_mo';
    return 'comptant';
  });

  const [montantComptant, setMontantComptant] = useState('40.000');
  const [ticketModerateur, setTicketModerateur] = useState('19.000');
  const [partCnamMo, setPartCnamMo] = useState('21.000');
  const [moyenPaiement, setMoyenPaiement] = useState('especes'); // 'especes' | 'cheque' | 'tiers_payant' | 'gratuit'
  const [motifGratuite, setMotifGratuite] = useState('Contrôle sous 7 jours');
  const [printReceipt, setPrintReceipt] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleModeChange = (mode) => {
    setModeReglement(mode);
    if (mode === 'cnam_apci') {
      setMoyenPaiement('tiers_payant');
    } else if (mode === 'gratuit') {
      setMoyenPaiement('gratuit');
    } else {
      if (moyenPaiement === 'tiers_payant' || moyenPaiement === 'gratuit') {
        setMoyenPaiement('especes');
      }
    }
  };

  const handleConfirmPayment = async () => {
    try {
      setSaving(true);
      let totalGlobal = 40.0;
      let partPatient = 40.0;
      let partCnam = 0.0;
      let obs = '';

      if (modeReglement === 'comptant') {
        partPatient = parseFloat(montantComptant) || 40.0;
        partCnam = 0.0;
        totalGlobal = partPatient;
        obs = `Consultation générale (Comptant ${partPatient.toFixed(3)} DT)`;
      } else if (modeReglement === 'cnam_mo') {
        partPatient = parseFloat(ticketModerateur) || 19.0;
        partCnam = parseFloat(partCnamMo) || 21.0;
        totalGlobal = partPatient + partCnam;
        obs = `Consultation générale (Filière Privée MO - Ticket Modérateur : ${partPatient.toFixed(3)} DT)`;
      } else if (modeReglement === 'cnam_apci') {
        partPatient = 0.0;
        partCnam = 40.0;
        totalGlobal = 40.0;
        obs = `Consultation APCI (Tiers-Payant 100% CNAM)`;
      } else if (modeReglement === 'gratuit') {
        partPatient = 0.0;
        partCnam = 0.0;
        totalGlobal = 0.0;
        obs = `Consultation Gratuite / Exonérée (${motifGratuite})`;
      }

      const invoiceData = {
        date: unsettledData.date || new Date().toISOString().split('T')[0],
        patientId: unsettledData.patientId,
        patientName: unsettledData.patientName,
        consultationId: unsettledData.consultationId,
        modeReglement,
        actes: [
          {
            code: modeReglement === 'cnam_apci' ? 'C_APCI' : modeReglement === 'cnam_mo' ? 'C_MO' : modeReglement === 'gratuit' ? 'C_GRATUIT' : 'C_COMPTANT',
            nom: modeReglement === 'gratuit' ? `Consultation Gratuite (${motifGratuite})` : 'Consultation Médicale',
            montantGlobal: totalGlobal,
            partCnam,
            partPatient,
            quantite: 1
          }
        ],
        totalGlobal,
        partPatient,
        partCnam,
        moyenPaiement: modeReglement === 'gratuit' ? 'gratuit' : (modeReglement === 'cnam_apci' ? 'tiers_payant' : moyenPaiement),
        montantRecu: partPatient,
        monnaieRendue: 0,
        estPaye: true,
        statutBordereau: partCnam > 0 ? 'en_attente' : 'non_soumis',
        bordereauId: null,
        observations: obs
      };

      const invId = await saveInvoice(invoiceData);
      clearUnsettledConsultation();

      if (printReceipt) {
        generateReceiptReport(
          {
            id: unsettledData.patientId,
            nom: unsettledData.patientName.split(' ')[0] || '',
            prenom: unsettledData.patientName.split(' ').slice(1).join(' ') || '',
            cnamid: unsettledData.patientCnamId || '',
            caisse: unsettledData.patientCaisse || 'CNSS',
            filiere: unsettledData.filiere || 'Privée',
            apci: unsettledData.isApci ? 'APCI' : ''
          },
          { ...invoiceData, id: invId }
        );
      }

      onSettled(invoiceData);
    } catch (err) {
      alert("Erreur lors de l'enregistrement du règlement : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 10, 25, 0.88)',
      backdropFilter: 'blur(8px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '8px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: '#0f172a',
        borderRadius: '16px',
        border: '2px solid #38bdf8',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 35px rgba(56, 189, 248, 0.35)',
        width: '100%',
        maxWidth: '540px',
        maxHeight: 'min(94vh, calc(100dvh - 16px))',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn 0.2s ease-out',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        {/* En-tête accrocheur & sécurisant */}
        <div style={{
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          padding: '12px 16px',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.3rem' }}>💳</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.2px' }}>
                Règlement de la Consultation
              </h3>
              <div style={{ fontSize: '0.75rem', opacity: 0.95, marginTop: '1px' }}>
                Aucun paiement ne doit être oublié
              </div>
            </div>
          </div>
          <button
            onClick={onDismissTemporarily}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Régler plus tard (Le rappel s'affichera à chaque manipulation)"
          >
            ✕
          </button>
        </div>

        {/* Fiche Patient & Consultation */}
        <div style={{
          padding: '9px 16px',
          background: '#1e293b',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.82rem',
          flexShrink: 0
        }}>
          <div>
            <span style={{ color: '#94a3b8' }}>Patient : </span>
            <strong style={{ color: '#38bdf8', fontSize: '0.95rem' }}>{unsettledData.patientName}</strong>
          </div>
          <div style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>
            📅 {unsettledData.date} à {unsettledData.heure || '10:00'}
          </div>
        </div>

        {/* Choix des Modes de Règlement - DÉFILEMENT INTERNE FLUIDE */}
        <div style={{
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          flex: '1 1 auto',
          minHeight: 0
        }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Sélectionnez la prise en charge :
          </div>

          {/* Option 1 : Comptant */}
          <div
            onClick={() => handleModeChange('comptant')}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: modeReglement === 'comptant' ? '2px solid #38bdf8' : '1px solid #334155',
              background: modeReglement === 'comptant' ? 'rgba(56, 189, 248, 0.15)' : '#1e293b',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="radio"
                  name="modalMode"
                  checked={modeReglement === 'comptant'}
                  onChange={() => handleModeChange('comptant')}
                  style={{ width: '18px', height: '18px', accentColor: '#38bdf8' }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem' }}>
                    💵 Règlement Comptant (100% Patient)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    Paiement direct au cabinet (Espèces / Chèque)
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="text"
                  value={montantComptant}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setMontantComptant(e.target.value)}
                  style={{
                    width: '75px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: '#0f172a',
                    border: '1px solid #38bdf8',
                    color: '#38bdf8',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    textAlign: 'right'
                  }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>DT</span>
              </div>
            </div>

            {modeReglement === 'comptant' && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px', paddingLeft: '28px' }}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMoyenPaiement('especes'); }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: moyenPaiement === 'especes' ? '#0284c7' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  💵 Espèces
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMoyenPaiement('cheque'); }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: moyenPaiement === 'cheque' ? '#0284c7' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  📝 Chèque
                </button>
              </div>
            )}
          </div>

          {/* Option 2 : CNAM MO */}
          <div
            onClick={() => handleModeChange('cnam_mo')}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: modeReglement === 'cnam_mo' ? '2px solid #10b981' : '1px solid #334155',
              background: modeReglement === 'cnam_mo' ? 'rgba(16, 185, 129, 0.15)' : '#1e293b',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="radio"
                  name="modalMode"
                  checked={modeReglement === 'cnam_mo'}
                  onChange={() => handleModeChange('cnam_mo')}
                  style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: '#34d399', fontSize: '0.92rem' }}>
                    🏛️ CNAM Maladie Ordinaire (MO - Filière Privée)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    Ticket modérateur patient : <strong>{ticketModerateur} DT</strong> + Part CNAM : <strong>{partCnamMo} DT</strong>
                  </div>
                </div>
              </div>
              <span style={{ color: '#34d399', fontWeight: 800, fontSize: '0.92rem' }}>
                40.000 DT
              </span>
            </div>
          </div>

          {/* Option 3 : CNAM APCI */}
          <div
            onClick={() => handleModeChange('cnam_apci')}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: modeReglement === 'cnam_apci' ? '2px solid #f59e0b' : '1px solid #334155',
              background: modeReglement === 'cnam_apci' ? 'rgba(245, 158, 11, 0.15)' : '#1e293b',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="radio"
                  name="modalMode"
                  checked={modeReglement === 'cnam_apci'}
                  onChange={() => handleModeChange('cnam_apci')}
                  style={{ width: '18px', height: '18px', accentColor: '#f59e0b' }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.92rem' }}>
                    ★ CNAM APCI (Tiers-Payant 100%)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    Patient : <strong>0 DT</strong> • Prise en charge intégrale CNAM : <strong>40.000 DT</strong>
                  </div>
                </div>
              </div>
              <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.92rem' }}>
                0 DT Patient
              </span>
            </div>
          </div>

          {/* Option 4 : GRATUIT (Demandé spécifiquement par l'utilisateur) */}
          <div
            onClick={() => handleModeChange('gratuit')}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: modeReglement === 'gratuit' ? '2px solid #c084fc' : '1px solid #334155',
              background: modeReglement === 'gratuit' ? 'rgba(192, 132, 252, 0.2)' : '#1e293b',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="radio"
                  name="modalMode"
                  checked={modeReglement === 'gratuit'}
                  onChange={() => handleModeChange('gratuit')}
                  style={{ width: '18px', height: '18px', accentColor: '#c084fc' }}
                />
                <div>
                  <div style={{ fontWeight: 800, color: '#c084fc', fontSize: '0.95rem' }}>
                    🎁 Prise en charge Gratuite / Exonérée
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    Contrôle sous 7 jours, confraternelle ou cas social
                  </div>
                </div>
              </div>
              <span style={{
                background: '#7c3aed',
                color: '#fff',
                padding: '3px 8px',
                borderRadius: '6px',
                fontWeight: 800,
                fontSize: '0.85rem'
              }}>
                0.000 DT
              </span>
            </div>

            {modeReglement === 'gratuit' && (
              <div style={{ marginTop: '8px', paddingLeft: '28px' }}>
                <select
                  value={motifGratuite}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setMotifGratuite(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: '#0f172a',
                    border: '1px solid #7c3aed',
                    color: '#fff',
                    fontSize: '0.8rem'
                  }}
                >
                  <option value="Contrôle médical sous 7 jours">Contrôle médical sous 7 jours (Gratuit)</option>
                  <option value="Consultation confraternelle">Consultation confraternelle (Gratuit)</option>
                  <option value="Cas social / Geste gracieux">Cas social / Geste gracieux (Gratuit)</option>
                  <option value="Simple lecture de bilan / résultat">Simple lecture de bilan / résultat (Gratuit)</option>
                  <option value="Urgence gracieuse">Urgence gracieuse (Gratuit)</option>
                </select>
              </div>
            )}
          </div>

          {/* Option d'impression de quittance */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.8rem',
            color: '#cbd5e1',
            cursor: 'pointer',
            marginTop: '2px',
            padding: '4px 2px'
          }}>
            <input
              type="checkbox"
              checked={printReceipt}
              onChange={(e) => setPrintReceipt(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#0284c7' }}
            />
            <span>🖨️ Imprimer la quittance / reçu immédiatement après validation</span>
          </label>
        </div>

        {/* Pied d'actions - FIXE EN BAS ET TOUJOURS VISIBLE SANS SCROLL */}
        <div style={{
          padding: '10px 14px',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))',
          background: '#0b1329',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
          boxShadow: '0 -4px 14px rgba(0, 0, 0, 0.4)'
        }}>
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            width: '100%'
          }}>
            <button
              type="button"
              onClick={onDismissTemporarily}
              style={{
                flex: '1 1 35%',
                padding: '10px 8px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#94a3b8',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                textAlign: 'center'
              }}
              title="Reporter temporairement (Rappel actif)"
            >
              Régler plus tard
            </button>

            <button
              type="button"
              onClick={handleConfirmPayment}
              disabled={saving}
              style={{
                flex: '1 1 65%',
                padding: '10px 12px',
                borderRadius: '8px',
                background: modeReglement === 'gratuit'
                  ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'
                  : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span>✓</span>
              <span>{saving ? 'Validation...' : 'Valider le Règlement'}</span>
            </button>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={onOpenFullBilling}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '2px 6px'
              }}
            >
              📑 Facturation complète & Actes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
