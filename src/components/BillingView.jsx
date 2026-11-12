import React, { useState, useEffect } from 'react';
import {
  getAllPatients,
  getAllInvoices,
  saveInvoice,
  deleteInvoiceById,
  getPendingCnamInvoices,
  getAllBordereaux,
  saveBordereau,
  deleteBordereauById,
  parseCnamBordereauTxt,
  clearUnsettledConsultation
} from '../services/patientStorage';
import { generateReceiptReport } from '../services/receiptReportGenerator';
import { generateCnamBordereauReport, exportCnamBordereauCSV } from '../services/cnamBordereauGenerator';
import actesData from '../data/actesMedicaux.json';
import { APCI_LIST } from '../constants/medicalConstants';
import historicalBordereaux from '../data/historicalBordereaux.json';

export default function BillingView({ initialPatient = null, initialConsultation = null, onFinished = null, isMobile: isMobileProp = undefined }) {
  const [activeTab, setActiveTab] = useState('encaissement'); // 'encaissement' | 'bordereaux' | 'journal'
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(initialPatient || null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const checkMobile = () => {
    if (isMobileProp !== undefined) return isMobileProp;
    if (typeof window === 'undefined') return false;
    const isSmall = window.innerWidth < 1024;
    const isTouch = 'ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0);
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator?.userAgent || '');
    return isSmall || (isTouch && isMobileUA);
  };

  const [isMobile, setIsMobile] = useState(checkMobile);

  useEffect(() => {
    if (isMobileProp !== undefined) {
      setIsMobile(isMobileProp);
      return;
    }
    const handleResize = () => setIsMobile(checkMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileProp]);

  // Données de facturation courante
  const [modeReglement, setModeReglement] = useState('comptant'); // 'comptant' | 'cnam_mo' | 'cnam_apci'
  const [selectedActes, setSelectedActes] = useState([]);
  const [moyenPaiement, setMoyenPaiement] = useState('especes'); // 'especes' | 'cheque' | 'virement' | 'tiers_payant'
  const [montantRecu, setMontantRecu] = useState('');
  const [observations, setObservations] = useState('');
  const [acteSearch, setActeSearch] = useState('');

  // Bordereaux CNAM
  const [cnamSubTab, setCnamSubTab] = useState('archives'); // 'archives' | 'nouveau'
  const [viewingBordereau, setViewingBordereau] = useState(null);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [bordereauxList, setBordereauxList] = useState([]);
  const [bordereauSearch, setBordereauSearch] = useState('');
  const [bordereauYearFilter, setBordereauYearFilter] = useState('TOUS');
  const [caisseFilter, setCaisseFilter] = useState('TOUTES');
  const [typeFilter, setTypeFilter] = useState('TOUS');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  // Journal de caisse & Factures
  const [invoicesList, setInvoicesList] = useState([]);
  const [journalPeriod, setJournalPeriod] = useState('mois'); // 'jour' | 'semaine' | 'mois' | 'tout'

  // Charger les données initiales
  const refreshData = async () => {
    try {
      const pats = await getAllPatients();
      setPatients(pats);

      const invs = await getAllInvoices();
      setInvoicesList(invs);

      const pInvs = await getPendingCnamInvoices();
      setPendingInvoices(pInvs);
      setSelectedInvoiceIds(pInvs.map(i => i.id));

      const bords = await getAllBordereaux();
      setBordereauxList(bords);
    } catch (e) {
      console.error("Erreur chargement données facturation:", e);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Détection du mode par défaut selon le patient sélectionné
  useEffect(() => {
    if (initialPatient) {
      setSelectedPatient(initialPatient);
    }
  }, [initialPatient]);

  useEffect(() => {
    if (selectedPatient) {
      if (selectedPatient.apci && selectedPatient.apci !== 'AUCUNE' && selectedPatient.apci !== '') {
        setModeReglement('cnam_apci');
        setMoyenPaiement('tiers_payant');
      } else if (selectedPatient.filiere && selectedPatient.filiere.toLowerCase().includes('privée')) {
        setModeReglement('cnam_mo');
        setMoyenPaiement('especes');
      } else {
        setModeReglement('comptant');
        setMoyenPaiement('especes');
      }

      // Si aucun acte sélectionné, ajouter l'acte de consultation adapté par défaut
      if (selectedActes.length === 0) {
        if (selectedPatient.apci && selectedPatient.apci !== 'AUCUNE') {
          addActeByCode('C_APCI');
        } else if (selectedPatient.filiere && selectedPatient.filiere.toLowerCase().includes('privée')) {
          addActeByCode('C_MO');
        } else {
          addActeByCode('C_COMPTANT');
        }
      }
    }
  }, [selectedPatient]);

  // Ajouter un acte par son code ou son objet
  const addActe = (acte) => {
    // Calculer les montants selon le mode de règlement actif
    let montantGlobal = Number(acte.montantGlobal) || 40.0;
    let partCnam = Number(acte.partCnam) || 0.0;
    let partPatient = Number(acte.partPatient) || montantGlobal;

    if (modeReglement === 'comptant') {
      partCnam = 0.0;
      partPatient = montantGlobal;
    } else if (modeReglement === 'cnam_apci') {
      partCnam = montantGlobal;
      partPatient = 0.0;
    } else if (modeReglement === 'cnam_mo') {
      // Pour CNAM MO : Ticket modérateur (30% ou fixe)
      if (partCnam === 0 && montantGlobal >= 30) {
        partCnam = 21.0;
        partPatient = montantGlobal - partCnam;
      }
    } else if (modeReglement === 'gratuit') {
      partCnam = 0.0;
      partPatient = 0.0;
      montantGlobal = 0.0;
    }

    const newItem = {
      code: acte.code || 'ACTE',
      nom: acte.nom || 'Acte médical',
      specialite: acte.specialite || 'MEDECINE',
      montantGlobal,
      partCnam,
      partPatient,
      quantite: 1
    };

    setSelectedActes([...selectedActes, newItem]);
    setActeSearch('');
  };

  const addActeByCode = (code) => {
    const found = actesData.find(a => a.code === code);
    if (found) {
      addActe(found);
    } else {
      // Fallback
      addActe({
        code,
        nom: 'Consultation Médicale',
        montantGlobal: 40.0,
        partCnam: 0.0,
        partPatient: 40.0
      });
    }
  };

  const removeActe = (index) => {
    const updated = selectedActes.filter((_, idx) => idx !== index);
    setSelectedActes(updated);
  };

  // Mettre à jour les quotes-parts si le mode de règlement change
  const handleModeReglementChange = (newMode) => {
    setModeReglement(newMode);
    if (newMode === 'cnam_apci') {
      setMoyenPaiement('tiers_payant');
    } else if (newMode === 'gratuit') {
      setMoyenPaiement('gratuit');
      setMontantRecu('0');
    } else if (moyenPaiement === 'tiers_payant' || moyenPaiement === 'gratuit') {
      setMoyenPaiement('especes');
    }

    // Réajuster les actes déjà sélectionnés
    const updated = selectedActes.map(a => {
      let partCnam = 0.0;
      let partPatient = a.montantGlobal;
      if (newMode === 'cnam_apci') {
        partCnam = a.montantGlobal;
        partPatient = 0.0;
      } else if (newMode === 'cnam_mo') {
        partCnam = Math.min(a.montantGlobal, 21.0);
        partPatient = Math.max(0, a.montantGlobal - partCnam);
      } else if (newMode === 'gratuit') {
        partCnam = 0.0;
        partPatient = 0.0;
      }
      return { ...a, partCnam, partPatient };
    });
    setSelectedActes(updated);
  };

  // Calcul des totaux
  const totalGlobal = selectedActes.reduce((acc, a) => acc + (a.montantGlobal * (a.quantite || 1)), 0);
  const totalPartCnam = selectedActes.reduce((acc, a) => acc + (a.partCnam * (a.quantite || 1)), 0);
  const totalPartPatient = selectedActes.reduce((acc, a) => acc + (a.partPatient * (a.quantite || 1)), 0);

  const numMontantRecu = parseFloat(montantRecu) || 0;
  const monnaieRendue = numMontantRecu > totalPartPatient ? numMontantRecu - totalPartPatient : 0;

  // Enregistrer le règlement
  const handleSaveInvoice = async (andPrint = false) => {
    if (!selectedPatient) {
      alert("Veuillez sélectionner un patient.");
      return;
    }
    if (selectedActes.length === 0) {
      alert("Veuillez ajouter au moins un acte ou une consultation.");
      return;
    }

    const newInvoice = {
      date: new Date().toISOString().split('T')[0],
      patientId: selectedPatient.id,
      patientName: selectedPatient.fullname || (selectedPatient.nom + ' ' + selectedPatient.prenom),
      patientCin: selectedPatient.cin || '',
      patientCnamId: selectedPatient.cnamid || '',
      patientCaisse: selectedPatient.caisse || 'CNSS',
      patientFiliere: selectedPatient.filiere || 'Privée',
      patientApci: selectedPatient.apci || '',
      patientApciLabel: selectedPatient.apciLabel || '',
      consultationId: initialConsultation?.id || null,
      modeReglement,
      actes: selectedActes,
      totalGlobal,
      partPatient: totalPartPatient,
      partCnam: totalPartCnam,
      moyenPaiement,
      montantRecu: numMontantRecu || totalPartPatient,
      monnaieRendue,
      estPaye: true,
      statutBordereau: totalPartCnam > 0 ? 'en_attente' : 'non_soumis',
      bordereauId: null,
      observations
    };

    try {
      const invId = await saveInvoice(newInvoice);
      clearUnsettledConsultation();
      alert(`✓ Quittance enregistrée avec succès ! (Réf: ${newInvoice.numFacture || 'FAC'})`);

      if (andPrint) {
        generateReceiptReport(selectedPatient, { ...newInvoice, id: invId });
      }

      // Réinitialiser
      setSelectedActes([]);
      setMontantRecu('');
      setObservations('');
      refreshData();

      if (initialConsultation && onFinished) {
        if (window.confirm("✓ Quittance enregistrée avec succès ! Souhaitez-vous retourner à la consultation en cours ?")) {
          onFinished();
        }
      }
    } catch (e) {
      alert("Erreur lors de l'enregistrement de la facture : " + e.message);
    }
  };

  // Suppression d'un paiement / facture
  const handleDeleteInvoice = async (invoiceOrId) => {
    let inv = typeof invoiceOrId === 'object' ? invoiceOrId : invoicesList.find(i => i.id === invoiceOrId);
    const num = inv?.numFacture || `FAC-${inv?.id || invoiceOrId}`;
    const pat = inv?.patientName || 'ce patient';
    const mtt = inv ? (inv.totalGlobal || 0).toFixed(3) + ' DT' : '';

    let msg = `Êtes-vous certain de vouloir supprimer définitivement le paiement N° ${num} de ${pat} (${mtt}) ?`;
    if (inv?.bordereauId) {
      msg += `\n\n⚠️ Attention : Ce paiement est rattaché au bordereau N° ${inv.bordereauId}. Sa suppression mettra automatiquement à jour le montant et les lignes du bordereau.`;
    }

    if (window.confirm(msg)) {
      try {
        await deleteInvoiceById(inv ? inv.id : invoiceOrId);
        alert(`✓ Le paiement N° ${num} a été supprimé avec succès.`);
        await refreshData();
      } catch (err) {
        alert("Erreur lors de la suppression du paiement : " + err.message);
      }
    }
  };

  // Génération d'un Bordereau CNAM
  const handleCreateBordereau = async () => {
    const selectedInvoices = pendingInvoices.filter(inv => selectedInvoiceIds.includes(inv.id));
    if (selectedInvoices.length === 0) {
      alert("Veuillez cocher au moins une consultation CNAM pour générer le bordereau.");
      return;
    }

    const year = new Date().getFullYear();
    const count = bordereauxList.length + 1;
    const numBordereau = `BORD-CNAM-${year}-${String(count).padStart(3, '0')}`;

    // Construire les lignes détaillées conformes au format CNAM
    const lignes = [];
    selectedInvoices.forEach(inv => {
      (inv.actes || []).forEach(acte => {
        lignes.push({
          factureId: inv.id,
          date: inv.date,
          patientName: inv.patientName,
          cnamId: inv.patientCnamId,
          quality: 'Assuré(e)',
          apci: inv.patientApci || '',
          codeActe: acte.code === 'C_APCI' || acte.code === 'C_MO' ? 'C' : acte.code,
          nomActe: acte.nom,
          montantGlobal: acte.montantGlobal,
          partPatient: acte.partPatient,
          partCnam: acte.partCnam
        });
      });
    });

    const montantTotalGlobal = lignes.reduce((acc, l) => acc + (l.montantGlobal || 0), 0);
    const montantTotalPatient = lignes.reduce((acc, l) => acc + (l.partPatient || 0), 0);
    const montantTotalCnam = lignes.reduce((acc, l) => acc + (l.partCnam || 0), 0);

    const dates = selectedInvoices.map(i => i.date).sort();

    const docProf = JSON.parse(localStorage.getItem('docpocket_doctor_profile') || '{}');
    const medecinNom = docProf.nom ? `Dr. ${docProf.nom}` : 'Dr. Hamed BEN KHALIFA';
    const medecinCnamId = docProf.cnamId || '010002763183';

    const newBordereau = {
      numBordereau,
      dateCreation: new Date().toISOString().split('T')[0],
      periodeDebut: dates[0] || new Date().toISOString().split('T')[0],
      periodeFin: dates[dates.length - 1] || new Date().toISOString().split('T')[0],
      medecinNom,
      medecinCnamId,
      caisse: caisseFilter,
      typeBordereau: typeFilter,
      facturesIds: selectedInvoiceIds,
      lignes,
      totalFactures: selectedInvoices.length,
      totalActes: lignes.length,
      montantTotalGlobal,
      montantTotalPatient,
      montantTotalCnam,
      statut: 'genere',
      dateDepot: null,
      dateReglement: null,
      referenceVirement: '',
      observations: `Bordereau de ${selectedInvoices.length} dossier(s) généré automatiquement.`
    };

    try {
      await saveBordereau(newBordereau);
      alert(`✓ Bordereau CNAM ${numBordereau} généré avec succès ! (${lignes.length} actes, Total CNAM: ${montantTotalCnam.toFixed(3)} DT)`);
      generateCnamBordereauReport(newBordereau);
      refreshData();
    } catch (e) {
      alert("Erreur lors de la création du bordereau : " + e.message);
    }
  };

  const handleUpdateBordereauStatus = async (bord, newStatus) => {
    const updated = { ...bord, statut: newStatus };
    if (newStatus === 'depose') {
      updated.dateDepot = new Date().toISOString().split('T')[0];
    } else if (newStatus === 'regle') {
      updated.dateReglement = new Date().toISOString().split('T')[0];
      const ref = window.prompt("Référence ou N° de virement CNAM (optionnel) :", updated.referenceVirement || 'VIR-CNAM-');
      if (ref !== null) updated.referenceVirement = ref;
    }
    await saveBordereau(updated);
    refreshData();
  };

  const handleDeleteBordereau = async (id) => {
    if (window.confirm("Êtes-vous certain de vouloir annuler ce bordereau ? Les consultations associées redeviendront en attente.")) {
      await deleteBordereauById(id);
      refreshData();
    }
  };

  // Import de fichiers bordereaux d'archives télétransmission CNAM (.txt)
  const handleImportTxtBordereaux = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    let imported = 0;
    let errors = 0;
    const existingNums = new Set(bordereauxList.map(b => b.numBordereau));

    for (const file of files) {
      try {
        const text = await file.text();
        const parsed = parseCnamBordereauTxt(text, file.name);
        if (!existingNums.has(parsed.numBordereau)) {
          await saveBordereau(parsed);
          existingNums.add(parsed.numBordereau);
          imported++;
        }
      } catch (err) {
        console.error("Erreur import bordereau:", file.name, err);
        errors++;
      }
    }

    if (imported > 0) {
      alert(`✓ ${imported} bordereau(x) CNAM importé(s) avec succès !`);
      await refreshData();
    } else if (errors > 0) {
      alert(`⚠️ Erreur lors de la lecture de ${errors} fichier(s). Vérifiez le format télétransmission CNAM.`);
    } else {
      alert("ℹ️ Aucun nouveau bordereau importé (les fichiers sélectionnés existent déjà dans l'historique).");
    }
    e.target.value = '';
  };

  // Filtrage du Journal de Caisse
  const now = new Date();
  const filteredInvoices = invoicesList.filter(inv => {
    if (!inv.date) return false;
    const invDate = new Date(inv.date);
    if (journalPeriod === 'jour') {
      return inv.date === now.toISOString().split('T')[0];
    } else if (journalPeriod === 'semaine') {
      const diffDays = (now - invDate) / (1000 * 60 * 60 * 24);
      return diffDays <= 7 && diffDays >= 0;
    } else if (journalPeriod === 'mois') {
      return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const kpiTotalPatient = filteredInvoices.reduce((acc, i) => acc + (Number(i.partPatient) || 0), 0);
  const kpiTotalCnam = filteredInvoices.reduce((acc, i) => acc + (Number(i.partCnam) || 0), 0);
  const kpiTotalChiffreAffaires = filteredInvoices.reduce((acc, i) => acc + (Number(i.totalGlobal) || 0), 0);
  const kpiTotalActes = filteredInvoices.reduce((acc, i) => acc + (i.actes?.length || 1), 0);

  // Suggestions d'actes pour la recherche
  const actesFiltered = acteSearch.trim() === ''
    ? []
    : actesData.filter(a =>
        a.nom.toLowerCase().includes(acteSearch.toLowerCase()) ||
        a.code.toLowerCase().includes(acteSearch.toLowerCase()) ||
        (a.specialite && a.specialite.toLowerCase().includes(acteSearch.toLowerCase()))
      ).slice(0, 10);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '14px' : '20px',
      maxWidth: '100%',
      overflowX: 'hidden',
      boxSizing: 'border-box'
    }}>
      {/* Styles réactifs garantis pour tous smartphones et navigateurs */}
      <style>{`
        .billing-responsive-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
          width: 100%;
          box-sizing: border-box;
        }
        @media (max-width: 900px) {
          .billing-responsive-actions {
            flex-direction: column !important;
            justify-content: stretch !important;
          }
          .billing-responsive-actions button {
            width: 100% !important;
          }
          .billing-btn-print {
            order: 1 !important;
            padding: 14px 16px !important;
          }
          .billing-btn-save {
            order: 2 !important;
            padding: 13px 16px !important;
          }
          .billing-btn-reset {
            order: 3 !important;
            padding: 11px 14px !important;
          }
        }
        @media (min-width: 901px) {
          .billing-responsive-actions {
            flex-direction: row !important;
            justify-content: flex-end !important;
          }
          .billing-btn-print {
            order: 3;
            width: auto !important;
          }
          .billing-btn-save {
            order: 2;
            width: auto !important;
          }
          .billing-btn-reset {
            order: 1;
            width: auto !important;
          }
        }
      `}</style>

      {/* BANNIÈRE RATTACHÉE À LA CONSULTATION EN COURS */}
      {initialConsultation && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(109, 40, 217, 0.2) 100%)',
          border: '1.5px solid #7c3aed',
          padding: isMobile ? '10px 14px' : '12px 18px',
          borderRadius: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '10px',
          boxShadow: '0 4px 14px rgba(124, 58, 237, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🩺</span>
            <div>
              <div style={{ fontWeight: 700, color: '#c084fc', fontSize: '0.9rem' }}>
                Quittance & Facturation rattachées à la consultation du {initialConsultation.date || 'jour'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                Patient : <strong style={{ color: '#fff' }}>{selectedPatient ? (selectedPatient.fullname || `${selectedPatient.nom} ${selectedPatient.prenom}`) : ''}</strong>
                {initialConsultation.diagnostic && (
                  <span> • Diagnostic : <strong style={{ color: '#38bdf8' }}>{initialConsultation.diagnostic}</strong></span>
                )}
              </div>
            </div>
          </div>
          {onFinished && (
            <button
              type="button"
              onClick={onFinished}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: '#7c3aed',
                border: 'none',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(124, 58, 237, 0.4)'
              }}
              title="Revenir à l'examen clinique de la consultation"
            >
              <span>⬅️</span> Revenir à la Consultation
            </button>
          )}
        </div>
      )}
      {/* Navigation des Onglets du Module Facturation Adaptative */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px',
        background: '#1e293b',
        padding: isMobile ? '8px 10px' : '10px 16px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '6px' : '8px', width: isMobile ? '100%' : 'auto' }}>
          <button
            onClick={() => setActiveTab('encaissement')}
            style={{
              flex: isMobile ? 1 : 'none',
              padding: isMobile ? '8px 6px' : '9px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'encaissement' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
              color: activeTab === 'encaissement' ? '#fff' : '#94a3b8',
              fontWeight: activeTab === 'encaissement' ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              fontSize: isMobile ? '0.78rem' : '0.85rem'
            }}
          >
            <span>💳</span> {isMobile ? 'Encaissement' : 'Encaissement & Saisie'}
          </button>

          <button
            onClick={() => setActiveTab('bordereaux')}
            style={{
              flex: isMobile ? 1 : 'none',
              padding: isMobile ? '8px 6px' : '9px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'bordereaux' ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'transparent',
              color: activeTab === 'bordereaux' ? '#fff' : '#94a3b8',
              fontWeight: activeTab === 'bordereaux' ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              fontSize: isMobile ? '0.78rem' : '0.85rem'
            }}
          >
            <span>🏛️</span> Bordereaux
            {pendingInvoices.length > 0 && (
              <span style={{
                background: '#d97706',
                color: '#fff',
                fontSize: '0.7rem',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 800
              }}>
                {pendingInvoices.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('journal')}
            style={{
              flex: isMobile ? 1 : 'none',
              padding: isMobile ? '8px 6px' : '9px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'journal' ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' : 'transparent',
              color: activeTab === 'journal' ? '#fff' : '#94a3b8',
              fontWeight: activeTab === 'journal' ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              fontSize: isMobile ? '0.78rem' : '0.85rem'
            }}
          >
            <span>📊</span> Journal Finances
          </button>
        </div>

        {!isMobile && (
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            DocPocket Cab • Facturation
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* ONGLET 1 : ENCAISSEMENT & FACTURATION RAPIDE                   */}
      {/* ============================================================== */}
      {activeTab === 'encaissement' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: isMobile ? '14px' : '20px',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Colonne Gauche : Sélection Patient & Régime */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
            {/* Sélection du Patient */}
            <div style={{
              background: '#1e293b',
              padding: '18px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>👤</span> Patient à facturer
              </h3>

              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Rechercher patient par nom, CIN ou CNAM..."
                  value={patientSearch}
                  onFocus={() => setShowPatientDropdown(true)}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setShowPatientDropdown(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.9rem'
                  }}
                />

                {showPatientDropdown && patientSearch.trim() && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 20,
                    background: '#0f172a',
                    border: '1px solid #38bdf8',
                    borderRadius: '8px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    marginTop: '4px'
                  }}>
                    {patients
                      .filter(p => (p.fullname || (p.nom + ' ' + p.prenom)).toLowerCase().includes(patientSearch.toLowerCase()))
                      .map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedPatient(p);
                            setPatientSearch('');
                            setShowPatientDropdown(false);
                          }}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                              {p.fullname || `${p.nom} ${p.prenom}`}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              CIN: {p.cin || '-'} | CNAM: {p.cnamid || '-'}
                            </div>
                          </div>
                          {p.apci && p.apci !== 'AUCUNE' && (
                            <span style={{ fontSize: '0.7rem', background: '#d97706', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
                              APCI {p.apci}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {selectedPatient ? (
                <div style={{
                  marginTop: '14px',
                  padding: '14px',
                  background: '#0f172a',
                  borderRadius: '10px',
                  border: '1px solid #334155'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#38bdf8' }}>
                      {selectedPatient.fullname || `${selectedPatient.nom} ${selectedPatient.prenom}`}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{selectedPatient.quality || 'Assuré(e)'}</span>
                  </div>

                  <div style={{ marginTop: '8px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px', color: '#cbd5e1' }}>
                    <div>Caisse : <strong style={{ color: '#fff' }}>{selectedPatient.caisse || 'CNSS'}</strong> | Filière : <strong style={{ color: '#fff' }}>{selectedPatient.filiere || 'Privée'}</strong></div>
                    <div>N° Carnet CNAM : <strong style={{ color: '#38bdf8' }}>{selectedPatient.cnamid || 'Non renseigné'}</strong></div>
                    {selectedPatient.apci && selectedPatient.apci !== 'AUCUNE' && (
                      <div style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.8rem', marginTop: '4px' }}>
                        ★ Affection APCI : {selectedPatient.apciLabel || selectedPatient.apci}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                  Aucun patient sélectionné. Utilisez la recherche ci-dessus.
                </div>
              )}
            </div>

            {/* Mode de Règlement */}
            <div style={{
              background: '#1e293b',
              padding: '18px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚖️</span> Mode de Règlement & Prise en Charge
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: modeReglement === 'comptant' ? 'rgba(56, 189, 248, 0.15)' : '#0f172a',
                  border: modeReglement === 'comptant' ? '1.5px solid #38bdf8' : '1px solid #334155',
                  cursor: 'pointer'
                }}>
                  <input
                    type="radio"
                    name="modeReglement"
                    value="comptant"
                    checked={modeReglement === 'comptant'}
                    onChange={() => handleModeReglementChange('comptant')}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: '#f8fafc' }}>💵 Règlement Comptant (100% Patient)</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Filière Remboursement ou Sans Convention</div>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: modeReglement === 'cnam_mo' ? 'rgba(5, 150, 105, 0.18)' : '#0f172a',
                  border: modeReglement === 'cnam_mo' ? '1.5px solid #10b981' : '1px solid #334155',
                  cursor: 'pointer'
                }}>
                  <input
                    type="radio"
                    name="modeReglement"
                    value="cnam_mo"
                    checked={modeReglement === 'cnam_mo'}
                    onChange={() => handleModeReglementChange('cnam_mo')}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: '#34d399' }}>🏛️ CNAM Maladie Ordinaire (MO)</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Filière Privée : Ticket modérateur patient + Tiers-Payant CNAM</div>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: modeReglement === 'cnam_apci' ? 'rgba(217, 119, 6, 0.18)' : '#0f172a',
                  border: modeReglement === 'cnam_apci' ? '1.5px solid #f59e0b' : '1px solid #334155',
                  cursor: 'pointer'
                }}>
                  <input
                    type="radio"
                    name="modeReglement"
                    value="cnam_apci"
                    checked={modeReglement === 'cnam_apci'}
                    onChange={() => handleModeReglementChange('cnam_apci')}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: '#fbbf24' }}>★ CNAM APCI (Tiers-Payant 100%)</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Dispense d'avance totale : Prise en charge intégrale par la CNAM</div>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: modeReglement === 'gratuit' ? 'rgba(168, 85, 247, 0.18)' : '#0f172a',
                  border: modeReglement === 'gratuit' ? '1.5px solid #a855f7' : '1px solid #334155',
                  cursor: 'pointer'
                }}>
                  <input
                    type="radio"
                    name="modeReglement"
                    value="gratuit"
                    checked={modeReglement === 'gratuit'}
                    onChange={() => handleModeReglementChange('gratuit')}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: '#c084fc' }}>🎁 Prise en charge Gratuite / Exonéré (0 DT)</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Consultation de contrôle sous 7 jours, confraternelle ou cas social</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Moyen de Paiement Patient */}
            <div style={{
              background: '#1e293b',
              padding: '18px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>💰</span> Modalité d'Encaissement Patient
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? '6px' : '10px', marginBottom: '12px' }}>
                <button
                  type="button"
                  onClick={() => setMoyenPaiement('especes')}
                  style={{
                    padding: isMobile ? '8px 4px' : '8px 12px',
                    borderRadius: '8px',
                    background: moyenPaiement === 'especes' ? '#0284c7' : '#0f172a',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: isMobile ? '0.78rem' : '0.85rem',
                    textAlign: 'center'
                  }}
                >
                  💵 Espèces
                </button>
                <button
                  type="button"
                  onClick={() => setMoyenPaiement('cheque')}
                  style={{
                    padding: isMobile ? '8px 4px' : '8px 12px',
                    borderRadius: '8px',
                    background: moyenPaiement === 'cheque' ? '#0284c7' : '#0f172a',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: isMobile ? '0.78rem' : '0.85rem',
                    textAlign: 'center'
                  }}
                >
                  📝 Chèque
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleModeReglementChange('gratuit');
                  }}
                  style={{
                    padding: isMobile ? '8px 4px' : '8px 12px',
                    borderRadius: '8px',
                    background: moyenPaiement === 'gratuit' ? '#7c3aed' : '#0f172a',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: isMobile ? '0.78rem' : '0.85rem',
                    textAlign: 'center'
                  }}
                >
                  🎁 Gratuit
                </button>
              </div>

              {totalPartPatient > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Montant Reçu (DT)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={montantRecu}
                      onChange={(e) => setMontantRecu(e.target.value)}
                      placeholder={totalPartPatient.toFixed(3)}
                      style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Monnaie Rendue (DT)</label>
                    <div style={{ padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: monnaieRendue > 0 ? '#4ade80' : '#94a3b8', fontWeight: 800 }}>
                      {monnaieRendue.toFixed(3)} DT
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Colonne Droite : Actes Facturés & Synthèse */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
            {/* Actes Rapides / Favoris */}
            <div style={{
              background: '#1e293b',
              padding: '18px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚡</span> Prestations & Actes Rapides
              </h3>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => addActeByCode('C_COMPTANT')}
                  style={{ padding: '6px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#38bdf8', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  + Consultation Cabinet (40 DT)
                </button>
                <button
                  type="button"
                  onClick={() => addActeByCode('C_MO')}
                  style={{ padding: '6px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #059669', color: '#34d399', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  + Consultation CNAM MO (30 DT)
                </button>
                <button
                  type="button"
                  onClick={() => addActeByCode('C_APCI')}
                  style={{ padding: '6px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #d97706', color: '#fbbf24', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  + Consultation APCI (30 DT)
                </button>
                <button
                  type="button"
                  onClick={() => addActeByCode('ECG_12')}
                  style={{ padding: '6px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  + ECG 12 Dérivations (25 DT)
                </button>
                <button
                  type="button"
                  onClick={() => addActeByCode('V_DOM')}
                  style={{ padding: '6px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  + Visite à Domicile (60 DT)
                </button>
              </div>

              {/* Barre de Recherche dans le catalogue des 277 Actes */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Rechercher un acte médical dans la nomenclature CNAM (ex: échographie, infiltration, suture...)..."
                  value={acteSearch}
                  onChange={(e) => setActeSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.85rem'
                  }}
                />

                {actesFiltered.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 30,
                    background: '#0f172a',
                    border: '1px solid #38bdf8',
                    borderRadius: '8px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                    marginTop: '4px'
                  }}>
                    {actesFiltered.map((a, idx) => (
                      <div
                        key={idx}
                        onClick={() => addActe(a)}
                        style={{
                          padding: '8px 12px',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>{a.nom}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            Code: {a.code} | {a.specialite}
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.9rem' }}>
                          {a.montantGlobal.toFixed(3)} DT
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tableau des Actes Sélectionnés */}
            <div style={{
              background: '#1e293b',
              padding: isMobile ? '14px' : '18px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: '1rem',
                color: '#38bdf8',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '6px'
              }}>
                <span>📋 Prestations Facturées ({selectedActes.length})</span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Devise : DT (Dinars)</span>
              </h3>

              {selectedActes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 10px', color: '#64748b', fontStyle: 'italic', background: '#0f172a', borderRadius: '8px', fontSize: '0.85rem' }}>
                  Aucun acte ajouté. Cliquez sur un acte rapide ou recherchez dans le catalogue.
                </div>
              ) : isMobile ? (
                /* VUE CARTE MOBILE POUR LES ACTES FACTURÉS */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedActes.map((acte, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#0f172a',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.88rem' }}>{acte.nom}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Code: {acte.code}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeActe(idx)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: 'none',
                            color: '#ef4444',
                            borderRadius: '6px',
                            width: '28px',
                            height: '28px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                          title="Retirer cet acte"
                        >
                          ✕
                        </button>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.78rem',
                        paddingTop: '6px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                      }}>
                        <span style={{ color: '#94a3b8' }}>Total: <strong>{acte.montantGlobal.toFixed(3)}</strong></span>
                        <span style={{ color: '#38bdf8' }}>CNAM: <strong>{acte.partCnam.toFixed(3)}</strong></span>
                        <span style={{ color: '#4ade80' }}>Patient: <strong>{acte.partPatient.toFixed(3)} DT</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* VUE TABLEAU DESKTOP */
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Désignation Acte</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', color: '#38bdf8' }}>Part CNAM</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', color: '#4ade80' }}>Part Patient</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedActes.map((acte, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <td style={{ padding: '10px' }}>
                            <div style={{ fontWeight: 600, color: '#f8fafc' }}>{acte.nom}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Code: {acte.code}</div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>
                            {acte.montantGlobal.toFixed(3)}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#38bdf8', fontWeight: 700 }}>
                            {acte.partCnam.toFixed(3)}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#4ade80', fontWeight: 700 }}>
                            {acte.partPatient.toFixed(3)}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => removeActe(idx)}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}
                              title="Retirer cet acte"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Carte Synthèse Financière Adaptative (Anti-chevauchement) */}
              <div style={{
                marginTop: '16px',
                background: '#0f172a',
                borderRadius: '12px',
                border: '1.5px solid #334155',
                padding: isMobile ? '12px' : '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {/* Ligne 1 : Deux tuiles côte-à-côte pour Total et CNAM */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px'
                }}>
                  <div style={{
                    background: '#1e293b',
                    padding: isMobile ? '8px 10px' : '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #334155'
                  }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Total Général
                    </div>
                    <div style={{ fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>
                      {totalGlobal.toFixed(3)} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>DT</span>
                    </div>
                  </div>

                  <div style={{
                    background: '#1e293b',
                    padding: isMobile ? '8px 10px' : '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(56, 189, 248, 0.35)'
                  }}>
                    <div style={{ fontSize: '0.72rem', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      🏛️ Tiers CNAM
                    </div>
                    <div style={{ fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
                      {totalPartCnam.toFixed(3)} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0284c7' }}>DT</span>
                    </div>
                  </div>
                </div>

                {/* Ligne 2 : NET PAYÉ PATIENT mise en valeur, pleine largeur, aucun débordement */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.12) 0%, rgba(34, 197, 94, 0.22) 100%)',
                  padding: isMobile ? '10px 14px' : '12px 18px',
                  borderRadius: '10px',
                  border: '1.5px solid #4ade80',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#86efac', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>💳</span> NET PAYÉ PATIENT
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#a7f3d0' }}>
                      {modeReglement === 'gratuit' ? 'Prise en charge gracieuse (0 DT)' : modeReglement === 'cnam_apci' ? 'Prise en charge 100% CNAM' : 'Règlement immédiat au cabinet'}
                    </div>
                  </div>
                  <div style={{ fontSize: isMobile ? '1.35rem' : '1.6rem', fontWeight: 900, color: '#4ade80', textShadow: '0 2px 8px rgba(74, 222, 128, 0.25)', whiteSpace: 'nowrap' }}>
                    {totalPartPatient.toFixed(3)} <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>DT</span>
                  </div>
                </div>
              </div>

              {/* Observations */}
              <div style={{ marginTop: '14px' }}>
                <input
                  type="text"
                  placeholder="Note ou observation pour cette facture (optionnel)..."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>

              {/* Boutons d'Action Validation & Impression - Responsives & Ergonomiques */}
              <div className="billing-responsive-actions" style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: isMobile ? 'stretch' : 'flex-end',
                flexWrap: 'wrap',
                gap: '10px',
                marginTop: '18px',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                <button
                  type="button"
                  className="billing-btn-print"
                  onClick={() => handleSaveInvoice(true)}
                  style={{
                    width: isMobile ? '100%' : 'auto',
                    padding: isMobile ? '14px 16px' : '11px 22px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: isMobile ? '0.98rem' : '0.95rem',
                    boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    order: isMobile ? 1 : 3
                  }}
                >
                  <span>🖨️</span> Valider & Imprimer Quittance
                </button>

                <button
                  type="button"
                  className="billing-btn-save"
                  onClick={() => handleSaveInvoice(false)}
                  style={{
                    width: isMobile ? '100%' : 'auto',
                    padding: isMobile ? '13px 16px' : '11px 20px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: isMobile ? '0.94rem' : '0.92rem',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    order: isMobile ? 2 : 2
                  }}
                >
                  <span>💾</span> Valider l'Encaissement
                </button>

                <button
                  type="button"
                  className="billing-btn-reset"
                  onClick={() => {
                    setSelectedActes([]);
                    setMontantRecu('');
                    setObservations('');
                  }}
                  style={{
                    width: isMobile ? '100%' : 'auto',
                    padding: isMobile ? '11px 14px' : '11px 18px',
                    borderRadius: '10px',
                    background: isMobile ? '#1e293b' : 'transparent',
                    border: '1px solid #475569',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    order: isMobile ? 3 : 1
                  }}
                >
                  <span>🔄</span> Réinitialiser
                </button>
              </div>
            </div>
          </div>

          {/* Section rapide : Derniers règlements avec bouton de suppression immédiate */}
          {invoicesList.length > 0 && (
            <div style={{
              gridColumn: '1 / -1',
              background: '#1e293b',
              padding: isMobile ? '14px' : '16px 20px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              maxWidth: '100%',
              overflowX: 'hidden',
              boxSizing: 'border-box'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                flexDirection: isMobile ? 'column' : 'row',
                gap: '4px',
                marginBottom: '14px'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⏱️</span> Derniers Paiements Enregistrés ({invoicesList.slice(0, 5).length})
                </h4>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  Possibilité de ré-imprimer ou de supprimer immédiatement en cas d'erreur
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', boxSizing: 'border-box' }}>
                {invoicesList.slice(0, 5).map(inv => (
                  <div
                    key={inv.id}
                    style={{
                      background: '#0f172a',
                      padding: isMobile ? '12px' : '14px 16px',
                      borderRadius: '10px',
                      border: '1px solid #334155',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Ligne 1 : N° Facture, Date & Badge Régime */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                          {inv.numFacture || `FAC-${inv.id}`}
                        </span>
                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{inv.date}</span>
                      </div>
                      <span style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        background: inv.modeReglement === 'gratuit' ? 'rgba(168, 85, 247, 0.2)' : inv.modeReglement === 'cnam_apci' ? 'rgba(217, 119, 6, 0.2)' : inv.modeReglement === 'cnam_mo' ? 'rgba(5, 150, 105, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                        color: inv.modeReglement === 'gratuit' ? '#c084fc' : inv.modeReglement === 'cnam_apci' ? '#fbbf24' : inv.modeReglement === 'cnam_mo' ? '#34d399' : '#38bdf8'
                      }}>
                        {inv.modeReglement === 'gratuit' ? '🎁 Gratuit' : inv.modeReglement === 'cnam_apci' ? '★ APCI 100%' : inv.modeReglement === 'cnam_mo' ? '🏛️ CNAM MO' : '💵 Comptant'}
                      </span>
                    </div>

                    {/* Ligne 2 : Patient et Montant */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
                        {inv.patientName}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Payé : </span>
                        <strong style={{ color: '#4ade80', fontSize: '1.05rem' }}>{(inv.partPatient || 0).toFixed(3)} DT</strong>
                        {inv.partCnam > 0 && (
                          <span style={{ color: '#38bdf8', fontSize: '0.75rem', marginLeft: '6px' }}>
                            (CNAM: {(inv.partCnam || 0).toFixed(3)} DT)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ligne 3 : Actions Ré-imprimer / Supprimer */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      <button
                        type="button"
                        onClick={() => {
                          const pat = patients.find(p => p.id === inv.patientId) || {
                            fullname: inv.patientName,
                            cnamid: inv.patientCnamId,
                            caisse: inv.patientCaisse,
                            cin: inv.patientCin,
                            apci: inv.patientApci,
                            apciLabel: inv.patientApciLabel
                          };
                          generateReceiptReport(pat, inv);
                        }}
                        style={{
                          padding: '9px 12px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          border: 'none',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                        title="Ré-imprimer la quittance en PDF"
                      >
                        <span>🖨️</span> Quittance
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteInvoice(inv)}
                        style={{
                          padding: '9px 12px',
                          borderRadius: '8px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#f87171',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                        title="Supprimer définitivement ce paiement"
                      >
                        <span>🗑️</span> Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* ONGLET 2 : BORDEREAUX CNAM (TIERS-PAYANT)                     */}
      {/* ============================================================== */}
      {activeTab === 'bordereaux' && (() => {
        // Garantir que les bordereaux sont TOUJOURS disponibles
        const allBords = (bordereauxList && bordereauxList.length > 0)
          ? bordereauxList
          : (historicalBordereaux || []);

        const totalBordereaux = allBords.length;
        const totalActes = allBords.reduce((acc, b) => acc + (b.totalFactures || b.lignes?.length || 0), 0);
        const totalMontantCnam = allBords.reduce((acc, b) => acc + (Number(b.montantTotalCnam) || 0), 0);
        const totalEnAttente = pendingInvoices.length;

        // Filtrage des bordereaux
        const filteredBords = allBords.filter(b => {
          if (bordereauYearFilter !== 'TOUS') {
            const y = (b.dateCreation || '').slice(0, 4);
            if (y !== bordereauYearFilter) return false;
          }
          if (bordereauSearch.trim()) {
            const q = bordereauSearch.toLowerCase();
            const matchNum = (b.numBordereau || '').toLowerCase().includes(q);
            const matchDate = (b.dateCreation || '').includes(q);
            const matchObs = (b.observations || '').toLowerCase().includes(q);
            const matchPat = (b.lignes || []).some(l => 
              (l.patientName || '').toLowerCase().includes(q) || 
              (l.cnamId || '').includes(q)
            );
            if (!matchNum && !matchDate && !matchObs && !matchPat) return false;
          }
          return true;
        });

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', maxWidth: '100%', overflowX: 'hidden' }}>
            {/* 1. CARTOUCHES KPI RECAPITULATIFS */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: isMobile ? '10px' : '14px'
            }}>
              <div style={{
                background: '#1e293b',
                padding: isMobile ? '12px 14px' : '16px 20px',
                borderRadius: '12px',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '10px' : '14px'
              }}>
                <div style={{ fontSize: isMobile ? '1.5rem' : '2rem', background: 'rgba(56, 189, 248, 0.1)', padding: isMobile ? '6px' : '10px', borderRadius: '10px' }}>📁</div>
                <div>
                  <div style={{ fontSize: isMobile ? '0.72rem' : '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bordereaux</div>
                  <div style={{ fontSize: isMobile ? '1.2rem' : '1.45rem', fontWeight: 800, color: '#38bdf8' }}>{totalBordereaux}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>2021 – 2026</div>
                </div>
              </div>

              <div style={{
                background: '#1e293b',
                padding: isMobile ? '12px 14px' : '16px 20px',
                borderRadius: '12px',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '10px' : '14px'
              }}>
                <div style={{ fontSize: isMobile ? '1.5rem' : '2rem', background: 'rgba(16, 185, 129, 0.1)', padding: isMobile ? '6px' : '10px', borderRadius: '10px' }}>👥</div>
                <div>
                  <div style={{ fontSize: isMobile ? '0.72rem' : '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actes Caisse</div>
                  <div style={{ fontSize: isMobile ? '1.2rem' : '1.45rem', fontWeight: 800, color: '#10b981' }}>{totalActes}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Télétransmis</div>
                </div>
              </div>

              <div style={{
                background: '#1e293b',
                padding: isMobile ? '12px 14px' : '16px 20px',
                borderRadius: '12px',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '10px' : '14px'
              }}>
                <div style={{ fontSize: isMobile ? '1.5rem' : '2rem', background: 'rgba(139, 92, 246, 0.1)', padding: isMobile ? '6px' : '10px', borderRadius: '10px' }}>💰</div>
                <div>
                  <div style={{ fontSize: isMobile ? '0.72rem' : '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total CNAM</div>
                  <div style={{ fontSize: isMobile ? '1.2rem' : '1.45rem', fontWeight: 800, color: '#a78bfa' }}>{totalMontantCnam.toFixed(3)} <span style={{ fontSize: '0.75rem' }}>DT</span></div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Créances perçues</div>
                </div>
              </div>

              <div style={{
                background: '#1e293b',
                padding: isMobile ? '12px 14px' : '16px 20px',
                borderRadius: '12px',
                border: totalEnAttente > 0 ? '1px solid #d97706' : '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '10px' : '14px'
              }}>
                <div style={{ fontSize: isMobile ? '1.5rem' : '2rem', background: totalEnAttente > 0 ? 'rgba(217, 119, 6, 0.15)' : 'rgba(255, 255, 255, 0.05)', padding: isMobile ? '6px' : '10px', borderRadius: '10px' }}>⏳</div>
                <div>
                  <div style={{ fontSize: isMobile ? '0.72rem' : '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>En Attente</div>
                  <div style={{ fontSize: isMobile ? '1.2rem' : '1.45rem', fontWeight: 800, color: totalEnAttente > 0 ? '#f59e0b' : '#94a3b8' }}>{totalEnAttente}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Prochain bordereau</div>
                </div>
              </div>
            </div>

            {/* 2. SOUS-ONGLETS DE NAVIGATION (Archives vs Nouveau) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: '1px solid #334155',
              paddingBottom: '8px',
              width: '100%'
            }}>
              <button
                type="button"
                onClick={() => setCnamSubTab('archives')}
                style={{
                  flex: isMobile ? 1 : 'none',
                  padding: isMobile ? '8px 10px' : '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: cnamSubTab === 'archives' ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
                  color: cnamSubTab === 'archives' ? '#fff' : '#94a3b8',
                  fontWeight: cnamSubTab === 'archives' ? 700 : 500,
                  fontSize: isMobile ? '0.8rem' : '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <span>🗄️</span> Archives ({totalBordereaux})
              </button>

              <button
                type="button"
                onClick={() => setCnamSubTab('nouveau')}
                style={{
                  flex: isMobile ? 1 : 'none',
                  padding: isMobile ? '8px 10px' : '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: cnamSubTab === 'nouveau' ? '#059669' : 'rgba(255, 255, 255, 0.05)',
                  color: cnamSubTab === 'nouveau' ? '#fff' : '#94a3b8',
                  fontWeight: cnamSubTab === 'nouveau' ? 700 : 500,
                  fontSize: isMobile ? '0.8rem' : '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <span>➕</span> Nouveau
                {totalEnAttente > 0 && (
                  <span style={{
                    background: '#f59e0b',
                    color: '#000',
                    fontWeight: 800,
                    fontSize: '0.7rem',
                    padding: '1px 5px',
                    borderRadius: '8px'
                  }}>
                    {totalEnAttente}
                  </span>
                )}
              </button>
            </div>

            {/* 3. VUE SOUS-ONGLET 1 : ARCHIVES & HISTORIQUE */}
            {cnamSubTab === 'archives' && (
              <div style={{
                background: '#1e293b',
                padding: isMobile ? '14px' : '20px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                {/* Input caché pour import .txt */}
                <input
                  id="cnam-archive-txt-input"
                  type="file"
                  accept=".txt"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleImportTxtBordereaux}
                />

                {/* Barre de Filtres & Actions */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '16px',
                  background: '#0f172a',
                  padding: isMobile ? '10px' : '12px 16px',
                  borderRadius: '10px'
                }}>
                  {/* Filtre par Année */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Année :</span>
                    <select
                      value={bordereauYearFilter}
                      onChange={(e) => setBordereauYearFilter(e.target.value)}
                      style={{
                        flex: isMobile ? 1 : 'none',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: '#1e293b',
                        border: '1px solid #334155',
                        color: '#fff',
                        fontSize: '0.85rem',
                        fontWeight: 600
                      }}
                    >
                      <option value="TOUS">Toutes les années ({totalBordereaux})</option>
                      <option value="2026">Année 2026</option>
                      <option value="2025">Année 2025</option>
                      <option value="2024">Année 2024</option>
                      <option value="2023">Année 2023</option>
                      <option value="2022">Année 2022</option>
                      <option value="2021">Année 2021</option>
                    </select>
                  </div>

                  {/* Recherche Libre */}
                  <div style={{ flex: '1', minWidth: isMobile ? '100%' : '220px', maxWidth: isMobile ? '100%' : '380px' }}>
                    <input
                      type="text"
                      placeholder="🔍 Rechercher N°, patient, date..."
                      value={bordereauSearch}
                      onChange={(e) => setBordereauSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: '#1e293b',
                        border: '1px solid #334155',
                        color: '#fff',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>

                  {/* Bouton Import */}
                  <button
                    type="button"
                    onClick={() => document.getElementById('cnam-archive-txt-input')?.click()}
                    style={{
                      width: isMobile ? '100%' : 'auto',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
                    }}
                    title="Importer un fichier de télétransmission CNAM (.txt)"
                  >
                    <span>📥</span> Importer fichier .txt
                  </button>
                </div>

                {/* Tableau ou Cartes Mobiles Propres */}
                {filteredBords.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 20px', color: '#94a3b8', background: '#0f172a', borderRadius: '8px', fontSize: '0.85rem' }}>
                    Aucun bordereau ne correspond aux critères de recherche.
                  </div>
                ) : isMobile ? (
                  /* VUE CARTE MOBILE DES BORDEREAUX */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredBords.map((b, idx) => {
                      const nbActes = b.totalFactures || b.lignes?.length || 0;
                      const mtt = (Number(b.montantTotalCnam) || 0).toFixed(3);
                      const isRegle = b.statut === 'regle';
                      const isDepose = b.statut === 'depose';

                      return (
                        <div
                          key={b.id || b.numBordereau || idx}
                          style={{
                            background: '#0f172a',
                            padding: '12px',
                            borderRadius: '10px',
                            border: '1px solid #334155',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span
                              onClick={() => setViewingBordereau(b)}
                              style={{
                                color: '#38bdf8',
                                cursor: 'pointer',
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                fontSize: '0.92rem'
                              }}
                            >
                              🏛️ {b.numBordereau}
                            </span>

                            {isRegle ? (
                              <span style={{ background: 'rgba(22, 163, 74, 0.2)', color: '#4ade80', border: '1px solid #16a34a', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                                ✓ Réglé
                              </span>
                            ) : isDepose ? (
                              <span style={{ background: 'rgba(2, 132, 199, 0.2)', color: '#38bdf8', border: '1px solid #0284c7', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600 }}>
                                Déposé
                              </span>
                            ) : (
                              <span style={{ background: 'rgba(202, 138, 4, 0.2)', color: '#facc15', border: '1px solid #ca8a04', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600 }}>
                                En attente
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>
                            <div>
                              <span>Du {b.periodeDebut} au {b.periodeFin}</span>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Établi le {b.dateCreation}</div>
                            </div>
                            <span style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                              {nbActes} dossier{nbActes > 1 ? 's' : ''}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total CNAM :</span>
                            <strong style={{ fontSize: '1.15rem', color: '#4ade80', fontWeight: 900 }}>{mtt} DT</strong>
                          </div>

                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr 1fr' : (b.id ? '1fr 1fr 1fr 38px' : '1fr 1fr 1fr'),
                            gap: '6px',
                            marginTop: '6px'
                          }}>
                            <button
                              type="button"
                              onClick={() => setViewingBordereau(b)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                background: '#334155',
                                border: 'none',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 600
                              }}
                            >
                              👁️ Détail
                            </button>
                            <button
                              type="button"
                              onClick={() => generateCnamBordereauReport(b)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                background: '#0284c7',
                                border: 'none',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 600
                              }}
                            >
                              🖨️ PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => exportCnamBordereauCSV(b)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                background: '#059669',
                                border: 'none',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 600
                              }}
                            >
                              📊 CSV
                            </button>
                            {b.id && (
                              <button
                                type="button"
                                onClick={() => handleDeleteBordereau(b.id)}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#ef4444',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  padding: '6px',
                                  fontSize: '0.85rem'
                                }}
                                title="Supprimer ce bordereau"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* VUE TABLEAU DESKTOP */
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #334155', color: '#94a3b8', textAlign: 'left', background: '#0f172a' }}>
                          <th style={{ padding: '12px 14px' }}>N° Bordereau</th>
                          <th style={{ padding: '12px 14px' }}>Date Établissement</th>
                          <th style={{ padding: '12px 14px' }}>Période Couverte</th>
                          <th style={{ padding: '12px 14px', textAlign: 'center' }}>Actes</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Montant Net CNAM</th>
                          <th style={{ padding: '12px 14px', textAlign: 'center' }}>Statut</th>
                          <th style={{ padding: '12px 14px', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBords.map((b, idx) => {
                          const nbActes = b.totalFactures || b.lignes?.length || 0;
                          const mtt = (Number(b.montantTotalCnam) || 0).toFixed(3);
                          const isRegle = b.statut === 'regle';
                          const isDepose = b.statut === 'depose';

                          return (
                            <tr
                              key={b.id || b.numBordereau || idx}
                              style={{
                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent'
                              }}
                            >
                              {/* N° Bordereau */}
                              <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                                <span
                                  onClick={() => setViewingBordereau(b)}
                                  style={{
                                    color: '#38bdf8',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    fontFamily: 'monospace',
                                    fontSize: '0.9rem'
                                  }}
                                  title="Cliquer pour afficher la liste des patients"
                                >
                                  {b.numBordereau}
                                </span>
                              </td>

                              {/* Date */}
                              <td style={{ padding: '12px 14px', color: '#e2e8f0', whiteSpace: 'nowrap' }}>
                                {b.dateCreation}
                              </td>

                              {/* Période */}
                              <td style={{ padding: '12px 14px', color: '#94a3b8', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                Du {b.periodeDebut} au {b.periodeFin}
                              </td>

                              {/* Nombre d'actes */}
                              <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                <span style={{
                                  background: 'rgba(56, 189, 248, 0.12)',
                                  color: '#38bdf8',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontWeight: 700,
                                  fontSize: '0.8rem'
                                }}>
                                  {nbActes} dossier{nbActes > 1 ? 's' : ''}
                                </span>
                              </td>

                              {/* Montant Net CNAM */}
                              <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#4ade80', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
                                {mtt} DT
                              </td>

                              {/* Statut */}
                              <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                {isRegle ? (
                                  <span style={{ background: 'rgba(22, 163, 74, 0.2)', color: '#4ade80', border: '1px solid #16a34a', padding: '3px 9px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                                    ✓ Réglé
                                  </span>
                                ) : isDepose ? (
                                  <span style={{ background: 'rgba(2, 132, 199, 0.2)', color: '#38bdf8', border: '1px solid #0284c7', padding: '3px 9px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                                    Déposé
                                  </span>
                                ) : (
                                  <span style={{ background: 'rgba(202, 138, 4, 0.2)', color: '#facc15', border: '1px solid #ca8a04', padding: '3px 9px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                                    En attente
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    type="button"
                                    onClick={() => setViewingBordereau(b)}
                                    style={{
                                      padding: '5px 10px',
                                      borderRadius: '6px',
                                      background: '#334155',
                                      border: 'none',
                                      color: '#fff',
                                      cursor: 'pointer',
                                      fontSize: '0.78rem',
                                      fontWeight: 600
                                    }}
                                    title="Voir le détail des patients de ce bordereau"
                                  >
                                    👁️ Détail
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => generateCnamBordereauReport(b)}
                                    style={{
                                      padding: '5px 10px',
                                      borderRadius: '6px',
                                      background: '#0284c7',
                                      border: 'none',
                                      color: '#fff',
                                      cursor: 'pointer',
                                      fontSize: '0.78rem',
                                      fontWeight: 600
                                    }}
                                    title="Imprimer le bordereau officiel A4 format CNAM"
                                  >
                                    🖨️ PDF
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => exportCnamBordereauCSV(b)}
                                    style={{
                                      padding: '5px 10px',
                                      borderRadius: '6px',
                                      background: '#059669',
                                      border: 'none',
                                      color: '#fff',
                                      cursor: 'pointer',
                                      fontSize: '0.78rem',
                                      fontWeight: 600
                                    }}
                                    title="Exporter au format Excel / CSV"
                                  >
                                    📊 CSV
                                  </button>

                                  {b.id && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteBordereau(b.id)}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#ef4444',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        fontSize: '0.85rem'
                                      }}
                                      title="Supprimer ce bordereau"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 4. VUE SOUS-ONGLET 2 : NOUVEAU BORDEREAU (Créances en Attente) */}
            {cnamSubTab === 'nouveau' && (
              <div style={{
                background: '#1e293b',
                padding: isMobile ? '14px' : '20px',
                borderRadius: '12px',
                border: '1.5px solid rgba(56, 189, 248, 0.3)'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: isMobile ? 'stretch' : 'center',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.15rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>📑</span> Créances CNAM en Attente ({pendingInvoices.length})
                    </h3>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                      Sélectionnez les consultations à regrouper sur le prochain bordereau officiel.
                    </div>
                  </div>

                  {pendingInvoices.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCreateBordereau}
                      style={{
                        padding: isMobile ? '12px 16px' : '11px 22px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                        border: 'none',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.92rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        width: isMobile ? '100%' : 'auto'
                      }}
                    >
                      <span>📄</span> Générer Bordereau ({selectedInvoiceIds.length})
                    </button>
                  )}
                </div>

                {/* Filtres de sélection */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                  alignItems: 'center',
                  marginBottom: '14px',
                  background: '#0f172a',
                  padding: isMobile ? '10px' : '10px 14px',
                  borderRadius: '8px'
                }}>
                  <div style={{ flex: isMobile ? '1 1 45%' : 'none' }}>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', marginRight: '6px' }}>Caisse :</label>
                    <select
                      value={caisseFilter}
                      onChange={(e) => setCaisseFilter(e.target.value)}
                      style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '0.82rem', width: isMobile ? '100%' : 'auto' }}
                    >
                      <option value="TOUTES">Toutes (CNSS & CNRPS)</option>
                      <option value="CNSS">CNSS uniquement</option>
                      <option value="CNRPS">CNRPS uniquement</option>
                    </select>
                  </div>

                  <div style={{ flex: isMobile ? '1 1 45%' : 'none' }}>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', marginRight: '6px' }}>Régime :</label>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '0.82rem', width: isMobile ? '100%' : 'auto' }}
                    >
                      <option value="TOUS">Tous (MO & APCI)</option>
                      <option value="MO">Maladie Ordinaire (MO)</option>
                      <option value="APCI">APCI 100%</option>
                    </select>
                  </div>

                  <div style={{ marginLeft: isMobile ? 0 : 'auto', display: 'flex', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedInvoiceIds(pendingInvoices.map(i => i.id))}
                      style={{ flex: isMobile ? 1 : 'none', padding: '6px 12px', background: '#334155', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      Tout cocher
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedInvoiceIds([])}
                      style={{ flex: isMobile ? 1 : 'none', padding: '6px 12px', background: '#334155', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      Tout décocher
                    </button>
                  </div>
                </div>

                {/* Tableau ou Cartes Mobiles des créances en attente */}
                {pendingInvoices.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 15px', color: '#94a3b8', background: '#0f172a', borderRadius: '8px', fontSize: '0.85rem' }}>
                    <div style={{ fontSize: '1.15rem', color: '#4ade80', marginBottom: '6px' }}>✓ Toutes les créances CNAM sont à jour !</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      Aucune nouvelle consultation conventionnée en attente.
                    </div>
                  </div>
                ) : isMobile ? (
                  /* VUE CARTE MOBILE DES CRÉANCES EN ATTENTE */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {pendingInvoices
                      .filter(inv => {
                        if (caisseFilter !== 'TOUTES' && inv.patientCaisse !== caisseFilter) return false;
                        if (typeFilter === 'MO' && inv.modeReglement !== 'cnam_mo') return false;
                        if (typeFilter === 'APCI' && inv.modeReglement !== 'cnam_apci') return false;
                        return true;
                      })
                      .map(inv => {
                        const isChecked = selectedInvoiceIds.includes(inv.id);
                        return (
                          <div
                            key={inv.id}
                            onClick={() => {
                              if (isChecked) {
                                setSelectedInvoiceIds(selectedInvoiceIds.filter(id => id !== inv.id));
                              } else {
                                setSelectedInvoiceIds([...selectedInvoiceIds, inv.id]);
                              }
                            }}
                            style={{
                              background: isChecked ? 'rgba(56, 189, 248, 0.1)' : '#0f172a',
                              border: isChecked ? '1.5px solid #38bdf8' : '1px solid #334155',
                              borderRadius: '8px',
                              padding: '10px 12px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  style={{ width: '18px', height: '18px', accentColor: '#0284c7' }}
                                />
                                <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>{inv.patientName}</span>
                              </div>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{inv.date}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                              <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>CNAM: {inv.patientCnamId || '-'}</span>
                              <span style={{
                                background: inv.modeReglement === 'cnam_apci' ? '#d97706' : '#059669',
                                color: '#fff',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 600
                              }}>
                                {inv.modeReglement === 'cnam_apci' ? '★ APCI' : '🏛️ MO'}
                              </span>
                            </div>

                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.8rem',
                              paddingTop: '4px',
                              borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                            }}>
                              <span style={{ color: '#94a3b8' }}>Total: {(inv.totalGlobal || 0).toFixed(3)}</span>
                              <span style={{ color: '#4ade80' }}>TM: {(inv.partPatient || 0).toFixed(3)}</span>
                              <span style={{ color: '#38bdf8', fontWeight: 800 }}>CNAM: {(inv.partCnam || 0).toFixed(3)} DT</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  /* VUE TABLEAU DESKTOP DES CRÉANCES EN ATTENTE */
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                          <th style={{ width: '40px', padding: '8px 10px', textAlign: 'center' }}></th>
                          <th style={{ padding: '8px 10px' }}>Date</th>
                          <th style={{ padding: '8px 10px' }}>Patient</th>
                          <th style={{ padding: '8px 10px' }}>N° Carnet CNAM</th>
                          <th style={{ padding: '8px 10px' }}>Régime</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', color: '#4ade80' }}>TM Payé</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', color: '#38bdf8' }}>Part CNAM</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '60px' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingInvoices
                          .filter(inv => {
                            if (caisseFilter !== 'TOUTES' && inv.patientCaisse !== caisseFilter) return false;
                            if (typeFilter === 'MO' && inv.modeReglement !== 'cnam_mo') return false;
                            if (typeFilter === 'APCI' && inv.modeReglement !== 'cnam_apci') return false;
                            return true;
                          })
                          .map(inv => {
                            const isChecked = selectedInvoiceIds.includes(inv.id);
                            return (
                              <tr
                                key={inv.id}
                                style={{
                                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                  background: isChecked ? 'rgba(56, 189, 248, 0.08)' : 'transparent'
                                }}
                              >
                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedInvoiceIds([...selectedInvoiceIds, inv.id]);
                                      } else {
                                        setSelectedInvoiceIds(selectedInvoiceIds.filter(id => id !== inv.id));
                                      }
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{inv.date}</td>
                                <td style={{ padding: '10px', fontWeight: 600, color: '#f8fafc' }}>
                                  {inv.patientName}
                                </td>
                                <td style={{ padding: '10px', fontFamily: 'monospace', color: '#38bdf8' }}>
                                  {inv.patientCnamId || '-'}
                                </td>
                                <td style={{ padding: '10px' }}>
                                  {inv.modeReglement === 'cnam_apci' ? (
                                    <span style={{ background: '#d97706', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                                      ★ APCI {inv.patientApci || ''}
                                    </span>
                                  ) : (
                                    <span style={{ background: '#059669', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                      🏛️ CNAM MO
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '10px', textAlign: 'right' }}>{(inv.totalGlobal || 0).toFixed(3)}</td>
                                <td style={{ padding: '10px', textAlign: 'right', color: '#4ade80' }}>{(inv.partPatient || 0).toFixed(3)}</td>
                                <td style={{ padding: '10px', textAlign: 'right', color: '#38bdf8', fontWeight: 800 }}>
                                  {(inv.partCnam || 0).toFixed(3)} DT
                                </td>
                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteInvoice(inv)}
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.12)',
                                      border: '1px solid rgba(239, 68, 68, 0.3)',
                                      color: '#f87171',
                                      cursor: 'pointer',
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      fontSize: '0.8rem'
                                    }}
                                    title="Supprimer ce paiement"
                                  >
                                    🗑️
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 5. MODAL DE CONSULTATION DU DÉTAIL D'UN BORDEREAU */}
            {viewingBordereau && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 9999,
                  background: 'rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px'
                }}
                onClick={() => setViewingBordereau(null)}
              >
                <div
                  style={{
                    background: '#1e293b',
                    borderRadius: '14px',
                    border: '1.5px solid #38bdf8',
                    maxWidth: '900px',
                    width: '100%',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                    overflow: 'hidden'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Entête Modal */}
                  <div style={{
                    padding: '16px 20px',
                    background: '#0f172a',
                    borderBottom: '1px solid #334155',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🏛️</span> Bordereau CNAM {viewingBordereau.numBordereau}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                        Date : <strong>{viewingBordereau.dateCreation}</strong> • Période : <strong>Du {viewingBordereau.periodeDebut} au {viewingBordereau.periodeFin}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewingBordereau(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        fontSize: '1.3rem',
                        cursor: 'pointer',
                        padding: '4px 8px'
                      }}
                    >
                      ✖
                    </button>
                  </div>

                  {/* Résumé Chiffré */}
                  <div style={{
                    padding: '12px 20px',
                    background: 'rgba(56, 189, 248, 0.05)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                      Nombre de patients : <strong style={{ color: '#fff' }}>{viewingBordereau.lignes?.length || viewingBordereau.totalFactures || 0}</strong>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                      Montant Total CNAM : <strong style={{ color: '#4ade80', fontSize: '1.05rem' }}>{(Number(viewingBordereau.montantTotalCnam) || 0).toFixed(3)} DT</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => generateCnamBordereauReport(viewingBordereau)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: '#0284c7',
                          border: 'none',
                          color: '#fff',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        🖨️ Imprimer PDF Officiel
                      </button>
                      <button
                        type="button"
                        onClick={() => exportCnamBordereauCSV(viewingBordereau)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: '#059669',
                          border: 'none',
                          color: '#fff',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        📊 Exporter CSV
                      </button>
                    </div>
                  </div>

                  {/* Liste des Patients du Bordereau */}
                  <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #334155', color: '#94a3b8', textAlign: 'left', background: '#0f172a' }}>
                          <th style={{ padding: '8px 10px', width: '35px', textAlign: 'center' }}>N°</th>
                          <th style={{ padding: '8px 10px' }}>Date</th>
                          <th style={{ padding: '8px 10px' }}>Patient</th>
                          <th style={{ padding: '8px 10px' }}>N° Carnet CNAM</th>
                          <th style={{ padding: '8px 10px' }}>Régime / APCI</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', color: '#4ade80' }}>Part Patient</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', color: '#38bdf8' }}>Part CNAM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(viewingBordereau.lignes || []).map((ligne, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent' }}>
                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{ligne.date}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: '#f8fafc' }}>
                              {ligne.patientName}
                            </td>
                            <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#38bdf8' }}>
                              {ligne.cnamId || '-'}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              {ligne.apci ? (
                                <span style={{ background: '#d97706', color: '#fff', padding: '2px 7px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                                  ★ {ligne.apci}
                                </span>
                              ) : (
                                <span style={{ background: '#059669', color: '#fff', padding: '2px 7px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                                  Maladie Ordinaire
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{(ligne.montantGlobal || 0).toFixed(3)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#4ade80' }}>{(ligne.partPatient || 0).toFixed(3)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#38bdf8', fontWeight: 800 }}>
                              {(ligne.partCnam || 0).toFixed(3)} DT
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pied de Modal */}
                  <div style={{
                    padding: '12px 20px',
                    background: '#0f172a',
                    borderTop: '1px solid #334155',
                    display: 'flex',
                    justifyContent: 'flex-end'
                  }}>
                    <button
                      type="button"
                      onClick={() => setViewingBordereau(null)}
                      style={{
                        padding: '8px 18px',
                        borderRadius: '6px',
                        background: '#334155',
                        border: 'none',
                        color: '#fff',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* ONGLET 3 : JOURNAL DE CAISSE & STATISTIQUES                    */}
      {/* ============================================================== */}
      {activeTab === 'journal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px' }}>
          {/* Cartes KPI Financières Adaptatives */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: isMobile ? '10px' : '16px'
          }}>
            <div style={{
              background: '#1e293b',
              padding: isMobile ? '12px' : '18px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{ fontSize: isMobile ? '0.72rem' : '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                💰 Encaissé Patient
              </div>
              <div style={{ fontSize: isMobile ? '1.2rem' : '1.6rem', fontWeight: 900, color: '#4ade80', marginTop: '4px' }}>
                {kpiTotalPatient.toFixed(3)} <span style={{ fontSize: '0.75rem' }}>DT</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                Perçu au cabinet
              </div>
            </div>

            <div style={{
              background: '#1e293b',
              padding: isMobile ? '12px' : '18px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{ fontSize: isMobile ? '0.72rem' : '0.8rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 600 }}>
                🏛️ Créances CNAM
              </div>
              <div style={{ fontSize: isMobile ? '1.2rem' : '1.6rem', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>
                {kpiTotalCnam.toFixed(3)} <span style={{ fontSize: '0.75rem' }}>DT</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                Prise en charge CNAM
              </div>
            </div>

            <div style={{
              background: '#1e293b',
              padding: isMobile ? '12px' : '18px',
              borderRadius: '12px',
              border: '1.5px solid #0284c7'
            }}>
              <div style={{ fontSize: isMobile ? '0.72rem' : '0.8rem', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 600 }}>
                📈 CA Global
              </div>
              <div style={{ fontSize: isMobile ? '1.2rem' : '1.6rem', fontWeight: 900, color: '#f8fafc', marginTop: '4px' }}>
                {kpiTotalChiffreAffaires.toFixed(3)} <span style={{ fontSize: '0.75rem' }}>DT</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#38bdf8', marginTop: '2px' }}>
                Honoraires totaux
              </div>
            </div>

            <div style={{
              background: '#1e293b',
              padding: isMobile ? '12px' : '18px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{ fontSize: isMobile ? '0.72rem' : '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                🧾 Prestations / Actes
              </div>
              <div style={{ fontSize: isMobile ? '1.2rem' : '1.6rem', fontWeight: 900, color: '#f59e0b', marginTop: '4px' }}>
                {kpiTotalActes}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                Sur {filteredInvoices.length} factures
              </div>
            </div>
          </div>

          {/* Filtres de Période & Tableau des Factures */}
          <div style={{
            background: '#1e293b',
            padding: isMobile ? '14px' : '20px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'stretch' : 'center',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <h3 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.15rem', color: '#38bdf8' }}>
                Journal des Quittances & Règlements ({filteredInvoices.length})
              </h3>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '6px'
              }}>
                {['jour', 'semaine', 'mois', 'tout'].map(p => (
                  <button
                    key={p}
                    onClick={() => setJournalPeriod(p)}
                    style={{
                      padding: '7px 6px',
                      borderRadius: '6px',
                      background: journalPeriod === p ? '#0284c7' : '#0f172a',
                      border: '1px solid #334155',
                      color: journalPeriod === p ? '#fff' : '#94a3b8',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    {p === 'jour' ? "Aujourd'hui" : (p === 'semaine' ? 'Semaine' : (p === 'mois' ? 'Ce Mois' : 'Tout'))}
                  </button>
                ))}
              </div>
            </div>

            {filteredInvoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', background: '#0f172a', borderRadius: '8px', fontSize: '0.85rem' }}>
                Aucun règlement enregistré pour cette période.
              </div>
            ) : isMobile ? (
              /* VUE CARTE MOBILE DU JOURNAL */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredInvoices.map(inv => (
                  <div
                    key={inv.id}
                    style={{
                      background: '#0f172a',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid #334155',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    {/* Ligne 1 : Numéro, Date, Régime */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                          {inv.numFacture || `FAC-${inv.id}`}
                        </span>
                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{inv.date}</span>
                      </div>
                      <span style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        background: inv.modeReglement === 'gratuit' ? 'rgba(168, 85, 247, 0.2)' : inv.modeReglement === 'cnam_apci' ? 'rgba(217, 119, 6, 0.2)' : inv.modeReglement === 'cnam_mo' ? 'rgba(5, 150, 105, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                        color: inv.modeReglement === 'gratuit' ? '#c084fc' : inv.modeReglement === 'cnam_apci' ? '#fbbf24' : inv.modeReglement === 'cnam_mo' ? '#34d399' : '#38bdf8'
                      }}>
                        {inv.modeReglement === 'gratuit' ? '🎁 Gratuit' : inv.modeReglement === 'cnam_apci' ? '★ APCI' : inv.modeReglement === 'cnam_mo' ? '🏛️ CNAM' : '💵 Comptant'}
                      </span>
                    </div>

                    {/* Ligne 2 : Nom patient & Modalité */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.92rem' }}>
                        {inv.patientName}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'capitalize' }}>
                        {inv.moyenPaiement}
                      </span>
                    </div>

                    {/* Ligne 3 : Détail Chiffré */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.8rem',
                      paddingTop: '6px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      <span style={{ color: '#94a3b8' }}>Total: <strong>{(inv.totalGlobal || 0).toFixed(3)}</strong></span>
                      <span style={{ color: '#4ade80' }}>Payé: <strong>{(inv.partPatient || 0).toFixed(3)} DT</strong></span>
                      {inv.partCnam > 0 && (
                        <span style={{ color: '#38bdf8' }}>CNAM: <strong>{(inv.partCnam || 0).toFixed(3)}</strong></span>
                      )}
                    </div>

                    {/* Ligne 4 : Actions */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      marginTop: '4px'
                    }}>
                      <button
                        type="button"
                        onClick={() => {
                          const pat = patients.find(p => p.id === inv.patientId) || {
                            fullname: inv.patientName,
                            cnamid: inv.patientCnamId,
                            caisse: inv.patientCaisse,
                            cin: inv.patientCin,
                            apci: inv.patientApci,
                            apciLabel: inv.patientApciLabel
                          };
                          generateReceiptReport(pat, inv);
                        }}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '6px',
                          background: '#0284c7',
                          border: 'none',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px'
                        }}
                        title="Ré-imprimer la quittance en PDF"
                      >
                        <span>🖨️</span> Quittance
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteInvoice(inv)}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '6px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#f87171',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px'
                        }}
                        title="Supprimer définitivement ce paiement"
                      >
                        <span>🗑️</span> Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* VUE TABLEAU DESKTOP DU JOURNAL */
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '10px' }}>N° Facture</th>
                      <th style={{ padding: '10px' }}>Date</th>
                      <th style={{ padding: '10px' }}>Patient</th>
                      <th style={{ padding: '10px' }}>Mode Prise en Charge</th>
                      <th style={{ padding: '10px' }}>Moyen Paiement</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Total (DT)</th>
                      <th style={{ padding: '10px', textAlign: 'right', color: '#4ade80' }}>Payé Patient</th>
                      <th style={{ padding: '10px', textAlign: 'right', color: '#38bdf8' }}>Part CNAM</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map(inv => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '10px', fontWeight: 600, color: '#38bdf8' }}>
                          {inv.numFacture || `FAC-${inv.id}`}
                        </td>
                        <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{inv.date}</td>
                        <td style={{ padding: '10px', fontWeight: 600, color: '#f8fafc' }}>
                          {inv.patientName}
                        </td>
                        <td style={{ padding: '10px' }}>
                          {inv.modeReglement === 'cnam_apci' && (
                            <span style={{ color: '#f59e0b', fontWeight: 700 }}>★ CNAM APCI</span>
                          )}
                          {inv.modeReglement === 'cnam_mo' && (
                            <span style={{ color: '#34d399', fontWeight: 600 }}>🏛️ CNAM MO</span>
                          )}
                          {inv.modeReglement === 'comptant' && (
                            <span style={{ color: '#cbd5e1' }}>💵 Comptant</span>
                          )}
                          {inv.modeReglement === 'gratuit' && (
                            <span style={{ color: '#c084fc', fontWeight: 600 }}>🎁 Gratuit</span>
                          )}
                        </td>
                        <td style={{ padding: '10px', textTransform: 'capitalize', color: '#94a3b8' }}>
                          {inv.moyenPaiement}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>
                          {(inv.totalGlobal || 0).toFixed(3)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#4ade80', fontWeight: 700 }}>
                          {(inv.partPatient || 0).toFixed(3)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#38bdf8', fontWeight: 700 }}>
                          {(inv.partCnam || 0).toFixed(3)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const pat = patients.find(p => p.id === inv.patientId) || {
                                  fullname: inv.patientName,
                                  cnamid: inv.patientCnamId,
                                  caisse: inv.patientCaisse,
                                  cin: inv.patientCin,
                                  apci: inv.patientApci,
                                  apciLabel: inv.patientApciLabel
                                };
                                generateReceiptReport(pat, inv);
                              }}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                background: '#0284c7',
                                border: 'none',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600
                              }}
                              title="Ré-imprimer la quittance en PDF"
                            >
                              🖨️ Quittance
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteInvoice(inv)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#f87171',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600
                              }}
                              title="Supprimer définitivement ce paiement"
                            >
                              🗑️ Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
