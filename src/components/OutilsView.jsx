import React, { useState, useEffect, useMemo } from 'react';
import {
  getMapaRecords,
  saveMapaRecord,
  deleteMapaRecord,
  generateSampleMapaReadings,
  getMailHistory,
  saveMailLog,
  getMailTemplates,
  DEFAULT_MAIL_TEMPLATES,
  getSmsHistory,
  saveSmsLog,
  DEFAULT_SMS_TEMPLATES,
  getScoresHistory,
  saveScoreRecord,
  deleteScoreRecord,
  getAddictoHistory,
  saveAddictoRecord,
  deleteAddictoRecord
} from '../services/toolsStorage';
import { 
  isSmsRdvActivated, 
  getSmsLicenseStatus, 
  activateSmsLicense, 
  deactivateSmsLicense,
  generateMobileSmsTrialKey,
  getLastGeneratedTrialKey
} from '../services/smsLicenseService';
import { 
  getTransmittedAppointmentsQueue, 
  markAppointmentSmsSent, 
  testGatewayConnection, 
  getGatewayUrl, 
  setGatewayUrl,
  fetchDoctorDeviceStatus,
  fetchCloudAppointments,
  triggerInstantSmsPush,
  checkAndSyncCloudLicense,
  broadcastLicenseToCloud,
  CLOUD_CONFIG
} from '../services/smsGatewayService';

