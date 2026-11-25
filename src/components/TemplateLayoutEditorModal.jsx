// ==============================================================
// DOCPOCKET CABINET - ÉDITEUR DE MODÈLES & MISE EN PAGE
// ORDONNANCES MÉDICALES ET CERTIFICATS AVEC VARIABLES DYNAMIQUES
// ==============================================================

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  AVAILABLE_VARIABLES,
  getAllTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  renderTemplateWithVariables
} from '../services/templateEditorService';
import { savePrescriptionSettings } from '../services/prescriptionSettingsService';

export default function TemplateLayoutEditorModal({
  isOpen,
  onClose,
  initialType = 'certificate', // 'certificate' | 'prescription'
  patient = null,
  consultation = null
}) {
  if (!isOpen) return null;

  const [docType, setDocType] = useState(initialType); // 'certificate' | 'prescription'
  const [templates, setTemplates] = useState(() => getAllTemplates(initialType));
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => {
    const list = getAllTemplates(initialType);
    return list[0]?.id || '';
  });

  // Modèle en cours d'édition
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('travail');
  const [paperFormat, setPaperFormat] = useState('A5');
  const [fontSize, setFontSize] = useState('11pt');
  const [textAlign, setTextAlign] = useState('left');
  const [margins, setMargins] = useState({ top: 35, bottom: 25, left: 20, right: 20 });
  const [showHeader, setShowHeader] = useState(true);
  const [showStamp, setShowStamp] = useState(true);
  const [showSignature, setShowSignature] = useState(true);
  const [bodyText, setBodyText] = useState('');

  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [activeTabPreview, setActiveTabPreview] = useState('editor'); // 'editor' | 'preview' | 'split'
  const textareaRef = useRef(null);

  // Recharger la liste quand on change de type de document
  useEffect(() => {
    const list = getAllTemplates(docType);
    setTemplates(list);
    if (list.length > 0) {
      loadTemplate(list[0]);
    } else {
      handleNewTemplate();
    }
  }, [docType]);

  const loadTemplate = (tmpl) => {
    if (!tmpl) return;
    setSelectedTemplateId(tmpl.id);
    setTitle(tmpl.title || 'Modèle sans titre');
    setDescription(tmpl.description || '');
    setCategory(tmpl.category || (docType === 'prescription' ? 'ordonnance' : 'travail'));
    setPaperFormat(tmpl.paperFormat || 'A5');
    setFontSize(tmpl.fontSize || '11pt');
    setTextAlign(tmpl.textAlign || 'left');
    setMargins(tmpl.margins || { top: 35, bottom: 25, left: 20, right: 20 });
    setShowHeader(tmpl.showHeader !== false);
    setShowStamp(tmpl.showStamp !== false);
    setShowSignature(tmpl.showSignature !== false);
    setBodyText(tmpl.body || '');
    setSaveSuccessMsg('');
  };

  const handleSelectTemplate = (id) => {
    const found = templates.find(t => t.id === id);
    if (found) loadTemplate(found);
  };

  const handleNewTemplate = () => {
    const isCert = docType === 'certificate';
    const isReport = docType === 'report';
    setSelectedTemplateId(`custom_${Date.now()}`);
    setTitle(isCert ? 'Nouveau Certificat Personnalisé' : (isReport ? 'Nouveau Rapport Médical' : 'Nouvelle Ordonnance Personnalisée'));
    setDescription('Modèle rédigé sur mesure avec variables dynamiques');
    setCategory(isCert ? 'travail' : (isReport ? 'rapport' : 'ordonnance'));
    setPaperFormat(isReport ? 'A4' : 'A5');
    setFontSize('11pt');
    setTextAlign('left');
    setMargins({ top: 35, bottom: 25, left: 20, right: 20 });
    setShowHeader(true);
    setShowStamp(true);
    setShowSignature(true);
    setBodyText(
      isCert
        ? `Je soussigné, {nom_medecin}, certifie avoir examiné ce jour :\n\n{nom_complet}, né(e) le {date_naissance} ({age}), titulaire de la CIN n° {cin}.\n\n[Saisissez ici le texte de votre certificat]\n\nFait à {ville}, le {date_du_jour}.`
        : isReport
        ? `RAPPORT MÉDICAL DE CONSULTATION\n\nPatient(e) : {nom_complet}\nDate de naissance : {date_naissance} ({age}) | CIN : {cin}\nConsultation du : {date_du_jour}\n\nMOTIF DE CONSULTATION :\n{motif}\n\nDONNÉES BIOMÉTRIQUES & CONSTANTES :\n{constantes}\n\nOBSERVATIONS CLINIQUES & DIAGNOSTIC :\nExamen clinique systématique réalisé ce jour.\nDiagnostic : {diagnostic}\n\nCONDUITE THÉRAPEUTIQUE & PRESCRIPTION :\n{liste_medicaments}\n\nRepos médical justifié : {nombre_jours_repos} ({jours_repos_lettres}) jours.\n\nFait à {ville}, le {date_du_jour}.`
        : `Patient(e) : {nom_complet}\nÂge : {age} | Date : {date_du_jour}\n\nPRESCRIPTION MÉDICALE :\n\n{liste_medicaments}\n\nOrdonnance valable 3 mois.`
    );
    setSaveSuccessMsg('');
  };

  // Insertion d'une variable dynamique à la position du curseur
  const insertVariable = (tag) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setBodyText(prev => prev + tag);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = bodyText;
    const updated = current.substring(0, start) + tag + current.substring(end);
    setBodyText(updated);

    // Repositionner le curseur juste après le tag
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  // Enregistrement
  const handleSave = () => {
    if (!title.trim()) {
      alert("Veuillez donner un titre à votre modèle.");
      return;
    }
    const toSave = {
      id: selectedTemplateId,
      type: docType,
      category,
      title: title.trim(),
      description: description.trim(),
      paperFormat,
      fontSize,
      textAlign,
      margins,
      showHeader,
      showStamp,
      showSignature,
      body: bodyText
    };

    saveCustomTemplate(toSave);

    // Mettre à jour et pérenniser le format d'impression global (A5 / A4 et marges)
    try {
      savePrescriptionSettings({
        pageSize: paperFormat,
        headerTopMargin: margins.top,
        sideMargin: margins.left,
        bottomMargin: margins.bottom
      });
      localStorage.setItem('docpocket_active_print_paper_size', paperFormat);
      localStorage.setItem(`docpocket_default_template_${docType}`, toSave.id);
    } catch (e) {
      console.warn("Erreur synchronisation réglages impression:", e);
    }

    const updatedList = getAllTemplates(docType);
    setTemplates(updatedList);
    setSelectedTemplateId(toSave.id);
    setSaveSuccessMsg(`✓ Modèle « ${title} » et format (${paperFormat}) enregistrés définitivement !`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // Suppression
  const handleDelete = () => {
    const current = templates.find(t => t.id === selectedTemplateId);
    if (!current) return;
    if (window.confirm(`Supprimer définitivement le modèle « ${current.title} » ?`)) {
      deleteCustomTemplate(selectedTemplateId);
      const updatedList = getAllTemplates(docType);
      setTemplates(updatedList);
      if (updatedList.length > 0) {
        loadTemplate(updatedList[0]);
      } else {
        handleNewTemplate();
      }
    }
  };

  // Exemple de données pour le rendu en temps réel
  const samplePatient = patient || {
    nom: 'BEN FOULEN',
    prenom: 'Foulen',
    fullname: 'M. Foulen BEN FOULEN',
    civility: 'M.',
    birthdate: '1982-05-14',
    cin: '08123456',
    passport: 'T987654',
    telephone: '98 123 456',
    adress: 'Avenue Habib Bourguiba',
    city: 'Mahdia',
    cnamid: '2008923676',
    caisse: 'CNSS',
    apci: '05'
  };

  const sampleContext = {
    patient: samplePatient,
    consultation: consultation || {
      diagnostic: 'Rhinopharyngite aiguë avec fébricule',
      motif: 'Consultation de médecine générale',
      reposJours: 3,
      reposDebut: new Date().toISOString().slice(0, 10),
      taMax: '12',
      taMin: '8',
      poids: '74'
    },
    data: {
      dureeJours: 3,
      dateDebut: new Date().toISOString().slice(0, 10),
      diagnostic: 'Syndrome grippal et état fébrile',
      medicaments: [
        { nom: 'PARACETAMOL 1g Comprimé', posologie: '1 comprimé 3 fois par jour si douleur ou fièvre', duree: '5 jours' },
        { nom: 'AMOXICILLINE 1g Comprimé', posologie: '1 comprimé matin et soir au milieu des repas', duree: '6 jours' },
        { nom: 'VITAMINE C 500mg Sachet', posologie: '1 sachet le matin dans un verre d\'eau', duree: '10 jours' }
      ]
    }
  };

  const previewRenderedText = renderTemplateWithVariables(bodyText, sampleContext);

  // Impression test
  const handlePrintTest = () => {
    const printWin = window.open('', '_blank', 'width=850,height=1000');
    if (!printWin) {
      alert("Veuillez autoriser les fenêtres pop-up pour tester l'impression.");
      return;
    }

    const doctorProfile = JSON.parse(localStorage.getItem('docpocket_doctor_profile') || '{}');
    const docNom = doctorProfile.nom ? `Dr. ${doctorProfile.nom}` : 'Dr. Hamed BEN KHALIFA';
    const docSpec = doctorProfile.specialite || 'Médecine Générale';
    const docOrdre = doctorProfile.ordreId || '12052';
    const docCnam = doctorProfile.cnamId || '010002763183';
    const docAdresse = doctorProfile.adresse || 'Complexe Médical Dar Attabib, Mahdia';
    const docTel = doctorProfile.telephone || '+216 73 680 888 / 98 250 500';

    const isA5 = paperFormat === 'A5';

    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>${title} - Aperçu Impression</title>
        <style>
          @page {
            size: ${paperFormat} portrait;
            margin: 0;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 0;
            background: #f1f5f9;
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #0f172a;
          }
          .page {
            width: ${isA5 ? '148mm' : '210mm'};
            min-height: ${isA5 ? '210mm' : '297mm'};
            margin: 15px auto;
            background: #fff;
            padding: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 8px;
            margin-bottom: 16px;
          }
          .doc-name { font-size: ${isA5 ? '14px' : '17px'}; font-weight: 800; color: #0369a1; text-transform: uppercase; }
          .doc-spec { font-size: ${isA5 ? '10px' : '12px'}; font-weight: 600; color: #334155; }
          .doc-sub { font-size: ${isA5 ? '8.5px' : '10px'}; color: #64748b; margin-top: 2px; }
          .doc-title-badge {
            display: inline-block;
            margin: 10px auto;
            padding: 4px 14px;
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            border-radius: 6px;
            font-size: ${isA5 ? '11px' : '13px'};
            font-weight: 800;
            color: #0284c7;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .content-body {
            font-size: ${fontSize};
            line-height: 1.65;
            white-space: pre-wrap;
            text-align: ${textAlign};
            flex: 1;
            color: #0f172a;
          }
          .footer-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 20px;
            padding-top: 10px;
          }
          .stamp-box {
            text-align: right;
            position: relative;
            min-height: 70px;
          }
          .stamp-img {
            max-width: ${isA5 ? '90px' : '110px'};
            max-height: ${isA5 ? '70px' : '85px'};
            opacity: 0.88;
          }
          .sig-img {
            position: absolute;
            right: 10px;
            bottom: 0px;
            max-width: ${isA5 ? '95px' : '120px'};
            opacity: 0.92;
          }
          @media print {
            body { background: #fff; }
            .page { margin: 0; box-shadow: none; width: 100%; min-height: 100vh; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="background: #0f172a; color: #fff; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-weight: 700;">Aperçu d'impression : ${title} (${paperFormat})</div>
          <button onclick="window.print()" style="padding: 8px 18px; background: #0284c7; color: #fff; border: none; border-radius: 6px; font-weight: 700; cursor: pointer;">🖨️ Imprimer maintenant</button>
        </div>

        <div class="page">
          <div>
            ${showHeader ? `
              <div class="header">
                <div class="doc-name">${docNom}</div>
                <div class="doc-spec">${docSpec}</div>
                <div class="doc-sub">N° Ordre : ${docOrdre} • Code CNAM : ${docCnam}</div>
                <div class="doc-sub">${docAdresse} • Tél : ${docTel}</div>
              </div>
            ` : `
              <div style="height: ${margins.top}mm;"></div>
            `}

            <div style="text-align: center;">
              <span class="doc-title-badge">${title}</span>
            </div>

            <div class="content-body">${previewRenderedText}</div>
          </div>

          <div class="footer-section">
            <div style="font-size: 9px; color: #94a3b8;">
              Établi à Mahdia, le ${new Date().toLocaleDateString('fr-FR')}
            </div>

            <div class="stamp-box">
              <div style="font-size: 10px; font-weight: 700; color: #475569; margin-bottom: 4px;">Signature & Griffe du Médecin :</div>
              ${showStamp ? `<img class="stamp-img" src="./assets/tampon-bkhmondocteur.png" alt="Tampon" onerror="this.style.display='none'" />` : ''}
              ${showSignature ? `<img class="sig-img" src="./assets/sig1.png" alt="Signature" onerror="this.style.display='none'" />` : ''}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  };

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(2, 6, 23, 0.88)',
      backdropFilter: 'blur(10px)',
      zIndex: 100000000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1280px',
        height: '92vh',
        background: '#0f172a',
        border: '1.5px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
        overflow: 'hidden'
      }}>
        {/* En-tête supérieur */}
        <div style={{
          padding: '14px 22px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(90deg, #0b1329 0%, #0f172a 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.4rem' }}>✍️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', fontWeight: 700 }}>
                Éditeur de Modèles & Mise en Page (Ordonnances & Certificats)
              </h2>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                Personnalisez librement le texte, positionnez vos variables dynamiques et calibrez l'impression
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {saveSuccessMsg && (
              <span style={{ color: '#4ade80', fontSize: '0.82rem', fontWeight: 600 }}>
                {saveSuccessMsg}
              </span>
            )}
            <button
              onClick={handlePrintTest}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid #0284c7',
                background: 'rgba(2, 132, 199, 0.15)',
                color: '#38bdf8',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.82rem'
              }}
              title="Tester le rendu réel d'impression"
            >
              🖨️ Tester l'Impression
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '7px 16px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.82rem',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
              }}
            >
              💾 Enregistrer ce Modèle
            </button>
            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid #334155',
                background: 'transparent',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '1.1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Barre de sélection de type et de modèles */}
        <div style={{
          padding: '10px 22px',
          background: '#131f38',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Bascule Type : Certificats vs Ordonnances vs Rapports */}
          <div style={{ display: 'flex', gap: '6px', background: '#0f172a', padding: '3px', borderRadius: '8px', border: '1px solid #334155' }}>
            <button
              onClick={() => setDocType('certificate')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: docType === 'certificate' ? '#0284c7' : 'transparent',
                color: docType === 'certificate' ? '#fff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              📜 Certificats & Attestations
            </button>
            <button
              onClick={() => setDocType('prescription')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: docType === 'prescription' ? '#0284c7' : 'transparent',
                color: docType === 'prescription' ? '#fff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              💊 Ordonnances Médicales
            </button>
            <button
              onClick={() => setDocType('report')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: docType === 'report' ? '#0284c7' : 'transparent',
                color: docType === 'report' ? '#fff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              📄 Rapports Médicaux
            </button>
          </div>

          {/* Sélecteur de modèle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '520px' }}>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: '8px',
                background: '#0f172a',
                border: '1px solid #334155',
                color: '#fff',
                fontSize: '0.82rem',
                fontWeight: 600
              }}
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.isCustom ? '★ ' : ''}{t.title} ({t.paperFormat || 'A5'})
                </option>
              ))}
            </select>
            <button
              onClick={handleNewTemplate}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #10b981',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}
            >
              + Nouveau Modèle
            </button>
            <button
              onClick={handleDelete}
              style={{
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid #ef4444',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#f87171',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
              title="Supprimer ce modèle"
            >
              🗑️
            </button>
          </div>

          {/* Mode d'affichage éditeur/aperçu */}
          <div style={{ display: 'flex', gap: '4px', background: '#0f172a', padding: '3px', borderRadius: '8px', border: '1px solid #334155' }}>
            <button
              onClick={() => setActiveTabPreview('split')}
              style={{
                padding: '5px 10px',
                borderRadius: '5px',
                border: 'none',
                background: activeTabPreview === 'split' ? '#334155' : 'transparent',
                color: activeTabPreview === 'split' ? '#fff' : '#94a3b8',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              ↔ Côte à côte
            </button>
            <button
              onClick={() => setActiveTabPreview('editor')}
              style={{
                padding: '5px 10px',
                borderRadius: '5px',
                border: 'none',
                background: activeTabPreview === 'editor' ? '#334155' : 'transparent',
                color: activeTabPreview === 'editor' ? '#fff' : '#94a3b8',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              ✍️ Éditeur seul
            </button>
            <button
              onClick={() => setActiveTabPreview('preview')}
              style={{
                padding: '5px 10px',
                borderRadius: '5px',
                border: 'none',
                background: activeTabPreview === 'preview' ? '#334155' : 'transparent',
                color: activeTabPreview === 'preview' ? '#fff' : '#94a3b8',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              👁️ Aperçu seul
            </button>
          </div>
        </div>

        {/* Corps central : Éditeur à gauche / Aperçu à droite */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* VOLET GAUCHE : ÉDITEUR & CONFIGURATION */}
          {(activeTabPreview === 'editor' || activeTabPreview === 'split') && (
            <div style={{
              flex: activeTabPreview === 'split' ? '1 1 55%' : '1 1 100%',
              borderRight: activeTabPreview === 'split' ? '1px solid #1e293b' : 'none',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: '16px 20px',
              gap: '14px'
            }}>
              {/* Informations du modèle */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.73rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                    Titre du document imprimé :
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="ex: Certificat de Repos Médical"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      color: '#fff',
                      fontSize: '0.85rem',
                      fontWeight: 700
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.73rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                    Format de papier :
                  </label>
                  <select
                    value={paperFormat}
                    onChange={(e) => setPaperFormat(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      color: '#38bdf8',
                      fontSize: '0.82rem',
                      fontWeight: 700
                    }}
                  >
                    <option value="A5">📄 Format A5 (Carnet usuel 148 × 210 mm)</option>
                    <option value="A4">📑 Format A4 (Feuille standard 210 × 297 mm)</option>
                  </select>
                </div>
              </div>

              {/* Réglages de mise en page & calibration */}
              <div style={{
                background: '#131f38',
                border: '1px solid #233554',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '14px',
                alignItems: 'center',
                fontSize: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Taille Police :</span>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value)}
                    style={{ padding: '3px 8px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '0.75rem' }}
                  >
                    <option value="9.5pt">9.5 pt (Compact)</option>
                    <option value="10.5pt">10.5 pt</option>
                    <option value="11pt">11 pt (Standard)</option>
                    <option value="12pt">12 pt (Grand)</option>
                    <option value="13pt">13 pt (Très grand)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Alignement :</span>
                  <select
                    value={textAlign}
                    onChange={(e) => setTextAlign(e.target.value)}
                    style={{ padding: '3px 8px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '0.75rem' }}
                  >
                    <option value="left">Gauche</option>
                    <option value="justify">Justifié</option>
                    <option value="center">Centré</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#cbd5e1', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showHeader} onChange={(e) => setShowHeader(e.target.checked)} />
                    En-tête Imprimé
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#cbd5e1', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showStamp} onChange={(e) => setShowStamp(e.target.checked)} />
                    Tampon
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#cbd5e1', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showSignature} onChange={(e) => setShowSignature(e.target.checked)} />
                    Signature
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                  <span style={{ color: '#94a3b8' }}>Marges (mm) :</span>
                  <input
                    type="number"
                    value={margins.top}
                    onChange={(e) => setMargins(m => ({ ...m, top: Number(e.target.value) }))}
                    title="Marge Haut"
                    style={{ width: '42px', padding: '2px 4px', background: '#0f172a', border: '1px solid #334155', color: '#38bdf8', borderRadius: '4px', textAlign: 'center', fontSize: '0.75rem' }}
                  />
                  <input
                    type="number"
                    value={margins.left}
                    onChange={(e) => setMargins(m => ({ ...m, left: Number(e.target.value) }))}
                    title="Marge Gauche"
                    style={{ width: '42px', padding: '2px 4px', background: '#0f172a', border: '1px solid #334155', color: '#38bdf8', borderRadius: '4px', textAlign: 'center', fontSize: '0.75rem' }}
                  />
                </div>
              </div>

              {/* PALETTE DES VARIABLES DYNAMIQUES */}
              <div style={{
                background: '#0b132b',
                border: '1px solid #1e3a8a',
                borderRadius: '10px',
                padding: '12px 14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#38bdf8' }}>
                    ⚡ Variables dynamiques à insérer (cliquez pour injecter au curseur) :
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                    Remplacées automatiquement à l'impression
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {AVAILABLE_VARIABLES
                    .filter(v => docType === 'certificate' ? v.category !== 'ordonnance' : true)
                    .map((v) => (
                      <button
                        key={v.tag}
                        type="button"
                        onClick={() => insertVariable(v.tag)}
                        title={`${v.label} (Ex: ${v.example})`}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #1e40af',
                          background: 'rgba(30, 64, 175, 0.25)',
                          color: '#93c5fd',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ color: '#60a5fa' }}>{v.tag}</span>
                        <span style={{ color: '#94a3b8', fontSize: '0.65rem' }}>{v.label}</span>
                      </button>
                    ))}
                </div>
              </div>

              {/* ZONE DE TEXTE LIBRE DU MODÈLE */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600 }}>
                    Corps du texte (ajoutez, modifiez ou supprimez librement) :
                  </label>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    {bodyText.length} caractères • {bodyText.split(/\s+/).filter(Boolean).length} mots
                  </span>
                </div>
                <textarea
                  ref={textareaRef}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Rédigez ici le corps de votre document en y intégrant les variables dynamiques..."
                  style={{
                    flex: 1,
                    minHeight: '260px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: '#090d1a',
                    border: '1.5px solid #1e293b',
                    color: '#f8fafc',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    resize: 'vertical',
                    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)'
                  }}
                />
              </div>
            </div>
          )}

          {/* VOLET DROIT : APERÇU EN TEMPS RÉEL */}
          {(activeTabPreview === 'preview' || activeTabPreview === 'split') && (
            <div style={{
              flex: activeTabPreview === 'split' ? '1 1 45%' : '1 1 100%',
              background: '#090d1a',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: '20px',
              alignItems: 'center'
            }}>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', maxWidth: '520px' }}>
                <span style={{ fontSize: '0.76rem', color: '#38bdf8', fontWeight: 700 }}>
                  👁️ Aperçu d'impression en temps réel ({paperFormat}) :
                </span>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  Avec données du patient d'exemple
                </span>
              </div>

              {/* Simulation de la feuille A5 ou A4 */}
              <div style={{
                width: '100%',
                maxWidth: paperFormat === 'A5' ? '460px' : '520px',
                minHeight: paperFormat === 'A5' ? '600px' : '720px',
                background: '#ffffff',
                color: '#0f172a',
                borderRadius: '6px',
                boxShadow: '0 10px 35px rgba(0,0,0,0.6)',
                padding: `${Math.max(15, margins.top * 0.75)}px ${Math.max(15, margins.right * 0.75)}px ${Math.max(15, margins.bottom * 0.75)}px ${Math.max(15, margins.left * 0.75)}px`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                fontFamily: 'Arial, sans-serif'
              }}>
                <div>
                  {/* En-tête cabinet */}
                  {showHeader && (
                    <div style={{
                      textAlign: 'center',
                      borderBottom: '2px solid #0284c7',
                      paddingBottom: '8px',
                      marginBottom: '14px'
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase' }}>
                        Dr. Hamed BEN KHALIFA
                      </div>
                      <div style={{ fontSize: '9.5px', fontWeight: 600, color: '#334155' }}>
                        Médecine Générale - Addictologie
                      </div>
                      <div style={{ fontSize: '8px', color: '#64748b', marginTop: '2px' }}>
                        N° Ordre : 12052 • Code CNAM : 010002763183
                      </div>
                      <div style={{ fontSize: '7.5px', color: '#64748b' }}>
                        Complexe Médical Dar Attabib, Mahdia • Tél : 73 680 888 / 98 250 500
                      </div>
                    </div>
                  )}

                  {/* Titre du document */}
                  <div style={{ textAlign: 'center', margin: '8px 0 12px 0' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 12px',
                      background: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 800,
                      color: '#0284c7',
                      textTransform: 'uppercase'
                    }}>
                      {title}
                    </span>
                  </div>

                  {/* Corps du texte fusionné */}
                  <div style={{
                    fontSize: fontSize,
                    lineHeight: 1.6,
                    textAlign: textAlign,
                    whiteSpace: 'pre-wrap',
                    color: '#0f172a'
                  }}>
                    {previewRenderedText}
                  </div>
                </div>

                {/* Bas de page avec signature et tampon */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  marginTop: '16px',
                  paddingTop: '8px'
                }}>
                  <div style={{ fontSize: '8px', color: '#94a3b8' }}>
                    Mahdia, le {new Date().toLocaleDateString('fr-FR')}
                  </div>

                  <div style={{ textAlign: 'right', position: 'relative', minHeight: '55px', minWidth: '120px' }}>
                    <div style={{ fontSize: '8px', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>
                      Signature & Tampon :
                    </div>
                    {showStamp && (
                      <img
                        src="./assets/tampon-bkhmondocteur.png"
                        alt="Tampon"
                        style={{ maxHeight: '50px', maxWidth: '75px', opacity: 0.88 }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    {showSignature && (
                      <img
                        src="./assets/sig1.png"
                        alt="Signature"
                        style={{ position: 'absolute', right: '5px', bottom: '0px', maxHeight: '45px', maxWidth: '75px', opacity: 0.92 }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
