import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  CERTIFICATE_CATEGORIES,
  CERTIFICATE_TEMPLATES,
  DEFAULT_DOCTOR_INFO,
  formatFrenchDate
} from '../services/medicalCertificateService';
import { saveCertificate } from '../services/patientStorage';

export default function CertificateModal({
  isOpen,
  onClose,
  patient,
  consultation = null,
  onCertificateSaved = () => {}
}) {
  if (!isOpen) return null;

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState('repos_medical');
  const [doctorInfo, setDoctorInfo] = useState(DEFAULT_DOCTOR_INFO);
  const [useStamp, setUseStamp] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form parameters
  const [formData, setFormData] = useState({
    dureeJours: 3,
    dateDebut: new Date().toISOString().slice(0, 10),
    dateReprise: '',
    afficherDiagnostic: false,
    diagnostic: consultation?.diagnostic || '',
    remarques: '',
    disciplineSportive: '',
    posteEmploi: '',
    passport: patient?.passport || '',
    nationalite: 'Tunisienne',
    destination: '',
    nomMalade: '',
    lienParente: '',
    etablissement: '',
    heureArrivee: '09:00',
    heureDepart: '09:30',
    dateFaits: '',
    heureFaits: '',
    doleances: '',
    examenClinique: '',
    dureeItt: 10,
    categoriePermis: 'B (Tourisme)',
    acuiteVisuelle: '10/10',
    avecCorrection: false,
    dateDeces: new Date().toISOString().slice(0, 10),
    heureDeces: '08:00',
    lieuDeces: 'Mahdia',
    obstacleMedicoLegal: false,
    miseEnBiere: false,
    antecedents: patient?.antecedents || '',
    diagnosticDetaille: consultation?.diagnostic || '',
    traitementsEnCours: '',
    evolutionClinique: '',
    conclusion: ''
  });

  const [customText, setCustomText] = useState('');
  const printFrameRef = useRef(null);

  // Charger profil médecin si configuré dans localStorage
  useEffect(() => {
    try {
      const savedDoc = localStorage.getItem('docpocket_doctor_profile');
      if (savedDoc) {
        const parsed = JSON.parse(savedDoc);
        setDoctorInfo(prev => ({
          ...prev,
          nom: parsed.nom ? `Dr. ${parsed.nom}` : prev.nom,
          specialite: parsed.specialite || prev.specialite,
          numOrdre: parsed.numOrdre || prev.numOrdre,
          adresse: parsed.adresse || prev.adresse,
          telephone: parsed.telephone || prev.telephone,
          email: parsed.email || prev.email
        }));
      }
    } catch (e) {}
  }, []);

  // Définir le modèle actif
  const currentTemplate = CERTIFICATE_TEMPLATES.find(t => t.id === selectedTemplateId) || CERTIFICATE_TEMPLATES[0];

  // Régénérer le texte dès que le modèle ou les paramètres changent
  useEffect(() => {
    if (currentTemplate && patient) {
      const gen = currentTemplate.generateText(patient, formData, doctorInfo);
      setCustomText(gen);
    }
  }, [selectedTemplateId, patient, formData.dureeJours, formData.dateDebut, formData.afficherDiagnostic, formData.diagnostic, formData.remarques, formData.nomMalade, formData.disciplineSportive, formData.posteEmploi, formData.dureeItt, formData.dateFaits, formData.heureFaits, formData.doleances, formData.examenClinique, formData.passport, formData.categoriePermis, formData.acuiteVisuelle, formData.avecCorrection, formData.dateDeces, formData.heureDeces, formData.obstacleMedicoLegal, formData.miseEnBiere, formData.antecedents, formData.diagnosticDetaille, formData.traitementsEnCours, formData.evolutionClinique, formData.conclusion]);

  // Filtrer les modèles par catégorie
  const filteredTemplates = selectedCategory === 'all'
    ? CERTIFICATE_TEMPLATES
    : CERTIFICATE_TEMPLATES.filter(t => t.category === selectedCategory);

  // Enregistrer dans la base IndexedDB
  const handleSave = async () => {
    if (!patient?.id) return;
    setIsSaving(true);
    try {
      const certRecord = {
        patientId: String(patient.id),
        patientName: patient.fullname || `${patient.nom || ''} ${patient.prenom || ''}`.trim(),
        templateId: selectedTemplateId,
        title: currentTemplate.title,
        content: customText,
        date: formData.dateDebut || new Date().toISOString().slice(0, 10),
        dureeJours: formData.dureeJours,
        afficherDiagnostic: formData.afficherDiagnostic,
        diagnostic: formData.diagnostic,
        doctor: doctorInfo.nom,
        hasStamp: useStamp,
        createdAt: new Date().toISOString()
      };
      await saveCertificate(certRecord);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      onCertificateSaved(certRecord);
    } catch (err) {
      console.error("Erreur enregistrement certificat:", err);
      alert("Erreur lors de l'enregistrement du certificat : " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Impression native directe haute définition
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour imprimer le certificat.");
      return;
    }

    const patientName = patient?.fullname || `${patient?.nom || ''} ${patient?.prenom || ''}`.trim();
    const cin = patient?.cin ? `CIN : ${patient.cin}` : (patient?.passport ? `Passeport : ${patient.passport}` : '');
    const age = patient?.age ? `${patient.age} ans` : (patient?.birthdate ? `Né(e) le : ${formatFrenchDate(patient.birthdate)}` : '');
    const todayStr = formatFrenchDate(new Date().toISOString().slice(0, 10));

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>${currentTemplate.title} - ${patientName}</title>
        <style>
          @page {
            size: A5 portrait;
            margin: 12mm 14mm;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
          }
          body {
            font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
            color: #111827;
            margin: 0;
            padding: 12px;
            background: #fff;
            line-height: 1.6;
          }
          .header {
            border-bottom: 2px solid #0284c7;
            padding-bottom: 12px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .doc-name {
            font-size: 17px;
            font-weight: 800;
            color: #0369a1;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .doc-spec {
            font-size: 12px;
            color: #334155;
            font-weight: 600;
            margin-top: 2px;
          }
          .doc-meta {
            font-size: 11px;
            color: #64748b;
            margin-top: 3px;
          }
          .right-header {
            text-align: right;
            font-size: 11px;
            color: #475569;
          }
          .cert-title-box {
            text-align: center;
            margin: 25px 0 20px 0;
          }
          .cert-title {
            display: inline-block;
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 4px;
          }
          .patient-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 14px;
            margin-bottom: 20px;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .patient-name {
            font-weight: 700;
            color: #0f172a;
            font-size: 13px;
          }
          .cert-body {
            font-size: 13.5px;
            line-height: 1.8;
            color: #1e293b;
            white-space: pre-line;
            text-align: justify;
            min-height: 180px;
          }
          .footer-box {
            margin-top: 35px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .date-place {
            font-size: 12px;
            color: #334155;
            font-style: italic;
          }
          .signature-box {
            text-align: center;
            width: 200px;
          }
          .signature-title {
            font-size: 12px;
            font-weight: 700;
            color: #0369a1;
            margin-bottom: 8px;
          }
          .stamp-img {
            max-width: 170px;
            max-height: 95px;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="doc-name">${doctorInfo.nom}</div>
            <div class="doc-spec">${doctorInfo.specialite}</div>
            <div class="doc-meta">Inscrit au Conseil de l'Ordre N° ${doctorInfo.numOrdre}</div>
          </div>
          <div class="right-header">
            <div>${doctorInfo.adresse}</div>
            <div>Tél : ${doctorInfo.telephone}</div>
            <div>${doctorInfo.email}</div>
          </div>
        </div>

        <div class="cert-title-box">
          <span class="cert-title">${currentTemplate.title}</span>
        </div>

        <div class="patient-box">
          <div>
            <span class="patient-name">${patientName}</span>
            ${age ? ` &bull; <span>${age}</span>` : ''}
          </div>
          <div>${cin}</div>
        </div>

        <div class="cert-body">${customText}</div>

        <div class="footer-box">
          <div class="date-place">
            Fait à ${doctorInfo.ville}, le ${todayStr}
          </div>
          <div class="signature-box">
            <div class="signature-title">Signature et Cachet du Médecin</div>
            ${useStamp ? `<img class="stamp-img" src="${window.location.origin}/assets/tampon-bkhmondocteur.png" onerror="this.style.display='none'" alt="Cachet Médical" />` : '<div style="height: 60px;"></div>'}
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Copier le texte du certificat
  const handleCopy = () => {
    navigator.clipboard.writeText(customText);
    alert("✓ Texte du certificat copié dans le presse-papier !");
  };

  const patientName = patient?.fullname || `${patient?.nom || ''} ${patient?.prenom || ''}`.trim() || 'Patient inconnu';

  return typeof document !== 'undefined' && createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(10, 15, 29, 0.94)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999999,
      padding: '16px',
      boxSizing: 'border-box'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '860px',
        maxHeight: 'min(94vh, 760px)',
        height: '92vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#0f172a',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        {/* En-tête du Modal */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(30, 41, 59, 0.85)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>📜</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#38bdf8', fontWeight: 700 }}>
                Certificats & Attestations Médicales
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Patient : <strong style={{ color: '#f8fafc' }}>{patientName}</strong> {patient?.cin ? `(CIN: ${patient.cin})` : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.6rem', cursor: 'pointer', padding: '2px 8px' }}
          >
            &times;
          </button>
        </div>

        {/* Corps du modal : 2 colonnes (Modèles à gauche, Formulaire et Prévisualisation à droite) */}
        <div style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden'
        }}>
          {/* Colonne Gauche : Sélection des Modèles */}
          <div style={{
            width: '280px',
            flexShrink: 0,
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(15, 23, 42, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Filtres par Catégorie */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', overflowX: 'auto', display: 'flex', gap: '6px' }}>
              {CERTIFICATE_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: selectedCategory === cat.id ? 700 : 500,
                    background: selectedCategory === cat.id ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
                    color: selectedCategory === cat.id ? '#fff' : '#94a3b8',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Liste des Modèles disponibles */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px' }}>
              {filteredTemplates.map(tpl => {
                const isSelected = selectedTemplateId === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => {
                      setSelectedTemplateId(tpl.id);
                      if (tpl.defaultDays) {
                        setFormData(prev => ({ ...prev, dureeJours: tpl.defaultDays }));
                      }
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      marginBottom: '6px',
                      background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.4)',
                      border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.05)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>{tpl.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: isSelected ? '#38bdf8' : '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {tpl.shortLabel}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                          {tpl.language === 'ar_fr' ? 'Bilingue Arabe / Français' : (tpl.language === 'bilingue' ? 'Bilingue Anglais / Français' : 'Français standard')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Colonne Droite : Paramètres et Éditeur de Texte */}
          <div style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '16px 20px',
            gap: '14px'
          }}>
            {/* Titre du modèle actif */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{currentTemplate.icon}</span>
                <span>{currentTemplate.title}</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#38bdf8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useStamp}
                  onChange={(e) => setUseStamp(e.target.checked)}
                  style={{ accentColor: '#0284c7' }}
                />
                <span>Apposer Cachet & Signature</span>
              </label>
            </div>

            {/* Champs spécifiques dynamiques selon le modèle */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {/* Durée en jours & Date de début si applicable */}
              {currentTemplate.fields.includes('dureeJours') && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: '1 1 140px' }}>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      📅 Durée du repos :
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={formData.dureeJours}
                        onChange={(e) => setFormData({ ...formData, dureeJours: parseInt(e.target.value, 10) || 1 })}
                        style={{
                          width: '80px',
                          padding: '6px 10px',
                          background: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.95rem'
                        }}
                      />
                      <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>jours</span>
                    </div>
                  </div>

                  {/* Raccourcis durées courantes */}
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', paddingTop: '16px' }}>
                    {[1, 2, 3, 5, 7, 10, 15, 21].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setFormData({ ...formData, dureeJours: d })}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.74rem',
                          background: formData.dureeJours === d ? '#0284c7' : 'rgba(255, 255, 255, 0.06)',
                          color: formData.dureeJours === d ? '#fff' : '#94a3b8',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        +{d}j
                      </button>
                    ))}
                  </div>

                  <div style={{ flex: '1 1 160px' }}>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Date de début :
                    </label>
                    <input
                      type="date"
                      value={formData.dateDebut}
                      onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
                      style={{
                        padding: '6px 10px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Diagnostic médical optionnel (secret médical) */}
              {currentTemplate.fields.includes('diagnosticOptionnel') && (
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <input
                      type="checkbox"
                      id="diagCheck"
                      checked={formData.afficherDiagnostic}
                      onChange={(e) => setFormData({ ...formData, afficherDiagnostic: e.target.checked })}
                      style={{ accentColor: '#0284c7' }}
                    />
                    <label htmlFor="diagCheck" style={{ fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      Mentionner le diagnostic sur le certificat (secret médical)
                    </label>
                  </div>
                  {formData.afficherDiagnostic && (
                    <input
                      type="text"
                      placeholder="Préciser le diagnostic (ex: Broncho-pneumopathie aiguë, Lumbago...)"
                      value={formData.diagnostic}
                      onChange={(e) => setFormData({ ...formData, diagnostic: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  )}
                </div>
              )}

              {/* Accompagnement : Proche & Etablissement */}
              {currentTemplate.fields.includes('nomMalade') && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Nom du proche hospitalisé (ex: sa mère Mme Fatma...)"
                    value={formData.nomMalade}
                    onChange={(e) => setFormData({ ...formData, nomMalade: e.target.value })}
                    style={{ flex: 1, padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                  />
                  <input
                    type="text"
                    placeholder="Établissement / Hôpital (ex: Hôpital Tahar Sfar Mahdia)"
                    value={formData.etablissement}
                    onChange={(e) => setFormData({ ...formData, etablissement: e.target.value })}
                    style={{ flex: 1, padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                  />
                </div>
              )}

              {/* CMI : Agression / ITT */}
              {currentTemplate.fields.includes('dureeItt') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="date"
                      placeholder="Date des faits"
                      value={formData.dateFaits}
                      onChange={(e) => setFormData({ ...formData, dateFaits: e.target.value })}
                      style={{ flex: 1, padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                    />
                    <input
                      type="text"
                      placeholder="Heure des faits (ex: 14h30)"
                      value={formData.heureFaits}
                      onChange={(e) => setFormData({ ...formData, heureFaits: e.target.value })}
                      style={{ width: '120px', padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: 700 }}>I.T.T. :</span>
                      <input
                        type="number"
                        min="0"
                        value={formData.dureeItt}
                        onChange={(e) => setFormData({ ...formData, dureeItt: parseInt(e.target.value, 10) || 0 })}
                        style={{ width: '70px', padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontWeight: 700 }}
                      />
                      <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>jours</span>
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Constatations et lésions traumatiques à l'examen clinique..."
                    value={formData.examenClinique}
                    onChange={(e) => setFormData({ ...formData, examenClinique: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              {/* Aptitude Sport : Discipline */}
              {currentTemplate.fields.includes('disciplineSportive') && (
                <div>
                  <input
                    type="text"
                    placeholder="Discipline sportive (ex: Football, Natation, Athlétisme...)"
                    value={formData.disciplineSportive}
                    onChange={(e) => setFormData({ ...formData, disciplineSportive: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>
              )}
            </div>

            {/* Éditeur de texte en direct du certificat */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 700 }}>
                  ✍️ Texte du certificat (modifiable librement avant impression) :
                </label>
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.76rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  📋 Copier le texte
                </button>
              </div>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                rows={11}
                style={{
                  width: '100%',
                  flex: 1,
                  minHeight: '180px',
                  padding: '12px 14px',
                  background: '#0a0f1d',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '0.86rem',
                  lineHeight: 1.6,
                  resize: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        </div>

        {/* Pied de page fixe avec actions */}
        <div style={{
          flexShrink: 0,
          background: '#0b1324',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          zIndex: 10
        }}>
          <div>
            {savedSuccess && (
              <span style={{ color: '#4ade80', fontSize: '0.88rem', fontWeight: 700 }}>
                ✓ Enregistré dans le dossier patient !
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.88rem'
              }}
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                cursor: isSaving ? 'wait' : 'pointer',
                fontWeight: 700,
                fontSize: '0.88rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              💾 Enregistrer
            </button>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                padding: '10px 22px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.9rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.45)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🖨️ Imprimer le Certificat
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