export default function OutilsView({
  initialTool = 'mapa',
  onToolChange = () => {},
  currentPatient = null,
  allPatients = [],
  onOpenConsultation = () => {}
}) {
  const [activeTool, setActiveTool] = useState(initialTool); // 'mapa' | 'mail' | 'sms' | 'scores'
  const [selectedPatientId, setSelectedPatientId] = useState(currentPatient ? String(currentPatient.id) : '');
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (initialTool) {
      setActiveTool(initialTool);
    }
  }, [initialTool]);

  const handleToolSwitch = (tool) => {
    setActiveTool(tool);
    onToolChange(tool);
  };

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Patient actif résolu
  const activePatient = useMemo(() => {
    if (!selectedPatientId) return currentPatient || null;
    return allPatients.find(p => String(p.id) === String(selectedPatientId)) || currentPatient || null;
  }, [selectedPatientId, allPatients, currentPatient]);

  // Âge calculé du patient actif
  const patientAge = useMemo(() => {
    if (!activePatient || !activePatient.dateNaissance) return 55;
    try {
      const birth = new Date(activePatient.dateNaissance);
      const diff = Date.now() - birth.getTime();
      const ageDate = new Date(diff);
      return Math.abs(ageDate.getUTCFullYear() - 1970) || 55;
    } catch (e) {
      return 55;
    }
  }, [activePatient]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: '#0b1329',
      color: '#f8fafc'
    }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 99999,
          background: notification.type === 'success' ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : '#dc2626',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.9rem',
          fontWeight: 600,
          border: '1px solid rgba(255,255,255,0.2)',
          animation: 'fadeIn 0.25s ease'
        }}>
          <span>{notification.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Barre Supérieure du Module Outils */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: '#0f172a',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
          }}>
            🛠️
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                Outils Médicaux
              </h1>
              <span style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 600
              }}>
                DocPocket Suite
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Modules d'aide au diagnostic, cardiologie, communication & calculs cliniques
            </div>
          </div>
        </div>

        {/* Sélecteur de patient transversal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Patient lié :</span>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              background: '#1e293b',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#f8fafc',
              fontSize: '0.85rem',
              fontWeight: 500,
              maxWidth: '260px'
            }}
          >
            <option value="">-- Aucun patient sélectionné --</option>
            {allPatients.map(p => (
              <option key={p.id} value={p.id}>
                {p.nom} {p.prenom} {p.telephone ? `(${p.telephone})` : ''}
              </option>
            ))}
          </select>

          {activePatient && (
            <button
              onClick={() => onOpenConsultation(activePatient)}
              title="Ouvrir la consultation de ce patient"
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>🩺</span> Consultation
            </button>
          )}
        </div>
      </div>

      {/* Onglets des 4 Outils */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#0f172a',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '0 20px',
        overflowX: 'auto',
        flexShrink: 0,
        gap: '8px'
      }}>
        <button
          onClick={() => handleToolSwitch('mapa')}
          style={{
            padding: '12px 18px',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTool === 'mapa' ? '3px solid #38bdf8' : '3px solid transparent',
            color: activeTool === 'mapa' ? '#38bdf8' : '#94a3b8',
            fontWeight: activeTool === 'mapa' ? 700 : 500,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}
        >
          <span style={{ fontSize: '1.15rem' }}>🩺</span>
          <span>DocPocket Mapa</span>
        </button>

        <button
          onClick={() => handleToolSwitch('mail')}
          style={{
            padding: '12px 18px',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTool === 'mail' ? '3px solid #38bdf8' : '3px solid transparent',
            color: activeTool === 'mail' ? '#38bdf8' : '#94a3b8',
            fontWeight: activeTool === 'mail' ? 700 : 500,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}
        >
          <span style={{ fontSize: '1.15rem' }}>✉️</span>
          <span>MailPocket Pro</span>
        </button>

        <button
          onClick={() => handleToolSwitch('sms')}
          style={{
            padding: '12px 18px',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTool === 'sms' ? '3px solid #38bdf8' : '3px solid transparent',
            color: activeTool === 'sms' ? '#38bdf8' : '#94a3b8',
            fontWeight: activeTool === 'sms' ? 700 : 500,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}
        >
          <span style={{ fontSize: '1.15rem' }}>💬</span>
          <span>DocPocket SMS RDV</span>
        </button>

        <button
          onClick={() => handleToolSwitch('scores')}
          style={{
            padding: '12px 18px',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTool === 'scores' ? '3px solid #38bdf8' : '3px solid transparent',
            color: activeTool === 'scores' ? '#38bdf8' : '#94a3b8',
            fontWeight: activeTool === 'scores' ? 700 : 500,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}
        >
          <span style={{ fontSize: '1.15rem' }}>🧮</span>
          <span>DocPocket Scores</span>
        </button>

        <button
          onClick={() => handleToolSwitch('addicto')}
          style={{
            padding: '12px 18px',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTool === 'addicto' ? '3px solid #10b981' : '3px solid transparent',
            color: activeTool === 'addicto' ? '#10b981' : '#94a3b8',
            fontWeight: activeTool === 'addicto' ? 700 : 500,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}
        >
          <span style={{ fontSize: '1.15rem' }}>🌿</span>
          <span>DocPocket Addicto</span>
        </button>
      </div>

      {/* Contenu Défilable du sous-module sélectionné */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {activeTool === 'mapa' && (
          <DocPocketMapaModule
            patient={activePatient}
            onNotify={showNotification}
          />
        )}

        {activeTool === 'mail' && (
          <MailPocketProModule
            patient={activePatient}
            onNotify={showNotification}
          />
        )}

        {activeTool === 'sms' && (
          <DocPocketSmsModule
            patient={activePatient}
            allPatients={allPatients}
            onNotify={showNotification}
          />
        )}

        {activeTool === 'scores' && (
          <DocPocketScoresModule
            patient={activePatient}
            patientAge={patientAge}
            onNotify={showNotification}
          />
        )}

        {activeTool === 'addicto' && (
          <DocPocketAddictoModule
            patient={activePatient}
            onNotify={showNotification}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 1. MODULE DOCPOCKET MAPA (HOLTER TENSIONNEL 24H)
// ============================================================================
function DocPocketMapaModule({ patient, onNotify }) {
  const [readings, setReadings] = useState(() => generateSampleMapaReadings('dipper_normal'));
  const [indication, setIndication] = useState('Suspicion HTA essentielle');
  const [traitement, setTraitement] = useState('Aucun (diagnostic initial)');
  const [dayStart, setDayStart] = useState('07:00');
  const [dayEnd, setDayEnd] = useState('22:00');
  const [newReading, setNewReading] = useState({
    time: '12:00',
    pas: 130,
    pad: 80,
    fc: 75,
    act: 'Activité normale'
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Séparation Diurne / Nocturne
  const { dayReadings, nightReadings } = useMemo(() => {
    const day = [];
    const night = [];
    readings.forEach(r => {
      const t = r.time;
      if (t >= dayStart && t < dayEnd) {
        day.push(r);
      } else {
        night.push(r);
      }
    });
    return { dayReadings: day, nightReadings: night };
  }, [readings, dayStart, dayEnd]);

  // Calculs statistiques
  const stats = useMemo(() => {
    const calcMean = (arr, key) => {
      if (!arr.length) return 0;
      const sum = arr.reduce((acc, curr) => acc + Number(curr[key] || 0), 0);
      return Math.round(sum / arr.length);
    };

    // 24h
    const mean24PAS = calcMean(readings, 'pas');
    const mean24PAD = calcMean(readings, 'pad');
    const mean24FC = calcMean(readings, 'fc');
    const mean24PAM = Math.round(mean24PAD + (mean24PAS - mean24PAD) / 3);
    const mean24PP = mean24PAS - mean24PAD;

    // Jour
    const meanDayPAS = calcMean(dayReadings, 'pas');
    const meanDayPAD = calcMean(dayReadings, 'pad');
    const dayOverPAS = dayReadings.filter(r => r.pas > 135).length;
    const dayChargePAS = dayReadings.length ? Math.round((dayOverPAS / dayReadings.length) * 100) : 0;

    // Nuit
    const meanNightPAS = calcMean(nightReadings, 'pas');
    const meanNightPAD = calcMean(nightReadings, 'pad');
    const nightOverPAS = nightReadings.filter(r => r.pas > 120).length;
    const nightChargePAS = nightReadings.length ? Math.round((nightOverPAS / nightReadings.length) * 100) : 0;

    // Baisse Nocturne (Dipping %)
    let dippingPercent = 0;
    if (meanDayPAS > 0) {
      dippingPercent = Math.round(((meanDayPAS - meanNightPAS) / meanDayPAS) * 100 * 10) / 10;
    }

    let dippingStatus = 'Dipper Normal (10 - 20%)';
    let dippingColor = '#10b981';
    let dippingSeverity = 'Physiologique';

    if (dippingPercent >= 10 && dippingPercent <= 20) {
      dippingStatus = 'Dipper Normal (10% à 20%)';
      dippingColor = '#10b981';
      dippingSeverity = 'Baisse nocturne physiologique préservée';
    } else if (dippingPercent >= 0 && dippingPercent < 10) {
      dippingStatus = 'Non-Dipper (< 10%)';
      dippingColor = '#f59e0b';
      dippingSeverity = 'Absence de baisse nocturne (Risque cardiovasculaire accru)';
    } else if (dippingPercent < 0) {
      dippingStatus = 'Riser / Inversé (< 0%)';
      dippingColor = '#ef4444';
      dippingSeverity = 'PA nocturne supérieure au jour (Très haut risque d\'AVC et insuffisance cardiaque)';
    } else if (dippingPercent > 20) {
      dippingStatus = 'Extreme Dipper (> 20%)';
      dippingColor = '#0284c7';
      dippingSeverity = 'Baisse nocturne excessive (Risque d\'hypoperfusion et d\'ischémie)';
    }

    // Diagnostic ESH/ESC
    let diagnostic = 'Normotension artérielle ambulatoire';
    let diagColor = '#10b981';

    const isGlobalHigh = mean24PAS >= 130 || mean24PAD >= 80;
    const isDayHigh = meanDayPAS >= 135 || meanDayPAD >= 85;
    const isNightHigh = meanNightPAS >= 120 || meanNightPAD >= 70;

    if (isGlobalHigh || isDayHigh || isNightHigh) {
      if (isDayHigh && !isNightHigh) {
        diagnostic = 'HTA Diurne isolée (Normotension nocturne)';
        diagColor = '#f59e0b';
      } else if (!isDayHigh && isNightHigh) {
        diagnostic = 'HTA Nocturne isolée (Risque élevé d\'atteinte des organes cibles)';
        diagColor = '#ef4444';
      } else {
        diagnostic = 'HTA Globale confirmée (Jour & Nuit non contrôlées)';
        diagColor = '#ef4444';
      }
    }

    return {
      mean24PAS, mean24PAD, mean24PAM, mean24FC, mean24PP,
      meanDayPAS, meanDayPAD, dayChargePAS,
      meanNightPAS, meanNightPAD, nightChargePAS,
      dippingPercent, dippingStatus, dippingColor, dippingSeverity,
      diagnostic, diagColor
    };
  }, [readings, dayReadings, nightReadings]);

  const handleAddReading = (e) => {
    e.preventDefault();
    const item = {
      time: newReading.time,
      pas: parseInt(newReading.pas, 10),
      pad: parseInt(newReading.pad, 10),
      fc: parseInt(newReading.fc, 10),
      act: newReading.act || 'Mesure'
    };
    const updated = [...readings, item].sort((a, b) => a.time.localeCompare(b.time));
    setReadings(updated);
    setShowAddForm(false);
    onNotify('Mesure tensionnelle ajoutée');
  };

  const handleDeleteReading = (index) => {
    const updated = readings.filter((_, i) => i !== index);
    setReadings(updated);
    onNotify('Mesure supprimée');
  };

  const handleSaveToPatientRecord = () => {
    const record = {
      patientId: patient ? patient.id : null,
      patientName: patient ? `${patient.nom} ${patient.prenom}` : 'Anonyme',
      date: new Date().toISOString(),
      indication,
      traitement,
      stats,
      readingsCount: readings.length,
      diagnostic: stats.diagnostic
    };
    saveMapaRecord(record);
    onNotify('Examen MAPA 24h sauvegardé avec succès dans l\'historique du cabinet');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* En-tête & Actions Rapides */}
      <div style={{
        background: '#1e293b',
        borderRadius: '12px',
        padding: '18px 22px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc', fontWeight: 700 }}>
              DocPocket Mapa - Holter Tensionnel 24h
            </h2>
            <span style={{
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '6px',
              fontWeight: 600
            }}>
              Recommandations ESH / ESC
            </span>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
            Patient : <strong style={{ color: '#fff' }}>{patient ? `${patient.nom} ${patient.prenom}` : 'Aucun (Sélectionnez en haut)'}</strong>
            {patient && ` • Âge : ${patient.age || '55'} ans • Matricule CNAM : ${patient.matriculeCnam || 'Non renseigné'}`}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            onClick={() => setReadings(generateSampleMapaReadings('dipper_normal'))}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ⚡ Tracé Dipper Normal
          </button>
          <button
            onClick={() => setReadings(generateSampleMapaReadings('non_dipper'))}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ⚡ Tracé Non-Dipper
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ➕ Ajouter Mesure
          </button>
          <button
            onClick={handleSaveToPatientRecord}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
            }}
          >
            💾 Enregistrer
          </button>
          <button
            onClick={() => setShowPrintPreview(!showPrintPreview)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#334155',
              border: 'none',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🖨️ {showPrintPreview ? 'Masquer Compte-Rendu' : 'Imprimer Compte-Rendu'}
          </button>
        </div>
      </div>

      {/* Paramètres de l'Examen MAPA */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '14px',
        background: '#131d36',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>
            Motif / Indication de la MAPA :
          </label>
          <input
            type="text"
            value={indication}
            onChange={(e) => setIndication(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.85rem'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>
            Traitement Antihypertenseur en cours :
          </label>
          <input
            type="text"
            value={traitement}
            onChange={(e) => setTraitement(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.85rem'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>
              Début Journée :
            </label>
            <input
              type="time"
              value={dayStart}
              onChange={(e) => setDayStart(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                background: '#0f172a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.85rem'
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>
              Début Nuit :
            </label>
            <input
              type="time"
              value={dayEnd}
              onChange={(e) => setDayEnd(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                background: '#0f172a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.85rem'
              }}
            />
          </div>
        </div>
      </div>

      {/* Modal Ajout Mesure Manuelle */}
      {showAddForm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <form
            onSubmit={handleAddReading}
            style={{
              background: '#0f172a',
              border: '1.5px solid #38bdf8',
              borderRadius: '14px',
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
              ➕ Ajouter une mesure tensionnelle
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Heure :</label>
                <input
                  type="time"
                  required
                  value={newReading.time}
                  onChange={(e) => setNewReading({ ...newReading, time: e.target.value })}
                  style={{ width: '100%', padding: '8px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Pouls (bpm) :</label>
                <input
                  type="number"
                  min="30"
                  max="220"
                  required
                  value={newReading.fc}
                  onChange={(e) => setNewReading({ ...newReading, fc: e.target.value })}
                  style={{ width: '100%', padding: '8px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>PAS (Systolique mmHg) :</label>
                <input
                  type="number"
                  min="60"
                  max="280"
                  required
                  value={newReading.pas}
                  onChange={(e) => setNewReading({ ...newReading, pas: e.target.value })}
                  style={{ width: '100%', padding: '8px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f87171', fontWeight: 700 }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>PAD (Diastolique mmHg) :</label>
                <input
                  type="number"
                  min="30"
                  max="180"
                  required
                  value={newReading.pad}
                  onChange={(e) => setNewReading({ ...newReading, pad: e.target.value })}
                  style={{ width: '100%', padding: '8px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#38bdf8', fontWeight: 700 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Activité / Contexte :</label>
              <input
                type="text"
                placeholder="Ex: Repos, Travail, Sommeil, Repas..."
                value={newReading.act}
                onChange={(e) => setNewReading({ ...newReading, act: e.target.value })}
                style={{ width: '100%', padding: '8px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                style={{ padding: '8px 14px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                type="submit"
                style={{ padding: '8px 18px', background: '#0284c7', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Enregistrer la mesure
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4 Cartes KPI Synthèse Clinique */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px'
      }}>
        {/* Moyenne 24H */}
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '16px 18px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
            Moyenne 24h (Norme &lt; 130/80)
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: stats.mean24PAS >= 130 || stats.mean24PAD >= 80 ? '#f87171' : '#34d399', margin: '6px 0 2px' }}>
            {stats.mean24PAS} / {stats.mean24PAD} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#94a3b8' }}>mmHg</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
            PAM : <strong>{stats.mean24PAM} mmHg</strong> • Pouls : <strong>{stats.mean24FC} bpm</strong>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
            Pression Pulsée (PP) : <strong style={{ color: stats.mean24PP > 50 ? '#f59e0b' : '#34d399' }}>{stats.mean24PP} mmHg</strong>
          </div>
        </div>

        {/* Moyenne Diurne */}
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '16px 18px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
            Période Jour (Norme &lt; 135/85)
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: stats.meanDayPAS >= 135 || stats.meanDayPAD >= 85 ? '#f87171' : '#34d399', margin: '6px 0 2px' }}>
            {stats.meanDayPAS} / {stats.meanDayPAD} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#94a3b8' }}>mmHg</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
            Charge diurne &gt; 135/85 : <strong style={{ color: stats.dayChargePAS > 20 ? '#f59e0b' : '#34d399' }}>{stats.dayChargePAS} %</strong>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
            {dayReadings.length} mesures enregistrées
          </div>
        </div>

        {/* Moyenne Nocturne */}
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '16px 18px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
            Période Nuit (Norme &lt; 120/70)
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: stats.meanNightPAS >= 120 || stats.meanNightPAD >= 70 ? '#f87171' : '#34d399', margin: '6px 0 2px' }}>
            {stats.meanNightPAS} / {stats.meanNightPAD} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#94a3b8' }}>mmHg</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
            Charge nocturne &gt; 120/70 : <strong style={{ color: stats.nightChargePAS > 20 ? '#f59e0b' : '#34d399' }}>{stats.nightChargePAS} %</strong>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
            {nightReadings.length} mesures enregistrées
          </div>
        </div>

        {/* Profil Dipping */}
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '16px 18px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
            Baisse Nocturne (Dipping)
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: stats.dippingColor, margin: '6px 0 2px' }}>
            {stats.dippingPercent > 0 ? `-${stats.dippingPercent}%` : `+${Math.abs(stats.dippingPercent)}%`}
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: stats.dippingColor }}>
            {stats.dippingStatus}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
            {stats.dippingSeverity}
          </div>
        </div>
      </div>

      {/* Bannière de Conclusion Diagnostique */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.8)',
        borderLeft: `5px solid ${stats.diagColor}`,
        borderRadius: '10px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
            Conclusion Clinique Automatisée
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: stats.diagColor, marginTop: '2px' }}>
            {stats.diagnostic}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '4px' }}>
            Profil rythmique : <strong>{stats.dippingStatus}</strong> • Charge globale : <strong>{stats.dayChargePAS}% (jour) / {stats.nightChargePAS}% (nuit)</strong>.
          </div>
        </div>
        <div style={{
          padding: '6px 14px',
          borderRadius: '8px',
          background: 'rgba(255, 255, 255, 0.06)',
          fontSize: '0.8rem',
          color: '#94a3b8'
        }}>
          Total : <strong style={{ color: '#fff' }}>{readings.length} mesures</strong> valides
        </div>
      </div>

      {/* Graphique Chronologique 24h (Tracé SVG) */}
      <div style={{
        background: '#1e293b',
        borderRadius: '12px',
        padding: '18px 20px',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#f8fafc' }}>
            📈 Tracé Chronologique des Mesures sur 24 Heures
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.78rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '3px', background: '#ef4444', display: 'inline-block' }}></span>
              PAS (Systolique)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '3px', background: '#38bdf8', display: 'inline-block' }}></span>
              PAD (Diastolique)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '3px', background: '#10b981', display: 'inline-block' }}></span>
              FC (Pouls bpm)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b' }}>
              - - - Seuils ESH (135/85 & 120/70)
            </span>
          </div>
        </div>

        {/* Zone SVG Graphique */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg viewBox="0 0 900 240" style={{ width: '100%', height: '240px', background: '#0f172a', borderRadius: '8px' }}>
            {/* Lignes de grille horizontales (50, 100, 150, 200 mmHg) */}
            {[50, 100, 150, 200].map(val => {
              const y = 220 - (val / 220) * 190;
              return (
                <g key={val}>
                  <line x1="45" y1={y} x2="880" y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                  <text x="10" y={y + 4} fill="#64748b" fontSize="10" fontFamily="monospace">{val}</text>
                </g>
              );
            })}

            {/* Ligne seuil Diurne PAS (135) et PAD (85) */}
            {(() => {
              const y135 = 220 - (135 / 220) * 190;
              const y85 = 220 - (85 / 220) * 190;
              return (
                <>
                  <line x1="45" y1={y135} x2="880" y2={y135} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity="0.4" />
                  <line x1="45" y1={y85} x2="880" y2={y85} stroke="#38bdf8" strokeDasharray="4 4" strokeOpacity="0.4" />
                </>
              );
            })()}

            {/* Points et Courbes des mesures */}
            {readings.length > 1 && (() => {
              const width = 835;
              const step = width / (readings.length - 1);

              const pointsPAS = readings.map((r, i) => `${45 + i * step},${220 - (r.pas / 220) * 190}`).join(' ');
              const pointsPAD = readings.map((r, i) => `${45 + i * step},${220 - (r.pad / 220) * 190}`).join(' ');
              const pointsFC = readings.map((r, i) => `${45 + i * step},${220 - (r.fc / 220) * 190}`).join(' ');

              return (
                <>
                  {/* Courbe PAS */}
                  <polyline fill="none" stroke="#ef4444" strokeWidth="2.5" points={pointsPAS} />
                  {/* Courbe PAD */}
                  <polyline fill="none" stroke="#38bdf8" strokeWidth="2.5" points={pointsPAD} />
                  {/* Courbe FC */}
                  <polyline fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="2 2" points={pointsFC} />

                  {/* Points et tooltips */}
                  {readings.map((r, i) => {
                    const x = 45 + i * step;
                    const yPAS = 220 - (r.pas / 220) * 190;
                    const yPAD = 220 - (r.pad / 220) * 190;
                    return (
                      <g key={i}>
                        <circle cx={x} cy={yPAS} r="4" fill="#ef4444" />
                        <circle cx={x} cy={yPAD} r="4" fill="#38bdf8" />
                        {i % Math.max(1, Math.floor(readings.length / 10)) === 0 && (
                          <text x={x} y="235" fill="#94a3b8" fontSize="9" textAnchor="middle">{r.time}</text>
                        )}
                      </g>
                    );
                  })}
                </>
              );
            })()}
          </svg>
        </div>
      </div>

      {/* Compte-Rendu Imprimable Officiel (affiché à la demande) */}
      {showPrintPreview && (
        <div style={{
          background: '#fff',
          color: '#0f172a',
          borderRadius: '12px',
          padding: '30px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          border: '1px solid #cbd5e1'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0284c7', paddingBottom: '16px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#0369a1' }}>
                CABINET MÉDICAL - Dr. Hamed BEN KHALIFA
              </h2>
              <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '2px' }}>
                Médecine Générale & Pratique Médicale • Tél : 71 000 000
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                RAPPORT D'ENREGISTREMENT M.A.P.A. 24H
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Date de l'examen : {new Date().toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', margin: '20px 0', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
            <div>
              <strong>Patient(e) :</strong> {patient ? `${patient.nom} ${patient.prenom}` : 'Non spécifié'}<br />
              <strong>Âge :</strong> {patient?.age || '55'} ans • <strong>Sexe :</strong> {patient?.sexe || 'M'}<br />
              <strong>Identifiant :</strong> {patient?.matriculeCnam || 'N/A'}
            </div>
            <div>
              <strong>Indication :</strong> {indication}<br />
              <strong>Traitement :</strong> {traitement}<br />
              <strong>Période d'analyse :</strong> 24 heures ({readings.length} mesures valides)
            </div>
          </div>

          <div style={{ margin: '20px 0' }}>
            <h4 style={{ margin: '0 0 10px', color: '#0369a1' }}>RÉSULTATS STATISTIQUES</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>Période</th>
                  <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>Moyenne PAS / PAD (mmHg)</th>
                  <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>Normes Recommandées</th>
                  <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>Charge Tensionnelle</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}><strong>Période Globale (24h)</strong></td>
                  <td style={{ padding: '8px', border: '1px solid #cbd5e1', fontWeight: 700 }}>{stats.mean24PAS} / {stats.mean24PAD} mmHg</td>
                  <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>&lt; 130 / 80 mmHg</td>
                  <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>PAM : {stats.mean24PAM} mmHg</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}><strong>Période Diurne (Jour)</strong></td>
                  <td style={{ padding: '8px', border: '1px solid #cbd5e1', fontWeight: 700 }}>{stats.meanDayPAS} / {stats.meanDayPAD} mmHg</td>
                  <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>&lt; 135 / 85 mmHg</td>
                  <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{stats.dayChargePAS} % des mesures</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}><strong>Période Nocturne (Nuit)</strong></td>
                  <td style={{ padding: '8px', border: '1px solid #cbd5e1', fontWeight: 700 }}>{stats.meanNightPAS} / {stats.meanNightPAD} mmHg</td>
                  <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>&lt; 120 / 70 mmHg</td>
                  <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{stats.nightChargePAS} % des mesures</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ margin: '20px 0', padding: '14px', background: '#f1f5f9', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 6px', color: '#0f172a' }}>CONCLUSION & CONDUITE À TENIR</h4>
            <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.5 }}>
              <strong>Diagnostic : </strong>{stats.diagnostic}.<br />
              <strong>Profil nycthéméral : </strong>{stats.dippingStatus} ({stats.dippingSeverity}).<br />
              <strong>Pression Pulsée moyenne : </strong>{stats.mean24PP} mmHg {stats.mean24PP > 50 ? '(Indice de rigidité artérielle augmenté)' : '(Dans les limites de la normale)'}.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Signature et Cachet du Médecin :</div>
              <div style={{ marginTop: '40px', fontWeight: 700, fontSize: '0.95rem' }}>Dr. Hamed BEN KHALIFA</div>
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => window.print()}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Imprimer cette fiche d'examen
            </button>
          </div>
        </div>
      )}

      {/* Tableau détaillé des mesures */}
      <div style={{
        background: '#1e293b',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
            📋 Liste Horodatée des Relevés ({readings.length})
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            Cliquez sur ✕ pour retirer un artefact de mesure
          </span>
        </div>

        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#94a3b8' }}>
                <th style={{ padding: '10px 14px' }}>Heure</th>
                <th style={{ padding: '10px 14px' }}>Période</th>
                <th style={{ padding: '10px 14px' }}>PAS (mmHg)</th>
                <th style={{ padding: '10px 14px' }}>PAD (mmHg)</th>
                <th style={{ padding: '10px 14px' }}>Pouls</th>
                <th style={{ padding: '10px 14px' }}>Activité / Contexte</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r, idx) => {
                const isNight = r.time < dayStart || r.time >= dayEnd;
                const isHigh = isNight ? (r.pas > 120 || r.pad > 70) : (r.pas > 135 || r.pad > 85);
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isNight ? 'rgba(15, 23, 42, 0.5)' : 'transparent' }}>
                    <td style={{ padding: '8px 14px', fontWeight: 600 }}>{r.time}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        background: isNight ? 'rgba(99, 102, 241, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: isNight ? '#818cf8' : '#fbbf24'
                      }}>
                        {isNight ? '🌙 Nuit' : '☀️ Jour'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 14px', color: isHigh ? '#f87171' : '#34d399', fontWeight: 700 }}>
                      {r.pas}
                    </td>
                    <td style={{ padding: '8px 14px', color: isHigh ? '#f87171' : '#38bdf8', fontWeight: 700 }}>
                      {r.pad}
                    </td>
                    <td style={{ padding: '8px 14px', color: '#cbd5e1' }}>{r.fc} bpm</td>
                    <td style={{ padding: '8px 14px', color: '#94a3b8' }}>{r.act}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleDeleteReading(idx)}
                        style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.85rem' }}
                        title="Supprimer la mesure"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. MODULE MAILPOCKET PRO (MESSAGERIE & RÉSULTATS MÉDICAUX)
// ============================================================================
function MailPocketProModule({ patient, onNotify }) {
  const templates = useMemo(() => getMailTemplates(), []);
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id || 'bilan_bio');
  const [destinataireType, setDestinataireType] = useState('patient'); // 'patient' | 'confrere' | 'labo'
  const [destinataireEmail, setDestinataireEmail] = useState(patient?.email || '');
  const [destinataireNom, setDestinataireNom] = useState(patient ? `${patient.nom} ${patient.prenom}` : '');
  const [objet, setObjet] = useState('');
  const [corps, setCorps] = useState('');
  const [history, setHistory] = useState(() => getMailHistory());

  useEffect(() => {
    if (patient) {
      if (destinataireType === 'patient') {
        setDestinataireEmail(patient.email || '');
        setDestinataireNom(`${patient.nom} ${patient.prenom}`);
      }
    }
  }, [patient, destinataireType]);

  useEffect(() => {
    const tmpl = templates.find(t => t.id === selectedTemplateId);
    if (tmpl) {
      setObjet(tmpl.objet);
      setCorps(tmpl.corps);
    }
  }, [selectedTemplateId, templates]);

  const handleSendViaMailClient = () => {
    if (!destinataireEmail) {
      alert('Veuillez renseigner une adresse email valide.');
      return;
    }
    const mailtoUrl = `mailto:${encodeURIComponent(destinataireEmail)}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;
    window.open(mailtoUrl, '_blank');

    const logEntry = {
      destinataireEmail,
      destinataireNom,
      type: destinataireType,
      objet,
      corps: corps.slice(0, 150) + '...',
      patientId: patient?.id || null
    };
    const saved = saveMailLog(logEntry);
    setHistory(getMailHistory());
    onNotify('Email préparé et ouvert dans votre client de messagerie');
  };

  const handleCopyMessage = () => {
    const fullText = `À : ${destinataireEmail}\nObjet : ${objet}\n\n${corps}`;
    navigator.clipboard.writeText(fullText);
    onNotify('Texte de l\'email copié dans le presse-papier');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{
        background: '#1e293b',
        borderRadius: '12px',
        padding: '18px 22px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc', fontWeight: 700 }}>
              MailPocket Pro - Messagerie Médicale Sécurisée
            </h2>
            <span style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '6px',
              fontWeight: 600
            }}>
              Résultats & Liaison Confrères
            </span>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
            Transmission confidentielle de résultats de bilans, courriers d'adressage et ordonnances
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleCopyMessage}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: '#cbd5e1',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            📋 Copier le Message
          </button>
          <button
            onClick={handleSendViaMailClient}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
            }}
          >
            🚀 Envoyer (Client Messagerie)
          </button>
        </div>
      </div>

      {/* Formulaire d'envoi & Modèles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px'
      }}>
        {/* Éditeur de message */}
        <div style={{
          background: '#131d36',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            {['patient', 'confrere', 'labo'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setDestinataireType(type)}
                style={{
                  flex: 1,
                  padding: '7px',
                  borderRadius: '6px',
                  border: 'none',
                  background: destinataireType === type ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.04)',
                  color: destinataireType === type ? '#38bdf8' : '#94a3b8',
                  fontSize: '0.8rem',
                  fontWeight: destinataireType === type ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                {type === 'patient' ? '👤 Patient' : type === 'confrere' ? '👨‍⚕️ Confrère Spécialiste' : '🔬 Laboratoire'}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                Nom du destinataire :
              </label>
              <input
                type="text"
                value={destinataireNom}
                onChange={(e) => setDestinataireNom(e.target.value)}
                placeholder="Ex: M. BEN SALAH / Dr. TRABELSI"
                style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                Adresse Email :
              </label>
              <input
                type="email"
                required
                value={destinataireEmail}
                onChange={(e) => setDestinataireEmail(e.target.value)}
                placeholder="exemple@email.com"
                style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#38bdf8', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
              Modèle Pré-rempli :
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.titre}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
              Objet du message :
            </label>
            <input
              type="text"
              value={objet}
              onChange={(e) => setObjet(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
              Corps de la communication médicale :
            </label>
            <textarea
              rows={8}
              value={corps}
              onChange={(e) => setCorps(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.88rem',
                lineHeight: 1.5,
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>
        </div>

        {/* Historique des envois récents */}
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.98rem', fontWeight: 700, color: '#f8fafc' }}>
            🕒 Historique des Communications MailPocket ({history.length})
          </h3>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '380px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.length === 0 ? (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                Aucun email envoyé pour le moment.
              </div>
            ) : (
              history.map((h, i) => (
                <div key={i} style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#0f172a',
                  border: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.8rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#38bdf8' }}>{h.destinataireNom || h.destinataireEmail}</strong>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {new Date(h.date).toLocaleDateString('fr-FR')} {new Date(h.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ color: '#cbd5e1', fontWeight: 600, marginTop: '2px' }}>{h.objet}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>{h.destinataireEmail}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. MODULE DOCPOCKET SMS RDV (RAPPELS DE RENDEZ-VOUS & PASSERELLE MOBILE)
// ============================================================================
function DocPocketSmsModule({ patient, allPatients, onNotify }) {
  // Gestion de la licence dédiée DocPocket SMS RDV
  const [smsLicense, setSmsLicense] = useState(() => getSmsLicenseStatus());
  const [licenseInput, setLicenseInput] = useState('');
  const [licenseError, setLicenseError] = useState('');
  const [licenseSuccess, setLicenseSuccess] = useState('');

  // Clé d'essai 2 mois & Signal Cloud Firebase
  const [trialInfo, setTrialInfo] = useState(() => getLastGeneratedTrialKey());
  const [doctorNameInput, setDoctorNameInput] = useState(() => {
    const last = getLastGeneratedTrialKey();
    if (last && last.doctorName) return last.doctorName;
    return 'DR HAMED BEN KHALIFA';
  });
  const [copiedKey, setCopiedKey] = useState(false);
  const [checkingSignal, setCheckingSignal] = useState(false);
  const [cloudSignalStatus, setCloudSignalStatus] = useState(null);

  // Sous-onglet du module : 'queue' (file d'attente reçue) | 'direct' (envoi personnalisé) | 'history' (journal) | 'settings' (passerelle)
  const [activeSubTab, setActiveSubTab] = useState('queue');

  // Passerelle locale & Cloud
  const [gatewayOnline, setGatewayOnline] = useState(false);
  const [gatewayUrl, setGatewayUrlState] = useState(getGatewayUrl());
  const [isEditingGateway, setIsEditingGateway] = useState(false);

  // Données Cloud Firebase (docpocket-rdv) & Smartphone Android (Infinix)
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [cloudAppointments, setCloudAppointments] = useState([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [instantSending, setInstantSending] = useState(false);

  // File d'attente des RDV transmis depuis DocPocket Cab
  const [transmittedQueue, setTransmittedQueue] = useState(() => getTransmittedAppointmentsQueue());

  // Formulaire d'envoi direct
  const [telephone, setTelephone] = useState(patient?.telephone || '');
  const [nom, setNom] = useState(patient ? `${patient.nom} ${patient.prenom}` : '');
  const [dateRdv, setDateRdv] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [heureRdv, setHeureRdv] = useState('10:00');
  const [langue, setLangue] = useState('fr'); // 'fr' | 'ar' | 'en'
  const [history, setHistory] = useState(() => getSmsHistory());

  // Chargement des données Cloud Firestore (docpocket-rdv) & Smartphone
  const loadCloudData = async () => {
    setLoadingCloud(true);
    try {
      const [dev, appts, syncRes] = await Promise.all([
        fetchDoctorDeviceStatus(),
        fetchCloudAppointments(),
        checkAndSyncCloudLicense()
      ]);
      setDeviceInfo(dev);
      setCloudAppointments(appts || []);
      setGatewayOnline(Boolean(dev?.connected || dev?.fcmToken));
      if (syncRes?.autoActivated) {
        setSmsLicense(getSmsLicenseStatus());
        onNotify(`✓ Signal Firebase reçu : Activé sur ${syncRes.deviceModel} -> DocPocket Cab activé !`);
      }
    } catch (e) {
      console.warn("Erreur chargement Cloud DocPocket SMS RDV:", e);
    } finally {
      setLoadingCloud(false);
    }
  };

  useEffect(() => {
    loadCloudData();
    const interval = setInterval(loadCloudData, 25000);
    return () => clearInterval(interval);
  }, []);

  // Déclencher un envoi immédiat via push vers le smartphone Infinix
  const handleTriggerInstantPush = async (item) => {
    setInstantSending(true);
    try {
      const res = await triggerInstantSmsPush(item);
      if (res.success) {
        onNotify('✓ Signal de réveil envoyé à votre smartphone Infinix ! SMS en cours d\'envoi.');
        setTimeout(loadCloudData, 2000);
      } else {
        alert("Erreur transmission push : " + (res.error || 'Erreur inconnue'));
      }
    } catch (e) {
      alert("Erreur : " + e.message);
    } finally {
      setInstantSending(false);
    }
  };

  // Écoute de l'état de la licence et de la file d'attente
  useEffect(() => {
    const handleLicenseChange = () => {
      setSmsLicense(getSmsLicenseStatus());
    };
    const handleQueueChange = (e) => {
      setTransmittedQueue(e.detail || getTransmittedAppointmentsQueue());
    };

    window.addEventListener('docpocket_sms_license_changed', handleLicenseChange);
    window.addEventListener('docpocket_sms_queue_updated', handleQueueChange);

    return () => {
      window.removeEventListener('docpocket_sms_license_changed', handleLicenseChange);
      window.removeEventListener('docpocket_sms_queue_updated', handleQueueChange);
    };
  }, []);

  // Vérification de la passerelle smartphone
  const checkGateway = async () => {
    const online = await testGatewayConnection();
    setGatewayOnline(online);
  };

  useEffect(() => {
    checkGateway();
    const interval = setInterval(checkGateway, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (patient) {
      setNom(`${patient.nom} ${patient.prenom}`);
      setTelephone(patient.telephone || '');
    }
  }, [patient]);

  // Activation de la licence
  const handleActivate = (keyToUse = null) => {
    setLicenseError('');
    setLicenseSuccess('');
    const key = (keyToUse || licenseInput || '').trim().toUpperCase();
    if (!key) {
      setLicenseError('Veuillez saisir votre clé de licence DocPocket SMS RDV.');
      return;
    }
    const res = activateSmsLicense(key);
    if (res.valid) {
      setSmsLicense(getSmsLicenseStatus());
      setLicenseSuccess('✓ DocPocket SMS RDV activé avec succès ! Synchronisation mobile active.');
      setLicenseInput('');
      onNotify('✓ Licence DocPocket SMS RDV activée');
    } else {
      setLicenseError(res.error || 'Clé de licence invalide.');
    }
  };

  // Désactivation de la licence
  const handleDeactivate = () => {
    if (window.confirm("Êtes-vous sûr de vouloir désactiver DocPocket SMS RDV sur ce poste ?\n\nLes rendez-vous ne seront plus transmis automatiquement à votre smartphone.")) {
      deactivateSmsLicense();
      setSmsLicense(getSmsLicenseStatus());
      onNotify('DocPocket SMS RDV désactivé');
    }
  };

  // Générer la clé d'essai 2 mois pour smartphone Android
  const handleGenerateTrial = () => {
    const cleanName = (doctorNameInput || 'DR HAMED BEN KHALIFA').trim().toUpperCase();
    const info = generateMobileSmsTrialKey(cleanName, 60);
    setTrialInfo(info);
    setCopiedKey(false);
    onNotify('✓ Clé test 2 mois générée pour le smartphone Android !');
  };

  // Copier la clé pour le mobile
  const handleCopyMobileKey = () => {
    if (trialInfo?.mobileKey) {
      navigator.clipboard.writeText(trialInfo.mobileKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 3000);
      onNotify('✓ Clé mobile copiée dans le presse-papiers');
    }
  };

  // Activer la clé test sur DocPocket Cab
  const handleActivateTrialOnCab = () => {
    if (trialInfo?.mobileKey) {
      handleActivate(trialInfo.mobileKey);
    } else {
      handleActivate('DPSMS-TRIAL-2M');
    }
  };

  // Vérifier manuellement le signal d'activation Cloud émis par le smartphone Android
  const handleCheckSignal = async () => {
    setCheckingSignal(true);
    setCloudSignalStatus(null);
    try {
      const res = await checkAndSyncCloudLicense();
      if (res?.autoActivated) {
        setSmsLicense(getSmsLicenseStatus());
        setLicenseSuccess(`✓ Signal Firebase détecté : Activé sur ${res.deviceModel || 'smartphone'} (${res.doctorName}) ! DocPocket Cab est maintenant activé.`);
        onNotify(`✓ DocPocket SMS RDV activé via le signal Firebase de votre smartphone !`);
      } else if (res?.alreadyActive) {
        setCloudSignalStatus({ active: true, message: `✓ Passerelle active et synchronisée avec votre smartphone (${res.deviceModel || 'Infinix'})` });
        onNotify(`✓ Signal vérifié : Passerelle active`);
      } else {
        setCloudSignalStatus({ active: false, message: res?.reason || "En attente du signal d'activation sur le smartphone." });
      }
    } catch (e) {
      setCloudSignalStatus({ active: false, message: "Erreur vérification signal : " + e.message });
    } finally {
      setCheckingSignal(false);
    }
  };

  // Génération du texte de SMS
  const generateSmsBody = (patientName, rdvD, rdvH, lang = 'fr') => {
    const tmpl = DEFAULT_SMS_TEMPLATES[lang] || DEFAULT_SMS_TEMPLATES.fr;
    const dateFormatted = new Date(rdvD).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return tmpl
      .replace('{nom}', patientName || 'Cher Patient')
      .replace('{date}', dateFormatted)
      .replace('{heure}', rdvH);
  };

  const messageText = useMemo(() => {
    return generateSmsBody(nom, dateRdv, heureRdv, langue);
  }, [langue, nom, dateRdv, heureRdv]);

  const handleSendViaMobileSms = () => {
    if (!telephone) {
      alert('Veuillez saisir un numéro de téléphone portable valide.');
      return;
    }
    const cleanPhone = telephone.replace(/\s+/g, '');
    const smsUri = `sms:${cleanPhone}?body=${encodeURIComponent(messageText)}`;
    window.open(smsUri, '_self');

    const log = {
      nom,
      telephone: cleanPhone,
      dateRdv,
      heureRdv,
      langue,
      message: messageText
    };
    saveSmsLog(log);
    setHistory(getSmsHistory());
    onNotify('Rappel SMS préparé et ouvert dans l\'application Messages');
  };

  const handleCopySms = () => {
    navigator.clipboard.writeText(messageText);
    onNotify('Texte du rappel SMS copié');
  };

  // Envoyer un SMS depuis la file d'attente
  const handleSendQueuedSms = (item) => {
    const phone = item.patientPhone || item.telephone;
    const name = item.patientName || item.nomPatient || 'Patient';
    if (!phone) {
      alert("Ce rendez-vous ne comporte pas de numéro de téléphone pour le patient.");
      return;
    }
    const cleanPhone = phone.replace(/\s+/g, '');
    const body = item.texteSms || generateSmsBody(name, item.dateRdv, item.heureRdv, item.language || 'fr');
    const smsUri = `sms:${cleanPhone}?body=${encodeURIComponent(body)}`;
    window.open(smsUri, '_self');

    markAppointmentSmsSent(item.id || item.localId);
    setTransmittedQueue(getTransmittedAppointmentsQueue());

    saveSmsLog({
      nom: name,
      telephone: cleanPhone,
      dateRdv: item.dateRdv,
      heureRdv: item.heureRdv,
      langue: item.language || 'fr',
      message: body,
      source: 'DocPocket Cab (Transmis auto)'
    });
    setHistory(getSmsHistory());
    onNotify(`Rappel SMS ouvert pour ${name}`);
  };

  const handleCopyQueuedSms = (item) => {
    const name = item.patientName || item.nomPatient || 'Patient';
    const body = item.texteSms || generateSmsBody(name, item.dateRdv, item.heureRdv, item.language || 'fr');
    navigator.clipboard.writeText(body);
    onNotify(`Texte SMS copié pour ${name}`);
  };

  // Fusion intelligente des rendez-vous Cloud Firestore et de la file locale
  const mergedAppointments = useMemo(() => {
    const list = [...cloudAppointments];
    const seenKeys = new Set(
      list.map(a => `${(a.patientPhone || a.telephone || '').replace(/\s+/g, '')}_${a.dateRdv}_${a.heureRdv}`)
    );
    for (const q of transmittedQueue) {
      const cleanPhone = (q.telephone || '').replace(/\s+/g, '');
      const key = `${cleanPhone}_${q.dateRdv}_${q.heureRdv}`;
      if (!seenKeys.has(key)) {
        list.push({
          id: q.id || `local_${q.dateRdv}_${q.heureRdv}`,
          patientName: q.nomPatient,
          patientPhone: q.telephone,
          dateRdv: q.dateRdv,
          heureRdv: q.heureRdv,
          smsEnvoye: Boolean(q.smsSent),
          reminderTimestamp: q.timestamp,
          texteSms: q.notes || '',
          source: 'local_queue'
        });
      }
    }
    return list;
  }, [cloudAppointments, transmittedQueue]);

  // --------------------------------------------------------------------------
  // CAS 1 : MODULE NON ACTIVÉ -> BANNIÈRE & FORMULAIRE DE VERROUILLAGE
  // --------------------------------------------------------------------------
  if (!smsLicense.isLicensed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* En-tête de verrouillage */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
          borderRadius: '14px',
          padding: '24px',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.6rem' }}>💬</span>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc', fontWeight: 700 }}>
                DocPocket SMS RDV - Passerelle & Rappels de Rendez-vous
              </h2>
              <span style={{
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#fbbf24',
                fontSize: '0.74rem',
                padding: '3px 10px',
                borderRadius: '6px',
                fontWeight: 700,
                border: '1px solid rgba(245, 158, 11, 0.3)'
              }}>
                🔒 Module Non Activé
              </span>
            </div>
            <div style={{ fontSize: '0.86rem', color: '#cbd5e1', marginTop: '8px', maxWidth: '780px', lineHeight: 1.5 }}>
              DocPocket SMS RDV permet la transmission automatique des rendez-vous fixés dans <strong>DocPocket Cab</strong> vers votre smartphone et l'envoi de rappels SMS 48h avant aux patients. Ce module requiert sa propre clé de licence dédiée.
            </div>
          </div>
        </div>

        {/* Carte d'Activation Principale */}
        <div style={{
          background: '#0f172a',
          borderRadius: '14px',
          padding: '28px',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
          maxWidth: '720px',
          margin: '0 auto',
          width: '100%'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '2px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              margin: '0 auto 12px'
            }}>
              🔑
            </div>
            <h3 style={{ margin: 0, fontSize: '1.18rem', color: '#f8fafc', fontWeight: 700 }}>
              Activation de DocPocket SMS RDV
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Entrez votre clé de licence pour déverrouiller la passerelle et la transmission des RDV
            </p>
          </div>

          {licenseError && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              fontSize: '0.85rem',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⛔</span> {licenseError}
            </div>
          )}

          {licenseSuccess && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid #22c55e',
              color: '#86efac',
              fontSize: '0.85rem',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>✓</span> {licenseSuccess}
            </div>
          )}

          {/* SECTION 1 : GÉNÉRATEUR DE CLÉ TEST (2 MOIS) POUR SMARTPHONE ANDROID & DOCPOCKET CAB */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.08) 0%, rgba(245, 158, 11, 0.03) 100%)',
            border: '1.5px solid rgba(245, 158, 11, 0.35)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>🎁</span>
                <strong style={{ color: '#fbbf24', fontSize: '1.02rem' }}>
                  Générateur de Clé Test (2 Mois Gratuits)
                </strong>
              </div>
              <span style={{ fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.2)', color: '#fde68a', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                Mobile Android & PC
              </span>
            </div>

            <div style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              Générez une clé d'essai gratuit de <strong>60 jours (2 mois)</strong> que vous pouvez saisir directement sur l'application <strong>DocPocket SMS RDV</strong> installée sur votre smartphone.
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                  Nom du Médecin (tel que saisi sur votre smartphone) :
                </label>
                <input
                  type="text"
                  value={doctorNameInput}
                  onChange={(e) => setDoctorNameInput(e.target.value)}
                  placeholder="Ex: DR HAMED BEN KHALIFA"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #475569',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    fontWeight: 600
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleGenerateTrial}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(217, 119, 6, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>🔑</span> Générer la Clé Test 2 Mois
              </button>
            </div>

            {trialInfo && (
              <div style={{
                background: '#090d16',
                border: '1px solid #38bdf8',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginTop: '4px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                    Clé de Licence Test (2 Mois) :
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 600 }}>
                    ✓ Valable 60 jours jusqu'au {trialInfo.expiryDate}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#1e293b',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '1.2rem', color: '#38bdf8', fontWeight: 700, letterSpacing: '1px' }}>
                    {trialInfo.mobileKey}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleCopyMobileKey}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        background: copiedKey ? '#22c55e' : '#0284c7',
                        color: '#fff',
                        border: 'none',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      {copiedKey ? '✓ Copié !' : '📋 Copier la clé'}
                    </button>
                    <button
                      type="button"
                      onClick={handleActivateTrialOnCab}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                        color: '#fff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                      title="Active directement cette clé sur DocPocket Cab"
                    >
                      ⚡ Activer sur ce Cab
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.45, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                  <strong style={{ color: '#fbbf24' }}>Mode d'emploi Smartphone :</strong>
                  <ol style={{ marginLeft: '16px', marginTop: '4px' }}>
                    <li>Ouvrez l'application <strong>DocPocket SMS RDV</strong> sur votre smartphone.</li>
                    <li>Saisissez le nom : <strong style={{ color: '#fff' }}>{trialInfo.doctorName}</strong></li>
                    <li>Collez la clé : <strong style={{ color: '#38bdf8' }}>{trialInfo.mobileKey}</strong></li>
                    <li>Touchez <strong>Activer</strong>. Dès l'activation, un signal Cloud activera aussi automatiquement ce poste !</li>
                  </ol>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2 : SIGNAL CLOUD FIREBASE (ACTIVATION AUTOMATIQUE DEPUIS ANDROID) */}
          <div style={{
            background: 'rgba(56, 189, 248, 0.05)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>📡</span>
                <strong style={{ color: '#38bdf8', fontSize: '0.95rem' }}>
                  Signal Cloud Firebase (Détection Mobile)
                </strong>
              </div>
              <button
                type="button"
                onClick={handleCheckSignal}
                disabled={checkingSignal}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  background: checkingSignal ? '#475569' : 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: checkingSignal ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{checkingSignal ? '⏳' : '🔄'}</span>
                {checkingSignal ? 'Vérification...' : 'Vérifier signal Firebase'}
              </button>
            </div>

            <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.45 }}>
              Dès que vous activez <strong>DocPocket SMS RDV sur votre smartphone</strong> (que ce soit avec la clé test ou une licence achetée), un signal est transmis en direct via Firebase pour déverrouiller automatiquement DocPocket Cab.
            </div>

            {deviceInfo && (
              <div style={{
                fontSize: '0.78rem',
                color: '#94a3b8',
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                background: 'rgba(0,0,0,0.25)',
                padding: '8px 12px',
                borderRadius: '6px'
              }}>
                <span>Terminal : <strong style={{ color: '#fff' }}>{deviceInfo.deviceModel}</strong></span>
                <span>Médecin : <strong style={{ color: '#fff' }}>{deviceInfo.doctorName}</strong></span>
                <span>Statut : <strong style={{ color: (deviceInfo.isLicensed || deviceInfo.fcmToken) ? '#4ade80' : '#fbbf24' }}>{(deviceInfo.isLicensed || deviceInfo.fcmToken) ? 'Connecté' : 'En attente'}</strong></span>
              </div>
            )}

            {cloudSignalStatus && (
              <div style={{
                fontSize: '0.82rem',
                padding: '8px 12px',
                borderRadius: '6px',
                background: cloudSignalStatus.active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: cloudSignalStatus.active ? '#86efac' : '#fde68a',
                border: `1px solid ${cloudSignalStatus.active ? '#22c55e' : '#f59e0b'}`
              }}>
                {cloudSignalStatus.message}
              </div>
            )}
          </div>

          {/* SECTION 3 : SAISIE MANUELLE DE LICENCE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>
                Ou saisissez manuellement votre clé de licence DocPocket SMS RDV :
              </label>
              <input
                type="text"
                value={licenseInput}
                onChange={(e) => setLicenseInput(e.target.value.toUpperCase())}
                placeholder="Ex: XXXX-XXXX-XXXX-XXXX ou DPSMS-03-20271231-XXXX-XXXX"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#38bdf8',
                  fontSize: '0.98rem',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  letterSpacing: '0.5px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleActivate()}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)'
                }}
              >
                ⚡ Activer DocPocket SMS RDV
              </button>
              <button
                type="button"
                onClick={() => handleActivate('DPSMS-TRIAL-2M')}
                style={{
                  padding: '12px 18px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Activer la version d'évaluation 2 mois (60 jours) sans engagement"
              >
                🎁 Essai Gratuit 2 Mois
              </button>
            </div>

            {/* Note d'activation automatique sur smartphone */}
            <div style={{
              marginTop: '12px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.06)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              fontSize: '0.8rem',
              color: '#94a3b8',
              lineHeight: 1.45
            }}>
              <strong style={{ color: '#38bdf8' }}>📱 Activation Mobile Automatique :</strong> Dès que vous activez la licence sur ce PC, elle est synchronisée automatiquement sur votre smartphone via le pont sécurisé. Vous n'aurez pas besoin de la ressaisir sur mobile.
            </div>

            <div style={{
              marginTop: '8px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(100, 116, 139, 0.1)',
              fontSize: '0.78rem',
              color: '#64748b'
            }}>
              ℹ️ Tant que la licence n'est pas activée, vos rendez-vous pris dans l'Agenda restent enregistrés <strong>dans DocPocket Cab uniquement</strong>, garantissant une étanchéité complète.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // CAS 2 : MODULE ACTIVÉ -> PANNEAU COMPLET AVEC GESTION & FILE D'ATTENTE
  // --------------------------------------------------------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Barre d'état de licence et passerelle Smartphone */}
      <div style={{
        background: '#131d36',
        borderRadius: '14px',
        padding: '18px 22px',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc', fontWeight: 700 }}>
              DocPocket SMS RDV - Passerelle Active
            </h2>
            <span style={{
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#4ade80',
              fontSize: '0.74rem',
              padding: '3px 10px',
              borderRadius: '6px',
              fontWeight: 700,
              border: '1px solid rgba(34, 197, 94, 0.3)'
            }}>
              ✓ Licence Active ({smsLicense.daysRemaining === 'Illimité' ? 'À vie' : `${smsLicense.daysRemaining} jours restants`})
            </span>
            <span style={{
              background: (deviceInfo?.connected || gatewayOnline) ? 'rgba(34, 197, 94, 0.15)' : 'rgba(56, 189, 248, 0.15)',
              color: (deviceInfo?.connected || gatewayOnline) ? '#4ade80' : '#38bdf8',
              fontSize: '0.74rem',
              padding: '3px 10px',
              borderRadius: '6px',
              fontWeight: 600,
              border: '1px solid rgba(56, 189, 248, 0.3)'
            }}>
              📱 {deviceInfo?.deviceModel || 'INFINIX Infinix X6726B'} (Android {deviceInfo?.androidVersion || '15'}) • {deviceInfo?.fcmToken ? 'Connecté & En veille' : 'Passerelle Prête'}
            </span>
            <span style={{
              background: 'rgba(168, 85, 247, 0.15)',
              color: '#c084fc',
              fontSize: '0.74rem',
              padding: '3px 10px',
              borderRadius: '6px',
              fontWeight: 600
            }}>
              👨‍⚕️ {deviceInfo?.doctorName || CLOUD_CONFIG.defaultDoctorName}
            </span>
            <span style={{
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              fontSize: '0.74rem',
              padding: '3px 10px',
              borderRadius: '6px',
              fontWeight: 600
            }}>
              ☁️ Firebase {CLOUD_CONFIG.projectId}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px' }}>
            Transmission automatique active : chaque rendez-vous fixé dans l'Agenda est synchronisé avec votre smartphone pour un envoi SMS automatique via votre carte SIM.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={loadCloudData}
            disabled={loadingCloud}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: loadingCloud ? 'not-allowed' : 'pointer'
            }}
            title="Rafraîchir les statuts Cloud et smartphone"
          >
            {loadingCloud ? '⏳ Actualisation...' : '🔄 Actualiser Cloud'}
          </button>
          <button
            type="button"
            onClick={() => setIsEditingGateway(!isEditingGateway)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#cbd5e1',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ⚙️ Réglages
          </button>
          <button
            type="button"
            onClick={handleDeactivate}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Désactiver
          </button>
        </div>
      </div>

      {/* Édition URL Passerelle si demandée */}
      {isEditingGateway && (
        <div style={{
          background: '#0f172a',
          padding: '14px 18px',
          borderRadius: '10px',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <label style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>URL Passerelle Locale (Secours Wi-Fi Cabinet) :</label>
          <input
            type="text"
            value={gatewayUrl}
            onChange={(e) => setGatewayUrlState(e.target.value)}
            style={{
              flex: 1,
              minWidth: '240px',
              padding: '6px 12px',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#38bdf8',
              fontSize: '0.85rem'
            }}
          />
          <button
            type="button"
            onClick={async () => {
              setGatewayUrl(gatewayUrl);
              await checkGateway();
              setIsEditingGateway(false);
              onNotify('Paramètres passerelle enregistrés');
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Enregistrer
          </button>
        </div>
      )}

      {/* Barre d'onglets internes du module */}
      <div style={{
        display: 'flex',
        gap: '6px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        paddingBottom: '4px'
      }}>
        <button
          type="button"
          onClick={() => setActiveSubTab('queue')}
          style={{
            padding: '9px 16px',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            background: activeSubTab === 'queue' ? '#1e293b' : 'transparent',
            color: activeSubTab === 'queue' ? '#38bdf8' : '#94a3b8',
            fontWeight: activeSubTab === 'queue' ? 700 : 500,
            fontSize: '0.86rem',
            cursor: 'pointer',
            borderBottom: activeSubTab === 'queue' ? '2px solid #38bdf8' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>📥</span>
          <span>Rendez-vous Transmis & Cloud ({mergedAppointments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('direct')}
          style={{
            padding: '9px 16px',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            background: activeSubTab === 'direct' ? '#1e293b' : 'transparent',
            color: activeSubTab === 'direct' ? '#38bdf8' : '#94a3b8',
            fontWeight: activeSubTab === 'direct' ? 700 : 500,
            fontSize: '0.86rem',
            cursor: 'pointer',
            borderBottom: activeSubTab === 'direct' ? '2px solid #38bdf8' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>✍️</span>
          <span>Envoi Manuel / Test SIM Direct</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('history')}
          style={{
            padding: '9px 16px',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            background: activeSubTab === 'history' ? '#1e293b' : 'transparent',
            color: activeSubTab === 'history' ? '#38bdf8' : '#94a3b8',
            fontWeight: activeSubTab === 'history' ? 700 : 500,
            fontSize: '0.86rem',
            cursor: 'pointer',
            borderBottom: activeSubTab === 'history' ? '2px solid #38bdf8' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>🕒</span>
          <span>Journal SMS ({history.length})</span>
        </button>
      </div>

      {/* CONTENU SOUS-ONGLET 1 : FILE D'ATTENTE & CLOUD RDV */}
      {activeSubTab === 'queue' && (
        <div style={{
          background: '#131d36',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          {/* Bannière récapitulative passerelle Infinix */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.8) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ fontSize: '2rem' }}>📱</div>
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc' }}>
                  Passerelle SIM : {deviceInfo?.deviceModel || 'INFINIX Infinix X6726B'} (Android {deviceInfo?.androidVersion || '15'})
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                  Médecin : <strong style={{ color: '#38bdf8' }}>{deviceInfo?.doctorName || CLOUD_CONFIG.defaultDoctorName}</strong> • Cloud Firebase : <span style={{ color: '#4ade80' }}>docpocket-rdv (En ligne)</span> • Vercel Cron : <span style={{ color: '#4ade80' }}>Actif</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={loadCloudData}
                disabled={loadingCloud}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: loadingCloud ? 'not-allowed' : 'pointer'
                }}
              >
                {loadingCloud ? '⏳ Synchronisation...' : '🔄 Synchroniser avec le Cloud'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 700 }}>
                📥 Rendez-vous Transmis & Programmés pour Rappel SMS
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                Synchronisés directement avec l'application Android DocPocket SMS RDV sur votre smartphone
              </p>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Total : <strong style={{ color: '#38bdf8' }}>{mergedAppointments.length}</strong> rendez-vous
            </span>
          </div>

          {mergedAppointments.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '0.88rem',
              background: '#0f172a',
              borderRadius: '10px',
              border: '1px dashed #334155'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📅</div>
              <strong>Aucun rendez-vous enregistré pour le moment.</strong>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '6px' }}>
                Lorsque vous fixez un rendez-vous dans l'Agenda de DocPocket Cab avec l'option rappel cochée, il apparaîtra automatiquement ici et sera envoyé par la SIM de votre téléphone !
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {mergedAppointments.map((item, idx) => {
                const patientName = item.patientName || item.nomPatient || 'Patient';
                const phone = item.patientPhone || item.telephone || '';
                const isSent = Boolean(item.smsEnvoye || item.smsSent);
                const reminderDateStr = item.reminderTimestamp ? new Date(item.reminderTimestamp).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;

                return (
                  <div
                    key={item.id || item.localId || idx}
                    style={{
                      padding: '14px 18px',
                      borderRadius: '10px',
                      background: '#0f172a',
                      border: isSent ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(245, 158, 11, 0.25)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <strong style={{ color: '#38bdf8', fontSize: '0.96rem' }}>{patientName}</strong>
                        <span style={{
                          fontSize: '0.72rem',
                          padding: '3px 9px',
                          borderRadius: '5px',
                          background: isSent ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.15)',
                          color: isSent ? '#4ade80' : '#fbbf24',
                          fontWeight: 700,
                          border: isSent ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(245, 158, 11, 0.3)'
                        }}>
                          {isSent ? `✓ Expédié par carte SIM (${deviceInfo?.deviceModel?.includes('Infinix') ? 'Infinix' : 'Smartphone'})` : '⏳ Rappel 48h programmé (Cloud)'}
                        </span>
                        {item.source === 'docpocket_cab' && (
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                            DocPocket Cab
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: '5px' }}>
                        RDV : <strong style={{ color: '#fff' }}>{item.dateRdv} à {item.heureRdv}</strong> • N° Portable : <strong style={{ color: '#38bdf8' }}>{phone || 'Non renseigné'}</strong>
                      </div>
                      {reminderDateStr && !isSent && (
                        <div style={{ fontSize: '0.74rem', color: '#fbbf24', marginTop: '3px' }}>
                          ⏰ Date de déclenchement du rappel : {reminderDateStr}
                        </div>
                      )}
                      {item.texteSms && (
                        <div style={{
                          fontSize: '0.76rem',
                          color: '#94a3b8',
                          marginTop: '4px',
                          fontStyle: 'italic',
                          maxWidth: '650px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          "{item.texteSms}"
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {!isSent && (
                        <button
                          type="button"
                          onClick={() => handleTriggerInstantPush(item)}
                          disabled={instantSending || !phone}
                          style={{
                            padding: '7px 14px',
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            border: 'none',
                            color: '#fff',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: (instantSending || !phone) ? 'not-allowed' : 'pointer',
                            opacity: (instantSending || !phone) ? 0.6 : 1,
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                          title="Réveiller le smartphone et envoyer immédiatement le SMS via la carte SIM"
                        >
                          ⚡ Déclencher Envoi Immédiat (SIM)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopyQueuedSms(item)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: 'none',
                          color: '#cbd5e1',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        📋 Copier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendQueuedSms(item)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          border: 'none',
                          color: '#fff',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)'
                        }}
                        title="Ouvrir dans l'application SMS du système"
                      >
                        📱 App SMS
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONTENU SOUS-ONGLET 2 : ENVOI MANUEL / PERSONNALISÉ */}
      {activeSubTab === 'direct' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {/* Formulaire de configuration du rappel */}
          <div style={{
            background: '#131d36',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Nom du Patient :
                </label>
                <input
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Ex: Mohamed BEN SALAH"
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  N° Téléphone Portable :
                </label>
                <input
                  type="tel"
                  required
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="Ex: 98 123 456"
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Date du Rendez-Vous :
                </label>
                <input
                  type="date"
                  value={dateRdv}
                  onChange={(e) => setDateRdv(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Heure du Rendez-Vous :
                </label>
                <input
                  type="time"
                  value={heureRdv}
                  onChange={(e) => setHeureRdv(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                Langue du Message SMS :
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setLangue('fr')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: langue === 'fr' ? '#0284c7' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontWeight: langue === 'fr' ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  🇫🇷 Français
                </button>
                <button
                  type="button"
                  onClick={() => setLangue('ar')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: langue === 'ar' ? '#0284c7' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontWeight: langue === 'ar' ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  🇹🇳 Arabe (عربي)
                </button>
                <button
                  type="button"
                  onClick={() => setLangue('en')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: langue === 'en' ? '#0284c7' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontWeight: langue === 'en' ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  🇬🇧 English
                </button>
              </div>
            </div>

            {/* Aperçu Cadre Smartphone */}
            <div>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                Aperçu du SMS transmis :
              </label>
              <div style={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '12px',
                padding: '16px',
                position: 'relative'
              }}>
                <div style={{
                  background: '#1e293b',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  borderLeft: '4px solid #38bdf8',
                  fontSize: '0.88rem',
                  lineHeight: 1.5,
                  color: '#f8fafc',
                  direction: langue === 'ar' ? 'rtl' : 'ltr',
                  textAlign: langue === 'ar' ? 'right' : 'left'
                }}>
                  {messageText}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.72rem', color: '#64748b' }}>
                  <span>Longueur : {messageText.length} caractères</span>
                  <span>Segments : {Math.ceil(messageText.length / 160)} SMS</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleTriggerInstantPush({
                  nomPatient: nom,
                  telephone,
                  dateRdv,
                  heureRdv,
                  texteSms: messageText,
                  language: langue
                })}
                disabled={instantSending || !telephone}
                style={{
                  flex: '1 1 100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  cursor: (instantSending || !telephone) ? 'not-allowed' : 'pointer',
                  opacity: (instantSending || !telephone) ? 0.6 : 1,
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                title="Transmet l'ordre en direct à votre smartphone Infinix pour envoi immédiat par sa carte SIM"
              >
                {instantSending ? '⏳ Transmission du signal en cours...' : '⚡ Expédier via mon Smartphone Infinix (SIM Direct)'}
              </button>
              <button
                type="button"
                onClick={handleCopySms}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  color: '#cbd5e1',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                📋 Copier SMS
              </button>
              <button
                type="button"
                onClick={handleSendViaMobileSms}
                style={{
                  flex: 1.4,
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
                }}
              >
                📱 App SMS Mobile
              </button>
            </div>
          </div>

          {/* Guide et informations de fonctionnement */}
          <div style={{
            background: '#1e293b',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#f8fafc' }}>
              ℹ️ Fonctionnement de DocPocket SMS RDV
            </h3>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.6 }}>
              <li><strong>Automatique :</strong> Tout rendez-vous fixé dans l'Agenda de DocPocket Cab est transmis en temps réel dans l'onglet « Rendez-vous Reçus ».</li>
              <li><strong>Rappels 48h :</strong> La passerelle prépare les notifications à l'avance et alerte le patient à la date optimale.</li>
              <li><strong>Zero surcoût :</strong> Utilise le forfait SMS inclus de votre smartphone Android / iOS via la liaison passerelle.</li>
              <li><strong>Multilingue :</strong> Prise en charge native des textes en Arabe littéraire (avec orientation RTL), Français et Anglais.</li>
            </ul>
          </div>
        </div>
      )}

      {/* CONTENU SOUS-ONGLET 3 : JOURNAL DES SMS ENVOYÉS */}
      {activeSubTab === 'history' && (
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.98rem', fontWeight: 700, color: '#f8fafc' }}>
            🕒 Journal des Rappels SMS ({history.length})
          </h3>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '420px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.length === 0 ? (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                Aucun rappel SMS envoyé récemment.
              </div>
            ) : (
              history.map((h, i) => (
                <div key={i} style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#0f172a',
                  border: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.8rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#38bdf8' }}>{h.nom}</strong>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {new Date(h.date).toLocaleDateString('fr-FR')} {new Date(h.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ color: '#cbd5e1', marginTop: '3px' }}>
                    RDV : <strong>{h.dateRdv} à {h.heureRdv}</strong> • Tél : {h.telephone}
                  </div>
                  {h.source && (
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                      Source : {h.source}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 4. MODULE DOCPOCKET SCORES (CALCULATEURS CLINIQUES)
// ============================================================================
function DocPocketScoresModule({ patient, patientAge, onNotify }) {
  const [selectedScore, setSelectedScore] = useState('chads_vasc'); // 'chads_vasc' | 'has_bled' | 'cockcroft' | 'wells_ep' | 'findrisc' | 'imc'

  // État Score CHA2DS2-VASc
  const [chadsState, setChadsState] = useState({
    c: false, // Insuffisance cardiaque (1)
    h: true,  // HTA (1)
    a2: patientAge >= 75, // Âge >= 75 (2)
    d: false, // Diabète (1)
    s2: false, // AVC / AIT antérieur (2)
    v: false, // Maladie vasculaire (1)
    a: patientAge >= 65 && patientAge < 75, // Âge 65-74 (1)
    sc: patient?.sexe === 'F' // Sexe Féminin (1)
  });

  // État Score HAS-BLED
  const [hasBledState, setHasBledState] = useState({
    h: true, // HTA non contrôlée PAS > 160 (1)
    a_renale: false, // Insuffisance rénale (1)
    a_hepatique: false, // Insuffisance hépatique (1)
    s: false, // AVC antérieur (1)
    b: false, // Saignement majeur (1)
    l: false, // INR labile (1)
    e: patientAge > 65, // Âge > 65 ans (1)
    d_medicaments: false, // Antiagrégants / AINS (1)
    d_alcool: false // Consommation alcool (1)
  });

  // État Clairance Cockcroft-Gault & DFG
  const [cockcroftState, setCockcroftState] = useState({
    poids: patient?.poids || 70,
    creatinine: 90, // µmol/L
    sexe: patient?.sexe === 'F' ? 'F' : 'M',
    age: patientAge
  });

  // État Score Wells Embolie Pulmonaire
  const [wellsState, setWellsState] = useState({
    signes_tvp: false, // 3 pts
    ep_probable: false, // 3 pts (Diagnostic alternatif moins probable)
    fc_100: false, // 1.5 pts (FC > 100)
    immobilisation: false, // 1.5 pts (Chirurgie ou alitement)
    atcd_mtev: false, // 1.5 pts (Antécédent TVP ou EP)
    hemoptysie: false, // 1 pt
    cancer: false // 1 pt (Actif ou traité < 6 mois)
  });

  // État FINDRISC (Risque diabète T2)
  const [findriscState, setFindriscState] = useState({
    agePoints: patientAge < 45 ? 0 : patientAge <= 54 ? 2 : patientAge <= 64 ? 3 : 4,
    imcPoints: 1, // <25: 0, 25-30: 1, >30: 3
    taillePoints: 0, // Tour de taille
    activitePoints: 0, // 30 min/jour: 0, non: 2
    legumesPoints: 0, // Quotidien: 0, non: 1
    htaPoints: 2, // Antihypertenseurs: 2, non: 0
    glycemiePoints: 0, // Hyperglycémie passée: 5, non: 0
    famillePoints: 0 // Non: 0, 2e degré: 3, 1er degré: 5
  });

  // État IMC & Surface corporelle
  const [imcState, setImcState] = useState({
    taille: patient?.taille || 170, // cm
    poids: patient?.poids || 75 // kg
  });

  // Calculs des scores
  const scoreResults = useMemo(() => {
    // 1. CHA2DS2-VASc
    let chadsTotal = 0;
    if (chadsState.c) chadsTotal += 1;
    if (chadsState.h) chadsTotal += 1;
    if (chadsState.a2) chadsTotal += 2;
    if (chadsState.d) chadsTotal += 1;
    if (chadsState.s2) chadsTotal += 2;
    if (chadsState.v) chadsTotal += 1;
    if (chadsState.a) chadsTotal += 1;
    if (chadsState.sc) chadsTotal += 1;

    let chadsRisk = 'Faible (0 homme / 1 femme)';
    let chadsReco = 'Aucun traitement antithrombotique nécessaire (Recommandation ESC Classe I)';
    let chadsColor = '#10b981';

    const seuilHomme = 1;
    const seuilFemme = 2;
    const isFemale = chadsState.sc;

    if ((!isFemale && chadsTotal === 1) || (isFemale && chadsTotal === 2)) {
      chadsRisk = 'Intermédiaire (Risque modéré d\'AVC)';
      chadsReco = 'Anticoagulation orale (AOD privilégié) à considérer selon le profil clinique (Classe IIa)';
      chadsColor = '#f59e0b';
    } else if ((!isFemale && chadsTotal >= 2) || (isFemale && chadsTotal >= 3)) {
      chadsRisk = 'Élevé (Indication formelle d\'anticoagulation)';
      chadsReco = 'Anticoagulation orale au long cours fortement recommandée : AOD (Apixaban, Rivaroxaban, Dabigatran) ou AVK (Classe I, Niveau A)';
      chadsColor = '#ef4444';
    }

    // 2. HAS-BLED
    let hasBledTotal = 0;
    Object.values(hasBledState).forEach(val => { if (val) hasBledTotal += 1; });
    let hasBledRisk = hasBledTotal >= 3 ? 'Risque Hémorragique Élevé (Score ≥ 3)' : 'Risque Hémorragique Faible à Modéré';
    let hasBledColor = hasBledTotal >= 3 ? '#ef4444' : '#10b981';
    let hasBledReco = hasBledTotal >= 3
      ? 'Surveillance rapprochée requise, corriger les facteurs de risque hémorragiques modifiables (PA, INR labile, alcool, AINS).'
      : 'Prise en charge standard sous anticoagulants.';

    // 3. Cockcroft-Gault
    const p = parseFloat(cockcroftState.poids) || 70;
    const a = parseFloat(cockcroftState.age) || 55;
    const creat = parseFloat(cockcroftState.creatinine) || 90; // µmol/L
    let clcr = 0;
    if (creat > 0) {
      // Formule en µmol/L : [(140 - âge) * Poids (kg) * k] / Créatinine (µmol/L)
      // k = 1.23 pour homme, 1.04 pour femme
      const k = cockcroftState.sexe === 'F' ? 1.04 : 1.23;
      clcr = Math.round(((140 - a) * p * k) / creat);
    }
    let stadeMRC = 'Fonction rénale normale (Clairance ≥ 90 ml/min)';
    let stadeColor = '#10b981';
    if (clcr < 15) {
      stadeMRC = 'Stade 5 : Insuffisance rénale terminale (< 15 ml/min)';
      stadeColor = '#ef4444';
    } else if (clcr < 30) {
      stadeMRC = 'Stade 4 : Insuffisance rénale sévère (15-29 ml/min) - Adaptation posologique urgente';
      stadeColor = '#ef4444';
    } else if (clcr < 60) {
      stadeMRC = 'Stade 3 : Insuffisance rénale modérée (30-59 ml/min) - Adapter doses (Metformine, AOD)';
      stadeColor = '#f59e0b';
    } else if (clcr < 90) {
      stadeMRC = 'Stade 2 : Baisse légère de la filtration (60-89 ml/min)';
      stadeColor = '#38bdf8';
    }

    // 4. Wells EP
    let wellsTotal = 0;
    if (wellsState.signes_tvp) wellsTotal += 3;
    if (wellsState.ep_probable) wellsTotal += 3;
    if (wellsState.fc_100) wellsTotal += 1.5;
    if (wellsState.immobilisation) wellsTotal += 1.5;
    if (wellsState.atcd_mtev) wellsTotal += 1.5;
    if (wellsState.hemoptysie) wellsTotal += 1;
    if (wellsState.cancer) wellsTotal += 1;

    let wellsCat = 'Probabilité clinique faible (Score < 2)';
    let wellsReco = 'Dosage des D-dimères en première intention (Haute valeur prédictive négative)';
    let wellsColor = '#10b981';
    if (wellsTotal > 6) {
      wellsCat = 'Probabilité clinique forte (Score > 6)';
      wellsReco = 'Angioscanner thoracique en urgence sans attendre les D-dimères';
      wellsColor = '#ef4444';
    } else if (wellsTotal >= 2) {
      wellsCat = 'Probabilité clinique intermédiaire (Score 2 - 6)';
      wellsReco = 'Dosage des D-dimères ou Angioscanner selon le contexte';
      wellsColor = '#f59e0b';
    }

    // 5. FINDRISC
    let findriscTotal = 0;
    Object.values(findriscState).forEach(val => { findriscTotal += Number(val || 0); });
    let findriscRisk = 'Risque très faible (< 1%)';
    let findriscColor = '#10b981';
    if (findriscTotal >= 20) {
      findriscRisk = 'Risque Très Élevé (1 personne sur 2 développera un diabète)';
      findriscColor = '#ef4444';
    } else if (findriscTotal >= 15) {
      findriscRisk = 'Risque Élevé (33% de probabilité à 10 ans)';
      findriscColor = '#ef4444';
    } else if (findriscTotal >= 12) {
      findriscRisk = 'Risque Modéré (17% de probabilité à 10 ans)';
      findriscColor = '#f59e0b';
    } else if (findriscTotal >= 7) {
      findriscRisk = 'Risque Légèrement Élevé (4% de probabilité)';
      findriscColor = '#38bdf8';
    }

    // 6. IMC
    const tailleM = (parseFloat(imcState.taille) || 170) / 100;
    const poidsKg = parseFloat(imcState.poids) || 70;
    const imc = tailleM > 0 ? Math.round((poidsKg / (tailleM * tailleM)) * 10) / 10 : 0;
    // Surface corporelle formule Mosteller : racine(poids * taille / 3600)
    const bsa = Math.round(Math.sqrt((poidsKg * (parseFloat(imcState.taille) || 170)) / 3600) * 100) / 100;

    let imcClass = 'Poids normal (IMC 18.5 - 24.9)';
    let imcColor = '#10b981';
    if (imc < 18.5) {
      imcClass = 'Insuffisance pondérale / Maigreur (IMC < 18.5)';
      imcColor = '#38bdf8';
    } else if (imc >= 40) {
      imcClass = 'Obésité morbide / Classe III (IMC ≥ 40)';
      imcColor = '#ef4444';
    } else if (imc >= 35) {
      imcClass = 'Obésité sévère / Classe II (IMC 35 - 39.9)';
      imcColor = '#ef4444';
    } else if (imc >= 30) {
      imcClass = 'Obésité modérée / Classe I (IMC 30 - 34.9)';
      imcColor = '#f59e0b';
    } else if (imc >= 25) {
      imcClass = 'Surpoids (IMC 25 - 29.9)';
      imcColor = '#f59e0b';
    }

    return {
      chadsTotal, chadsRisk, chadsReco, chadsColor,
      hasBledTotal, hasBledRisk, hasBledReco, hasBledColor,
      clcr, stadeMRC, stadeColor,
      wellsTotal, wellsCat, wellsReco, wellsColor,
      findriscTotal, findriscRisk, findriscColor,
      imc, bsa, imcClass, imcColor
    };
  }, [chadsState, hasBledState, cockcroftState, wellsState, findriscState, imcState]);

  const handleCopyScoreToClipboard = (scoreName, summaryText) => {
    navigator.clipboard.writeText(summaryText);
    onNotify(`Score ${scoreName} copié pour la consultation`);
  };

  const handleSaveScore = (scoreName, value, interp) => {
    saveScoreRecord({
      patientId: patient?.id || null,
      patientName: patient ? `${patient.nom} ${patient.prenom}` : 'Anonyme',
      score: scoreName,
      valeur: value,
      interpretation: interp
    });
    onNotify(`Score ${scoreName} enregistré dans l'historique`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* En-tête du module Scores */}
      <div style={{
        background: '#1e293b',
        borderRadius: '12px',
        padding: '18px 22px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc', fontWeight: 700 }}>
              DocPocket Scores - Calculateurs Médicaux & Aide à la Décision
            </h2>
            <span style={{
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '6px',
              fontWeight: 600
            }}>
              Scores Cliniques Validiés
            </span>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
            Calculs automatisés pré-remplis pour : <strong style={{ color: '#fff' }}>{patient ? `${patient.nom} ${patient.prenom} (${patientAge} ans)` : 'Sélectionnez un patient'}</strong>
          </div>
        </div>
      </div>

      {/* Barre de sélection du score à calculer */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        background: '#131d36',
        padding: '12px',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        {[
          { id: 'chads_vasc', icon: '🫀', title: 'CHA₂DS₂-VASc (AVC & FA)' },
          { id: 'has_bled', icon: '🩸', title: 'HAS-BLED (Saignement)' },
          { id: 'cockcroft', icon: '🧪', title: 'Clairance Cockcroft / DFG' },
          { id: 'wells_ep', icon: '🫁', title: 'Wells (Embolie Pulmonaire)' },
          { id: 'findrisc', icon: '🩺', title: 'FINDRISC (Diabète T2)' },
          { id: 'imc', icon: '⚖️', title: 'IMC & Surface Corporelle' }
        ].map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedScore(s.id)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: selectedScore === s.id ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'rgba(255,255,255,0.06)',
              color: selectedScore === s.id ? '#fff' : '#94a3b8',
              fontWeight: selectedScore === s.id ? 700 : 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: selectedScore === s.id ? '0 2px 8px rgba(2, 132, 199, 0.4)' : 'none'
            }}
          >
            <span>{s.icon}</span>
            <span>{s.title}</span>
          </button>
        ))}
      </div>

      {/* Contenu dynamique du score sélectionné */}
      <div style={{
        background: '#1e293b',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        {/* 1. SCORE CHA2DS2-VASc */}
        {selectedScore === 'chads_vasc' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                  Score CHA₂DS₂-VASc (Fibrillation Atriale & Risque Thromboembolique)
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Évalue le risque annuel d'AVC ischémique chez les patients en ACFA selon les recommandations ESC.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleCopyScoreToClipboard('CHA2DS2-VASc', `Score CHA2DS2-VASc = ${scoreResults.chadsTotal} (${scoreResults.chadsRisk}). Recommandation : ${scoreResults.chadsReco}`)}
                  style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: '#cbd5e1', fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  📋 Copier
                </button>
                <button
                  onClick={() => handleSaveScore('CHA2DS2-VASc', scoreResults.chadsTotal, scoreResults.chadsRisk)}
                  style={{ padding: '6px 12px', background: '#0284c7', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  💾 Enregistrer
                </button>
              </div>
            </div>

            {/* Checklist des critères */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
              {[
                { key: 'c', label: 'C - Insuffisance cardiaque congestive (FEVG ≤ 40%) (+1 pt)' },
                { key: 'h', label: 'H - Hypertension artérielle traitée ou non (+1 pt)' },
                { key: 'a2', label: 'A₂ - Âge ≥ 75 ans (+2 pts)' },
                { key: 'd', label: 'D - Diabète sucré (+1 pt)' },
                { key: 's2', label: 'S₂ - Antécédent d\'AVC, AIT ou embolie systémique (+2 pts)' },
                { key: 'v', label: 'V - Maladie vasculaire (Infarctus, AOMI, plaques aortiques) (+1 pt)' },
                { key: 'a', label: 'A - Âge entre 65 et 74 ans (+1 pt)' },
                { key: 'sc', label: 'Sc - Sexe Féminin (+1 pt)' }
              ].map(item => (
                <label
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: chadsState[item.key] ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                    border: chadsState[item.key] ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={chadsState[item.key]}
                    onChange={(e) => setChadsState({ ...chadsState, [item.key]: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            {/* Résultat & Recommandation */}
            <div style={{
              background: '#0f172a',
              borderRadius: '10px',
              padding: '18px',
              borderLeft: `5px solid ${scoreResults.chadsColor}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: scoreResults.chadsColor }}>
                  {scoreResults.chadsTotal} / 9
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: scoreResults.chadsColor }}>
                  Risque Thromboembolique : {scoreResults.chadsRisk}
                </span>
              </div>
              <div style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                <strong>Recommandation Thérapeutique (ESC) : </strong>{scoreResults.chadsReco}
              </div>
            </div>
          </div>
        )}

        {/* 2. SCORE HAS-BLED */}
        {selectedScore === 'has_bled' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                  Score HAS-BLED (Risque Hémorragique sous Anticoagulant)
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Identifie les patients sous anticoagulants nécessitant une surveillance attentive.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleCopyScoreToClipboard('HAS-BLED', `Score HAS-BLED = ${scoreResults.hasBledTotal} (${scoreResults.hasBledRisk}). ${scoreResults.hasBledReco}`)}
                  style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: '#cbd5e1', fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  📋 Copier
                </button>
                <button
                  onClick={() => handleSaveScore('HAS-BLED', scoreResults.hasBledTotal, scoreResults.hasBledRisk)}
                  style={{ padding: '6px 12px', background: '#0284c7', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  💾 Enregistrer
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
              {[
                { key: 'h', label: 'H - Hypertension artérielle non contrôlée (PAS > 160) (+1)' },
                { key: 'a_renale', label: 'A - Atteinte rénale (Dialyse, transplantation, Cr > 200 µmol) (+1)' },
                { key: 'a_hepatique', label: 'A - Atteinte hépatique (Cirrhose ou Bilirubine > 2x) (+1)' },
                { key: 's', label: 'S - Antécédent d\'AVC (Stroke) (+1)' },
                { key: 'b', label: 'B - Saignement majeur ou prédisposition hémorragique (+1)' },
                { key: 'l', label: 'L - Labile INR (Temps dans la cible thérapeutique < 60%) (+1)' },
                { key: 'e', label: 'E - Âge > 65 ans (Elderly) (+1)' },
                { key: 'd_medicaments', label: 'D - Médicaments prédisposant (Antiagrégants, AINS) (+1)' },
                { key: 'd_alcool', label: 'D - Consommation d\'alcool excessive (≥ 8 verres/sem) (+1)' }
              ].map(item => (
                <label
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: hasBledState[item.key] ? 'rgba(239, 68, 68, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                    border: hasBledState[item.key] ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={hasBledState[item.key]}
                    onChange={(e) => setHasBledState({ ...hasBledState, [item.key]: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            <div style={{
              background: '#0f172a',
              borderRadius: '10px',
              padding: '18px',
              borderLeft: `5px solid ${scoreResults.hasBledColor}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: scoreResults.hasBledColor }}>
                  {scoreResults.hasBledTotal} / 9
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: scoreResults.hasBledColor }}>
                  {scoreResults.hasBledRisk}
                </span>
              </div>
              <div style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                {scoreResults.hasBledReco}
              </div>
            </div>
          </div>
        )}

        {/* 3. CLAIRANCE COCKCROFT-GAULT */}
        {selectedScore === 'cockcroft' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                  Calculateur de Clairance Rénale (Cockcroft-Gault & DFG)
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Essentiel pour l'adaptation posologique des médicaments à élimination rénale (Metformine, AOD, Antibiotiques).
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleCopyScoreToClipboard('Clairance Rénale', `Clairance Cockcroft-Gault = ${scoreResults.clcr} ml/min (${scoreResults.stadeMRC})`)}
                  style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: '#cbd5e1', fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  📋 Copier
                </button>
                <button
                  onClick={() => handleSaveScore('Clairance Cockcroft', `${scoreResults.clcr} ml/min`, scoreResults.stadeMRC)}
                  style={{ padding: '6px 12px', background: '#0284c7', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  💾 Enregistrer
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Sexe :</label>
                <select
                  value={cockcroftState.sexe}
                  onChange={(e) => setCockcroftState({ ...cockcroftState, sexe: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                >
                  <option value="M">Homme (Facteur k = 1.23)</option>
                  <option value="F">Femme (Facteur k = 1.04)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Âge (ans) :</label>
                <input
                  type="number"
                  value={cockcroftState.age}
                  onChange={(e) => setCockcroftState({ ...cockcroftState, age: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Poids Réel (kg) :</label>
                <input
                  type="number"
                  value={cockcroftState.poids}
                  onChange={(e) => setCockcroftState({ ...cockcroftState, poids: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Créatininémie (µmol/L) :</label>
                <input
                  type="number"
                  value={cockcroftState.creatinine}
                  onChange={(e) => setCockcroftState({ ...cockcroftState, creatinine: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#38bdf8', fontWeight: 700 }}
                />
              </div>
            </div>

            <div style={{
              background: '#0f172a',
              borderRadius: '10px',
              padding: '18px',
              borderLeft: `5px solid ${scoreResults.stadeColor}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: scoreResults.stadeColor }}>
                  {scoreResults.clcr} <span style={{ fontSize: '1rem', fontWeight: 500 }}>ml/min</span>
                </span>
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: scoreResults.stadeColor }}>
                  {scoreResults.stadeMRC}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4. SCORE WELLS EP */}
        {selectedScore === 'wells_ep' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                  Score de Wells (Embolie Pulmonaire)
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Stratifie la probabilité clinique pré-test d'embolie pulmonaire pour guider la stratégie diagnostique.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleCopyScoreToClipboard('Wells EP', `Score Wells EP = ${scoreResults.wellsTotal} (${scoreResults.wellsCat}). Conduite : ${scoreResults.wellsReco}`)}
                  style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: '#cbd5e1', fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  📋 Copier
                </button>
                <button
                  onClick={() => handleSaveScore('Wells EP', scoreResults.wellsTotal, scoreResults.wellsCat)}
                  style={{ padding: '6px 12px', background: '#0284c7', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  💾 Enregistrer
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
              {[
                { key: 'signes_tvp', label: 'Signes cliniques de TVP (œdème unilatéral, douleur mollet) (+3 pts)' },
                { key: 'ep_probable', label: 'Diagnostic alternatif moins probable que l\'EP (+3 pts)' },
                { key: 'fc_100', label: 'Fréquence cardiaque > 100 bpm (+1.5 pt)' },
                { key: 'immobilisation', label: 'Immobilisation récente (≥ 3 j) ou chirurgie (< 4 sem) (+1.5 pt)' },
                { key: 'atcd_mtev', label: 'Antécédent personnel de TVP ou d\'EP (+1.5 pt)' },
                { key: 'hemoptysie', label: 'Hémoptysie (+1 pt)' },
                { key: 'cancer', label: 'Cancer actif ou traité dans les 6 derniers mois (+1 pt)' }
              ].map(item => (
                <label
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: wellsState[item.key] ? 'rgba(239, 68, 68, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                    border: wellsState[item.key] ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={wellsState[item.key]}
                    onChange={(e) => setWellsState({ ...wellsState, [item.key]: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            <div style={{
              background: '#0f172a',
              borderRadius: '10px',
              padding: '18px',
              borderLeft: `5px solid ${scoreResults.wellsColor}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: scoreResults.wellsColor }}>
                  {scoreResults.wellsTotal} pts
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: scoreResults.wellsColor }}>
                  {scoreResults.wellsCat}
                </span>
              </div>
              <div style={{ fontSize: '0.88rem', color: '#cbd5e1' }}>
                <strong>Stratégie Diagnostique Recommandée : </strong>{scoreResults.wellsReco}
              </div>
            </div>
          </div>
        )}

        {/* 5. FINDRISC */}
        {selectedScore === 'findrisc' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                  Score FINDRISC (Dépistage du Risque de Diabète de Type 2 à 10 ans)
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Outil validé par l'OMS et l'IDF pour repérer les sujets à haut risque de diabète méconnu ou futur.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleCopyScoreToClipboard('FINDRISC', `Score FINDRISC = ${scoreResults.findriscTotal} pts (${scoreResults.findriscRisk})`)}
                  style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: '#cbd5e1', fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  📋 Copier
                </button>
                <button
                  onClick={() => handleSaveScore('FINDRISC', `${scoreResults.findriscTotal} pts`, scoreResults.findriscRisk)}
                  style={{ padding: '6px 12px', background: '#0284c7', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  💾 Enregistrer
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Tranche d'Âge :</label>
                <select
                  value={findriscState.agePoints}
                  onChange={(e) => setFindriscState({ ...findriscState, agePoints: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                >
                  <option value={0}>Moins de 45 ans (0 pt)</option>
                  <option value={2}>45 à 54 ans (2 pts)</option>
                  <option value={3}>55 à 64 ans (3 pts)</option>
                  <option value={4}>Plus de 64 ans (4 pts)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Activité physique ≥ 30 min/j :</label>
                <select
                  value={findriscState.activitePoints}
                  onChange={(e) => setFindriscState({ ...findriscState, activitePoints: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                >
                  <option value={0}>Oui (0 pt)</option>
                  <option value={2}>Non (2 pts)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Consommation Quotidienne Légumes/Fruits :</label>
                <select
                  value={findriscState.legumesPoints}
                  onChange={(e) => setFindriscState({ ...findriscState, legumesPoints: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                >
                  <option value={0}>Tous les jours (0 pt)</option>
                  <option value={1}>Pas tous les jours (1 pt)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Traitement Antihypertenseur :</label>
                <select
                  value={findriscState.htaPoints}
                  onChange={(e) => setFindriscState({ ...findriscState, htaPoints: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                >
                  <option value={0}>Non (0 pt)</option>
                  <option value={2}>Oui, régulièrement (2 pts)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Antécédent d'Hyperglycémie passée :</label>
                <select
                  value={findriscState.glycemiePoints}
                  onChange={(e) => setFindriscState({ ...findriscState, glycemiePoints: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                >
                  <option value={0}>Non (0 pt)</option>
                  <option value={5}>Oui (Grossesse ou bilan) (5 pts)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Antécédents Familiaux de Diabète :</label>
                <select
                  value={findriscState.famillePoints}
                  onChange={(e) => setFindriscState({ ...findriscState, famillePoints: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                >
                  <option value={0}>Aucun (0 pt)</option>
                  <option value={3}>Famille 2e degré (grands-parents, oncles) (3 pts)</option>
                  <option value={5}>Famille 1er degré (parents, fratrie, enfants) (5 pts)</option>
                </select>
              </div>
            </div>

            <div style={{
              background: '#0f172a',
              borderRadius: '10px',
              padding: '18px',
              borderLeft: `5px solid ${scoreResults.findriscColor}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: scoreResults.findriscColor }}>
                  {scoreResults.findriscTotal} pts
                </span>
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: scoreResults.findriscColor }}>
                  {scoreResults.findriscRisk}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 6. IMC & SURFACE CORPORELLE */}
        {selectedScore === 'imc' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                  Calculateur d'IMC (Indice de Masse Corporelle) & Surface Corporelle
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Classification OMS et formule de Mosteller pour l'indexation thérapeutique.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleCopyScoreToClipboard('IMC', `IMC = ${scoreResults.imc} kg/m² (${scoreResults.imcClass}) • Surface corporelle = ${scoreResults.bsa} m²`)}
                  style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: '#cbd5e1', fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  📋 Copier
                </button>
                <button
                  onClick={() => handleSaveScore('IMC', `${scoreResults.imc} kg/m²`, scoreResults.imcClass)}
                  style={{ padding: '6px 12px', background: '#0284c7', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  💾 Enregistrer
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Taille (cm) :
                </label>
                <input
                  type="number"
                  min="50"
                  max="250"
                  value={imcState.taille}
                  onChange={(e) => setImcState({ ...imcState, taille: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.95rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Poids (kg) :
                </label>
                <input
                  type="number"
                  min="10"
                  max="300"
                  value={imcState.poids}
                  onChange={(e) => setImcState({ ...imcState, poids: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#38bdf8', fontSize: '0.95rem', fontWeight: 700 }}
                />
              </div>
            </div>

            <div style={{
              background: '#0f172a',
              borderRadius: '10px',
              padding: '18px',
              borderLeft: `5px solid ${scoreResults.imcColor}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, color: scoreResults.imcColor }}>
                  {scoreResults.imc} <span style={{ fontSize: '1rem', fontWeight: 500 }}>kg/m²</span>
                </span>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: scoreResults.imcColor }}>
                    {scoreResults.imcClass}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '2px' }}>
                    Surface corporelle (Mosteller) : <strong>{scoreResults.bsa} m²</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 5. MODULE DOCPOCKET ADDICTO (SCORES D'ADDICTIONS & ÉVALUATIONS CLINIQUES)
// ============================================================================
function DocPocketAddictoModule({ patient, onNotify }) {
  const [activeTest, setActiveTest] = useState('fagerstrom'); // 'fagerstrom' | 'audit' | 'deta' | 'cast' | 'prochaska'
  const [history, setHistory] = useState(() => getAddictoHistory(patient?.id));

  useEffect(() => {
    setHistory(getAddictoHistory(patient?.id));
  }, [patient]);

  // 1. FAGERSTRÖM (Tabac)
  const FAGERSTROM_QUESTIONS = [
    {
      q: "1. Combien de temps après votre réveil fumez-vous votre première cigarette ?",
      options: [
        { label: "Dans les 5 minutes", points: 3 },
        { label: "De 6 à 30 minutes", points: 2 },
        { label: "De 31 à 60 minutes", points: 1 },
        { label: "Après 60 minutes", points: 0 }
      ]
    },
    {
      q: "2. Trouvez-vous difficile de ne pas fumer dans les endroits où c'est interdit ?",
      options: [
        { label: "Oui", points: 1 },
        { label: "Non", points: 0 }
      ]
    },
    {
      q: "3. À quelle cigarette de la journée vous serait-il le plus difficile de renoncer ?",
      options: [
        { label: "La première du matin", points: 1 },
        { label: "N'importe quelle autre", points: 0 }
      ]
    },
    {
      q: "4. Combien de cigarettes fumez-vous par jour en moyenne ?",
      options: [
        { label: "10 ou moins", points: 0 },
        { label: "11 à 20 cigarettes", points: 1 },
        { label: "21 à 30 cigarettes", points: 2 },
        { label: "31 cigarettes ou plus", points: 3 }
      ]
    },
    {
      q: "5. Fumez-vous à un rythme plus soutenu le matin que l'après-midi ?",
      options: [
        { label: "Oui", points: 1 },
        { label: "Non", points: 0 }
      ]
    },
    {
      q: "6. Fumez-vous lorsque vous êtes malade et alité(e) presque toute la journée ?",
      options: [
        { label: "Oui", points: 1 },
        { label: "Non", points: 0 }
      ]
    }
  ];

  const [fagerstromAnswers, setFagerstromAnswers] = useState([2, 1, 1, 1, 1, 0]);

  const fagerstromScore = useMemo(() => {
    return fagerstromAnswers.reduce((sum, val) => sum + val, 0);
  }, [fagerstromAnswers]);

  const fagerstromResult = useMemo(() => {
    let niveau = 'Dépendance faible';
    let couleur = '#34d399';
    let reco = 'Accompagnement comportemental, TNS oraux à la demande selon besoin.';
    if (fagerstromScore >= 7) {
      niveau = 'Dépendance forte à très forte';
      couleur = '#ef4444';
      reco = 'Indication formelle d\'un traitement de substitution nicotinique combiné (Patch transdermique 21 mg/24h + forme orale rapide gommes/pastilles). Suivi médical rapproché.';
    } else if (fagerstromScore >= 5) {
      niveau = 'Dépendance moyenne';
      couleur = '#f59e0b';
      reco = 'Substituts nicotiniques recommandés (Patch 14 ou 21 mg/24h selon la consommation).';
    } else if (fagerstromScore <= 2) {
      niveau = 'Pas ou très peu de dépendance physique';
      couleur = '#38bdf8';
      reco = 'Dépendance comportementale prédominante. Soutien psychologique et conseils de modification des habitudes.';
    }
    return { score: fagerstromScore, niveau, couleur, reco };
  }, [fagerstromScore]);

  // 2. AUDIT (Alcool OMS)
  const AUDIT_QUESTIONS = [
    {
      q: "1. À quelle fréquence vous arrive-t-il de consommer des boissons alcoolisées ?",
      options: [
        { label: "Jamais", points: 0 },
        { label: "1 fois par mois ou moins", points: 1 },
        { label: "2 à 4 fois par mois", points: 2 },
        { label: "2 à 3 fois par semaine", points: 3 },
        { label: "4 fois ou plus par semaine", points: 4 }
      ]
    },
    {
      q: "2. Combien de verres standard buvez-vous un jour typique où vous consommez de l'alcool ?",
      options: [
        { label: "1 ou 2 verres", points: 0 },
        { label: "3 ou 4 verres", points: 1 },
        { label: "5 ou 6 verres", points: 2 },
        { label: "7 à 9 verres", points: 3 },
        { label: "10 verres ou plus", points: 4 }
      ]
    },
    {
      q: "3. À quelle fréquence buvez-vous six verres ou plus en une même occasion (Binge drinking) ?",
      options: [
        { label: "Jamais", points: 0 },
        { label: "Moins d'une fois par mois", points: 1 },
        { label: "Une fois par mois", points: 2 },
        { label: "Une fois par semaine", points: 3 },
        { label: "Chaque jour ou presque", points: 4 }
      ]
    },
    {
      q: "4. Au cours de l'année écoulée, avez-vous constaté que vous n'étiez plus capable de vous arrêter de boire ?",
      options: [
        { label: "Jamais", points: 0 },
        { label: "Moins d'une fois par mois", points: 1 },
        { label: "Une fois par mois", points: 2 },
        { label: "Une fois par semaine", points: 3 },
        { label: "Chaque jour ou presque", points: 4 }
      ]
    },
    {
      q: "5. Avez-vous manqué à vos obligations habituelles à cause de votre consommation d'alcool ?",
      options: [
        { label: "Jamais", points: 0 },
        { label: "Moins d'une fois par mois", points: 1 },
        { label: "Une fois par mois", points: 2 },
        { label: "Une fois par semaine", points: 3 },
        { label: "Chaque jour ou presque", points: 4 }
      ]
    },
    {
      q: "6. Avez-vous eu besoin d'un verre le matin à jeun pour vous remettre en route après avoir bu ?",
      options: [
        { label: "Jamais", points: 0 },
        { label: "Moins d'une fois par mois", points: 1 },
        { label: "Une fois par mois", points: 2 },
        { label: "Une fois par semaine", points: 3 },
        { label: "Chaque jour ou presque", points: 4 }
      ]
    },
    {
      q: "7. Avez-vous eu un sentiment de culpabilité ou de remords après avoir bu ?",
      options: [
        { label: "Jamais", points: 0 },
        { label: "Moins d'une fois par mois", points: 1 },
        { label: "Une fois par mois", points: 2 },
        { label: "Une fois par semaine", points: 3 },
        { label: "Chaque jour ou presque", points: 4 }
      ]
    },
    {
      q: "8. Avez-vous été incapable de vous rappeler ce qui s'était passé la nuit précédente ?",
      options: [
        { label: "Jamais", points: 0 },
        { label: "Moins d'une fois par mois", points: 1 },
        { label: "Une fois par mois", points: 2 },
        { label: "Une fois par semaine", points: 3 },
        { label: "Chaque jour ou presque", points: 4 }
      ]
    },
    {
      q: "9. Vous êtes-vous blessé(e) ou quelqu'un a-t-il été blessé parce que vous aviez bu ?",
      options: [
        { label: "Non", points: 0 },
        { label: "Oui, mais pas au cours de l'année", points: 2 },
        { label: "Oui, au cours de l'année écoulée", points: 4 }
      ]
    },
    {
      q: "10. Un proche ou un médecin s'est-il inquiété de votre consommation et vous a-t-il conseillé de réduire ?",
      options: [
        { label: "Non", points: 0 },
        { label: "Oui, mais pas au cours de l'année", points: 2 },
        { label: "Oui, au cours de l'année écoulée", points: 4 }
      ]
    }
  ];

  const [auditAnswers, setAuditAnswers] = useState([1, 1, 0, 0, 0, 0, 0, 0, 0, 0]);

  const auditScore = useMemo(() => {
    return auditAnswers.reduce((sum, val) => sum + val, 0);
  }, [auditAnswers]);

  const auditCScore = useMemo(() => {
    return (auditAnswers[0] || 0) + (auditAnswers[1] || 0) + (auditAnswers[2] || 0);
  }, [auditAnswers]);

  const auditResult = useMemo(() => {
    let niveau = 'Consommation à faible risque';
    let couleur = '#34d399';
    let reco = 'Poursuivre les recommandations OMS (maximum 2 verres standard par jour, et pas tous les jours).';
    if (auditScore >= 13) {
      niveau = 'Dépendance alcoolique probable (Usage très nocif)';
      couleur = '#ef4444';
      reco = 'Évaluation addictologique approfondie requise. Proposer un bilan biologique hépatique (Gamma-GT, VGM, Transaminases) et envisager un sevrage médicalisé accompagné.';
    } else if (auditScore >= 7) {
      niveau = 'Consommation à risque / Usage nocif';
      couleur = '#f59e0b';
      reco = 'Intervention brève recommandée. Définir des objectifs de réduction concertés et proposer un carnet de suivi.';
    }
    return { score: auditScore, auditC: auditCScore, niveau, couleur, reco };
  }, [auditScore, auditCScore]);

  // 3. DETA / CAGE (Alcool rapide 4 questions)
  const [detaState, setDetaState] = useState({
    d: false, // Diminuer
    e: false, // Entourage
    t: false, // Trop
    a: false  // Alcool au réveil
  });

  const detaScore = useMemo(() => {
    let count = 0;
    if (detaState.d) count++;
    if (detaState.e) count++;
    if (detaState.t) count++;
    if (detaState.a) count++;
    return count;
  }, [detaState]);

  const detaResult = useMemo(() => {
    const isRisque = detaScore >= 2;
    return {
      score: detaScore,
      niveau: isRisque ? 'Risque très élevé de dépendance alcoolique (Score ≥ 2)' : 'Score normal (Risque faible)',
      couleur: isRisque ? '#ef4444' : '#34d399',
      reco: isRisque
        ? 'Deux réponses positives ou plus orientent fortement vers une dépendance avérée à l\'alcool. Bilan et entretien clinique recommandés.'
        : 'Aucune anomalie flagrante au dépistage rapide.'
    };
  }, [detaScore]);

  // 4. CAST (Cannabis Abuse Screening Test)
  const [castState, setCastState] = useState([false, false, false, false, false, false]);
  const castScore = useMemo(() => {
    return castState.filter(Boolean).length;
  }, [castState]);

  const castResult = useMemo(() => {
    let niveau = 'Usage à faible risque';
    let couleur = '#34d399';
    let reco = 'Information et prévention des risques.';
    if (castScore >= 4) {
      niveau = 'Usage à haut risque / Dépendance probable au cannabis';
      couleur = '#ef4444';
      reco = 'Prise en charge addictologique spécifique recommandée. Évaluation de l\'impact cognitif, social et professionnel.';
    } else if (castScore >= 2) {
      niveau = 'Usage à risque modéré';
      couleur = '#f59e0b';
      reco = 'Conseils de réduction et repérage précoce des situations à risque.';
    }
    return { score: castScore, niveau, couleur, reco };
  }, [castScore]);

  // 5. STADES DE PROCHASKA & DICLEMENTE
  const [stadeProchaska, setStadeProchaska] = useState('CONTEMPLATION');
  const [balanceAvantages, setBalanceAvantages] = useState('Détente, gestion du stress, habitude sociale');
  const [balanceInconvenients, setBalanceInconvenients] = useState('Coût financier, toux matinale, souffle court, risque cardiovasculaire');

  const STADES_PROCHASKA = [
    {
      id: 'PRE_CONTEMPLATION',
      titre: '1. Pré-contemplation (Déni)',
      desc: 'Pas d\'intention d\'arrêter dans les 6 prochains mois. Ne perçoit pas le problème.',
      couleur: '#64748b',
      conseil: 'Éviter la confrontation. Informer sans juger, susciter le doute bienveillant.'
    },
    {
      id: 'CONTEMPLATION',
      titre: '2. Contemplation (Ambivalence)',
      desc: 'Envisage un arrêt dans les 6 mois mais hésite. Pèse le pour et le contre.',
      couleur: '#f59e0b',
      conseil: 'Explorer l\'ambivalence avec la balance décisionnelle. Renforcer le sentiment d\'efficacité personnelle.'
    },
    {
      id: 'PREPARATION',
      titre: '3. Préparation',
      desc: 'Décision prise ! Prêt à tenter l\'arrêt dans les 30 jours à venir.',
      couleur: '#38bdf8',
      conseil: 'Fixer ensemble une date d\'arrêt. Prescrire les traitements de substitution et préparer les stratégies d\'évitement.'
    },
    {
      id: 'ACTION',
      titre: '4. Action',
      desc: 'Arrêt ou changement effectif en cours depuis moins de 6 mois.',
      couleur: '#10b981',
      conseil: 'Valoriser les progrès et les bénéfices immédiats. Prévenir les situations à haut risque de rechute (HALT).'
    },
    {
      id: 'MAINTIEN',
      titre: '5. Maintien & Consolidation',
      desc: 'Abstinence stable depuis plus de 6 mois. Consolidation des nouvelles habitudes.',
      couleur: '#0284c7',
      conseil: 'Soutien au long cours. Rassurer sur le fait qu\'un faux pas n\'est pas un échec définitif.'
    }
  ];

  const currentStadeObj = STADES_PROCHASKA.find(s => s.id === stadeProchaska) || STADES_PROCHASKA[1];

  // Actions
  const handleCopyAddictoSummary = (title, summary) => {
    navigator.clipboard.writeText(summary);
    onNotify(`Synthèse ${title} copiée dans le presse-papier`);
  };

  const handleSaveAddictoTest = (testType, scoreVal, resultText) => {
    saveAddictoRecord({
      patientId: patient?.id || null,
      patientName: patient ? `${patient.nom} ${patient.prenom}` : 'Anonyme',
      testType,
      score: scoreVal,
      resultat: resultText,
      stadeProchaska: stadeProchaska
    });
    setHistory(getAddictoHistory(patient?.id));
    onNotify(`Évaluation ${testType} enregistrée dans le dossier du patient`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* En-Tête du Module Addicto */}
      <div style={{
        background: '#1e293b',
        borderRadius: '12px',
        padding: '18px 22px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc', fontWeight: 700 }}>
              DocPocket Addicto - Scores d'Addictions & Psychométrie
            </h2>
            <span style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '6px',
              fontWeight: 600
            }}>
              Tabacologie • Alcoologie • Substances
            </span>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
            Patient(e) évalué(e) : <strong style={{ color: '#fff' }}>{patient ? `${patient.nom} ${patient.prenom}` : 'Sélectionnez un patient'}</strong>
            {patient && ` • Âge : ${patient.age || '55'} ans`}
          </div>
        </div>
      </div>

      {/* Barre de sélection de l'échelle addictologique */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        background: '#131d36',
        padding: '12px',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        {[
          { id: 'fagerstrom', icon: '🚬', label: 'Fagerström (Tabac & Nicotine)' },
          { id: 'audit', icon: '🍷', label: 'AUDIT & AUDIT-C (Alcool OMS)' },
          { id: 'deta', icon: '🍺', label: 'Test DETA / CAGE (Alcool rapide)' },
          { id: 'cast', icon: '🌿', label: 'Score CAST (Cannabis)' },
          { id: 'prochaska', icon: '🔄', label: 'Stades de Prochaska & Motivation' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTest(t.id)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTest === t.id ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'rgba(255,255,255,0.06)',
              color: activeTest === t.id ? '#fff' : '#94a3b8',
              fontWeight: activeTest === t.id ? 700 : 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeTest === t.id ? '0 2px 8px rgba(5, 150, 105, 0.4)' : 'none'
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* 1. TEST DE FAGERSTRÖM */}
      {activeTest === 'fagerstrom' && (
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                Test de Fagerström (Dépendance Physique à la Nicotine)
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Échelle de référence internationale (OMS) pour doser l'aide pharmacologique au sevrage tabagique.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleCopyAddictoSummary('Fagerström', `Test de Fagerström = ${fagerstromResult.score}/10 (${fagerstromResult.niveau}). Conduite : ${fagerstromResult.reco}`)}
                style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: '#cbd5e1', fontSize: '0.78rem', cursor: 'pointer' }}
              >
                📋 Copier
              </button>
              <button
                onClick={() => handleSaveAddictoTest('Test de Fagerström', `${fagerstromResult.score}/10`, fagerstromResult.niveau)}
                style={{ padding: '6px 12px', background: '#059669', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
              >
                💾 Enregistrer
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {FAGERSTROM_QUESTIONS.map((qObj, idx) => (
              <div key={idx} style={{ background: '#0f172a', padding: '14px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc', marginBottom: '10px' }}>
                  {qObj.q}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {qObj.options.map((opt, oIdx) => {
                    const isSelected = fagerstromAnswers[idx] === opt.points;
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => {
                          const updated = [...fagerstromAnswers];
                          updated[idx] = opt.points;
                          setFagerstromAnswers(updated);
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: isSelected ? '1.5px solid #38bdf8' : '1px solid #334155',
                          background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.03)',
                          color: isSelected ? '#38bdf8' : '#94a3b8',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        {opt.label} ({opt.points} pt{opt.points > 1 ? 's' : ''})
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Résultat Fagerström */}
          <div style={{
            background: '#0f172a',
            borderRadius: '10px',
            padding: '18px',
            borderLeft: `5px solid ${fagerstromResult.couleur}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 800, color: fagerstromResult.couleur }}>
                {fagerstromResult.score} <span style={{ fontSize: '1rem', fontWeight: 500 }}>/ 10</span>
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: fagerstromResult.couleur }}>
                {fagerstromResult.niveau}
              </span>
            </div>
            <div style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              <strong>Recommandation Thérapeutique : </strong>{fagerstromResult.reco}
            </div>
          </div>
        </div>
      )}

      {/* 2. SCORE AUDIT (Alcool OMS) */}
      {activeTest === 'audit' && (
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                Score AUDIT (Alcohol Use Disorders Identification Test - OMS)
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Dépistage de l'usage problématique d'alcool et de la dépendance (Score AUDIT-C calculé sur les 3 premières questions).
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleCopyAddictoSummary('AUDIT Alcool', `Score AUDIT = ${auditResult.score}/40 (AUDIT-C = ${auditResult.auditC}/12). Niveau : ${auditResult.niveau}. Conduite : ${auditResult.reco}`)}
                style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: '#cbd5e1', fontSize: '0.78rem', cursor: 'pointer' }}
              >
                📋 Copier
              </button>
              <button
                onClick={() => handleSaveAddictoTest('Score AUDIT Alcool', `${auditResult.score}/40`, auditResult.niveau)}
                style={{ padding: '6px 12px', background: '#059669', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
              >
                💾 Enregistrer
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {AUDIT_QUESTIONS.map((qObj, idx) => (
              <div key={idx} style={{ background: '#0f172a', padding: '14px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc', marginBottom: '10px' }}>
                  {qObj.q} {idx < 3 && <span style={{ color: '#38bdf8', fontSize: '0.72rem' }}>(Item AUDIT-C)</span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {qObj.options.map((opt, oIdx) => {
                    const isSelected = auditAnswers[idx] === opt.points;
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => {
                          const updated = [...auditAnswers];
                          updated[idx] = opt.points;
                          setAuditAnswers(updated);
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: isSelected ? '1.5px solid #10b981' : '1px solid #334155',
                          background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
                          color: isSelected ? '#34d399' : '#94a3b8',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        {opt.label} ({opt.points} pt{opt.points > 1 ? 's' : ''})
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Résultat AUDIT */}
          <div style={{
            background: '#0f172a',
            borderRadius: '10px',
            padding: '18px',
            borderLeft: `5px solid ${auditResult.couleur}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 800, color: auditResult.couleur }}>
                {auditResult.score} <span style={{ fontSize: '1rem', fontWeight: 500 }}>/ 40</span>
              </span>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: auditResult.couleur }}>
                  {auditResult.niveau}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                  Score AUDIT-C (3 premières questions) : <strong>{auditResult.auditC} / 12</strong> (Seuil risque : ≥ 4 chez l'homme, ≥ 3 chez la femme)
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5, marginTop: '4px' }}>
              <strong>Conduite Clinique : </strong>{auditResult.reco}
            </div>
          </div>
        </div>
      )}

      {/* 3. TEST DETA / CAGE */}
      {activeTest === 'deta' && (
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                Test DETA / CAGE (Dépistage Rapide en 4 Questions)
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Test ultra-rapide en consultation : 2 réponses positives signent un risque très élevé d'alcoolo-dépendance.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleCopyAddictoSummary('DETA / CAGE', `Test DETA = ${detaResult.score}/4 (${detaResult.niveau}). Conduite : ${detaResult.reco}`)}
                style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: '#cbd5e1', fontSize: '0.78rem', cursor: 'pointer' }}
              >
                📋 Copier
              </button>
              <button
                onClick={() => handleSaveAddictoTest('Test DETA / CAGE', `${detaResult.score}/4`, detaResult.niveau)}
                style={{ padding: '6px 12px', background: '#059669', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
              >
                💾 Enregistrer
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {[
              { key: 'd', lettre: 'D', titre: 'Diminuer', text: 'Avez-vous déjà ressenti le besoin de DIMINUER votre consommation de boissons alcoolisées ?' },
              { key: 'e', lettre: 'E', titre: 'Entourage', text: 'Votre ENTOURAGE vous a-t-il déjà fait des remarques ou reproches au sujet de votre consommation ?' },
              { key: 't', lettre: 'T', titre: 'Trop', text: 'Avez-vous déjà eu l\'impression que vous buviez TROP ou ressenti de la culpabilité ?' },
              { key: 'a', lettre: 'A', titre: 'Alcool au réveil', text: 'Avez-vous déjà eu besoin d\'ALCOOL dès le réveil (à jeun) pour vous sentir en forme ?' }
            ].map(item => (
              <label
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '14px',
                  borderRadius: '10px',
                  background: detaState[item.key] ? 'rgba(239, 68, 68, 0.15)' : '#0f172a',
                  border: detaState[item.key] ? '1.5px solid #ef4444' : '1px solid #334155',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={detaState[item.key]}
                  onChange={(e) => setDetaState({ ...detaState, [item.key]: e.target.checked })}
                  style={{ width: '20px', height: '20px', marginTop: '2px', accentColor: '#ef4444' }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: detaState[item.key] ? '#f87171' : '#fff', fontSize: '0.95rem' }}>
                    {item.lettre} — {item.titre}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px', lineHeight: 1.4 }}>
                    {item.text}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div style={{
            background: '#0f172a',
            borderRadius: '10px',
            padding: '18px',
            borderLeft: `5px solid ${detaResult.couleur}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 800, color: detaResult.couleur }}>
                {detaResult.score} <span style={{ fontSize: '1rem', fontWeight: 500 }}>/ 4</span>
              </span>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: detaResult.couleur }}>
                {detaResult.niveau}
              </span>
            </div>
            <div style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              {detaResult.reco}
            </div>
          </div>
        </div>
      )}

      {/* 4. SCORE CAST (Cannabis) */}
      {activeTest === 'cast' && (
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                Score CAST (Cannabis Abuse Screening Test)
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Échelle clinique pour repérer les usages problématiques et la dépendance au cannabis.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleCopyAddictoSummary('Score CAST Cannabis', `Score CAST = ${castResult.score}/6 (${castResult.niveau}). Conduite : ${castResult.reco}`)}
                style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: '#cbd5e1', fontSize: '0.78rem', cursor: 'pointer' }}
              >
                📋 Copier
              </button>
              <button
                onClick={() => handleSaveAddictoTest('Score CAST Cannabis', `${castResult.score}/6`, castResult.niveau)}
                style={{ padding: '6px 12px', background: '#059669', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
              >
                💾 Enregistrer
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              "1. Avez-vous déjà fumé du cannabis avant midi ?",
              "2. Avez-vous déjà fumé du cannabis lorsque vous étiez seul(e) ?",
              "3. Avez-vous déjà eu des problèmes de mémoire quand vous fumez du cannabis ?",
              "4. Des proches ou amis vous ont-ils déjà dit que vous devriez réduire ou arrêter ?",
              "5. Avez-vous déjà essayé de réduire ou d'arrêter de fumer du cannabis sans y parvenir ?",
              "6. Avez-vous déjà eu des problèmes à cause de votre consommation (conflits, travail, scolarité, accident) ?"
            ].map((questionText, idx) => (
              <label
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: castState[idx] ? 'rgba(16, 185, 129, 0.15)' : '#0f172a',
                  border: castState[idx] ? '1.5px solid #10b981' : '1px solid #334155',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={castState[idx]}
                  onChange={(e) => {
                    const updated = [...castState];
                    updated[idx] = e.target.checked;
                    setCastState(updated);
                  }}
                  style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                />
                <span style={{ fontSize: '0.88rem', color: castState[idx] ? '#34d399' : '#f8fafc', fontWeight: castState[idx] ? 600 : 400 }}>
                  {questionText}
                </span>
              </label>
            ))}
          </div>

          <div style={{
            background: '#0f172a',
            borderRadius: '10px',
            padding: '18px',
            borderLeft: `5px solid ${castResult.couleur}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 800, color: castResult.couleur }}>
                {castResult.score} <span style={{ fontSize: '1rem', fontWeight: 500 }}>/ 6</span>
              </span>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: castResult.couleur }}>
                {castResult.niveau}
              </span>
            </div>
            <div style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              {castResult.reco}
            </div>
          </div>
        </div>
      )}

      {/* 5. STADES DE PROCHASKA & BALANCE MOTIVATIONNELLE */}
      {activeTest === 'prochaska' && (
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                Stades de Changement de Prochaska & DiClemente
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Modèle transthéorique évaluant la motivation du patient pour adapter la posture clinique.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleCopyAddictoSummary('Motivation Prochaska', `Stade de Changement : ${currentStadeObj.titre}. Posture recommandée : ${currentStadeObj.conseil}. Balance : [Avantages perçus: ${balanceAvantages}] / [Inconvénients: ${balanceInconvenients}]`)}
                style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: '#cbd5e1', fontSize: '0.78rem', cursor: 'pointer' }}
              >
                📋 Copier
              </button>
              <button
                onClick={() => handleSaveAddictoTest('Stade Prochaska & Motivation', currentStadeObj.titre, currentStadeObj.conseil)}
                style={{ padding: '6px 12px', background: '#059669', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
              >
                💾 Enregistrer
              </button>
            </div>
          </div>

          {/* Jauge des 5 stades */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {STADES_PROCHASKA.map(stade => {
              const isSelected = stadeProchaska === stade.id;
              return (
                <div
                  key={stade.id}
                  onClick={() => setStadeProchaska(stade.id)}
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: isSelected ? 'rgba(56, 189, 248, 0.2)' : '#0f172a',
                    border: isSelected ? '2px solid #38bdf8' : '1px solid #334155',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: isSelected ? '#38bdf8' : stade.couleur }}>
                    {stade.titre}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px', lineHeight: 1.35 }}>
                    {stade.desc}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recommandation de posture clinique */}
          <div style={{
            background: '#0f172a',
            padding: '16px',
            borderRadius: '10px',
            borderLeft: `5px solid ${currentStadeObj.couleur}`
          }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
              Posture Thérapeutique Recommandée pour ce Stade :
            </div>
            <div style={{ fontSize: '0.95rem', color: '#f8fafc', fontWeight: 600, marginTop: '4px' }}>
              {currentStadeObj.conseil}
            </div>
          </div>

          {/* Balance décisionnelle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600, marginBottom: '6px' }}>
                ⚖️ Avantages perçus à maintenir la consommation :
              </label>
              <textarea
                rows={3}
                value={balanceAvantages}
                onChange={(e) => setBalanceAvantages(e.target.value)}
                style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#f87171', fontWeight: 600, marginBottom: '6px' }}>
                ⚠️ Inconvénients et motivations au changement :
              </label>
              <textarea
                rows={3}
                value={balanceInconvenients}
                onChange={(e) => setBalanceInconvenients(e.target.value)}
                style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Historique des Évaluations Addictologiques du Patient */}
      <div style={{
        background: '#1e293b',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
            🕒 Historique des Évaluations Addictologiques ({history.length})
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            Patient : {patient ? `${patient.nom} ${patient.prenom}` : 'Non spécifié'}
          </span>
        </div>

        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
          {history.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              Aucune évaluation addictologique enregistrée pour ce patient.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#94a3b8' }}>
                  <th style={{ padding: '10px 14px' }}>Date</th>
                  <th style={{ padding: '10px 14px' }}>Test / Échelle</th>
                  <th style={{ padding: '10px 14px' }}>Score</th>
                  <th style={{ padding: '10px 14px' }}>Résultat / Sévérité</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 14px', color: '#94a3b8' }}>
                      {new Date(h.date).toLocaleDateString('fr-FR')} {new Date(h.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '8px 14px', fontWeight: 600, color: '#38bdf8' }}>{h.testType}</td>
                    <td style={{ padding: '8px 14px', fontWeight: 700, color: '#f8fafc' }}>{h.score}</td>
                    <td style={{ padding: '8px 14px', color: '#cbd5e1' }}>{h.resultat}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          deleteAddictoRecord(h.id);
                          setHistory(getAddictoHistory(patient?.id));
                          onNotify('Évaluation supprimée');
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.85rem' }}
                        title="Supprimer"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
