import React, { useState, useEffect } from 'react';
import {
  getAllPatients,
  savePatient,
  deletePatientById,
  addToWaitingRoom,
  findDuplicatePatients,
  isDemoDatabase,
  getUnsettledConsultation,
  setUnsettledConsultation,
  clearUnsettledConsultation
} from './services/patientStorage';
import { isBackupFolderConfigured } from './services/backupFolderService';
import {
  initAutoBackup,
  subscribeAutoBackup,
  getAutoBackupStatus,
  performAutoBackupNow
} from './services/autoBackupService';
import BackupFolderSetupModal from './components/BackupFolderSetupModal';
import PatientMergeModal from './components/PatientMergeModal';
import DuplicateBatchModal from './components/DuplicateBatchModal';
import PatientModal from './components/PatientModal';
import PatientDetail from './components/PatientDetail';
import WaitingRoomView from './components/WaitingRoomView';
import AgendaView from './components/AgendaView';
import ConsultationView from './components/ConsultationView';
import PrescriptionView from './components/PrescriptionView';
import BillingView from './components/BillingView';
import OutilsView from './components/OutilsView';
import DirectoryView from './components/DirectoryView';
import SettingsView from './components/SettingsView';
import UnsettledConsultationModal from './components/UnsettledConsultationModal';
import LicenseLockModal from './components/LicenseLockModal';
import PinLockModal from './components/PinLockModal';
import PractitionerSwitchModal from './components/PractitionerSwitchModal';
import appLogo from './assets/logo.jpg';
import { initTheme, getCurrentThemeId } from './services/themeService';
import {
  getActivePractitioner,
  onPractitionerChange,
  formatDoctorDisplayName
} from './services/practitionerService';
import {
  getLicenseStatus,
  getDoctorPinConfig,
  getPinLockoutStatus
} from './services/licenseService';
import {
  startBridgeListener,
  stopBridgeListener,
  subscribeBridgeSync,
  sendInitialSyncRequestFromMobile,
  checkAndPullExistingBackup,
  autoSyncWithLatestBridge,
  firebaseFetch,
  isMobileDevice
} from './services/firebaseBridgeSyncService';
import './styles/global.css';

// Formate le nom du praticien : enlève tout "Dr." ou "Dr" en double et affiche Prénom puis Nom
function formatDoctorWelcomeName(raw) {
  if (!raw) return 'Hamed BEN KHALIFA';
  // Supprime tous les préfixes "Dr.", "Dr", "Docteur", "Pr." isolés ou répétés
  let clean = raw.replace(/\b(dr\.?|docteur|pr\.?)\b/gi, '').replace(/\s+/g, ' ').trim();
  
  // Si c'est spécifiquement "BEN KHALIFA Hamed" ou similaire
  if (/^ben\s+khalifa\s+hamed$/i.test(clean)) {
    return 'Hamed BEN KHALIFA';
  }
  
  // Détection générale : si le nom de famille est en tête et le prénom à la fin (ex: "BEN KHALIFA Hamed")
  const parts = clean.split(' ');
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const prev = parts.slice(0, parts.length - 1);
    const isPrevUpper = prev.every(p => p === p.toUpperCase() && p.length > 1);
    const isLastTitle = last[0] === last[0].toUpperCase() && last.slice(1) === last.slice(1).toLowerCase();
    if (isPrevUpper && isLastTitle) {
      return `${last} ${prev.join(' ')}`;
    }
  }
  
  return clean || 'Hamed BEN KHALIFA';
}

