import React, { useState } from 'react';
import { 
  activateLicense, 
  unlockAppWithLicense,
  getDoctorPinConfig, 
  setDoctorPinCode,
  getLicensePartitionId,
  syncLicenseWithFirebase
} from '../services/licenseService';
import { savePractitioner, getAllPractitioners } from '../services/practitionerService';
import { publishDoctorToDirectory } from '../services/confreresDirectoryService';
import logoImg from '../assets/logo.jpg';

const SPECIALITES = [
  'Médecine Générale',
  'Cardiologie & Maladies Vasculaires',
  'Pédiatrie & Néonatologie',
  'Gynécologie-Obstétrique',
  'Dermatologie & Vénéréologie',
  'Ophtalmologie',
  'Gastro-Entérologie & Hépatologie',
  'Psychiatrie & Pédopsychiatrie',
  'Orthopédie & Traumatologie',
  'Neurologie',
  'Pneumologie & Phtisiologie',
  'O.R.L & Chirurgie Cervico-faciale',
  'Endocrinologie & Diabétologie',
  'Rhumatologie',
  'Radiologie & Imagerie Médicale',
  'Urologie & Andrologie',
  'Néphrologie',
  'Chirurgie Générale',
  'Médecine Interne',
  'Médecine Dentaire & Stomatologie',
  'Médecine Physique & Réadaptation'
];

const VILLES_TUNISIE = [
  'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan',
  'Bizerte', 'Béja', 'Jendouba', 'Le Kef', 'Siliana',
  'Sousse', 'Monastir', 'Mahdia', 'Sfax', 'Kairouan',
  'Kasserine', 'Sidi Bouzid', 'Gabès', 'Médenine',
  'Tataouine', 'Gafsa', 'Tozeur', 'Kébili'
];

