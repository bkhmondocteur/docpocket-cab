import React, { useState, useEffect } from 'react';
import {
  getAllPatients,
  getAllConsultations,
  getAllPrescriptions,
  getAllInvoices,
  getAllBordereaux
} from '../services/patientStorage';
import {
  exportDocPocketBackup,
  restoreDocPocketBackup,
  restoreLegacyBackupZip
} from '../services/backupService';
import {
  getBackupFolderInfo,
  isDirectoryPickerSupported
} from '../services/backupFolderService';
import {
  subscribeAutoBackup,
  getAutoBackupStatus,
  setAutoBackupEnabled,
  setAutoBackupDaily,
  performAutoBackupNow,
  downloadLatestAutoBackupSnapshot
} from '../services/autoBackupService';
import {
  getFirebaseBridgeConfig,
  saveFirebaseBridgeConfig,
  disconnectFirebaseBridge,
  autoProvisionCabinetCloud,
  uploadBackupToBridge,
  downloadBackupFromBridge,
  smartDeduplicatingMerge,
  sendInitialSyncRequestFromMobile,
  getDeviceDisplayName,
  isMobileDevice,
  getBridgeChannelKey,
  testFirebaseBridgeConnection
} from '../services/firebaseBridgeSyncService';
import {
  sendEmailVerificationCode,
  verifyEmailSecretCode,
  resetEmailVerification,
  isEmailAlreadyVerified
} from '../services/emailVerificationService';
import {
  getLicenseStatus,
  activateLicense,
  upgradeLicenseKey,
  verifyLicenseKey,
  computeDoctorSerial,
  revokeLicense,
  getDoctorPinConfig,
  setDoctorPinCode,
  removeDoctorPinCode,
  getActiveLicensePartitionId,
  isMasterInstallation,
  switchToMasterInstallation
} from '../services/licenseService';
import {
  getAllPractitioners,
  getActivePractitioner,
  savePractitioner,
  deletePractitioner,
  switchPractitioner,
  formatDoctorDisplayName,
  PRACTITIONER_COLORS
} from '../services/practitionerService';
import {
  THEMES_LIST,
  getCurrentThemeId,
  getCurrentTheme,
  applyTheme
} from '../services/themeService';
import BackupFolderSetupModal from './BackupFolderSetupModal';