export default function App() {
  const [activeTab, setActiveTab] = useState('patients'); // 'patients' | 'waiting' | 'agenda' | 'consultation' | 'prescriptions' | 'billing' | 'tools' | 'settings'
  const [selectedTool, setSelectedTool] = useState('mapa'); // 'mapa' | 'mail' | 'sms' | 'scores' | 'addicto'
  const [toolsMenuExpanded, setToolsMenuExpanded] = useState(false); // Menu outils fermé par défaut
  const [settingsActiveTab, setSettingsActiveTab] = useState('backup');

  // Suivi rigoureux des règlements : aucune consultation sans règlement (même gratuit)
  const [unsettledConsultation, setUnsettledConsultationState] = useState(() => getUnsettledConsultation());
  const [showPaymentModal, setShowPaymentModal] = useState(() => Boolean(getUnsettledConsultation()));

  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [syncBanner, setSyncBanner] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  // Protection logicielle : Licence & Code PIN Praticien (Sécurité données patients)
  const [licenseInfo, setLicenseInfo] = useState(() => getLicenseStatus());
  const [pinLockout, setPinLockout] = useState(() => getPinLockoutStatus());
  const [lockoutReason, setLockoutReason] = useState(() => pinLockout.isLocked ? "3 tentatives de code PIN erronées" : '');
  const [appUnlocked, setAppUnlocked] = useState(() => {
    const pinCfg = getDoctorPinConfig();
    return !pinCfg.hasPin; // si aucun PIN n'est configuré, déverrouillé par défaut
  });

  // Cloisonnement multi-médecins : chaque praticien a sa propre base et ses données
  const [activePractitioner, setActivePractitioner] = useState(() => getActivePractitioner());
  const [showPractitionerModal, setShowPractitionerModal] = useState(false);
  const [practitionerToast, setPractitionerToast] = useState(null);

  // Message de bienvenue affiché pendant 5 secondes à l'ouverture pour le médecin
  const [welcomeBannerVisible, setWelcomeBannerVisible] = useState(false);
  const [doctorName, setDoctorName] = useState(() => {
    try {
      const activeDoc = getActivePractitioner();
      if (activeDoc && activeDoc.nom) {
        return `${activeDoc.prenom || ''} ${activeDoc.nom}`.trim();
      }
      const savedProfile = localStorage.getItem('docpocket_doctor_profile');
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        return parsed.nom || 'BEN KHALIFA Hamed';
      }
    } catch {}
    return 'BEN KHALIFA Hamed';
  });

  useEffect(() => {
    const unsub = onPractitionerChange(({ action, practitioner }) => {
      const currentDoc = practitioner || getActivePractitioner();
      setActivePractitioner(currentDoc);
      setDoctorName(currentDoc.nom ? `${currentDoc.prenom || ''} ${currentDoc.nom}`.trim() : 'Hamed BEN KHALIFA');
      setSelectedPatient(null);
      refreshPatients();
      if (action === 'switched') {
        setPractitionerToast(`Session active : ${formatDoctorDisplayName(currentDoc)} (Base isolée connectée)`);
        setTimeout(() => setPractitionerToast(null), 4500);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (licenseInfo?.isLicensed && appUnlocked) {
      setWelcomeBannerVisible(true);
      const timer = setTimeout(() => {
        setWelcomeBannerVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [licenseInfo?.isLicensed, appUnlocked]);

  // Cibles pour bascule Consultation <-> Rendez-vous
  const [appointmentTargetPatient, setAppointmentTargetPatient] = useState(null);
  const [pendingConsultationReturn, setPendingConsultationReturn] = useState(null);

  // Tri du bloc patient : 'numfch' | 'nom' | 'prenom' | 'consultation' | 'birthdate'
  const [sortOrder, setSortOrder] = useState(() => {
    try {
      return localStorage.getItem('docpocket_patient_sort_order') || 'numfch';
    } catch {
      return 'numfch';
    }
  });

  const handleSortChange = (newOrder) => {
    setSortOrder(newOrder);
    try {
      localStorage.setItem('docpocket_patient_sort_order', newOrder);
    } catch (e) {}
  };

  // Liste des patients triée dynamiquement selon le critère choisi
  const sortedPatients = React.useMemo(() => {
    const list = [...patients];
    if (sortOrder === 'numfch') {
      return list.sort((a, b) => {
        const fA = a.numfch || String(a.id || '');
        const fB = b.numfch || String(b.id || '');
        return fA.localeCompare(fB, undefined, { numeric: true, sensitivity: 'base' });
      });
    }
    if (sortOrder === 'nom') {
      return list.sort((a, b) => {
        const comp = (a.nom || '').localeCompare(b.nom || '');
        if (comp !== 0) return comp;
        return (a.prenom || '').localeCompare(b.prenom || '');
      });
    }
    if (sortOrder === 'prenom') {
      return list.sort((a, b) => {
        const comp = (a.prenom || '').localeCompare(b.prenom || '');
        if (comp !== 0) return comp;
        return (a.nom || '').localeCompare(b.nom || '');
      });
    }
    if (sortOrder === 'consultation') {
      return list.sort((a, b) => {
        const dateA = a.derniere_visite || '';
        const dateB = b.derniere_visite || '';
        if (dateA && dateB) {
          if (dateA !== dateB) return dateB.localeCompare(dateA); // Plus récentes en premier
        } else if (dateA && !dateB) {
          return -1;
        } else if (!dateA && dateB) {
          return 1;
        }
        return (a.nom || '').localeCompare(b.nom || '');
      });
    }
    if (sortOrder === 'birthdate') {
      return list.sort((a, b) => {
        const bA = a.birthdate || a.date_naissance || '';
        const bB = b.birthdate || b.date_naissance || '';
        if (bA && bB) return bA.localeCompare(bB);
        if (bA && !bB) return -1;
        if (!bA && bB) return 1;
        return (a.nom || '').localeCompare(b.nom || '');
      });
    }
    return list;
  }, [patients, sortOrder]);

  // Suggestions instantanées pour le champ de recherche libre
  const searchSuggestions = React.useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 1) return [];
    return sortedPatients.slice(0, 5);
  }, [searchQuery, sortedPatients]);

  // Patient actuellement actif (sélectionné, en consultation ou en prescription)
  const [currentActivePatient, setCurrentActivePatient] = useState(null);

  // Patient, entrée salle d'attente ou consultation passée transmis vers la vue consultation
  const [consultationTargetPatient, setConsultationTargetPatient] = useState(null);
  const [consultationWaitingEntry, setConsultationWaitingEntry] = useState(null);
  const [consultationToEdit, setConsultationToEdit] = useState(null);

  // Patient et consultation cibles pour la prescription
  const [prescriptionTargetPatient, setPrescriptionTargetPatient] = useState(null);
  const [prescriptionTargetConsultation, setPrescriptionTargetConsultation] = useState(null);

  // Patient et consultation cibles pour la facturation & quittance
  const [billingTargetPatient, setBillingTargetPatient] = useState(null);
  const [billingTargetConsultation, setBillingTargetConsultation] = useState(null);

  // Configuration du dossier de sauvegarde local au 1er lancement
  const [showFolderSetup, setShowFolderSetup] = useState(() => !isBackupFolderConfigured());

  // Statut de la sauvegarde automatique après modification
  const [autoBackupStatus, setAutoBackupStatus] = useState(() => getAutoBackupStatus());

  // Détection de la plateforme & ergonomie tactile (Windows, macOS, Android, iPhone)
  const checkIsMobileDevice = () => {
    if (typeof window === 'undefined') return false;
    const isSmall = window.innerWidth < 1024;
    const isTouch = 'ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0);
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator?.userAgent || '');
    return isSmall || (isTouch && isMobileUA);
  };
  const [isMobile, setIsMobile] = useState(checkIsMobileDevice);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = checkIsMobileDevice();
      setIsMobile(mobile);
      if (!mobile) setMobileDrawerOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [currentAppTheme, setCurrentAppTheme] = useState(() => getCurrentThemeId());

  // Support officiel de l'installation PWA Google Chrome & Navigateurs Mobiles
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsAppInstalled(true);
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsAppInstalled(true);
        setDeferredPrompt(null);
      }
    } else {
      alert("Installation de DocPocket Cab sur Google Chrome :\n\n1. Appuyez sur le menu (⋮) en haut à droite du navigateur Chrome.\n2. Cliquez sur 'Installer l'application' (ou 'Ajouter à l'écran d'accueil').\n3. L'application apparaîtra directement sur votre écran d'accueil avec son icône médicale dédiée !");
    }
  };

  useEffect(() => {
    initTheme();
    const handleThemeChange = (e) => {
      setCurrentAppTheme(e.detail?.id || getCurrentThemeId());
    };
    window.addEventListener('docpocket-theme-changed', handleThemeChange);
    return () => window.removeEventListener('docpocket-theme-changed', handleThemeChange);
  }, []);

  useEffect(() => {
    initAutoBackup();
    const unsub = subscribeAutoBackup((newStatus) => {
      setAutoBackupStatus(newStatus);
    });
    return unsub;
  }, []);

  // Écouteur du pont de synchronisation Firebase (PC <-> Mobile)
  useEffect(() => {
    startBridgeListener();
    const unsub = subscribeBridgeSync((evt) => {
      if (evt.type === 'SYNC_COMPLETE') {
        refreshPatients();
        setSyncBanner({
          type: 'success',
          message: evt.message || 'Données synchronisées sans doublons !',
          time: Date.now()
        });
        setTimeout(() => setSyncBanner(null), 6000);
      } else if (evt.type === 'SYNC_START' || evt.type === 'UPLOADING' || evt.type === 'DOWNLOADING') {
        setSyncBanner({
          type: 'info',
          message: evt.message,
          time: Date.now()
        });
      } else if (evt.type === 'REMOTE_REQUEST_RECEIVED') {
        setSyncBanner({
          type: 'info',
          message: evt.message,
          time: Date.now()
        });
        setTimeout(() => setSyncBanner(null), 5000);
      } else if (evt.type === 'SYNC_ERROR') {
        setSyncBanner({
          type: 'error',
          message: `Erreur pont Firebase : ${evt.error}`,
          time: Date.now()
        });
        setTimeout(() => setSyncBanner(null), 8000);
      }
    });

    // SYNCHRONISATION AUTOMATIQUE UNIVERSELLE (PC <-> SMARTPHONE) :
    // Détecte la sauvegarde la plus récente sur Firebase et la synchronise automatiquement avec tous les appareils
    autoSyncWithLatestBridge((msg) => {
      setSyncBanner({ type: 'info', message: msg, time: Date.now() });
    }).then(async (res) => {
      if (res && res.action === 'pulled') {
        await refreshPatients();
      } else if (res && res.action === 'push_needed') {
        console.log("Synchronisation : publication de la base la plus récente vers le pont Firebase...");
        await performAutoBackupNow('sync_vers_pont_sauvegarde_recente');
      } else if (isMobileDevice()) {
        const pats = await getAllPatients();
        if (isDemoDatabase(pats)) {
          sendInitialSyncRequestFromMobile().catch(() => {});
        }
      }
    }).catch(err => {
      console.warn("Erreur autoSyncWithLatestBridge au démarrage:", err);
    });

    return () => {
      unsub();
      stopBridgeListener();
    };
  }, []);

  // Détection des doublons & fusion
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [showBatchDuplicatesModal, setShowBatchDuplicatesModal] = useState(false);
  const [selectedPatientIds, setSelectedPatientIds] = useState([]);
  const [mergeModalData, setMergeModalData] = useState(null);

  // Charger la liste des patients depuis IndexedDB (PWA offline)
  const refreshPatients = async (query = '') => {
    try {
      setLoading(true);
      const data = await getAllPatients(query);
      setPatients(data);

      // Détecter les doublons potentiels (même identité et date de naissance)
      const duplicates = await findDuplicatePatients();
      setDuplicateGroups(duplicates);

      if (selectedPatient) {
        const updatedSelected = data.find(p => p.id === selectedPatient.id);
        if (updatedSelected) {
          setSelectedPatient(updatedSelected);
        }
      }
    } catch (err) {
      console.error('Erreur chargement patients:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectPatient = (id) => {
    setSelectedPatientIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedPatientIds.length === sortedPatients.length) {
      setSelectedPatientIds([]);
    } else {
      setSelectedPatientIds(sortedPatients.map(p => p.id));
    }
  };

  const handleOpenMergeSelected = () => {
    const selectedPats = patients.filter(p => selectedPatientIds.includes(p.id));
    if (selectedPats.length < 2) return;
    setMergeModalData({
      target: selectedPats[0],
      sources: selectedPats.slice(1),
      group: null
    });
  };

  useEffect(() => {
    refreshPatients(searchQuery);
  }, [searchQuery]);

  const handleOpenAddModal = () => {
    setEditingPatient(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (patient) => {
    setEditingPatient(patient);
    setShowModal(true);
  };

  const handleSavePatient = async (patientData) => {
    try {
      const isNewPatient = !patientData.id;
      const savedId = await savePatient(patientData);
      setShowModal(false);
      setEditingPatient(null);
      await refreshPatients(searchQuery);

      if (isNewPatient) {
        // Redirection directe vers le bloc consultation pour effectuer une nouvelle consultation
        const createdRecord = { ...patientData, id: savedId };
        setCurrentActivePatient(createdRecord);
        setSelectedPatient(createdRecord);
        setConsultationTargetPatient(createdRecord);
        setConsultationWaitingEntry(null);
        setConsultationToEdit(null); // consultation vierge prête
        setActiveTab('consultation');
      }
    } catch (err) {
      alert("Erreur lors de l'enregistrement du dossier patient : " + err.message);
    }
  };

  const handleDeletePatient = async (id) => {
    if (window.confirm("Êtes-vous certain de vouloir supprimer définitivement ce dossier patient ?")) {
      try {
        await deletePatientById(id);
        if (selectedPatient && selectedPatient.id === id) {
          setSelectedPatient(null);
        }
        await refreshPatients(searchQuery);
      } catch (err) {
        alert("Erreur lors de la suppression : " + err.message);
      }
    }
  };

  const handleAddPatientToWaiting = async (patient) => {
    try {
      await addToWaitingRoom(patient, 'Consultation générale');
      alert(`✓ ${patient.nom} ${patient.prenom} a été ajouté(e) en Salle d'Attente !`);
      setActiveTab('waiting');
    } catch (err) {
      alert("Erreur lors de l'ajout en salle d'attente : " + err.message);
    }
  };

  // Navigation avec vérification stricte : aucun règlement (même gratuit) ne doit être oublié
  const handleNavTabClick = (tabName, extraAction, onItemClick) => {
    if (unsettledConsultation && tabName !== 'billing') {
      setShowPaymentModal(true);
      onItemClick?.();
      return;
    }
    setActiveTab(tabName);
    extraAction?.();
    onItemClick?.();
  };

  // Rendu des liens de navigation (partagé entre sidebar desktop et drawer mobile)
  const renderNavigationItems = (onItemClick) => (
    <>
      <button
        onClick={() => handleNavTabClick('patients', () => setSelectedPatient(null), onItemClick)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
          borderRadius: '8px',
          border: 'none',
          background: activeTab === 'patients' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
          color: activeTab === 'patients' ? '#38bdf8' : '#94a3b8',
          fontWeight: activeTab === 'patients' ? 600 : 500,
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>👥</span>
        <div>
          <div>Dossiers Patients</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Annuaire & Couverture CNAM</div>
        </div>
      </button>

      <button
        onClick={() => handleNavTabClick('waiting', () => setSelectedPatient(null), onItemClick)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
          borderRadius: '8px',
          border: 'none',
          background: activeTab === 'waiting' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
          color: activeTab === 'waiting' ? '#38bdf8' : '#94a3b8',
          fontWeight: activeTab === 'waiting' ? 600 : 500,
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>⏱️</span>
        <div>
          <div>Salle d'Attente</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>File active du jour</div>
        </div>
      </button>

      <button
        onClick={() => handleNavTabClick('agenda', () => setSelectedPatient(null), onItemClick)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
          borderRadius: '8px',
          border: 'none',
          background: activeTab === 'agenda' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
          color: activeTab === 'agenda' ? '#38bdf8' : '#94a3b8',
          fontWeight: activeTab === 'agenda' ? 600 : 500,
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>📅</span>
        <div>
          <div>Agenda & RDV</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Planification & Rendez-vous</div>
        </div>
      </button>

      <button
        onClick={() => {
          handleNavTabClick('consultation', () => {
            setSelectedPatient(null);
            setConsultationTargetPatient(null);
            setConsultationWaitingEntry(null);
          }, onItemClick);
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
          borderRadius: '8px',
          border: 'none',
          background: activeTab === 'consultation' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
          color: activeTab === 'consultation' ? '#38bdf8' : '#94a3b8',
          fontWeight: activeTab === 'consultation' ? 600 : 500,
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>🩺</span>
        <div>
          <div>Consultations</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Examen clinique & Constantes</div>
        </div>
      </button>

      <button
        onClick={() => {
          handleNavTabClick('prescriptions', () => {
            if (currentActivePatient) {
              setPrescriptionTargetPatient(currentActivePatient);
            }
          }, onItemClick);
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
          borderRadius: '8px',
          border: 'none',
          background: activeTab === 'prescriptions' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
          color: activeTab === 'prescriptions' ? '#38bdf8' : '#94a3b8',
          fontWeight: activeTab === 'prescriptions' ? 600 : 500,
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>💊</span>
        <div>
          <div>Prescriptions & DCI</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Ordonnances & Base Avicenna</div>
        </div>
      </button>

      <button
        onClick={() => {
          setActiveTab('billing');
          if (currentActivePatient) {
            setBillingTargetPatient(currentActivePatient);
          }
          onItemClick?.();
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
          borderRadius: '8px',
          border: 'none',
          background: activeTab === 'billing' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
          color: activeTab === 'billing' ? '#38bdf8' : '#94a3b8',
          fontWeight: activeTab === 'billing' ? 600 : 500,
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>💰</span>
        <div>
          <div>Finances & Facturation</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Caisse, Recettes & CNAM</div>
        </div>
      </button>

      {/* Rubrique Outils */}
      <div style={{ margin: '4px 0', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '6px' }}>
        <button
          type="button"
          onClick={() => {
            handleNavTabClick('tools', () => setToolsMenuExpanded(prev => !prev), onItemClick);
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'tools' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeTab === 'tools' ? '#38bdf8' : '#94a3b8',
            fontWeight: activeTab === 'tools' ? 600 : 500,
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.2rem' }}>🛠️</span>
            <div>
              <div>Outils</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>DocPocket Suite Clinique</div>
            </div>
          </div>
          <span style={{
            fontSize: '0.75rem',
            color: '#64748b',
            transition: 'transform 0.2s ease',
            transform: toolsMenuExpanded ? 'rotate(90deg)' : 'none'
          }}>
            ▶
          </span>
        </button>

        {/* Sous-rubriques Outils */}
        {toolsMenuExpanded && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            marginLeft: '16px',
            marginTop: '4px',
            paddingLeft: '12px',
            borderLeft: '1.5px solid rgba(56, 189, 248, 0.3)'
          }}>
            <button
              onClick={() => handleNavTabClick('tools', () => setSelectedTool('mapa'), onItemClick)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'tools' && selectedTool === 'mapa' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                color: activeTab === 'tools' && selectedTool === 'mapa' ? '#38bdf8' : '#cbd5e1',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'tools' && selectedTool === 'mapa' ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <span>🩺</span>
              <div>
                <div>DocPocket Mapa</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Holter tensionnel 24h</div>
              </div>
            </button>

            <button
              onClick={() => handleNavTabClick('tools', () => setSelectedTool('mail'), onItemClick)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'tools' && selectedTool === 'mail' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                color: activeTab === 'tools' && selectedTool === 'mail' ? '#38bdf8' : '#cbd5e1',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'tools' && selectedTool === 'mail' ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <span>✉️</span>
              <div>
                <div>MailPocket Pro</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Résultats & Messagerie</div>
              </div>
            </button>

            <button
              onClick={() => handleNavTabClick('tools', () => setSelectedTool('sms'), onItemClick)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'tools' && selectedTool === 'sms' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                color: activeTab === 'tools' && selectedTool === 'sms' ? '#38bdf8' : '#cbd5e1',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'tools' && selectedTool === 'sms' ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <span>💬</span>
              <div>
                <div>DocPocket SMS RDV</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Rappels de rendez-vous</div>
              </div>
            </button>

            <button
              onClick={() => handleNavTabClick('tools', () => setSelectedTool('scores'), onItemClick)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'tools' && selectedTool === 'scores' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                color: activeTab === 'tools' && selectedTool === 'scores' ? '#38bdf8' : '#cbd5e1',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'tools' && selectedTool === 'scores' ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <span>🧮</span>
              <div>
                <div>DocPocket Scores</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Calculateurs cliniques</div>
              </div>
            </button>

            <button
              onClick={() => handleNavTabClick('tools', () => setSelectedTool('addicto'), onItemClick)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'tools' && selectedTool === 'addicto' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                color: activeTab === 'tools' && selectedTool === 'addicto' ? '#34d399' : '#cbd5e1',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'tools' && selectedTool === 'addicto' ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <span>🌿</span>
              <div>
                <div>DocPocket Addicto</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Scores d'addictions</div>
              </div>
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => handleNavTabClick('directory', () => setSelectedPatient(null), onItemClick)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
          borderRadius: '8px',
          border: 'none',
          background: activeTab === 'directory' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
          color: activeTab === 'directory' ? '#38bdf8' : '#94a3b8',
          fontWeight: activeTab === 'directory' ? 600 : 500,
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>👥</span>
        <div>
          <div>Annuaire Confrères</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Réseau Partagé & Orientation</div>
        </div>
      </button>

      <button
        onClick={() => {
          setSettingsActiveTab('backup');
          handleNavTabClick('settings', null, onItemClick);
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
          borderRadius: '8px',
          border: 'none',
          background: activeTab === 'settings' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
          color: activeTab === 'settings' ? '#38bdf8' : '#94a3b8',
          fontWeight: activeTab === 'settings' ? 600 : 500,
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>⚙️</span>
        <div>
          <div>Paramètres & Thèmes</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>10 Thèmes, Sauvegardes & Cloud</div>
        </div>
      </button>
    </>
  );

  // Rendu du footer sidebar (informations PWA, auto-backup)
  const renderSidebarFooter = () => (
    <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.75rem', color: '#64748b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
        <strong style={{ color: '#cbd5e1' }}>PWA Mode Hors-Ligne</strong>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#94a3b8' }}>
        <span>💾 Auto-Sauvegarde :</span>
        <strong style={{ color: autoBackupStatus.enabled ? '#4ade80' : '#f87171' }}>
          {autoBackupStatus.enabled ? 'Active (après modif)' : 'Désactivée'}
        </strong>
      </div>
    </div>
  );

  // 1. Si aucune licence active n'est enregistrée sur cet appareil
  if (!licenseInfo || !licenseInfo.isLicensed) {
    return (
      <LicenseLockModal 
        onActivated={(newLic) => {
          setLicenseInfo(newLic);
          setAppUnlocked(true);
        }} 
      />
    );
  }

  // 2. Si l'application a été bloquée après 3 tentatives de code PIN erronées
  if (lockoutReason || pinLockout.isLocked) {
    return (
      <LicenseLockModal 
        lockoutReason={lockoutReason || "Application bloquée suite à 3 tentatives de code PIN erronées"}
        onActivated={(newLic) => {
          setLicenseInfo(newLic);
          setLockoutReason('');
          setPinLockout({ isLocked: false, failedAttempts: 0, remainingAttempts: 3 });
          setAppUnlocked(true);
        }} 
      />
    );
  }

  // 3. Si un code PIN praticien est configuré et que l'application est verrouillée
  if (!appUnlocked) {
    return (
      <PinLockModal 
        onUnlocked={() => {
          setAppUnlocked(true);
        }}
        onRequireLicense={(reason) => {
          setLockoutReason(reason);
        }}
      />
    );
  }

  return (
    <div
      className="docpocket-app-container"
      style={{
        display: 'flex',
        height: '100%',
        minHeight: '100dvh',
        width: '100vw',
        background: 'var(--bg-color, #0b1329)',
        color: 'var(--text-main, #f8fafc)',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Message de bienvenue affiché pendant 5 secondes à l'ouverture pour le médecin */}
      {welcomeBannerVisible && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 99999,
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          color: '#fff',
          padding: '14px 22px',
          borderRadius: '14px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(56, 189, 248, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          border: '1.5px solid rgba(255, 255, 255, 0.25)',
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem'
          }}>
            👨‍⚕️
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>
              Bienvenue Dr. {formatDoctorWelcomeName(doctorName)}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#e0f2fe' }}>
              Votre Cabinet Médical DocPocket Cab est prêt.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setWelcomeBannerVisible(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '1.1rem',
              cursor: 'pointer',
              marginLeft: '8px'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Toast de bascule de médecin */}
      {practitionerToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
          color: '#fff',
          padding: '12px 22px',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          border: '1.5px solid #34d399',
          animation: 'fadeIn 0.3s ease',
          fontSize: '0.9rem',
          fontWeight: 700
        }}>
          <span style={{ fontSize: '1.3rem' }}>🩺</span>
          <span>{practitionerToast}</span>
        </div>
      )}

      {/* Sidebar Navigation Desktop (Windows / macOS / Écrans larges >= 1024px) */}
      {!isMobile && (
        <aside style={{
          width: '260px',
          background: '#0f172a',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div>
            {/* Logo Cabinet */}
            <div style={{ padding: '20px 18px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img
                  src={appLogo}
                  alt="DocPocket Cab Logo"
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '10px',
                    objectFit: 'cover',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                    border: '1.5px solid rgba(56, 189, 248, 0.4)'
                  }}
                />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                    DocPocket Cab
                  </h2>
                </div>
              </div>
            </div>

            {/* Carte Praticien Connecté & Sélecteur */}
            <div
              onClick={() => setShowPractitionerModal(true)}
              style={{
                margin: '12px 14px 4px',
                padding: '10px 12px',
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                transition: 'all 0.2s'
              }}
              title="Cliquez pour changer de médecin ou gérer l'équipe du cabinet"
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: activePractitioner.color || '#0284c7',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {((activePractitioner.prenom || 'M')[0] + (activePractitioner.nom || 'D')[0]).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#f8fafc', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {formatDoctorDisplayName(activePractitioner)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#38bdf8', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {activePractitioner.specialite || 'Médecine Générale'}
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#38bdf8' }}>⇄</span>
            </div>

            {/* Menus / Blocs */}
            <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {renderNavigationItems()}
            </nav>
          </div>

          {renderSidebarFooter()}
        </aside>
      )}

      {/* Menu Tiroir Mobile (Slide-over Drawer sur Android / iPhone) */}
      {isMobile && mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(5px)',
            zIndex: 99998,
            display: 'flex'
          }}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="animate-slide-left"
            style={{
              width: '290px',
              maxWidth: '85vw',
              height: '100%',
              background: '#0f172a',
              borderRight: '1.5px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              zIndex: 99999,
              boxShadow: '10px 0 30px rgba(0, 0, 0, 0.8)',
              overflowY: 'auto',
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)'
            }}
          >
            <div>
              <div style={{
                padding: '16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={appLogo}
                    alt="Logo"
                    style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover' }}
                  />
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', fontWeight: 700 }}>
                      DocPocket Cab
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: '#94a3b8',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    fontSize: '1.1rem'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Carte Praticien Mobile */}
              <div
                onClick={() => {
                  setMobileDrawerOpen(false);
                  setShowPractitionerModal(true);
                }}
                style={{
                  margin: '10px 10px 4px',
                  padding: '10px 12px',
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.18) 0%, rgba(15, 23, 42, 0.7) 100%)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: activePractitioner.color || '#0284c7',
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {((activePractitioner.prenom || 'M')[0] + (activePractitioner.nom || 'D')[0]).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#f8fafc', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {formatDoctorDisplayName(activePractitioner)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#38bdf8', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {activePractitioner.specialite || 'Médecine Générale'}
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#38bdf8' }}>⇄</span>
              </div>

              <nav style={{ padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {renderNavigationItems(() => setMobileDrawerOpen(false))}
              </nav>
            </div>

            {renderSidebarFooter()}
          </aside>
        </div>
      )}

      {/* Zone de Contenu Principale */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {/* Top Header Adaptatif */}
        <header style={{
          height: isMobile ? '56px' : '65px',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background: '#0f172a',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: isMobile ? '12px' : '28px',
          paddingRight: isMobile ? '12px' : '28px',
          flexShrink: 0,
          zIndex: 8000
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '12px' }}>
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                style={{
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: '#38bdf8',
                  borderRadius: '8px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '1.25rem'
                }}
                title="Ouvrir le menu"
              >
                ☰
              </button>
            )}

            {isMobile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={appLogo} alt="Logo" style={{ width: '30px', height: '30px', borderRadius: '7px', objectFit: 'cover' }} />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
                  {activeTab === 'patients' && 'Patients'}
                  {activeTab === 'waiting' && 'Salle d\'Attente'}
                  {activeTab === 'agenda' && 'Agenda Médical'}
                  {activeTab === 'consultation' && 'Consultations'}
                  {activeTab === 'prescriptions' && 'Ordonnances'}
                  {activeTab === 'billing' && 'Facturation & CNAM'}
                  {activeTab === 'tools' && 'Outils & Addicto'}
                  {activeTab === 'directory' && 'Annuaire Confrères'}
                  {activeTab === 'settings' && 'Paramètres'}
                </span>
              </div>
            ) : (
              <>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                  {activeTab === 'patients' && 'Dossiers Patients :'}
                  {activeTab === 'waiting' && "Salle d'Attente :"}
                  {activeTab === 'agenda' && 'Agenda Médical :'}
                  {activeTab === 'consultation' && 'Consultations Médicales :'}
                  {activeTab === 'prescriptions' && 'Ordonnances Médicales :'}
                  {activeTab === 'billing' && 'Facturation & CNAM :'}
                  {activeTab === 'tools' && 'Outils & Addicto :'}
                  {activeTab === 'directory' && 'Annuaire des Confrères :'}
                  {activeTab === 'settings' && 'Paramètres du Cabinet :'}
                </span>
                <span style={{ color: '#cbd5e1' }}>
                  {activeTab === 'patients' && 'Gestion des Dossiers Patients & Couverture Sociale'}
                  {activeTab === 'waiting' && "Salle d'Attente & Gestion du Flux en Temps Réel"}
                  {activeTab === 'agenda' && 'Agenda Médical & Planification des Rendez-Vous'}
                  {activeTab === 'consultation' && 'Consultations Médicales & Résumés PDF'}
                  {activeTab === 'prescriptions' && 'Prescriptions & Ordonnances Médicales (Base Avicenna)'}
                  {activeTab === 'billing' && 'Facturation, Quittances & Bordereaux CNAM (Tiers-Payant)'}
                  {activeTab === 'tools' && 'DocPocket Mapa, MailPocket, SMS, Scores & Addicto'}
                  {activeTab === 'directory' && 'Réseau Médical Partagé & Orientation des Patients'}
                  {activeTab === 'settings' && 'Sauvegarde, Restauration & Configuration du Cabinet'}
                </span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px' }}>
            {/* Badge & Sélecteur Rapide Praticien */}
            <button
              type="button"
              onClick={() => setShowPractitionerModal(true)}
              title={`Médecin actif : ${formatDoctorDisplayName(activePractitioner)}\nCliquez pour changer de praticien ou gérer l'équipe du cabinet.`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '5px' : '8px',
                padding: isMobile ? '5px 8px' : '6px 14px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.2) 0%, rgba(15, 23, 42, 0.7) 100%)',
                border: '1.5px solid #0284c7',
                color: '#38bdf8',
                fontWeight: 700,
                fontSize: isMobile ? '0.72rem' : '0.82rem',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(2, 132, 199, 0.25)',
                userSelect: 'none'
              }}
            >
              <span style={{
                width: isMobile ? '20px' : '22px',
                height: isMobile ? '20px' : '22px',
                borderRadius: '50%',
                background: activePractitioner.color || '#0284c7',
                color: '#fff',
                fontSize: isMobile ? '0.65rem' : '0.72rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {((activePractitioner.prenom || 'M')[0] + (activePractitioner.nom || 'D')[0]).toUpperCase()}
              </span>
              <span>
                {isMobile 
                  ? (activePractitioner.nom ? `Dr. ${activePractitioner.nom}` : 'Dr.')
                  : formatDoctorDisplayName(activePractitioner)}
              </span>
              <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>▼</span>
            </button>

            {/* Raccourci Thèmes Visuels (10 Thèmes au Choix) */}
            <button
              type="button"
              onClick={() => {
                setSettingsActiveTab('themes');
                setActiveTab('settings');
              }}
              title="Personnalisation de l'ambiance visuelle (10 thèmes médicaux au choix)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '4px' : '6px',
                padding: isMobile ? '5px 8px' : '6px 12px',
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1.5px solid rgba(255, 255, 255, 0.15)',
                color: '#f8fafc',
                fontWeight: 600,
                fontSize: isMobile ? '0.72rem' : '0.8rem',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              <span>🎨</span>
              {!isMobile && <span>Thèmes</span>}
            </button>

            {/* Bouton d'Installation PWA Google Chrome & Écran d'accueil */}
            {!isAppInstalled && (
              <button
                type="button"
                onClick={handleInstallPWA}
                title="Installer DocPocket Cab sur votre écran d'accueil (Application PWA)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? '4px' : '6px',
                  padding: isMobile ? '5px 9px' : '6px 13px',
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: '1.5px solid #38bdf8',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: isMobile ? '0.72rem' : '0.8rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(2, 132, 199, 0.45)',
                  userSelect: 'none'
                }}
              >
                <span>📲</span>
                <span>Installer</span>
              </button>
            )}

            {/* Badge Auto-Sauvegarde */}
            <div
              onClick={() => setShowFolderSetup(true)}
              title={
                autoBackupStatus.lastInfo
                  ? `Dernière sauvegarde auto : ${autoBackupStatus.lastInfo.timeFormatted || ''} dans "${autoBackupStatus.lastInfo.folderName}"\nCliquez pour changer le dossier.`
                  : 'Sauvegarde automatique active après chaque modification'
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '4px' : '8px',
                padding: isMobile ? '5px 10px' : '6px 14px',
                borderRadius: '20px',
                background: autoBackupStatus.state === 'saving'
                  ? 'rgba(56, 189, 248, 0.2)'
                  : autoBackupStatus.state === 'pending'
                  ? 'rgba(234, 179, 8, 0.2)'
                  : 'rgba(34, 197, 94, 0.15)',
                border: `1.5px solid ${
                  autoBackupStatus.state === 'saving'
                    ? '#38bdf8'
                    : autoBackupStatus.state === 'pending'
                    ? '#eab308'
                    : 'rgba(34, 197, 94, 0.4)'
                }`,
                fontSize: isMobile ? '0.72rem' : '0.8rem',
                color: autoBackupStatus.state === 'saving'
                  ? '#38bdf8'
                  : autoBackupStatus.state === 'pending'
                  ? '#facc15'
                  : '#4ade80',
                fontWeight: 600,
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              <span>
                {autoBackupStatus.state === 'saving' ? '🔄' : autoBackupStatus.state === 'pending' ? '⏳' : '🛡️'}
              </span>
              {!isMobile && (
                <span>
                  {autoBackupStatus.state === 'saving' && 'Auto-Sauvegarde en cours...'}
                  {autoBackupStatus.state === 'pending' && 'Sauvegarde en attente...'}
                  {(autoBackupStatus.state === 'saved' || autoBackupStatus.state === 'idle') && (
                    autoBackupStatus.lastInfo && autoBackupStatus.lastInfo.timeFormatted
                      ? `Auto-Sauvegardé (${autoBackupStatus.lastInfo.timeFormatted})`
                      : 'Auto-Sauvegarde Active'
                  )}
                  {autoBackupStatus.state === 'error' && 'Erreur Auto-Sauvegarde'}
                </span>
              )}
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: autoBackupStatus.state === 'saving'
                  ? '#38bdf8'
                  : autoBackupStatus.state === 'pending'
                  ? '#facc15'
                  : '#22c55e',
                boxShadow: '0 0 6px rgba(34, 197, 94, 0.8)'
              }}></span>
            </div>

            {activeTab === 'patients' && (
              <button
                onClick={handleOpenAddModal}
                style={{
                  padding: isMobile ? '7px 12px' : '9px 18px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: isMobile ? '0.8rem' : '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
                }}
              >
                <span>+</span> {isMobile ? 'Patient' : 'Nouveau Patient'}
              </button>
            )}
          </div>
        </header>

        {/* Corps avec défilement fluide et marge basse pour la barre mobile */}
        <div
          className="scroll-touch"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isMobile
              ? '14px 12px calc(80px + env(safe-area-inset-bottom, 0px)) 12px'
              : '24px 28px'
          }}
        >
          {/* Notification Bannière Pont Firebase (PC <-> Mobile) */}
          {syncBanner && (
            <div
              className="animate-fade-in"
              style={{
                marginBottom: '16px',
                padding: '12px 16px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: syncBanner.type === 'success'
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%)'
                  : syncBanner.type === 'error'
                  ? 'rgba(239, 68, 68, 0.2)'
                  : 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(2, 132, 199, 0.2) 100%)',
                border: `1.5px solid ${
                  syncBanner.type === 'success' ? '#10b981' : syncBanner.type === 'error' ? '#ef4444' : '#38bdf8'
                }`,
                color: '#fff',
                fontSize: '0.88rem',
                fontWeight: 600,
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.2rem' }}>
                  {syncBanner.type === 'success' ? '✓' : syncBanner.type === 'error' ? '⚠️' : '🔄'}
                </span>
                <span>{syncBanner.message}</span>
              </div>
              <button
                onClick={() => setSyncBanner(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  padding: '2px 6px'
                }}
              >
                ✕
              </button>
            </div>
          )}

          {activeTab === 'patients' && (
            selectedPatient ? (
              <PatientDetail
                patient={selectedPatient}
                onBack={() => setSelectedPatient(null)}
                onEdit={handleOpenEditModal}
                onDelete={handleDeletePatient}
                onAddToWaitingRoom={handleAddPatientToWaiting}
                onNewConsultation={(pat) => {
                  setCurrentActivePatient(pat);
                  setConsultationTargetPatient(pat);
                  setConsultationWaitingEntry(null);
                  setConsultationToEdit(null);
                  setActiveTab('consultation');
                }}
                onOpenConsultation={(pat, consult) => {
                  setCurrentActivePatient(pat);
                  setConsultationTargetPatient(pat);
                  setConsultationWaitingEntry(null);
                  setConsultationToEdit(consult);
                  setActiveTab('consultation');
                }}
                onNewPrescription={(pat) => {
                  // Redirige vers une consultation car l'ordonnance doit être rattachée à la consultation
                  setCurrentActivePatient(pat);
                  setConsultationTargetPatient(pat);
                  setConsultationWaitingEntry(null);
                  setConsultationToEdit(null);
                  setActiveTab('consultation');
                }}
                onNewInvoice={(pat) => {
                  // Redirige vers une consultation car la quittance doit être rattachée à la consultation
                  setCurrentActivePatient(pat);
                  setConsultationTargetPatient(pat);
                  setConsultationWaitingEntry(null);
                  setConsultationToEdit(null);
                  setActiveTab('consultation');
                }}
                onMerge={(pat) => {
                  setMergeModalData({
                    target: pat,
                    sources: [],
                    group: null
                  });
                }}
                onOpenDirectory={(pat) => {
                  setCurrentActivePatient(pat);
                  setSelectedPatient(pat);
                  setActiveTab('directory');
                }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Alerte / Bannière Détection Automatique des Doublons */}
                {duplicateGroups.length > 0 && (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(161, 98, 7, 0.12) 100%)',
                    border: '1.5px solid rgba(234, 179, 8, 0.4)',
                    borderRadius: '12px',
                    padding: isMobile ? '12px 14px' : '14px 20px',
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '1.6rem' }}>⚠️</span>
                      <div>
                        <div style={{ fontWeight: 700, color: '#facc15', fontSize: '0.9rem', marginBottom: '2px' }}>
                          {duplicateGroups.length} groupe(s) de doublons potentiels détectés
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                          Même identité et date de naissance. Regroupez leurs consultations sur une fiche unique.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBatchDuplicatesModal(true)}
                      style={{
                        padding: '9px 18px',
                        borderRadius: '8px',
                        background: '#eab308',
                        color: '#0f172a',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(234, 179, 8, 0.35)',
                        whiteSpace: 'nowrap',
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      title="Ouvrir l'assistant de fusion groupée pour traiter tous les doublons ensemble"
                    >
                      <span>🔀</span> Traiter tous les doublons ({duplicateGroups.length})
                    </button>
                  </div>
                )}

                {/* Barre de Recherche, Filtres de Tri et Compteurs */}
                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  justifyContent: 'space-between',
                  alignItems: isMobile ? 'stretch' : 'center',
                  background: '#1e293b',
                  padding: isMobile ? '12px 14px' : '14px 20px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  {/* Champ de recherche réactif instantané avec suggestions */}
                  <div style={{ position: 'relative', width: isMobile ? '100%' : '360px' }}>
                    <input
                      type="text"
                      placeholder="Rechercher : Nom, Prénom, Date Naiss., CIN, N° Fiche..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 32px 10px 38px',
                        borderRadius: '8px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        fontSize: '0.88rem',
                        outline: 'none'
                      }}
                    />
                    <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#64748b' }}>🔍</span>
                    {searchQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          padding: '2px 4px'
                        }}
                        title="Effacer la recherche"
                      >
                        ✕
                      </button>
                    )}

                    {/* Liste Déroulante des Suggestions Instantanées */}
                    {searchQuery.trim().length > 0 && searchSuggestions.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        background: '#0f172a',
                        border: '1.5px solid #38bdf8',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                        zIndex: 100,
                        maxHeight: '230px',
                        overflowY: 'auto'
                      }}>
                        <div style={{ padding: '6px 12px', fontSize: '0.72rem', color: '#94a3b8', background: '#1e293b', borderBottom: '1px solid #334155', fontWeight: 600 }}>
                          💡 Suggestions de patients correspondants :
                        </div>
                        {searchSuggestions.map(pat => (
                          <div
                            key={pat.id}
                            onClick={() => {
                              setSelectedPatient(pat);
                              setCurrentActivePatient(pat);
                            }}
                            style={{
                              padding: '8px 12px',
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.82rem',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#1e293b'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div>
                              <strong style={{ color: '#f8fafc' }}>{pat.civility || ''} {pat.nom} {pat.prenom}</strong>
                              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                                📁 Fiche : <span style={{ color: '#38bdf8' }}>{pat.numfch || pat.id}</span>
                                {pat.birthdate && ` • 🎂 ${pat.birthdate}`}
                                {pat.cin && ` • 🪪 CIN : ${pat.cin}`}
                              </div>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>Sélectionner →</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tri du Bloc Patient sous forme de Liste Déroulante */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap'
                  }}>
                    <label htmlFor="patientSortSelect" style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>⇅</span> Trier par :
                    </label>
                    <select
                      id="patientSortSelect"
                      value={sortOrder}
                      onChange={(e) => handleSortChange(e.target.value)}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '8px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        color: '#38bdf8',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        outline: 'none',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                      }}
                    >
                      <option value="numfch">📁 Numéro de fiche</option>
                      <option value="nom">🔤 Nom</option>
                      <option value="prenom">👤 Prénom</option>
                      <option value="consultation">📅 Date de consultation</option>
                      <option value="birthdate">🎂 Date de naissance</option>
                    </select>
                  </div>

                  {/* Compteur et sélection */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-end', gap: '12px', fontSize: '0.85rem', color: '#94a3b8' }}>
                    {selectedPatientIds.length > 0 && (
                      <span style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600
                      }}>
                        {selectedPatientIds.length} sélectionné(s)
                      </span>
                    )}
                    <span>
                      Total fiches : <strong style={{ color: '#38bdf8' }}>{sortedPatients.length}</strong>
                      {searchQuery && <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '4px' }}>/{patients.length}</span>}
                    </span>
                  </div>
                </div>

                {/* Affichage Réactif : Fiches Tactiles (Mobile) OU Tableau Exhaustif (Desktop) */}
                {isMobile ? (
                  /* ================================================= */
                  /* AFFICHAGE CARTES TACTILES POUR MOBILE (Android / iPhone) */
                  /* ================================================= */
                  <div
                    id="patient-mobile-list-container"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      maxHeight: 'calc(100vh - 270px)',
                      overflowY: 'auto',
                      paddingRight: '2px'
                    }}
                  >
                    {loading ? (
                      <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                        Chargement des dossiers patients...
                      </div>
                    ) : sortedPatients.length === 0 ? (
                      <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', background: '#0f172a', borderRadius: '12px' }}>
                        Aucun dossier patient ne correspond à votre recherche.
                      </div>
                    ) : (
                      <>
                        {sortedPatients.map(p => (
                        <div
                          key={p.id}
                          onClick={() => { setSelectedPatient(p); setCurrentActivePatient(p); }}
                          style={{
                            background: selectedPatientIds.includes(p.id) ? 'rgba(56, 189, 248, 0.1)' : '#0f172a',
                            border: `1.5px solid ${selectedPatientIds.includes(p.id) ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
                            borderRadius: '12px',
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {/* Ligne 1 : Checkbox + Identité + APCI */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input
                                type="checkbox"
                                checked={selectedPatientIds.includes(p.id)}
                                onChange={() => toggleSelectPatient(p.id)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ width: '18px', height: '18px', accentColor: '#0284c7', cursor: 'pointer' }}
                              />
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
                                  {(p.civility && !/mari|celib|veuf|divorc/i.test(p.civility))
                                    ? p.civility
                                    : (p.gender === 'F' ? ((p.etat_civil === 'Célibataire' || /celib/i.test(p.civility || '')) ? 'Mlle' : 'Mme') : 'M.')
                                  } {p.nom.toUpperCase()} {p.prenom}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>N° {p.numfch || p.id}</span>
                                  {p.birthdate && <span>• Né(e) {p.birthdate}</span>}
                                  {p.etat_civil && p.etat_civil !== 'Célibataire' && (
                                    <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '1px 5px', borderRadius: '4px' }}>
                                      💍 {p.etat_civil}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {p.apci && (
                              <span style={{
                                background: 'rgba(234, 179, 8, 0.15)',
                                color: '#facc15',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                whiteSpace: 'nowrap'
                              }}>
                                APCI {p.apci}
                              </span>
                            )}
                          </div>

                          {/* Ligne 2 : Téléphone (Lien appel direct iPhone/Android) + CNAM */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontSize: '0.8rem' }}>
                            {p.telephone ? (
                              <a
                                href={`tel:${p.telephone.replace(/\s+/g, '')}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  color: '#38bdf8',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'rgba(56, 189, 248, 0.1)',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontWeight: 500
                                }}
                              >
                                📞 {p.telephone}
                              </a>
                            ) : (
                              <span style={{ color: '#64748b' }}>Sans tél</span>
                            )}

                            {p.cnamid ? (
                              <span style={{ color: '#94a3b8' }}>
                                🏛️ {p.caisse || 'CNAM'} • <strong style={{ color: '#cbd5e1' }}>{p.cnamid}</strong>
                              </span>
                            ) : (
                              <span style={{ color: '#64748b' }}>Sans CNAM</span>
                            )}
                          </div>

                          {/* Ligne 3 : Actions rapides optimisées pour le pouce */}
                          <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => { setSelectedPatient(p); setCurrentActivePatient(p); }}
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                color: '#fff',
                                border: 'none',
                                fontWeight: 600,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px'
                              }}
                            >
                              <span>📋</span> Dossier
                            </button>

                            <button
                              onClick={() => handleAddPatientToWaiting(p)}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                background: 'rgba(56, 189, 248, 0.15)',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                color: '#38bdf8',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                              title="Ajouter en salle d'attente"
                            >
                              ⏱️ Attente
                            </button>

                            <button
                              onClick={() => handleDeletePatient(p.id)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '8px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: 'none',
                                color: '#f87171',
                                fontSize: '0.82rem',
                                cursor: 'pointer'
                              }}
                              title="Supprimer"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Pied de liste Mobile avec compteur et bouton retour haut */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        background: '#1e293b',
                        borderRadius: '10px',
                        fontSize: '0.82rem',
                        color: '#94a3b8',
                        marginTop: '4px'
                      }}>
                        <span>Total : <strong style={{ color: '#38bdf8' }}>{sortedPatients.length}</strong> patient(s)</span>
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById('patient-mobile-list-container');
                            if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            color: '#38bdf8',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          ▲ Haut
                        </button>
                      </div>
                    </>
                    )}
                  </div>
                ) : (
                  /* ================================================= */
                  /* TABLEAU POUR DESKTOP (Windows, macOS, Grand écran) */
                  /* ================================================= */
                  <div
                    id="patient-desktop-list-container"
                    style={{
                      background: '#0f172a',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      maxHeight: 'calc(100vh - 270px)',
                      overflowY: 'auto',
                      position: 'relative'
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1e293b', boxShadow: '0 2px 6px rgba(0,0,0,0.35)' }}>
                        <tr style={{ background: '#1e293b', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                          <th style={{ padding: '14px 16px', width: '38px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={sortedPatients.length > 0 && selectedPatientIds.length === sortedPatients.length}
                              onChange={toggleSelectAll}
                              title="Tout sélectionner"
                              style={{ cursor: 'pointer', accentColor: '#0284c7' }}
                            />
                          </th>
                          <th style={{ padding: '14px 16px', fontWeight: 600 }}>N° Fiche</th>
                          <th style={{ padding: '14px 16px', fontWeight: 600 }}>Patient</th>
                          <th style={{ padding: '14px 16px', fontWeight: 600 }}>Téléphone</th>
                          <th style={{ padding: '14px 16px', fontWeight: 600 }}>Couverture CNAM</th>
                          <th style={{ padding: '14px 16px', fontWeight: 600 }}>APCI</th>
                          <th style={{ padding: '14px 16px', fontWeight: 600 }}>Dernière Visite</th>
                          <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                              Chargement des dossiers patients...
                            </td>
                          </tr>
                        ) : sortedPatients.length === 0 ? (
                          <tr>
                            <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                              Aucun dossier patient ne correspond à votre recherche.
                            </td>
                          </tr>
                        ) : (
                          sortedPatients.map(p => (
                            <tr
                              key={p.id}
                              onClick={() => { setSelectedPatient(p); setCurrentActivePatient(p); }}
                              style={{
                                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                background: selectedPatientIds.includes(p.id) ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                                transition: 'background 0.2s',
                                cursor: 'pointer'
                              }}
                              onMouseEnter={(e) => {
                                if (!selectedPatientIds.includes(p.id)) e.currentTarget.style.background = 'rgba(56, 189, 248, 0.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = selectedPatientIds.includes(p.id) ? 'rgba(56, 189, 248, 0.08)' : 'transparent';
                              }}
                            >
                              <td style={{ padding: '14px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedPatientIds.includes(p.id)}
                                  onChange={() => toggleSelectPatient(p.id)}
                                  style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#0284c7' }}
                                />
                              </td>
                              <td style={{ padding: '14px 16px', color: '#38bdf8', fontWeight: 500 }}>
                                {p.numfch || '-'}
                              </td>
                              <td style={{ padding: '14px 16px', fontWeight: 600, color: '#f8fafc' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span>
                                    {(p.civility && !/mari|celib|veuf|divorc/i.test(p.civility))
                                      ? p.civility
                                      : (p.gender === 'F' ? ((p.etat_civil === 'Célibataire' || /celib/i.test(p.civility || '')) ? 'Mlle' : 'Mme') : 'M.')
                                    } {p.nom.toUpperCase()} {p.prenom}
                                  </span>
                                  {p.etat_civil && p.etat_civil !== 'Célibataire' && (
                                    <span style={{
                                      fontSize: '0.72rem',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: 'rgba(56, 189, 248, 0.12)',
                                      color: '#38bdf8',
                                      fontWeight: 500
                                    }}>
                                      💍 {p.etat_civil}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '14px 16px', color: '#cbd5e1' }}>
                                {p.telephone || '-'}
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                {p.cnamid ? (
                                  <span style={{
                                    background: 'rgba(56, 189, 248, 0.1)',
                                    color: '#38bdf8',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem'
                                  }}>
                                    {p.caisse} • {p.cnamid}
                                  </span>
                                ) : (
                                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Sans CNAM</span>
                                )}
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                {p.apci ? (
                                  <span style={{
                                    background: 'rgba(234, 179, 8, 0.15)',
                                    color: '#facc15',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    fontWeight: 500
                                  }}>
                                    APCI {p.apci}
                                  </span>
                                ) : (
                                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>-</span>
                                )}
                              </td>
                              <td style={{ padding: '14px 16px', color: '#94a3b8' }}>
                                {p.derniere_visite || '-'}
                              </td>
                              <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedPatient(p); setCurrentActivePatient(p); }}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    background: '#0284c7',
                                    border: 'none',
                                    color: '#fff',
                                    fontWeight: 500,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    marginRight: '6px'
                                  }}
                                >
                                  📋 Ouvrir
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeletePatient(p.id); }}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    border: 'none',
                                    color: '#f87171',
                                    fontWeight: 500,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer'
                                  }}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Barre de pied sticky avec statistiques et bouton retour en haut */}
                    <div style={{
                      position: 'sticky',
                      bottom: 0,
                      background: '#1e293b',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      padding: '10px 18px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.82rem',
                      color: '#94a3b8',
                      zIndex: 5
                    }}>
                      <div>
                        Affichage de <strong style={{ color: '#38bdf8' }}>{sortedPatients.length}</strong> patient(s)
                        {searchQuery && <span> sur <strong style={{ color: '#fff' }}>{patients.length}</strong></span>} • Trié par : <strong style={{ color: '#fff' }}>{sortOrder === 'consultation' ? 'Date de consultation (récentes en premier)' : sortOrder === 'nom' ? 'Nom alphabétique (A-Z)' : 'Prénom alphabétique (A-Z)'}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById('patient-desktop-list-container');
                          if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#38bdf8',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ▲ Haut de page
                      </button>
                    </div>
                  </div>
                )}

                {/* Barre Flottante d'action lors de la sélection multiple */}
                {selectedPatientIds.length >= 2 && (
                  <div style={{
                    position: 'fixed',
                    bottom: isMobile ? 'calc(72px + env(safe-area-inset-bottom, 0px))' : '28px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#0f172a',
                    border: '1.5px solid #38bdf8',
                    borderRadius: '14px',
                    padding: isMobile ? '10px 16px' : '12px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '10px' : '18px',
                    boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.8), 0 0 20px rgba(56, 189, 248, 0.3)',
                    zIndex: 9999,
                    width: isMobile ? 'calc(100% - 24px)' : 'auto',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: isMobile ? '0.85rem' : '0.95rem' }}>
                      ✓ <strong>{selectedPatientIds.length}</strong> {isMobile ? 'fiches' : 'dossiers sélectionnés'}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleOpenMergeSelected}
                        style={{
                          padding: isMobile ? '8px 12px' : '9px 18px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          color: '#fff',
                          border: 'none',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                          fontSize: isMobile ? '0.8rem' : '0.9rem'
                        }}
                      >
                        <span>🔀</span> Fusionner
                      </button>
                      <button
                        onClick={() => setSelectedPatientIds([])}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {activeTab === 'waiting' && (
            <WaitingRoomView 
              onStartConsultation={(entry) => {
                const pat = patients.find(p => String(p.id) === String(entry.patientId));
                setCurrentActivePatient(pat || null);
                setConsultationTargetPatient(pat || null);
                setConsultationWaitingEntry(entry);
                setActiveTab('consultation');
              }} 
              onNewPatient={handleOpenAddModal}
            />
          )}

          {activeTab === 'agenda' && (
            <AgendaView 
              onNewPatient={handleOpenAddModal}
              initialPatient={appointmentTargetPatient}
              returnToConsultation={Boolean(pendingConsultationReturn)}
              onReturnToConsultation={() => {
                if (pendingConsultationReturn) {
                  setConsultationToEdit(pendingConsultationReturn);
                  setConsultationTargetPatient(pendingConsultationReturn.patient || appointmentTargetPatient);
                }
                setPendingConsultationReturn(null);
                setAppointmentTargetPatient(null);
                setActiveTab('consultation');
              }}
              onNavigateToSms={() => {
                setSelectedTool('sms');
                setActiveTab('tools');
              }}
            />
          )}

          {activeTab === 'consultation' && (
            <ConsultationView 
              initialPatient={consultationTargetPatient || currentActivePatient}
              waitingEntry={consultationWaitingEntry}
              consultationToEdit={consultationToEdit}
              onPatientChange={(pat) => {
                setCurrentActivePatient(pat);
                setPrescriptionTargetPatient(pat);
                setBillingTargetPatient(pat);
                setAppointmentTargetPatient(pat);
              }}
              onOpenPrescription={(pat, consult) => {
                setCurrentActivePatient(pat);
                setPrescriptionTargetPatient(pat);
                setPrescriptionTargetConsultation(consult);
                setConsultationToEdit(consult);
                setActiveTab('prescriptions');
              }}
              onOpenBilling={(pat, consult) => {
                setCurrentActivePatient(pat);
                setBillingTargetPatient(pat);
                setBillingTargetConsultation(consult);
                setConsultationToEdit(consult);
                setActiveTab('billing');
              }}
              onOpenAppointment={(pat, consult) => {
                setCurrentActivePatient(pat);
                setAppointmentTargetPatient(pat);
                setConsultationToEdit(consult);
                setPendingConsultationReturn(consult);
                setActiveTab('agenda');
              }}
              onRequirePayment={(unsettled) => {
                setUnsettledConsultationState(unsettled);
                setShowPaymentModal(true);
                setConsultationTargetPatient(null);
                setConsultationWaitingEntry(null);
                setConsultationToEdit(null);
                setPendingConsultationReturn(null);
                setAppointmentTargetPatient(null);
                refreshPatients();
              }}
              onFinished={() => {
                setConsultationTargetPatient(null);
                setConsultationWaitingEntry(null);
                setConsultationToEdit(null);
                setPendingConsultationReturn(null);
                setAppointmentTargetPatient(null);
                refreshPatients();
                setActiveTab('patients');
              }}
            />
          )}

          {activeTab === 'prescriptions' && (
            <PrescriptionView
              initialPatient={prescriptionTargetPatient || currentActivePatient}
              initialConsultation={prescriptionTargetConsultation}
              onFinished={() => {
                if (prescriptionTargetConsultation) {
                  // Retour direct et fluide à la consultation active
                  setConsultationToEdit(prescriptionTargetConsultation);
                  setPrescriptionTargetConsultation(null);
                  setActiveTab('consultation');
                } else {
                  setPrescriptionTargetPatient(null);
                  setPrescriptionTargetConsultation(null);
                  setActiveTab('patients');
                }
              }}
            />
          )}

          {activeTab === 'billing' && (
            <BillingView
              initialPatient={billingTargetPatient || currentActivePatient}
              initialConsultation={billingTargetConsultation}
              isMobile={isMobile}
              onFinished={() => {
                if (billingTargetConsultation) {
                  // Retour direct et fluide à la consultation active
                  setConsultationToEdit(billingTargetConsultation);
                  setBillingTargetConsultation(null);
                  setActiveTab('consultation');
                } else {
                  setBillingTargetPatient(null);
                  setBillingTargetConsultation(null);
                  setActiveTab('patients');
                }
              }}
            />
          )}

          {activeTab === 'tools' && (
            <OutilsView
              initialTool={selectedTool}
              onToolChange={(tool) => setSelectedTool(tool)}
              currentPatient={currentActivePatient}
              allPatients={patients}
              onOpenConsultation={(pat) => {
                setCurrentActivePatient(pat);
                setConsultationTargetPatient(pat);
                setActiveTab('consultation');
              }}
            />
          )}

          {activeTab === 'directory' && (
            <DirectoryView
              patients={patients}
              initialSelectedPatient={selectedPatient || currentActivePatient}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              initialTab={settingsActiveTab}
              onDataRestored={() => refreshPatients()}
            />
          )}
        </div>

        {/* Barre de Navigation Inférieure Mobile (iOS / Android Bottom Bar) */}
        {isMobile && (
          <nav
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              background: 'rgba(15, 23, 42, 0.96)',
              backdropFilter: 'blur(16px)',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              zIndex: 9000,
              boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.45)'
            }}
          >
            <button
              onClick={() => handleNavTabClick('patients', () => setSelectedPatient(null))}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === 'patients' ? '#38bdf8' : '#94a3b8',
                padding: '6px 0',
                transition: 'color 0.15s ease'
              }}
            >
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>👥</span>
              <span style={{ fontSize: '0.7rem', fontWeight: activeTab === 'patients' ? 700 : 500 }}>Patients</span>
            </button>

            <button
              onClick={() => handleNavTabClick('waiting', () => setSelectedPatient(null))}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === 'waiting' ? '#38bdf8' : '#94a3b8',
                padding: '6px 0',
                transition: 'color 0.15s ease'
              }}
            >
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>⏱️</span>
              <span style={{ fontSize: '0.7rem', fontWeight: activeTab === 'waiting' ? 700 : 500 }}>Attente</span>
            </button>

            <button
              onClick={() => handleNavTabClick('agenda', () => setSelectedPatient(null))}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === 'agenda' ? '#38bdf8' : '#94a3b8',
                padding: '6px 0',
                transition: 'color 0.15s ease'
              }}
            >
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>📅</span>
              <span style={{ fontSize: '0.7rem', fontWeight: activeTab === 'agenda' ? 700 : 500 }}>Agenda</span>
            </button>

            <button
              onClick={() => handleNavTabClick('consultation')}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === 'consultation' ? '#38bdf8' : '#94a3b8',
                padding: '6px 0',
                transition: 'color 0.15s ease'
              }}
            >
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>🩺</span>
              <span style={{ fontSize: '0.7rem', fontWeight: activeTab === 'consultation' ? 700 : 500 }}>Consult</span>
            </button>

            <button
              onClick={() => setMobileDrawerOpen(true)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: mobileDrawerOpen ? '#38bdf8' : '#94a3b8',
                padding: '6px 0',
                transition: 'color 0.15s ease'
              }}
            >
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>☰</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>Menu</span>
            </button>
          </nav>
        )}
      </main>

      {/* Modal Ajout / Modification Patient */}
      {/* Modal Ajout / Modification Patient avec Détection Anti-Doublon Active */}
      {showModal && (
        <PatientModal
          patient={editingPatient}
          existingPatients={patients}
          onClose={() => { setShowModal(false); setEditingPatient(null); }}
          onSave={handleSavePatient}
          onSwitchToExisting={(foundPatient) => {
            setShowModal(false);
            setEditingPatient(null);
            setSelectedPatient(foundPatient);
            setCurrentActivePatient(foundPatient);
            setConsultationTargetPatient(foundPatient);
            setConsultationWaitingEntry(null);
            setConsultationToEdit(null);
            setActiveTab('consultation');
            setSyncBanner({
              type: 'success',
              message: `✓ Fiche de ${foundPatient.nom} ${foundPatient.prenom} ouverte pour consultation médicale.`,
              time: Date.now()
            });
            setTimeout(() => setSyncBanner(null), 5000);
          }}
        />
      )}

      {/* Modal Traitement Groupé de Tous les Doublons */}
      {showBatchDuplicatesModal && (
        <DuplicateBatchModal
          duplicateGroups={duplicateGroups}
          onClose={() => setShowBatchDuplicatesModal(false)}
          onMerged={async () => {
            setShowBatchDuplicatesModal(false);
            setSelectedPatientIds([]);
            await refreshPatients(searchQuery);
            setSyncBanner({
              type: 'success',
              message: `✓ Nettoyage terminé : tous les doublons sélectionnés ont été fusionnés sans perte.`,
              time: Date.now()
            });
            setTimeout(() => setSyncBanner(null), 6000);
          }}
        />
      )}

      {/* Modal Premier Lancement : Configuration du Dossier de Sauvegarde Local */}
      {showFolderSetup && (
        <BackupFolderSetupModal
          onClose={() => setShowFolderSetup(false)}
          onConfigured={() => setShowFolderSetup(false)}
        />
      )}

      {/* Modal Fusion / Merge Manuel de Fiches Patients (Sélection unitaire) */}
      {mergeModalData && (
        <PatientMergeModal
          initialTargetPatient={mergeModalData.target}
          initialSourcePatients={mergeModalData.sources || []}
          duplicateGroup={mergeModalData.group}
          onClose={() => setMergeModalData(null)}
          onMerged={async ({ targetPatient: tp }) => {
            setMergeModalData(null);
            setSelectedPatientIds([]);
            await refreshPatients(searchQuery);
            if (selectedPatient) {
              setSelectedPatient(tp);
            }
          }}
        />
      )}

      {/* Fenêtre Flottante de Règlement de Consultation (Aucun paiement ne sera oublié) */}
      {showPaymentModal && unsettledConsultation && (
        <UnsettledConsultationModal
          unsettledData={unsettledConsultation}
          onSettled={(invoice) => {
            clearUnsettledConsultation();
            setUnsettledConsultationState(null);
            setShowPaymentModal(false);
            setSyncBanner({
              type: 'success',
              message: `✓ Règlement enregistré avec succès (Réf: ${invoice.numFacture || 'FAC'}). Clôture validée !`,
              time: Date.now()
            });
            setTimeout(() => setSyncBanner(null), 5000);
            refreshPatients();
          }}
          onOpenFullBilling={() => {
            setShowPaymentModal(false);
            const pat = patients.find(p => String(p.id) === String(unsettledConsultation.patientId));
            if (pat) {
              setCurrentActivePatient(pat);
              setBillingTargetPatient(pat);
            }
            setBillingTargetConsultation({ id: unsettledConsultation.consultationId });
            setActiveTab('billing');
          }}
          onDismissTemporarily={() => {
            setShowPaymentModal(false);
          }}
        />
      )}

      {/* Rappel Flottant Permanent si consultation en attente de règlement */}
      {unsettledConsultation && !showPaymentModal && (
        <div
          onClick={() => setShowPaymentModal(true)}
          style={{
            position: 'fixed',
            bottom: isMobile ? 'calc(70px + env(safe-area-inset-bottom, 0px))' : '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
            border: '2px solid #c084fc',
            borderRadius: '30px',
            padding: isMobile ? '8px 14px' : '10px 22px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(168, 85, 247, 0.5)',
            cursor: 'pointer',
            zIndex: 99990,
            maxWidth: '92vw'
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <span style={{ fontSize: isMobile ? '0.78rem' : '0.88rem', fontWeight: 700 }}>
            Consultation de <u>{unsettledConsultation.patientName}</u> en attente de règlement !
          </span>
          <span style={{
            background: '#fff',
            color: '#7c3aed',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: isMobile ? '0.7rem' : '0.78rem',
            fontWeight: 800,
            whiteSpace: 'nowrap'
          }}>
            Régler (Gratuit / Payant)
          </span>
        </div>
      )}

      {/* Modal Multi-Praticiens : Gestion & Bascule de Médecin */}
      <PractitionerSwitchModal
        isOpen={showPractitionerModal}
        onClose={() => setShowPractitionerModal(false)}
        onPractitionerSwitched={(newDoc) => {
          setActivePractitioner(newDoc);
          setDoctorName(newDoc.nom ? `${newDoc.prenom || ''} ${newDoc.nom}`.trim() : 'Hamed BEN KHALIFA');
          setSelectedPatient(null);
          refreshPatients();
        }}
      />
    </div>
  );
}