export default function LicenseLockModal({ onActivated, lockoutReason = '' }) {
  const [step, setStep] = useState('license'); // 'license' | 'doctor_setup' | 'pin_setup'
  const [keyInput, setKeyInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [checking, setChecking] = useState(false);
  const [activatedDetails, setActivatedDetails] = useState(null);

  // Configuration du code PIN de sécurité
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Formulaire d'onboarding Confrère (nouveau cabinet acheteur)
  const [docTitre, setDocTitre] = useState('Dr.');
  const [docNom, setDocNom] = useState('');
  const [docPrenom, setDocPrenom] = useState('');
  const [docSpecialite, setDocSpecialite] = useState('Médecine Générale');
  const [docVille, setDocVille] = useState('Tunis');
  const [docAdresse, setDocAdresse] = useState('');
  const [docTelephone, setDocTelephone] = useState('');
  const [docEmail, setDocEmail] = useState('');
  const [docCnamId, setDocCnamId] = useState('');
  const [docPin, setDocPin] = useState('');
  const [docConfirmPin, setDocConfirmPin] = useState('');
  const [publishInDirectory, setPublishInDirectory] = useState(true);
  const [setupError, setSetupError] = useState('');

  const handleActivate = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!keyInput.trim()) {
      setErrorMsg('Veuillez saisir votre clé de licence.');
      return;
    }

    setChecking(true);
    const result = unlockAppWithLicense(keyInput.trim());

    if (result.success) {
      setSuccessMsg(`Succès ! Application déverrouillée.`);
      setActivatedDetails(result);

      const partition = getLicensePartitionId(keyInput.trim());

      setTimeout(() => {
        setChecking(false);

        // Si la clé entrée est une licence commerciale vendue à un confrère
        if (partition !== 'primary') {
          const docs = getAllPractitioners();
          const isConfigured = docs.some(d => d.nom && d.nom.trim().length > 0);
          if (!isConfigured) {
            // Afficher le formulaire d'onboarding cabinet pour ce nouveau médecin
            setStep('doctor_setup');
            return;
          }
        }

        // Si partition maître ou profil déjà configuré
        const pinCfg = getDoctorPinConfig();
        if (!pinCfg.hasPin) {
          setStep('pin_setup');
        } else {
          if (onActivated) {
            onActivated({ isLicensed: true });
          }
        }
      }, 500);
    } else {
      setChecking(false);
      setErrorMsg(result.error || 'Clé de licence invalide.');
    }
  };

  const handleSaveDoctorSetup = async (e) => {
    e.preventDefault();
    setSetupError('');

    if (!docNom.trim() || !docPrenom.trim()) {
      setSetupError('Veuillez renseigner le nom et le prénom du praticien.');
      return;
    }

    if (!docTelephone.trim()) {
      setSetupError('Veuillez indiquer un numéro de téléphone de contact.');
      return;
    }

    if (docPin) {
      if (docPin.length < 4) {
        setSetupError('Le code PIN de sécurité doit comporter au moins 4 chiffres.');
        return;
      }
      if (docPin !== docConfirmPin) {
        setSetupError('Les deux codes PIN ne correspondent pas.');
        return;
      }
    }

    // 1. Sauvegarde du praticien dans sa partition étanche
    const practitionerPayload = {
      id: 'primary',
      titre: docTitre,
      nom: docNom.trim().toUpperCase(),
      prenom: docPrenom.trim(),
      specialite: docSpecialite,
      ville: docVille,
      adresse: docAdresse.trim(),
      telephone: docTelephone.trim(),
      email: docEmail.trim(),
      cnamId: docCnamId.trim(),
      pinCode: docPin.trim(),
      isDefault: true,
      color: '#059669',
      createdAt: new Date().toISOString()
    };

    savePractitioner(practitionerPayload);

    // Notification et synchronisation vers Firebase pour le Keygen Éditeur
    try {
      syncLicenseWithFirebase(practitionerPayload);
    } catch {}

    // 2. Enregistrement du code PIN de sécurité
    if (docPin.trim()) {
      setDoctorPinCode(docPin.trim());
    }

    // 3. Inscription dans l'annuaire partagé des confrères si demandée
    if (publishInDirectory) {
      try {
        await publishDoctorToDirectory({
          titre: docTitre,
          nom: docNom.trim().toUpperCase(),
          prenom: docPrenom.trim(),
          specialite: docSpecialite,
          ville: docVille,
          adresse: docAdresse.trim(),
          telephone: docTelephone.trim(),
          email: docEmail.trim(),
          cnamId: docCnamId.trim()
        });
      } catch (err) {
        console.warn("Publication annuaire différée:", err);
      }
    }

    alert(`✓ Félicitations ${docTitre} ${docNom.toUpperCase()} ${docPrenom} !\n\nVotre cabinet médical DocPocket Cab a été initialisé avec succès.\nVous disposez de votre espace de données 100% indépendant, sécurisé et prêt à accueillir vos patients.`);

    if (onActivated) {
      onActivated({ isLicensed: true });
    }
  };

  const handleSavePin = (e) => {
    e.preventDefault();
    setPinError('');

    if (!newPin || newPin.trim().length < 4) {
      setPinError('Le code PIN doit comporter au moins 4 chiffres.');
      return;
    }

    if (newPin !== confirmPin) {
      setPinError('Les deux codes PIN ne correspondent pas.');
      return;
    }

    const res = setDoctorPinCode(newPin.trim());
    if (res.success) {
      alert("✓ Code PIN enregistré avec succès !\n\nCe code sera demandé au démarrage pour protéger les dossiers médicaux de vos patients.");
      if (onActivated) {
        onActivated({ isLicensed: true });
      }
    } else {
      setPinError(res.error);
    }
  };

  const handleSkipPin = () => {
    if (onActivated) {
      onActivated({ isLicensed: true });
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'radial-gradient(circle at 50% 30%, #1e293b 0%, #0a0f1d 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      padding: '16px',
      overflowY: 'auto'
    }}>
      <div style={{
        width: '100%',
        maxWidth: step === 'doctor_setup' ? '540px' : '480px',
        maxHeight: '94vh',
        overflowY: 'auto',
        background: 'rgba(15, 23, 42, 0.94)',
        backdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '20px',
        padding: step === 'doctor_setup' ? '28px 24px' : '36px 30px',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.15)',
        textAlign: 'center'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
          <div style={{
            width: '74px',
            height: '74px',
            borderRadius: '16px',
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
                borderRadius: '13px',
                objectFit: 'cover'
              }}
            />
          </div>
        </div>

        <h1 style={{ margin: '0 0 6px 0', fontSize: '1.4rem', color: '#f8fafc', fontWeight: 700 }}>
          DocPocket Cab
        </h1>

        {/* ============================================================== */}
        {/* ÉTAPE 1 : ENTRÉE DE LA CLÉ DE LICENCE                         */}
        {/* ============================================================== */}
        {step === 'license' && (
          <>
            <div style={{
              display: 'inline-block',
              background: lockoutReason ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)',
              border: `1px solid ${lockoutReason ? '#ef4444' : '#eab308'}`,
              color: lockoutReason ? '#f87171' : '#facc15',
              padding: '3px 12px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              marginBottom: '16px',
              letterSpacing: '0.5px'
            }}>
              {lockoutReason ? '⛔ SÉCURITÉ PATIENTS : APPLICATION BLOQUÉE' : '🔒 ACTIVATION REQUISE'}
            </div>

            <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.5 }}>
              {lockoutReason ? (
                <strong style={{ color: '#fca5a5' }}>
                  {lockoutReason}. Pour lever le blocage de sécurité et protéger les dossiers médicaux, veuillez saisir votre clé de licence officielle :
                </strong>
              ) : (
                "Veuillez renseigner votre clé de licence officielle pour activer votre cabinet médical dans un espace de données sécurisé et indépendant :"
              )}
            </p>

            <form onSubmit={handleActivate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <input
                  type="text"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                  placeholder="Ex: DPCAB-03-20271231-A79B-8F42"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '13px 16px',
                    background: '#1e293b',
                    border: errorMsg ? '2px solid #ef4444' : '1px solid #334155',
                    borderRadius: '10px',
                    color: '#facc15',
                    fontSize: '0.98rem',
                    textAlign: 'center',
                    letterSpacing: '1.5px',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              {errorMsg && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.84rem'
                }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              {successMsg && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#6ee7b7',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.84rem'
                }}>
                  ✅ {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={checking}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '0.98rem',
                  fontWeight: 700,
                  cursor: checking ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <span>🔓</span> Déverrouiller & Activer la Licence
              </button>
            </form>

            <div style={{
              marginTop: '20px',
              paddingTop: '14px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.78rem',
              color: '#64748b',
              lineHeight: 1.45
            }}>
              Votre clé de licence officielle vous a été délivrée par l'éditeur du logiciel. Chaque clé bénéficie d'un cloisonnement étanche de ses données.
            </div>
          </>
        )}

        {/* ============================================================== */}
        {/* ÉTAPE NOUVEAU MÉDECIN : INITIALISATION DU CABINET CONFRÈRE    */}
        {/* ============================================================== */}
        {step === 'doctor_setup' && (
          <div style={{ textAlign: 'left' }}>
            <div style={{
              display: 'inline-block',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              color: '#34d399',
              padding: '3px 12px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              marginBottom: '10px',
              letterSpacing: '0.5px'
            }}>
              ✓ LICENCE VALIDÉE • ESPACE MÉDECIN PRIVÉ
            </div>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', color: '#f8fafc', fontWeight: 700 }}>
              🩺 Configuration Initiale de votre Cabinet
            </h3>

            <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>
              Vos coordonnées apparaîtront sur les ordonnances, quittances et dans l'annuaire médical des confrères :
            </p>

            <form onSubmit={handleSaveDoctorSetup} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Titre</label>
                  <select
                    value={docTitre}
                    onChange={(e) => setDocTitre(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                  >
                    <option value="Dr.">Dr.</option>
                    <option value="Pr.">Pr.</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Nom *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nom de famille"
                    value={docNom}
                    onChange={(e) => setDocNom(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Prénom *</label>
                  <input
                    type="text"
                    required
                    placeholder="Prénom"
                    value={docPrenom}
                    onChange={(e) => setDocPrenom(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Spécialité Médicale</label>
                  <select
                    value={docSpecialite}
                    onChange={(e) => setDocSpecialite(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.82rem' }}
                  >
                    {SPECIALITES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Gouvernorat / Ville</label>
                  <select
                    value={docVille}
                    onChange={(e) => setDocVille(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.82rem' }}
                  >
                    {VILLES_TUNISIE.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Adresse du Cabinet</label>
                <input
                  type="text"
                  placeholder="Ex: Avenue Habib Bourguiba, Centre Médical..."
                  value={docAdresse}
                  onChange={(e) => setDocAdresse(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Téléphone Cabinet *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Ex: 71 000 000 / 98 000 000"
                    value={docTelephone}
                    onChange={(e) => setDocTelephone(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Code Conventionné CNAM</label>
                  <input
                    type="text"
                    placeholder="Ex: 01000..."
                    value={docCnamId}
                    onChange={(e) => setDocCnamId(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Code PIN de sécurité du médecin */}
              <div style={{
                background: 'rgba(2, 132, 199, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '10px 12px',
                borderRadius: '8px',
                marginTop: '4px'
              }}>
                <div style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700, marginBottom: '6px' }}>
                  🛡️ Code PIN Personnel de Sécurité (4 chiffres) :
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="password"
                    maxLength={8}
                    placeholder="PIN (ex: 1234)"
                    value={docPin}
                    onChange={(e) => setDocPin(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#facc15', fontSize: '0.95rem', letterSpacing: '3px', textAlign: 'center', fontWeight: 700 }}
                  />
                  <input
                    type="password"
                    maxLength={8}
                    placeholder="Confirmez PIN"
                    value={docConfirmPin}
                    onChange={(e) => setDocConfirmPin(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#facc15', fontSize: '0.95rem', letterSpacing: '3px', textAlign: 'center', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Inscription à l'Annuaire Médical Confrères */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: '#cbd5e1', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={publishInDirectory}
                  onChange={(e) => setPublishInDirectory(e.target.checked)}
                />
                <span>👥 Publier mes coordonnées professionnelles dans <strong>l'Annuaire Médical des Confrères DocPocket</strong> (pour recevoir des orientations de patients)</span>
              </label>

              {setupError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#fca5a5',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem'
                }}>
                  ⚠️ {setupError}
                </div>
              )}

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '6px'
                }}
              >
                <span>🚀</span> Enregistrer & Accéder à Mon Cabinet
              </button>
            </form>
          </div>
        )}

        {/* ============================================================== */}
        {/* ÉTAPE PIN RAPIDE POUR CABINET EXISTANT                         */}
        {/* ============================================================== */}
        {step === 'pin_setup' && (
          <div>
            <div style={{
              display: 'inline-block',
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid #22c55e',
              color: '#4ade80',
              padding: '3px 12px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              marginBottom: '14px',
              letterSpacing: '0.5px'
            }}>
              ✓ LICENCE VALIDÉE • SÉCURITÉ PATIENTS
            </div>

            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#f8fafc' }}>
              Définir votre Code PIN Praticien
            </h3>

            <p style={{ margin: '0 0 18px 0', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.45 }}>
              Pour sécuriser les dossiers médicaux confidentiels de vos patients, définissez un code PIN personnel (4 chiffres ou plus) :
            </p>

            <form onSubmit={handleSavePin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="password"
                maxLength={8}
                value={newPin}
                onChange={(e) => { setNewPin(e.target.value); setPinError(''); }}
                placeholder="Code PIN (ex: 1234)"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#facc15',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  letterSpacing: '6px'
                }}
                autoFocus
              />

              <input
                type="password"
                maxLength={8}
                value={confirmPin}
                onChange={(e) => { setConfirmPin(e.target.value); setPinError(''); }}
                placeholder="Confirmez le code PIN"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#facc15',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  letterSpacing: '6px'
                }}
              />

              {pinError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#fca5a5',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '0.82rem'
                }}>
                  ⚠️ {pinError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleSkipPin}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #475569',
                    color: '#cbd5e1',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Plus tard
                </button>

                <button
                  type="submit"
                  style={{
                    flex: 2,
                    padding: '11px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
                  }}
                >
                  <span>🛡️</span> Enregistrer le PIN
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