export default function SettingsView({ initialTab = 'backup', onDataRestored = () => {} }) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'backup' | 'sync' | 'license' | 'practitioners' | 'themes'

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [dbStats, setDbStats] = useState({
    patients: 0,
    consultations: 0,
    prescriptions: 0,
    invoices: 0,
    bordereaux: 0
  });

  // États pour les thèmes visuels (10 thèmes médicaux)
  const [activeThemeId, setActiveThemeId] = useState(() => getCurrentThemeId());
  const [themeSuccessMsg, setThemeSuccessMsg] = useState('');

  const handleSelectTheme = (themeId) => {
    const applied = applyTheme(themeId);
    setActiveThemeId(applied.id);
    setThemeSuccessMsg(`✓ Thème « ${applied.name} » activé avec succès ! Tous vos écrans ont été mis à jour.`);
    setTimeout(() => {
      setThemeSuccessMsg('');
    }, 4000);
  };

  // États pour la licence et la sécurité PIN
  const [licenseState, setLicenseState] = useState(() => getLicenseStatus());
  const [newKeyInput, setNewKeyInput] = useState('');
  const [activateMsg, setActivateMsg] = useState(null);
  const [pinConfig, setPinConfig] = useState(() => getDoctorPinConfig());
  const [settingsPinInput, setSettingsPinInput] = useState('');
  const [settingsPinMsg, setSettingsPinMsg] = useState('');

  // États pour la synchronisation Cloud Google & Firebase
  const [bridgeConfig, setBridgeConfig] = useState(() => getFirebaseBridgeConfig());
  const [googleEmailInput, setGoogleEmailInput] = useState(() => bridgeConfig.googleUserEmail || '');
  const [googleDoctorInput, setGoogleDoctorInput] = useState(() => bridgeConfig.googleDoctorName || '');
  const [provisioningCloud, setProvisioningCloud] = useState(false);
  const [bridgeStatusMsg, setBridgeStatusMsg] = useState('');
  const [bridgeErrorMsg, setBridgeErrorMsg] = useState('');
  const [bridgeLoading, setBridgeLoading] = useState(false);
  const [bridgeTesting, setBridgeTesting] = useState(false);
  const [bridgeTestResult, setBridgeTestResult] = useState(null);

  // États pour la vérification email par code secret (2FA)
  const [otpStep, setOtpStep] = useState('input_email'); // 'input_email' | 'input_code'
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [sentCodeNotice, setSentCodeNotice] = useState(null);
  const [otpSending, setOtpSending] = useState(false);

  // Profil praticien & Multi-Médecins
  const [practitionersList, setPractitionersList] = useState(() => getAllPractitioners());
  const [activePractitioner, setActivePractitioner] = useState(() => getActivePractitioner());
  const [editingPractitioner, setEditingPractitioner] = useState(null);
  const [isNewPractitioner, setIsNewPractitioner] = useState(false);
  const [practitionerPinTarget, setPractitionerPinTarget] = useState(null);
  const [practitionerEnteredPin, setPractitionerEnteredPin] = useState('');
  const [practitionerPinError, setPractitionerPinError] = useState('');

  const [doctorProfile, setDoctorProfile] = useState(() => {
    const cur = getActivePractitioner();
    return {
      nom: cur.nom ? `${cur.prenom || ''} ${cur.nom}`.trim() : 'Hamed BEN KHALIFA',
      specialite: cur.specialite || 'Médecine Générale',
      cnamId: cur.cnamId || '010002763183',
      ordreId: cur.ordreId || '12052',
      fiscId: cur.fiscId || '856103/M',
      adresse: cur.adresse || 'Complexe Médical Dar Attabib',
      ville: cur.ville || 'Mahdia',
      telephone: cur.telephone || '31 576 900 / 53 573 117',
      email: cur.email || 'bkhmondocteur@yahoo.com',
      ribCnam: '08 012 0001234567890 45'
    };
  });

  // États pour la sauvegarde & restauration
  const [folderInfo, setFolderInfo] = useState({ folderName: '', isConfigured: false, supported: true, hasDirectHandle: false });
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [autoBackupState, setAutoBackupState] = useState(() => getAutoBackupStatus());
  const [autoBackupTriggering, setAutoBackupTriggering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState('');
  const [restoreResult, setRestoreResult] = useState(null);
  const [restoreMode, setRestoreMode] = useState('merge'); // 'merge' | 'replace'
  const [selectedFile, setSelectedFile] = useState(null);

  const refreshFolderInfo = async () => {
    try {
      const info = await getBackupFolderInfo();
      setFolderInfo(info);
    } catch (e) {
      console.warn("Erreur chargement dossier:", e);
    }
  };

  const refreshStats = async () => {
    try {
      const [p, c, pr, i, b] = await Promise.all([
        getAllPatients(),
        getAllConsultations(),
        getAllPrescriptions(),
        getAllInvoices(),
        getAllBordereaux()
      ]);
      setDbStats({
        patients: p.length,
        consultations: c.length,
        prescriptions: pr.length,
        invoices: i.length,
        bordereaux: b.length
      });
    } catch (e) {
      console.warn("Erreur chargement statistiques DB:", e);
    }
  };

  useEffect(() => {
    refreshStats();
    refreshFolderInfo();
    const unsub = subscribeAutoBackup((st) => {
      setAutoBackupState(st);
    });
    const savedProfile = localStorage.getItem('docpocket_doctor_profile');
    if (savedProfile) {
      try {
        setDoctorProfile(JSON.parse(savedProfile));
      } catch (e) {
        // ignore
      }
    }
    return unsub;
  }, []);

  const handleManualTriggerAutoBackup = async () => {
    try {
      setAutoBackupTriggering(true);
      const res = await performAutoBackupNow('test_manuel_parametres');
      alert(`✓ Sauvegarde automatique effectuée avec succès !\nFichier : ${res.filename}\nEmplacement : ${res.folderName}\nPatients sauvegardés : ${res.stats.patientsCount}`);
    } catch (err) {
      alert("Erreur lors de l'auto-sauvegarde : " + err.message);
    } finally {
      setAutoBackupTriggering(false);
    }
  };

  const handleDownloadLatestSnapshot = async () => {
    try {
      const snapshot = await downloadLatestAutoBackupSnapshot();
      alert(`✓ Téléchargement lancé pour : ${snapshot.filename || 'DocPocketCab_AutoBackup.json'}`);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    localStorage.setItem('docpocket_doctor_profile', JSON.stringify(doctorProfile));
    // Synchronise également avec la gestion multi-médecins
    const cur = getActivePractitioner();
    savePractitioner({
      ...cur,
      nom: doctorProfile.nom,
      specialite: doctorProfile.specialite,
      cnamId: doctorProfile.cnamId,
      ordreId: doctorProfile.ordreId,
      fiscId: doctorProfile.fiscId,
      adresse: doctorProfile.adresse,
      ville: doctorProfile.ville,
      telephone: doctorProfile.telephone,
      email: doctorProfile.email
    });
    setPractitionersList(getAllPractitioners());
    setActivePractitioner(getActivePractitioner());
    alert("✓ Coordonnées du praticien enregistrées avec succès !");
  };

  // Exécution de la Sauvegarde
  const handleExportBackup = async () => {
    try {
      setExporting(true);
      const res = await exportDocPocketBackup();
      const destText = res.saveMode === 'direct'
        ? `📁 Enregistré directement dans : ${res.folderName}`
        : `📥 Téléchargé dans vos fichiers (Dossier : ${res.folderName})`;
      alert(`✓ Sauvegarde générée avec succès !\nFichier : ${res.filename}\n${destText}\nDonnées sauvegardées : ${res.stats.patientsCount} patients, ${res.stats.consultationsCount} consultations.`);
    } catch (err) {
      alert("Erreur lors de la création de la sauvegarde : " + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Traitement du fichier sélectionné
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setRestoreResult(null);
      setRestoreProgress('');
    }
  };

  // Exécution de la Restauration
  const handleStartRestore = async () => {
    if (!selectedFile) {
      alert("Veuillez sélectionner un fichier de sauvegarde (.json ou .zip).");
      return;
    }

    const isZip = selectedFile.name.toLowerCase().endsWith('.zip');
    const isJson = selectedFile.name.toLowerCase().endsWith('.json');

    if (!isZip && !isJson) {
      alert("Format non reconnu. Veuillez choisir un fichier JSON (DocPocket Cab) ou archive ZIP (SMED6__*.zip).");
      return;
    }

    const confirmMsg = restoreMode === 'replace'
      ? `⚠️ ATTENTION : Vous avez choisi le mode 'Remplacement complet'.\nToutes les données actuelles de DocPocket Cabinet seront réinitialisées et remplacées par le contenu de ${selectedFile.name}.\n\nSouhaitez-vous continuer ?`
      : `Voulez-vous importer et fusionner les données du fichier ${selectedFile.name} dans DocPocket Cabinet ?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setRestoring(true);
      setRestoreProgress("Lecture du fichier...");

      const arrayBuffer = await selectedFile.arrayBuffer();

      if (isZip) {
        // Import sauvegarde ancienne base de données cabinet
        const result = await restoreLegacyBackupZip(arrayBuffer, restoreMode, (msg) => {
          setRestoreProgress(msg);
        });
        setRestoreResult({
          type: 'archive',
          message: `✓ Importation de l'archive réussie avec succès !`,
          details: `${result.patients} patients importés, ${result.consultations} consultations, ${result.prescriptions} ordonnances.`
        });
      } else {
        // Import sauvegarde JSON DocPocket
        const text = new TextDecoder('utf-8').decode(arrayBuffer);
        const jsonObj = JSON.parse(text);
        const result = await restoreDocPocketBackup(jsonObj, restoreMode, (msg) => {
          setRestoreProgress(msg);
        });
        setRestoreResult({
          type: 'docpocket',
          message: `✓ Restauration DocPocket Cabinet réussie !`,
          details: `${result.patients} patients, ${result.consultations} consultations, ${result.invoices} factures.`
        });
      }

      await refreshStats();
      onDataRestored();
      alert("✓ Restauration terminée avec succès !");
    } catch (err) {
      alert("Erreur lors de la restauration : " + err.message);
      setRestoreProgress("Échec de la restauration : " + err.message);
    } finally {
      setRestoring(false);
    }
  };

  // ==============================================================
  // GESTIONNAIRES DE SYNCHRONISATION CLOUD & DOUBLE SÉCURITÉ 2FA
  // ==============================================================

  // Étape 1 : Demande de code secret envoyé à l'email du médecin
  const handleRequestSecretCode = async (e) => {
    e?.preventDefault();
    if (!googleEmailInput || !googleEmailInput.includes('@')) {
      alert("Veuillez saisir votre adresse email Google (ex: docteur.dupont@gmail.com).");
      return;
    }
    try {
      setOtpSending(true);
      setBridgeErrorMsg('');
      setSentCodeNotice(null);
      const res = await sendEmailVerificationCode(googleEmailInput, googleDoctorInput);
      setSentCodeNotice(res);
      setOtpStep('input_code');
      setBridgeStatusMsg(`✓ Code secret de sécurité envoyé à ${googleEmailInput} !`);
    } catch (err) {
      setBridgeErrorMsg("Erreur lors de l'envoi du code : " + err.message);
    } finally {
      setOtpSending(false);
    }
  };

  // Étape 2 : Vérification du code secret et initialisation cloud
  const handleValidateSecretCodeAndConnect = async (e) => {
    e?.preventDefault();
    if (!otpCodeInput || otpCodeInput.trim().length < 6) {
      alert("Veuillez saisir le code secret à 6 chiffres reçu sur votre boîte email.");
      return;
    }

    const verification = verifyEmailSecretCode(googleEmailInput, otpCodeInput);
    if (!verification.success) {
      setBridgeErrorMsg(verification.error);
      return;
    }

    try {
      setProvisioningCloud(true);
      const res = await autoProvisionCabinetCloud(googleEmailInput, googleDoctorInput);
      const freshCfg = getFirebaseBridgeConfig();
      setBridgeConfig(freshCfg);
      setBridgeStatusMsg(`✓ Sécurité validée : votre cabinet Cloud est activé et synchronisé !`);
      setOtpStep('input_email');
      setOtpCodeInput('');
      setSentCodeNotice(null);
      alert("✓ Authentification réussie !\n\nVotre adresse email a été validée par code secret.\nVos sauvegardes et synchronisations sont désormais parfaitement sécurisées et cloisonnées avec votre clé de licence.");
    } catch (err) {
      setBridgeErrorMsg("Erreur lors de l'activation : " + err.message);
    } finally {
      setProvisioningCloud(false);
    }
  };

  const handleDisconnectGoogleAccount = () => {
    if (window.confirm("Voulez-vous déconnecter ce compte Google du cabinet ?")) {
      disconnectFirebaseBridge();
      resetEmailVerification();
      const freshCfg = getFirebaseBridgeConfig();
      setBridgeConfig(freshCfg);
      setGoogleEmailInput('');
      setOtpStep('input_email');
      setOtpCodeInput('');
      setSentCodeNotice(null);
      setBridgeStatusMsg("Compte Google déconnecté avec succès. Prêt pour un nouveau compte.");
      setTimeout(() => setBridgeStatusMsg(''), 4000);
    }
  };

  const handleManualBridgeUpload = async () => {
    try {
      setBridgeLoading(true);
      setBridgeStatusMsg("Comparaison des sauvegardes du PC et du smartphone...");
      setBridgeErrorMsg('');

      const [p, c, pr, inv, b] = await Promise.all([
        getAllPatients(),
        getAllConsultations(),
        getAllPrescriptions(),
        getAllInvoices(),
        getAllBordereaux()
      ]);

      const docProf = JSON.parse(localStorage.getItem('docpocket_doctor_profile') || '{}');
      const backupPayload = {
        app: 'DocPocket Cabinet',
        schemaVersion: 6,
        exportedAt: new Date().toISOString(),
        stats: {
          patientsCount: p.length,
          consultationsCount: c.length,
          prescriptionsCount: pr.length,
          invoicesCount: inv.length,
          bordereauxCount: b.length
        },
        doctorProfile: docProf,
        data: { patients: p, consultations: c, prescriptions: pr, invoices: inv, bordereaux: b }
      };

      const res = await uploadBackupToBridge(backupPayload, 'envoi_manuel_parametres');
      if (res.skipped) {
        if (res.reason === 'identical_backup') {
          setBridgeStatusMsg("✓ Les deux sauvegardes du PC et du smartphone sont déjà parfaitement identiques (aucun transfert requis).");
        } else if (res.reason === 'remote_newer_merged') {
          setBridgeStatusMsg("✓ L'autre appareil avait une sauvegarde plus récente : vos données ont été automatiquement fusionnées sans doublons !");
          await refreshStats();
          onDataRestored();
        }
      } else {
        setBridgeStatusMsg(`✓ Sauvegarde la plus récente envoyée sur le Cloud ! (${res.metadata.totalChunks} morceaux, ${res.metadata.stats.patientsCount} patients).`);
      }
      setBridgeConfig(getFirebaseBridgeConfig());
    } catch (err) {
      setBridgeErrorMsg("Erreur lors de l'envoi sur le Cloud : " + err.message);
    } finally {
      setBridgeLoading(false);
    }
  };

  const handleManualBridgeDownload = async () => {
    try {
      setBridgeLoading(true);
      setBridgeStatusMsg("Téléchargement des morceaux depuis le Cloud...");
      setBridgeErrorMsg('');

      const { backupData, metadata } = await downloadBackupFromBridge();
      setBridgeStatusMsg("Fusion intelligente sans doublons...");

      const report = await smartDeduplicatingMerge(backupData, (msg) => {
        setBridgeStatusMsg(msg);
      });

      await refreshStats();
      onDataRestored();
      setBridgeConfig(getFirebaseBridgeConfig());
      setBridgeStatusMsg(`✓ Fusion réussie sans doublons : +${report.newPatients} patient(s), +${report.newConsultations} consult., ${report.updatedConsultations} consult. màj.`);
    } catch (err) {
      setBridgeErrorMsg("Erreur lors de la récupération : " + err.message);
    } finally {
      setBridgeLoading(false);
    }
  };

  const handleSendMobileRequestToPC = async () => {
    try {
      setBridgeLoading(true);
      setBridgeStatusMsg("Envoi du signal de demande de sauvegarde au PC...");
      await sendInitialSyncRequestFromMobile();
      setBridgeStatusMsg("✓ Demande transmise via le Cloud ! Dès que votre PC est allumé, il synchronisera sa dernière sauvegarde.");
    } catch (err) {
      setBridgeErrorMsg("Erreur envoi signal : " + err.message);
    } finally {
      setBridgeLoading(false);
    }
  };

  // Test de connectivité Cloud / Firebase
  const handleTestBridge = async () => {
    try {
      setBridgeTesting(true);
      setBridgeTestResult(null);
      setBridgeStatusMsg('');
      setBridgeErrorMsg('');
      const res = await testFirebaseBridgeConnection();
      setBridgeTestResult(res);
      if (res.success) {
        setBridgeStatusMsg(res.message);
      } else {
        setBridgeErrorMsg(res.message);
      }
    } catch (err) {
      const msg = "Erreur de test : " + err.message;
      setBridgeTestResult({ success: false, message: msg });
      setBridgeErrorMsg(msg);
    } finally {
      setBridgeTesting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Navigation des Onglets Paramètres Adaptative */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        background: '#1e293b',
        padding: '10px 16px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('backup')}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'backup' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
              color: activeTab === 'backup' ? '#fff' : '#94a3b8',
              fontWeight: activeTab === 'backup' ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem'
            }}
          >
            <span>💾</span> Sauvegardes
          </button>

          <button
            onClick={() => setActiveTab('sync')}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'sync' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
              color: activeTab === 'sync' ? '#fff' : '#94a3b8',
              fontWeight: activeTab === 'sync' ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem'
            }}
          >
            <span>🔄</span> Synchronisation Cloud (Google)
          </button>

          <button
            onClick={() => setActiveTab('license')}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'license' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
              color: activeTab === 'license' ? '#fff' : '#94a3b8',
              fontWeight: activeTab === 'license' ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem'
            }}
          >
            <span>🔐</span> Licence & Sécurité PIN
          </button>

          <button
            onClick={() => setActiveTab('practitioners')}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'practitioners' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
              color: activeTab === 'practitioners' ? '#fff' : '#94a3b8',
              fontWeight: activeTab === 'practitioners' ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem'
            }}
          >
            <span>🩺</span> Équipe & Praticiens ({practitionersList.length})
          </button>

          <button
            onClick={() => setActiveTab('themes')}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'themes' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
              color: activeTab === 'themes' ? '#fff' : '#94a3b8',
              fontWeight: activeTab === 'themes' ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem'
            }}
          >
            <span>🎨</span> Thèmes Visuels (10)
          </button>
        </div>

        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          DocPocket Cabinet • Sécurité Locale
        </div>
      </div>

      {/* ============================================================== */}
      {/* ONGLET 1 : SAUVEGARDES & RESTAURATION                          */}
      {/* ============================================================== */}
      {activeTab === 'backup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Configuration du Dossier Local de Sauvegarde */}
          <div style={{
            background: '#1e293b',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem'
              }}>
                📁
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                  Dossier de Sauvegarde Local Actuel :
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{folderInfo.folderName || 'Dossier Téléchargements par défaut'}</span>
                  {folderInfo.hasDirectHandle && (
                    <span style={{
                      fontSize: '0.7rem',
                      background: 'rgba(34, 197, 94, 0.2)',
                      color: '#4ade80',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      border: '1px solid rgba(34, 197, 94, 0.4)'
                    }}>
                      ✓ Écriture directe autorisée
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowFolderModal(true)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#38bdf8',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>🔄</span> Changer de Dossier
              </button>
            </div>
          </div>

          {/* Bloc Sauvegarde Automatique après chaque modification */}
          <div style={{
            background: '#1e293b',
            border: '1.5px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem'
                }}>
                  🛡️
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Sauvegarde Automatique Après Chaque Modification
                  </h3>
                </div>
              </div>

              {/* Interrupteur Activation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={autoBackupState.enabled}
                    onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981' }}
                  />
                  <strong style={{ fontSize: '0.9rem', color: autoBackupState.enabled ? '#34d399' : '#94a3b8' }}>
                    {autoBackupState.enabled ? '✓ Sauvegarde Auto Active' : '✕ Sauvegarde Auto Désactivée'}
                  </strong>
                </label>
              </div>
            </div>

            {/* Cartouche d'état temps réel */}
            <div style={{
              background: '#0f172a',
              borderRadius: '10px',
              border: '1px solid #334155',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ color: '#cbd5e1' }}>État de l'auto-sauvegarde :</span>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: autoBackupState.state === 'saving'
                    ? 'rgba(56, 189, 248, 0.2)'
                    : autoBackupState.state === 'pending'
                    ? 'rgba(234, 179, 8, 0.2)'
                    : 'rgba(34, 197, 94, 0.2)',
                  color: autoBackupState.state === 'saving'
                    ? '#38bdf8'
                    : autoBackupState.state === 'pending'
                    ? '#facc15'
                    : '#4ade80',
                  border: '1px solid currentColor'
                }}>
                  {autoBackupState.state === 'saving' && '🔄 En cours d\'enregistrement...'}
                  {autoBackupState.state === 'pending' && '⏳ En attente de stabilisation (1.2s)...'}
                  {(autoBackupState.state === 'idle' || autoBackupState.state === 'saved') && '🟢 Prêt & À jour'}
                  {autoBackupState.state === 'error' && '⚠️ Erreur survenue'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ color: '#cbd5e1' }}>Dernière exécution :</span>
                <strong style={{ color: '#f8fafc' }}>
                  {autoBackupState.lastInfo && autoBackupState.lastInfo.timeFormatted
                    ? `Aujourd'hui à ${autoBackupState.lastInfo.timeFormatted}`
                    : 'Aucune modification enregistrée depuis le démarrage'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ color: '#cbd5e1' }}>Fichier miroir généré :</span>
                <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>
                  {autoBackupState.lastInfo ? autoBackupState.lastInfo.filename : 'DocPocketCab_AutoBackup.json'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ color: '#cbd5e1' }}>Mode d'écriture :</span>
                <span style={{ color: '#cbd5e1' }}>
                  {folderInfo.hasDirectHandle
                    ? `✓ Écriture directe sur le disque local (${folderInfo.folderName})`
                    : `Sécurisé en mémoire locale IndexedDB (Associez un dossier pour écriture disque directe)`}
                </span>
              </div>
            </div>

            {/* Options additionnelles & Boutons d'action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', paddingTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: '#cbd5e1' }}>
                <input
                  type="checkbox"
                  checked={autoBackupState.includeDaily}
                  onChange={(e) => setAutoBackupDaily(e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: '#10b981' }}
                />
                <span>Conserver également une archive journalière horodatée (<code>DocPocketCab_AutoBackup_AAAA-MM-JJ.json</code>)</span>
              </label>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleManualTriggerAutoBackup}
                  disabled={autoBackupTriggering}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#34d399',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: autoBackupTriggering ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>⚡</span> {autoBackupTriggering ? 'Enregistrement...' : 'Forcer Auto-Sauvegarde'}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadLatestSnapshot}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
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
                  <span>📥</span> Télécharger Dernier Snapshot
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '20px' }}>
          {/* Colonne Gauche : Bouton Sauvegarder & Statistiques Actuelles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: '#1e293b',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: '1.1rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>💾</span> Sauvegarder les Données
              </h3>

              {/* Compteurs Actuels */}
              <div style={{
                background: '#0f172a',
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid #334155',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.85rem',
                marginBottom: '18px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#cbd5e1' }}>👥 Dossiers Patients enregistrés :</span>
                  <strong style={{ color: '#38bdf8' }}>{dbStats.patients}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#cbd5e1' }}>🩺 Consultations médicales :</span>
                  <strong style={{ color: '#4ade80' }}>{dbStats.consultations}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#cbd5e1' }}>💊 Ordonnances & Prescriptions :</span>
                  <strong style={{ color: '#fbbf24' }}>{dbStats.prescriptions}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#cbd5e1' }}>💳 Quittances & Factures :</span>
                  <strong style={{ color: '#cbd5e1' }}>{dbStats.invoices}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#cbd5e1' }}>🏛️ Bordereaux CNAM créés :</span>
                  <strong style={{ color: '#38bdf8' }}>{dbStats.bordereaux}</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportBackup}
                disabled={exporting}
                style={{
                  width: '100%',
                  padding: '12px 18px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)'
                }}
              >
                <span>💾</span> {exporting ? 'Génération en cours...' : 'Télécharger la Sauvegarde Complète'}
              </button>
            </div>
          </div>

          {/* Colonne Droite : Bouton Restaurer & Importateur Universel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: '#1e293b',
              padding: '20px',
              borderRadius: '12px',
              border: '1.5px solid rgba(56, 189, 248, 0.3)'
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📥</span> Restaurer / Importer une Sauvegarde
              </h3>

              {/* Sélection du fichier */}
              <div style={{
                border: '2px dashed #334155',
                borderRadius: '10px',
                padding: '20px',
                textAlign: 'center',
                background: '#0f172a',
                marginBottom: '16px'
              }}>
                <input
                  type="file"
                  id="backupFileInput"
                  accept=".json,.zip"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="backupFileInput"
                  style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    gap: '8px'
                  }}
                >
                  <span style={{ fontSize: '2.4rem' }}>📁</span>
                  <span style={{ fontWeight: 600, color: '#38bdf8', fontSize: '0.95rem' }}>
                    {selectedFile ? selectedFile.name : 'Sélectionner un fichier de sauvegarde (.json ou .zip)'}
                  </span>
                </label>
              </div>

              {/* Choix du mode d'importation */}
              <div style={{
                background: '#0f172a',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid #334155',
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Mode d'importation :</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="radio"
                    name="restoreMode"
                    value="merge"
                    checked={restoreMode === 'merge'}
                    onChange={() => setRestoreMode('merge')}
                  />
                  <span>
                    <strong>Mode Fusion :</strong> Conserver les enregistrements actuels
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="radio"
                    name="restoreMode"
                    value="replace"
                    checked={restoreMode === 'replace'}
                    onChange={() => setRestoreMode('replace')}
                  />
                  <span style={{ color: '#f87171' }}>
                    <strong>Remplacement complet :</strong> Écraser la base active
                  </span>
                </label>
              </div>

              {/* Bouton Lancement Restauration */}
              <button
                type="button"
                onClick={handleStartRestore}
                disabled={!selectedFile || restoring}
                style={{
                  width: '100%',
                  padding: '12px 18px',
                  borderRadius: '8px',
                  background: !selectedFile || restoring
                    ? '#334155'
                    : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: !selectedFile || restoring ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: selectedFile ? '0 4px 14px rgba(5, 150, 105, 0.4)' : 'none'
                }}
              >
                <span>📥</span> {restoring ? 'Restauration en cours...' : 'Lancer la Restauration des Données'}
              </button>

              {/* Journal / Progression de restauration */}
              {restoreProgress && (
                <div style={{
                  marginTop: '14px',
                  padding: '10px 14px',
                  background: '#0f172a',
                  borderRadius: '6px',
                  border: '1px solid #38bdf8',
                  fontSize: '0.85rem',
                  color: '#38bdf8'
                }}>
                  ⏳ {restoreProgress}
                </div>
              )}

              {/* Résultat */}
              {restoreResult && (
                <div style={{
                  marginTop: '14px',
                  padding: '14px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  borderRadius: '8px',
                  border: '1.5px solid #10b981',
                  color: '#4ade80'
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>
                    {restoreResult.message}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                    {restoreResult.details}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ONGLET : PONT DE SYNCHRONISATION FIREBASE (PC <-> MOBILE)     */}
      {/* ============================================================== */}
      {activeTab === 'sync' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Messages de statut / erreur */}
          {bridgeStatusMsg && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid #22c55e',
              color: '#4ade80',
              fontSize: '0.9rem',
              fontWeight: 600
            }}>
              {bridgeStatusMsg}
            </div>
          )}

          {bridgeErrorMsg && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#f87171',
              fontSize: '0.9rem',
              fontWeight: 600
            }}>
              ⚠️ {bridgeErrorMsg}
            </div>
          )}

          {/* ============================================================== */}
          {/* CARTE UNIQUE : AUTHENTIFICATION COMPTE GOOGLE & GESTION CLOUD */}
          {/* ============================================================== */}
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            padding: '24px',
            borderRadius: '12px',
            border: '1.5px solid rgba(56, 189, 248, 0.4)',
            boxShadow: '0 4px 18px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
                }}>
                  ☁️
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 700 }}>
                    Synchronisation Cloud Automatique
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '2px' }}>
                    Authentification sécurisée par Compte Google • DocPocket Cabinet gère l'infrastructure Cloud automatiquement
                  </div>
                </div>
              </div>

              {bridgeConfig.googleUserEmail && (
                <button
                  type="button"
                  onClick={handleDisconnectGoogleAccount}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#f87171',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Déconnecter ce compte Google du cabinet"
                >
                  <span>🔌</span> Déconnecter le Compte Google
                </button>
              )}
            </div>

            {bridgeConfig.googleUserEmail ? (
              /* ÉTAT CONNECTÉ */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1.5px solid rgba(34, 197, 94, 0.35)',
                  borderRadius: '10px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.6rem' }}>🟢</span>
                    <div>
                      <strong style={{ color: '#4ade80', fontSize: '1.05rem' }}>
                        Cabinet Cloud Actif & Synchronisé
                      </strong>
                      <div style={{ fontSize: '0.88rem', color: '#cbd5e1', marginTop: '2px' }}>
                        Compte Google : <strong style={{ color: '#fff' }}>{bridgeConfig.googleUserEmail}</strong>
                        {bridgeConfig.googleDoctorName && (
                          <span style={{ color: '#38bdf8' }}> ({bridgeConfig.googleDoctorName})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '12px',
                    background: '#0f172a',
                    padding: '14px 18px',
                    borderRadius: '8px',
                    fontSize: '0.85rem'
                  }}>
                    <div>
                      <span style={{ color: '#94a3b8' }}>Appareil Actuel :</span><br />
                      <strong style={{ color: '#f8fafc' }}>{getDeviceDisplayName()}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>Synchronisation Automatique :</span><br />
                      <strong style={{ color: '#4ade80' }}>✓ Active en arrière-plan (PC ↔ Smartphones)</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>Dernière Synchronisation :</span><br />
                      <strong style={{ color: '#cbd5e1' }}>
                        {bridgeConfig.lastSync
                          ? new Date(bridgeConfig.lastSync).toLocaleString('fr-FR')
                          : 'Synchronisé en continu'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Boutons d'action simples */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={bridgeLoading}
                    onClick={handleManualBridgeUpload}
                    style={{
                      flex: 1,
                      minWidth: '220px',
                      padding: '12px 18px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 600,
                      cursor: bridgeLoading ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
                    }}
                  >
                    <span>📤</span> {bridgeLoading ? 'Synchronisation en cours...' : 'Envoyer les Données vers le Cloud'}
                  </button>

                  <button
                    type="button"
                    disabled={bridgeLoading}
                    onClick={handleManualBridgeDownload}
                    style={{
                      flex: 1,
                      minWidth: '220px',
                      padding: '12px 18px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 600,
                      cursor: bridgeLoading ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)'
                    }}
                  >
                    <span>📥</span> {bridgeLoading ? 'Récupération en cours...' : 'Récupérer les Données du Cloud'}
                  </button>

                  <button
                    type="button"
                    disabled={bridgeTesting}
                    onClick={handleTestBridge}
                    style={{
                      padding: '12px 18px',
                      borderRadius: '8px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      color: '#38bdf8',
                      fontWeight: 600,
                      cursor: bridgeTesting ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>{bridgeTesting ? '⏳' : '🧪'}</span>
                    <span>{bridgeTesting ? 'Test en cours...' : 'Tester la Connexion Cloud'}</span>
                  </button>

                  {isMobileDevice() && (
                    <button
                      type="button"
                      disabled={bridgeLoading}
                      onClick={handleSendMobileRequestToPC}
                      style={{
                        padding: '12px 18px',
                        borderRadius: '8px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        color: '#38bdf8',
                        fontWeight: 600,
                        cursor: bridgeLoading ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <span>📱</span> Demander la sauvegarde initiale au PC
                    </button>
                  )}
                </div>

                {bridgeTestResult && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: bridgeTestResult.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${bridgeTestResult.success ? '#22c55e' : '#ef4444'}`,
                    color: bridgeTestResult.success ? '#4ade80' : '#f87171',
                    fontSize: '0.88rem',
                    lineHeight: 1.4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>{bridgeTestResult.success ? '✅' : '❌'}</span>
                    <span>{bridgeTestResult.message}</span>
                  </div>
                )}
              </div>
            ) : otpStep === 'input_email' ? (
              /* ÉTAPE 1 : SAISIE DE L'EMAIL & ENVOI DU CODE SECRET */
              <form onSubmit={handleRequestSecretCode} style={{
                background: '#0f172a',
                padding: '24px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}>
                <div style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{ fontSize: '1.5rem' }}>🔐</span>
                  <div style={{ fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                    <strong style={{ color: '#38bdf8' }}>Double Protection (Email + Clé de Licence) :</strong><br />
                    Pour garantir l'étanchéité absolue de votre cabinet, un code secret temporaire à 6 chiffres sera envoyé à votre adresse email pour valider votre identité avant d'activer la synchronisation Cloud.
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#38bdf8', marginBottom: '6px', fontWeight: 600 }}>
                      Votre Adresse Email Google (Gmail) *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="docteur.cabinet@gmail.com"
                      value={googleEmailInput}
                      onChange={(e) => setGoogleEmailInput(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        background: '#1e293b',
                        border: '1px solid #38bdf8',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.92rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>
                      Nom du Médecin / Intitulé du Cabinet (Optionnel)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Dr. Ben Khalifa Hamed"
                      value={googleDoctorInput}
                      onChange={(e) => setGoogleDoctorInput(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.92rem'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    disabled={bridgeTesting}
                    onClick={handleTestBridge}
                    style={{
                      padding: '11px 18px',
                      borderRadius: '8px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      color: '#38bdf8',
                      fontWeight: 600,
                      cursor: bridgeTesting ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>{bridgeTesting ? '⏳' : '🧪'}</span>
                    <span>{bridgeTesting ? 'Test en cours...' : 'Tester la Connexion Cloud'}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={otpSending}
                    style={{
                      padding: '12px 26px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      cursor: otpSending ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)'
                    }}
                  >
                    <span>📨</span> {otpSending ? 'Envoi du Code Secret...' : 'Envoyer le Code Secret de Confirmation'}
                  </button>
                </div>

                {bridgeTestResult && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: bridgeTestResult.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${bridgeTestResult.success ? '#22c55e' : '#ef4444'}`,
                    color: bridgeTestResult.success ? '#4ade80' : '#f87171',
                    fontSize: '0.88rem',
                    lineHeight: 1.4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>{bridgeTestResult.success ? '✅' : '❌'}</span>
                    <span>{bridgeTestResult.message}</span>
                  </div>
                )}
              </form>
            ) : (
              /* ÉTAPE 2 : SAISIE DU CODE SECRET OTP */
              <form onSubmit={handleValidateSecretCodeAndConnect} style={{
                background: '#0f172a',
                padding: '24px',
                borderRadius: '12px',
                border: '1.5px solid #38bdf8',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}>
                <div style={{
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '8px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{ fontSize: '1.8rem' }}>📧</span>
                  <div style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                    <strong style={{ color: '#38bdf8', fontSize: '1rem' }}>Code Secret Envoyé !</strong><br />
                    Un code de confirmation à 6 chiffres a été généré pour l'adresse : <strong style={{ color: '#fff' }}>{googleEmailInput}</strong>.<br />
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Consultez vos emails et saisissez le code ci-dessous (validité : 10 minutes).</span>
                  </div>
                </div>

                {sentCodeNotice?.code && (
                  <div style={{
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px dashed #22c55e',
                    borderRadius: '8px',
                    padding: '12px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div style={{ fontSize: '0.88rem', color: '#4ade80' }}>
                      🔑 <strong>Code de sécurité généré :</strong> <code style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '3px', background: '#022c22', padding: '3px 8px', borderRadius: '4px', color: '#34d399', marginLeft: '6px' }}>{sentCodeNotice.code}</code>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOtpCodeInput(sentCodeNotice.code)}
                      style={{
                        padding: '6px 12px',
                        background: '#059669',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Remplir automatiquement
                    </button>
                  </div>
                )}

                <div style={{ maxWidth: '380px', margin: '0 auto', width: '100%', textAlign: 'center' }}>
                  <label style={{ display: 'block', fontSize: '0.92rem', color: '#f8fafc', marginBottom: '8px', fontWeight: 600 }}>
                    Saisissez le Code Secret à 6 chiffres :
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={otpCodeInput}
                    onChange={(e) => setOtpCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: '#1e293b',
                      border: '2px solid #38bdf8',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '1.8rem',
                      fontWeight: 700,
                      letterSpacing: '10px',
                      textAlign: 'center',
                      boxShadow: '0 0 16px rgba(56, 189, 248, 0.25)'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => { setOtpStep('input_email'); setBridgeErrorMsg(''); }}
                    style={{
                      padding: '11px 18px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#cbd5e1',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    ← Modifier l'adresse email
                  </button>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      type="button"
                      disabled={otpSending}
                      onClick={handleRequestSecretCode}
                      style={{
                        padding: '11px 16px',
                        borderRadius: '8px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8',
                        fontWeight: 600,
                        cursor: otpSending ? 'wait' : 'pointer'
                      }}
                    >
                      🔄 Renvoyer un code
                    </button>

                    <button
                      type="submit"
                      disabled={provisioningCloud}
                      style={{
                        padding: '12px 26px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#fff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        cursor: provisioningCloud ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                      }}
                    >
                      <span>🛡️</span> {provisioningCloud ? 'Validation & Connexion Cloud...' : 'Valider le Code Secret & Activer la Synchronisation'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ONGLET 3 : LICENCE & SÉCURITÉ PIN (SANS AUCUN KEYGEN)           */}
      {/* ============================================================== */}
      {activeTab === 'license' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          {/* Carte 1 : Statut de la Licence Logicielle */}
          <div style={{
            background: '#1e293b',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.6rem' }}>🔐</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>Licence Logicielle</h3>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Protection du cabinet médical</span>
                </div>
              </div>

              <span style={{
                color: licenseState.isLicensed ? '#4ade80' : '#f87171',
                fontWeight: 700,
                background: licenseState.isLicensed ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${licenseState.isLicensed ? '#22c55e' : '#ef4444'}`,
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.8rem'
              }}>
                {licenseState.isLicensed ? '● Active' : '● Verrouillée'}
              </span>
            </div>

            <div style={{
              background: '#0f172a',
              padding: '16px',
              borderRadius: '10px',
              border: '1px solid #334155',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontSize: '0.88rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Type de Licence :</span>
                <strong style={{ color: '#38bdf8' }}>{licenseState.name || 'Licence Commerciale Officielle'}</strong>
              </div>

              {/* CLÉ DE LICENCE STRICTEMENT MASQUÉE POUR LA CONFIDENTIALITÉ */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Clé Active :</span>
                <code style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.82rem' }}>
                  ••••••••••••••••••••••••• (Masquée pour sécurité)
                </code>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Appareils Autorisés :</span>
                <strong style={{ color: '#a855f7' }}>
                  {licenseState.maxDevices ? `${licenseState.maxDevices} appareil(s) (PC & Smartphones)` : '3 appareils'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8' }}>Espace / Partition :</span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: isMasterInstallation() ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: isMasterInstallation() ? '#38bdf8' : '#34d399',
                  border: `1px solid ${isMasterInstallation() ? 'rgba(56, 189, 248, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`
                }}>
                  {isMasterInstallation() ? '🏛️ Cabinet Maître (Dr. Hamed BEN KHALIFA)' : `🩺 Cabinet Confrère (${getActiveLicensePartitionId()})`}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Expiration :</span>
                <strong style={{ color: '#f8fafc' }}>{licenseState.expiryDate || '31/12/2026'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Temps Restant :</span>
                <strong style={{ color: '#4ade80' }}>
                  {licenseState.daysRemaining !== undefined
                    ? (typeof licenseState.daysRemaining === 'number' ? `${licenseState.daysRemaining} jours restants` : licenseState.daysRemaining)
                    : 'Valide'}
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (window.confirm("Voulez-vous verrouiller DocPocket Cabinet ? L'écran de demande de clé sera affiché.")) {
                  revokeLicense();
                  window.location.reload();
                }
              }}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>🔒</span> Verrouiller le Cabinet (Changer de Clé)
            </button>

            {!isMasterInstallation() && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Revenir immédiatement au Cabinet Principal Maître (Dr. Hamed BEN KHALIFA) avec tous vos patients originaux ?")) {
                    switchToMasterInstallation();
                    window.location.reload();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <span>🏛️</span> Revenir au Cabinet Principal (Dr. Hamed BEN KHALIFA)
              </button>
            )}
          </div>

          {/* Carte 2 : Mettre à Niveau ou Changer de Clé de Licence */}
          {(() => {
            const currentDoc = activePractitioner || getActivePractitioner();
            const docNom = currentDoc?.nom || '';
            const docPrenom = currentDoc?.prenom || '';
            const docOrdre = currentDoc?.ordreId || currentDoc?.cnamId || '';
            const currentDoctorSerial = computeDoctorSerial(docNom, docPrenom, docOrdre);

            const cleanKey = (newKeyInput || '').trim().toUpperCase();
            const proKeyMatch = cleanKey.match(/^DPCAB-(\d{2})-(\d{8})-([A-F0-9]{4})-([A-F0-9]{4})$/);
            const inputDevCount = proKeyMatch ? parseInt(proKeyMatch[1], 10) : null;
            const inputExpiry = proKeyMatch ? `${proKeyMatch[2].slice(0, 4)}-${proKeyMatch[2].slice(4, 6)}-${proKeyMatch[2].slice(6, 8)}` : null;
            const inputSerial = proKeyMatch ? proKeyMatch[3] : null;
            const isSerialMatching = inputSerial && currentDoctorSerial && (inputSerial.toUpperCase() === currentDoctorSerial.toUpperCase());

            const handleUpgradeKey = () => {
              if (!cleanKey) {
                setActivateMsg({ type: 'error', text: 'Veuillez saisir votre nouvelle clé de licence.' });
                return;
              }

              // 1. Vérification cryptographique
              const verification = verifyLicenseKey(cleanKey);
              if (!verification.valid) {
                setActivateMsg({ type: 'error', text: verification.error || 'Clé de licence invalide.' });
                return;
              }

              // 2. Vérification de correspondance de la signature praticien
              if (proKeyMatch && !isMasterInstallation()) {
                const keySerial = proKeyMatch[3];
                if (keySerial.toUpperCase() !== currentDoctorSerial.toUpperCase()) {
                  const proceed = window.confirm(
                    `⚠️ Concordance d'Identité Médecin :\n\n` +
                    `Cette clé a été générée avec la signature (${keySerial}) alors que votre cabinet actuel a la signature (${currentDoctorSerial}).\n\n` +
                    `Voulez-vous tout de même appliquer cette clé à votre cabinet actuel ?\n` +
                    `Votre base de données patients et votre code PIN resteront intégralement conservés.`
                  );
                  if (!proceed) return;
                }
              }

              // 3. Application de la mise à niveau avec garantie de persistance BDD et PIN
              const res = upgradeLicenseKey(cleanKey);
              if (res.success) {
                setActivateMsg({
                  type: 'success',
                  text: `✓ Félicitations ! Votre licence a été mise à niveau (${res.details.newDevices} appareil(s)). Votre base de données patients et votre code PIN sont intégralement conservés.`
                });
                setLicenseState(getLicenseStatus());
                setNewKeyInput('');

                alert(
                  `✓ Félicitations ! Votre licence a été mise à niveau avec succès !\n\n` +
                  `• Appareils autorisés : ${res.details.newDevices === 99 ? 'Illimité' : res.details.newDevices + ' poste(s) (PC & Mobiles)'}\n` +
                  `• Expiration : ${res.details.expiryDate}\n` +
                  `• Base de données patients : 100% conservée intacte\n` +
                  `• Code PIN de sécurité : Inchangé et actif`
                );

                window.location.reload();
              } else {
                setActivateMsg({ type: 'error', text: res.error });
              }
            };

            return (
              <div style={{
                background: '#1e293b',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '12px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.6rem' }}>🔄</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                      Changer ou Mettre à Niveau la Licence
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      Extension de postes (ex: 1 poste PC ➔ 3 postes avec smartphone) ou renouvellement
                    </span>
                  </div>
                </div>

                {/* Encadré d'identité du médecin & garantie de persistance */}
                <div style={{
                  background: '#0f172a',
                  borderRadius: '10px',
                  padding: '14px',
                  border: '1px solid #334155',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '0.84rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ color: '#94a3b8' }}>Médecin Titulaire :</span>
                    <strong style={{ color: '#f8fafc' }}>
                      {currentDoc?.titre || 'Dr.'} {docNom || 'BEN KHALIFA'} {docPrenom || 'Hamed'}
                    </strong>
                  </div>

                  {docOrdre && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>N° d'Ordre des Médecins :</span>
                      <strong style={{ color: '#38bdf8' }}>{docOrdre}</strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#94a3b8' }}>Signature Unique Cabinet :</span>
                    <span style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      background: 'rgba(168, 85, 247, 0.15)',
                      color: '#c084fc',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgba(168, 85, 247, 0.3)'
                    }}>
                      {currentDoctorSerial}
                    </span>
                  </div>

                  <div style={{
                    marginTop: '6px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    color: '#4ade80',
                    fontSize: '0.78rem',
                    lineHeight: 1.45
                  }}>
                    🛡️ <strong>Garantie de Continuité :</strong> Toute nouvelle clé saisie ici conserve <strong>100% de votre base de données patients</strong> existante et <strong>votre code PIN de sécurité</strong> reste inchangé.
                  </div>
                </div>

                {/* Saisie de la clé */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600 }}>
                    Saisissez la Nouvelle Clé de Licence :
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Ex: DPCAB-03-20271231-XXXX-XXXX"
                      value={newKeyInput}
                      onChange={(e) => {
                        setNewKeyInput(e.target.value.toUpperCase());
                        setActivateMsg(null);
                      }}
                      style={{
                        flex: 1,
                        padding: '11px 12px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#facc15',
                        fontSize: '0.85rem',
                        letterSpacing: '1px',
                        fontFamily: 'monospace'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleUpgradeKey}
                      style={{
                        padding: '11px 18px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        border: 'none',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Mettre à Niveau
                    </button>
                  </div>
                </div>

                {/* Prévisualisation dynamique des capacités de la nouvelle clé */}
                {proKeyMatch && (
                  <div style={{
                    background: '#091122',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '0.82rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Appareils inclus :</span>
                      <strong style={{ color: inputDevCount > 1 ? '#4ade80' : '#fbbf24' }}>
                        {inputDevCount === 99 ? 'Illimité' : `${inputDevCount} poste(s) (${inputDevCount > 1 ? 'PC + Smartphones autorisés' : 'PC uniquement'})`}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Nouvelle Expiration :</span>
                      <strong style={{ color: '#38bdf8' }}>{inputExpiry}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#94a3b8' }}>Concordance Médecin :</span>
                      <span style={{
                        color: isSerialMatching ? '#4ade80' : '#facc15',
                        fontWeight: 700,
                        fontSize: '0.78rem'
                      }}>
                        {isSerialMatching ? '✓ Signature Conforme' : `Signature ${inputSerial}`}
                      </span>
                    </div>
                  </div>
                )}

                {activateMsg && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    background: activateMsg.type === 'success' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${activateMsg.type === 'success' ? '#22c55e' : '#ef4444'}`,
                    color: activateMsg.type === 'success' ? '#4ade80' : '#fca5a5'
                  }}>
                    {activateMsg.text}
                  </div>
                )}

                <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.45 }}>
                  Pour obtenir une clé avec extension de postes (ex: passer de 1 poste PC à 3 postes avec smartphone) ou prolonger votre abonnement, contactez directement votre éditeur.
                </div>
              </div>
            );
          })()}

          {/* Carte 3 : Sécurité & Code PIN d'Accès Praticien */}
          <div style={{
            background: '#1e293b',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.6rem' }}>🛡️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>Code PIN de Sécurité</h3>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Protection confidentielle des dossiers patients</span>
                </div>
              </div>

              <span style={{
                color: pinConfig.hasPin ? '#4ade80' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.8rem',
                background: pinConfig.hasPin ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                padding: '3px 10px',
                borderRadius: '20px',
                border: `1px solid ${pinConfig.hasPin ? '#22c55e' : '#475569'}`
              }}>
                {pinConfig.hasPin ? '● PIN Actif' : 'Non configuré'}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.45 }}>
              Le code PIN protège l'accès à l'application. En cas de 3 saisies erronées consécutives, l'application est automatiquement bloquée et nécessite la clé de licence pour être réouverte.
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="password"
                maxLength={8}
                placeholder="Nouveau Code PIN (4 chiffres ou plus)"
                value={settingsPinInput}
                onChange={(e) => setSettingsPinInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#facc15',
                  fontSize: '1rem',
                  fontWeight: 700,
                  letterSpacing: '4px',
                  textAlign: 'center'
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (!settingsPinInput || settingsPinInput.trim().length < 4) {
                    alert("Le code PIN doit comporter au moins 4 chiffres.");
                    return;
                  }
                  const res = setDoctorPinCode(settingsPinInput.trim());
                  if (res.success) {
                    setPinConfig(getDoctorPinConfig());
                    setSettingsPinInput('');
                    setSettingsPinMsg("✓ Code PIN enregistré avec succès !");
                    setTimeout(() => setSettingsPinMsg(''), 4000);
                  }
                }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Enregistrer
              </button>
            </div>

            {settingsPinMsg && (
              <div style={{ color: '#4ade80', fontSize: '0.82rem', fontWeight: 600 }}>
                {settingsPinMsg}
              </div>
            )}

            {pinConfig.hasPin && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Voulez-vous désactiver la protection par code PIN ?")) {
                    removeDoctorPinCode();
                    setPinConfig(getDoctorPinConfig());
                  }
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#f87171',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  textDecoration: 'underline'
                }}
              >
                Désactiver la protection par code PIN
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ONGLET 4 : ÉQUIPE MÉDICALE & MULTI-PRATICIENS (CLOISONNEMENT) */}
      {/* ============================================================== */}
      {activeTab === 'practitioners' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Bannière de présentation de l'isolation étanche */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1.5px solid #0284c7',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 4px 16px rgba(2, 132, 199, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{ fontSize: '1.8rem' }}>🛡️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#38bdf8', fontWeight: 800 }}>
                  Cloisonnement Étanche & Multi-Praticiens
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                  Architecture à bases de données partitionnées indépendantes par médecin
                </div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
              Lorsque plusieurs médecins exercent au cabinet, chaque praticien dispose de son <strong>propre environnement hermétique</strong> : 
              ses dossiers patients, ses consultations, ses ordonnances, ses quittances financières et ses bordereaux CNAM sont stockés 
              dans une base indépendante. Il n'y a <strong>aucun risque de mélange de données</strong> entre confrères.
            </p>
          </div>

          {/* Dialogue de saisie du PIN lors d'une tentative de bascule vers un médecin protégé */}
          {practitionerPinTarget && (
            <div style={{
              background: '#0f172a',
              border: '2px solid #0284c7',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '380px',
              margin: '0 auto',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '6px' }}>🔒</div>
              <h4 style={{ margin: '0 0 6px', color: '#f8fafc', fontSize: '1rem' }}>Code PIN Confidentiel Requis</h4>
              <p style={{ margin: '0 0 14px', fontSize: '0.8rem', color: '#94a3b8' }}>
                Session protégée pour le <strong>{formatDoctorDisplayName(practitionerPinTarget)}</strong>
              </p>
              <input
                type="password"
                maxLength={8}
                autoFocus
                placeholder="••••"
                value={practitionerEnteredPin}
                onChange={(e) => {
                  setPractitionerEnteredPin(e.target.value);
                  setPractitionerPinError('');
                }}
                style={{
                  width: '160px',
                  textAlign: 'center',
                  fontSize: '1.5rem',
                  letterSpacing: '6px',
                  padding: '8px',
                  borderRadius: '8px',
                  background: '#1e293b',
                  border: practitionerPinError ? '2px solid #ef4444' : '2px solid #38bdf8',
                  color: '#fff',
                  outline: 'none',
                  marginBottom: '10px'
                }}
              />
              {practitionerPinError && (
                <div style={{ color: '#f87171', fontSize: '0.78rem', marginBottom: '10px', fontWeight: 600 }}>
                  {practitionerPinError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setPractitionerPinTarget(null);
                    setPractitionerEnteredPin('');
                  }}
                  style={{ padding: '7px 14px', borderRadius: '6px', background: 'transparent', border: '1px solid #475569', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem' }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const res = switchPractitioner(practitionerPinTarget.id, practitionerEnteredPin);
                    if (res.success) {
                      setPractitionerPinTarget(null);
                      setPractitionerEnteredPin('');
                      setPractitionersList(getAllPractitioners());
                      setActivePractitioner(getActivePractitioner());
                      alert(`✓ Session basculée vers le cabinet du ${formatDoctorDisplayName(res.practitioner)}.`);
                    } else {
                      setPractitionerPinError("Code PIN incorrect.");
                    }
                  }}
                  style={{ padding: '7px 18px', borderRadius: '6px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
                >
                  Valider
                </button>
              </div>
            </div>
          )}

          {/* Formulaire d'ajout / modification de praticien */}
          {editingPractitioner ? (
            <div style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '22px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{isNewPractitioner ? '➕' : '✏️'}</span>
                  {isNewPractitioner ? 'Ajouter un Médecin Associé ou Remplaçant' : `Modifier la fiche du ${formatDoctorDisplayName(editingPractitioner)}`}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingPractitioner(null)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem' }}
                >
                  ✕ Annuler
                </button>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                if (!editingPractitioner.nom.trim()) {
                  alert("Veuillez renseigner le nom de famille.");
                  return;
                }
                const res = savePractitioner(editingPractitioner);
                if (res.success) {
                  setPractitionersList(getAllPractitioners());
                  setActivePractitioner(getActivePractitioner());
                  setEditingPractitioner(null);
                  alert(`✓ Fiche du ${formatDoctorDisplayName(res.practitioner)} enregistrée avec succès !`);
                } else {
                  alert("Erreur enregistrement : " + res.error);
                }
              }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Titre</label>
                    <select
                      value={editingPractitioner.titre || 'Dr.'}
                      onChange={(e) => setEditingPractitioner({ ...editingPractitioner, titre: e.target.value })}
                      style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                    >
                      <option value="Dr.">Dr.</option>
                      <option value="Pr.">Pr.</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Nom de Famille *</label>
                    <input
                      type="text"
                      required
                      placeholder="ex: BEN KHALIFA"
                      value={editingPractitioner.nom}
                      onChange={(e) => setEditingPractitioner({ ...editingPractitioner, nom: e.target.value.toUpperCase() })}
                      style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Prénom</label>
                    <input
                      type="text"
                      placeholder="ex: Hamed"
                      value={editingPractitioner.prenom}
                      onChange={(e) => setEditingPractitioner({ ...editingPractitioner, prenom: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Spécialité Médicale</label>
                    <input
                      type="text"
                      placeholder="ex: Médecine Générale"
                      value={editingPractitioner.specialite}
                      onChange={(e) => setEditingPractitioner({ ...editingPractitioner, specialite: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Code Conventionnel CNAM</label>
                    <input
                      type="text"
                      placeholder="ex: 010002763183"
                      value={editingPractitioner.cnamId}
                      onChange={(e) => setEditingPractitioner({ ...editingPractitioner, cnamId: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>N° Ordre des Médecins</label>
                    <input
                      type="text"
                      placeholder="ex: 12052"
                      value={editingPractitioner.ordreId}
                      onChange={(e) => setEditingPractitioner({ ...editingPractitioner, ordreId: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Identifiant Fiscal</label>
                    <input
                      type="text"
                      placeholder="ex: 856103/M"
                      value={editingPractitioner.fiscId}
                      onChange={(e) => setEditingPractitioner({ ...editingPractitioner, fiscId: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Téléphone</label>
                    <input
                      type="text"
                      value={editingPractitioner.telephone}
                      onChange={(e) => setEditingPractitioner({ ...editingPractitioner, telephone: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Email</label>
                    <input
                      type="email"
                      value={editingPractitioner.email}
                      onChange={(e) => setEditingPractitioner({ ...editingPractitioner, email: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Adresse Cabinet</label>
                    <input
                      type="text"
                      value={editingPractitioner.adresse}
                      onChange={(e) => setEditingPractitioner({ ...editingPractitioner, adresse: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Ville</label>
                    <input
                      type="text"
                      value={editingPractitioner.ville}
                      onChange={(e) => setEditingPractitioner({ ...editingPractitioner, ville: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                    />
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>
                        🔒 Code PIN de Protection (Optionnel)
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        Exige ce code secret lors d'une bascule de session vers ce médecin
                      </div>
                    </div>
                    <input
                      type="password"
                      maxLength={8}
                      placeholder="••••"
                      value={editingPractitioner.pinCode || ''}
                      onChange={(e) => setEditingPractitioner({ ...editingPractitioner, pinCode: e.target.value })}
                      style={{ width: '100px', textAlign: 'center', letterSpacing: '4px', padding: '6px 10px', background: '#1e293b', border: '1px solid #38bdf8', borderRadius: '6px', color: '#fff', fontWeight: 700 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setEditingPractitioner(null)}
                    style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid #475569', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '8px 22px', borderRadius: '8px', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                  >
                    💾 Enregistrer la Fiche
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Liste des praticiens enregistrés */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 600 }}>
                  Praticiens exerçant dans l'application ({practitionersList.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsNewPractitioner(true);
                    setEditingPractitioner({
                      titre: 'Dr.',
                      nom: '',
                      prenom: '',
                      specialite: 'Médecine Générale',
                      telephone: '',
                      email: '',
                      adresse: activePractitioner?.adresse || '',
                      ville: activePractitioner?.ville || 'Mahdia',
                      cnamId: '',
                      fiscId: '',
                      ordreId: '',
                      pinCode: '',
                      color: PRACTITIONER_COLORS[practitionersList.length % PRACTITIONER_COLORS.length]
                    });
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
                  }}
                >
                  <span>➕</span> Ajouter un Confrère / Remplaçant
                </button>
              </div>

              {practitionersList.map((doc) => {
                const isActive = doc.id === activePractitioner.id;
                const initials = `${(doc.prenom || 'M')[0]}${(doc.nom || 'D')[0]}`.toUpperCase();

                return (
                  <div
                    key={doc.id}
                    style={{
                      background: isActive ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%)' : '#1e293b',
                      border: isActive ? '2px solid #0284c7' : '1px solid #334155',
                      borderRadius: '12px',
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: isActive ? '0 4px 14px rgba(2, 132, 199, 0.25)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '12px',
                          background: doc.color || '#0284c7',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '1.1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: '1.05rem' }}>
                              {formatDoctorDisplayName(doc)}
                            </span>
                            {doc.id === 'primary' && (
                              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontWeight: 700 }}>
                                Praticien Titulaire Originel
                              </span>
                            )}
                            {doc.pinCode && (
                              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.2)', color: '#facc15' }}>
                                🔒 Protégé par PIN
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '3px' }}>
                            {doc.specialite || 'Médecine Générale'} • {doc.ville || 'Mahdia'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                            Code CNAM : <strong style={{ color: '#cbd5e1' }}>{doc.cnamId || 'Non défini'}</strong> • Ordre : <strong style={{ color: '#cbd5e1' }}>{doc.ordreId || 'Non défini'}</strong> • Base : <code style={{ color: '#38bdf8', background: '#0f172a', padding: '1px 5px', borderRadius: '4px' }}>{doc.id === 'primary' ? 'DocPocketCabinetDB' : `DocPocketCabinetDB_${doc.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`}</code>
                          </div>
                        </div>
                      </div>

                      {isActive && (
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#4ade80',
                          border: '1px solid #10b981',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }}></span>
                          Session Active
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setIsNewPractitioner(false);
                            setEditingPractitioner({ ...doc });
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: '#0f172a',
                            border: '1px solid #334155',
                            color: '#cbd5e1',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          ✏️ Modifier coordonnées
                        </button>

                        {doc.id !== 'primary' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Supprimer le compte du ${formatDoctorDisplayName(doc)} ?`)) {
                                deletePractitioner(doc.id);
                                setPractitionersList(getAllPractitioners());
                                setActivePractitioner(getActivePractitioner());
                              }
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#f87171',
                              fontSize: '0.78rem',
                              cursor: 'pointer'
                            }}
                          >
                            🗑️ Supprimer
                          </button>
                        )}
                      </div>

                      {!isActive ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (doc.pinCode && doc.pinCode.trim()) {
                              setPractitionerPinTarget(doc);
                              setPractitionerEnteredPin('');
                              setPractitionerPinError('');
                            } else {
                              const res = switchPractitioner(doc.id, null);
                              if (res.success) {
                                setPractitionersList(getAllPractitioners());
                                setActivePractitioner(getActivePractitioner());
                                alert(`✓ Session basculée vers le cabinet du ${formatDoctorDisplayName(res.practitioner)}.`);
                              }
                            }
                          }}
                          style={{
                            padding: '7px 16px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                            border: 'none',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
                          }}
                        >
                          <span>🔄</span> Basculer sur cette session
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
                          Base de données connectée
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* ONGLET 5 : THÈMES VISUELS & PERSONNALISATION (10 THÈMES)       */}
      {/* ============================================================== */}
      {activeTab === 'themes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Message de succès lors du changement de thème */}
          {themeSuccessMsg && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.25) 100%)',
              border: '1.5px solid #10b981',
              borderRadius: '12px',
              padding: '14px 20px',
              color: '#34d399',
              fontWeight: 700,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <span style={{ fontSize: '1.3rem' }}>✓</span>
              <span>{themeSuccessMsg}</span>
            </div>
          )}

          {/* Bannière de présentation */}
          <div style={{
            background: '#1e293b',
            padding: '20px 24px',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>🎨</span> Personnalisation Visuelle du Cabinet (10 Thèmes au Choix)
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
                  Sélectionnez l'ambiance visuelle adaptée à la luminosité de votre cabinet et à votre confort visuel. Tous les écrans, menus, boutons et dossiers patients s'adaptent instantanément.
                </div>
              </div>

              {/* Thème Actif Récapitulatif */}
              {(() => {
                const cur = THEMES_LIST.find(t => t.id === activeThemeId) || THEMES_LIST[0];
                return (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: '#0f172a',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: '1px solid #38bdf8',
                    boxShadow: '0 2px 8px rgba(56, 189, 248, 0.2)'
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>{cur.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Thème Actuel</div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#38bdf8' }}>{cur.name}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Grille des 10 Thèmes Médicaux */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px'
          }}>
            {THEMES_LIST.map((theme) => {
              const isSelected = theme.id === activeThemeId;
              return (
                <div
                  key={theme.id}
                  onClick={() => handleSelectTheme(theme.id)}
                  style={{
                    background: '#0f172a',
                    borderRadius: '14px',
                    border: isSelected ? '2px solid #38bdf8' : '1px solid #334155',
                    boxShadow: isSelected
                      ? '0 0 24px rgba(56, 189, 248, 0.25), 0 8px 24px rgba(0,0,0,0.5)'
                      : '0 4px 14px rgba(0,0,0,0.2)',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#0284c7';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#334155';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  <div>
                    {/* Ligne 1 : En-tête de la carte thème */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          background: theme.colors.surface,
                          border: `1px solid ${theme.colors.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.4rem',
                          flexShrink: 0
                        }}>
                          {theme.icon}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1rem', color: isSelected ? '#38bdf8' : '#f8fafc' }}>
                            {theme.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: theme.colors.accent, fontWeight: 600 }}>
                            {theme.tagline}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                          color: isSelected ? '#38bdf8' : '#94a3b8'
                        }}>
                          {theme.badge}
                        </span>
                        {isSelected && (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#059669',
                            color: '#fff'
                          }}>
                            ✓ ACTIF
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p style={{
                      margin: '10px 0 0 0',
                      fontSize: '0.8rem',
                      color: '#cbd5e1',
                      lineHeight: 1.45
                    }}>
                      {theme.description}
                    </p>

                    {/* Nuancier Palette de Couleurs */}
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                        Nuancier de Couleurs :
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: '4px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        padding: '3px',
                        background: '#0b1329',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                      }}>
                        <div style={{ height: '24px', background: theme.colors.bg, borderRadius: '4px' }} title={`Fond : ${theme.colors.bg}`} />
                        <div style={{ height: '24px', background: theme.colors.surface, borderRadius: '4px' }} title={`Surface : ${theme.colors.surface}`} />
                        <div style={{ height: '24px', background: theme.colors.card, borderRadius: '4px' }} title={`Cartes : ${theme.colors.card}`} />
                        <div style={{ height: '24px', background: theme.colors.border, borderRadius: '4px' }} title={`Bordures : ${theme.colors.border}`} />
                        <div style={{ height: '24px', background: theme.colors.primary, borderRadius: '4px' }} title={`Primaire : ${theme.colors.primary}`} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748b', marginTop: '3px', padding: '0 2px' }}>
                        <span>Fond</span>
                        <span>Surface</span>
                        <span>Cartes</span>
                        <span>Bords</span>
                        <span>Accent</span>
                      </div>
                    </div>

                    {/* Mockup miniature d'interface */}
                    <div style={{
                      marginTop: '12px',
                      background: theme.colors.bg,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '8px',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: theme.colors.surface,
                        padding: '4px 8px',
                        borderRadius: '6px'
                      }}>
                        <span style={{ fontSize: '0.72rem', color: theme.colors.accent, fontWeight: 700 }}>
                          DocPocket Cab
                        </span>
                        <span style={{ fontSize: '0.65rem', color: theme.colors.textMuted }}>
                          Dr. H. BEN KHALIFA
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: theme.colors.card,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '0.7rem'
                      }}>
                        <span style={{ color: theme.colors.textMain, fontWeight: 600 }}>
                          Dossier Patient • Fiche
                        </span>
                        <span style={{
                          background: theme.colors.primary,
                          color: '#fff',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: 700
                        }}>
                          En consultation
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bouton d'activation */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectTheme(theme.id);
                    }}
                    style={{
                      marginTop: '4px',
                      width: '100%',
                      padding: '9px 14px',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid #10b981' : 'none',
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)'
                        : theme.colors.gradient,
                      color: isSelected ? '#34d399' : '#fff',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: isSelected ? 'none' : '0 2px 8px rgba(0,0,0,0.3)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {isSelected ? (
                      <>
                        <span>✓</span>
                        <span>Thème Actuel Appliqué</span>
                      </>
                    ) : (
                      <>
                        <span>🎨</span>
                        <span>Activer « {theme.name} »</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Sélection du Dossier de Sauvegarde */}
      {showFolderModal && (
        <BackupFolderSetupModal
          onClose={() => {
            setShowFolderModal(false);
            refreshFolderInfo();
          }}
          onConfigured={() => {
            setShowFolderModal(false);
            refreshFolderInfo();
          }}
        />
      )}
    </div>
  );
}
