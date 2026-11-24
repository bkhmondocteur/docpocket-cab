// ==============================================================
// DOCPOCKET CABINET - VUE COMPLÈTE CERTIFICATS & ATTESTATIONS MÉDICALES
// MODULE DÉDIÉ AVEC ACCÈS RAPIDE, HISTORIQUE ET ÉDITEUR DE MODÈLES
// ==============================================================

import React, { useState, useEffect } from 'react';
import { 
  getAllPatients, 
  getAllCertificates, 
  deleteCertificate 
} from '../services/patientStorage';
import { 
  getAllTemplates, 
  renderTemplateWithVariables 
} from '../services/templateEditorService';
import { 
  CERTIFICATE_CATEGORIES, 
  DEFAULT_DOCTOR_INFO,
  formatFrenchDate 
} from '../services/medicalCertificateService';
import CertificateModal from './CertificateModal';
import TemplateLayoutEditorModal from './TemplateLayoutEditorModal';

export default function CertificatesView({
  initialPatient = null,
  onOpenConsultation = null
}) {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(initialPatient || null);
  const [patientSearch, setPatientSearch] = useState('');
  const [activeTab, setActiveTab] = useState('templates'); // 'templates' | 'history'

  // Catégorie sélectionnée pour les modèles
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [templates, setTemplates] = useState([]);

  // Historique des certificats
  const [certificatesHistory, setCertificatesHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modals
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [selectedTemplateForIssue, setSelectedTemplateForIssue] = useState('repos_medical');
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editorInitialType, setEditorInitialType] = useState('certificate');

  // Charger patients et modèles au montage
  useEffect(() => {
    loadPatients();
    loadTemplates();
    loadHistory();
  }, []);

  // Mettre à jour si initialPatient change
  useEffect(() => {
    if (initialPatient) {
      setSelectedPatient(initialPatient);
    }
  }, [initialPatient]);

  const loadPatients = async () => {
    try {
      const list = await getAllPatients();
      setPatients(list || []);
    } catch (e) {
      console.error("Erreur chargement patients:", e);
    }
  };

  const loadTemplates = () => {
    const list = getAllTemplates('certificate');
    setTemplates(list || []);
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const certs = await getAllCertificates();
      certs.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
      setCertificatesHistory(certs || []);
    } catch (e) {
      console.error("Erreur historique certificats:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteCertificate = async (id) => {
    if (window.confirm("Êtes-vous certain de vouloir supprimer cette archive de certificat ?")) {
      try {
        await deleteCertificate(id);
        loadHistory();
      } catch (err) {
        alert("Erreur lors de la suppression : " + err.message);
      }
    }
  };

  const handlePrintHistoricalCert = (cert) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour imprimer.");
      return;
    }

    const title = cert.title || 'Certificat Médical';
    const content = cert.content || '';
    const dateFormatted = formatFrenchDate(cert.date || cert.createdAt);
    const doctorName = cert.doctor || 'Dr. Hamed BEN KHALIFA';

    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>${title} - ${cert.patientName || ''}</title>
        <style>
          @page { size: A5 portrait; margin: 12mm 14mm; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; margin: 0; padding: 16px; color: #111827; line-height: 1.6; }
          .header { border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
          .doc-name { font-size: 16px; font-weight: 800; color: #0369a1; text-transform: uppercase; }
          .doc-spec { font-size: 12px; color: #475569; font-weight: 600; margin-top: 2px; }
          .cert-title-box { text-align: center; margin: 25px 0 20px 0; }
          .cert-title { font-size: 18px; font-weight: 800; text-transform: uppercase; border-bottom: 2px solid #0284c7; padding-bottom: 4px; display: inline-block; }
          .patient-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 20px; font-size: 12.5px; }
          .cert-body { font-size: 13.5px; line-height: 1.8; text-align: justify; white-space: pre-line; min-height: 180px; }
          .footer-box { margin-top: 35px; display: flex; justify-content: space-between; align-items: flex-end; }
          .date-place { font-size: 12px; font-style: italic; color: #475569; }
          .signature-box { text-align: right; min-width: 170px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="doc-name">${doctorName}</div>
            <div class="doc-spec">Médecine Générale - Addictologie</div>
            <div style="font-size: 11px; color: #64748b;">N° d'Ordre Médecins : 12052</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #475569;">
            <div>Dar Attabib, Mahdia</div>
            <div>Tél : 31 576 900 / 53 573 117</div>
          </div>
        </div>

        <div class="cert-title-box">
          <div class="cert-title">${title}</div>
        </div>

        <div class="patient-box">
          <strong>Patient(e) :</strong> ${cert.patientName || 'Non spécifié'} &nbsp;|&nbsp; <strong>Date :</strong> ${dateFormatted}
        </div>

        <div class="cert-body">
          ${content}
        </div>

        <div class="footer-box">
          <div class="date-place">
            Fait à Mahdia, le ${dateFormatted}
          </div>
          <div class="signature-box">
            <div style="font-size: 11px; color: #475569; margin-bottom: 8px;">Signature & Cachet du Médecin :</div>
            <div style="height: 50px;"></div>
            <div style="font-weight: 700; font-size: 12px;">${doctorName}</div>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Filtrage des patients pour sélection rapide
  const filteredPatients = patientSearch.trim()
    ? patients.filter(p => {
        const full = `${p.nom || ''} ${p.prenom || ''}`.toLowerCase();
        const cin = (p.cin || '').toLowerCase();
        const q = patientSearch.toLowerCase();
        return full.includes(q) || cin.includes(q);
      }).slice(0, 10)
    : [];

  // Filtrage des modèles
  const filteredTemplates = templates.filter(t => {
    if (selectedCategory === 'all') return true;
    return t.category === selectedCategory;
  });

  // Filtrage historique
  const filteredHistory = certificatesHistory.filter(c => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    const pName = (c.patientName || '').toLowerCase();
    const title = (c.title || '').toLowerCase();
    const date = (c.date || '').toLowerCase();
    return pName.includes(q) || title.includes(q) || date.includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#0a0f1d', color: '#f8fafc' }}>
      {/* En-tête de la vue */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(15, 23, 42, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(2, 132, 199, 0.3))',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem'
          }}>
            📜
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Certificats & Attestations Médicales</span>
              <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                Cabinet Dr. BEN KHALIFA
              </span>
            </h2>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
              Émission de certificats médicaux, repos, aptitudes, CMI & Éditeur de mise en page personnalisé
            </div>
          </div>
        </div>

        {/* Boutons d'action principaux */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              setEditorInitialType('certificate');
              setIsEditorModalOpen(true);
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(147, 51, 234, 0.3))',
              color: '#d8b4fe',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.86rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <span>🎨</span>
            <span>Éditeur de Modèles (Mise en page & Textes)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!selectedPatient) {
                alert("Veuillez d'abord sélectionner un patient ci-dessous.");
                return;
              }
              setIsCertModalOpen(true);
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.86rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
            }}
          >
            <span>✍️</span>
            <span>Nouveau Certificat</span>
          </button>
        </div>
      </div>

      {/* Barre de contexte Patient */}
      <div style={{
        padding: '10px 24px',
        background: 'rgba(30, 41, 59, 0.5)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
          <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>👤 Patient actif :</span>
          {selectedPatient ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '4px 12px',
              borderRadius: '6px'
            }}>
              <span style={{ fontWeight: 800, color: '#38bdf8', fontSize: '0.9rem' }}>
                {selectedPatient.fullname || `${selectedPatient.nom || ''} ${selectedPatient.prenom || ''}`.trim()}
              </span>
              {selectedPatient.age && (
                <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>({selectedPatient.age} ans)</span>
              )}
              {selectedPatient.cin && (
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>CIN : {selectedPatient.cin}</span>
              )}
              {selectedPatient.cnamid && (
                <span style={{ fontSize: '0.75rem', color: '#34d399', background: 'rgba(52, 211, 153, 0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                  CNAM: {selectedPatient.cnamid}
                </span>
              )}
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem', marginLeft: '4px' }}
                title="Changer de patient"
              >
                &times;
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <input
                type="text"
                placeholder="🔍 Rechercher et sélectionner un patient (Nom, Prénom, CIN)..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
              {filteredPatients.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  zIndex: 20,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                }}>
                  {filteredPatients.map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedPatient(p);
                        setPatientSearch('');
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        fontSize: '0.85rem'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                        {p.fullname || `${p.nom || ''} ${p.prenom || ''}`.trim()}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {p.cin ? `CIN : ${p.cin}` : ''} {p.age ? `• ${p.age} ans` : ''} {p.telephone ? `• Tél: ${p.telephone}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Onglets de navigation interne (Modèles vs Historique) */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: activeTab === 'templates' ? 700 : 500,
              background: activeTab === 'templates' ? '#0284c7' : 'rgba(255, 255, 255, 0.06)',
              color: activeTab === 'templates' ? '#fff' : '#cbd5e1',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            📋 Modèles & Rédaction ({filteredTemplates.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              loadHistory();
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: activeTab === 'history' ? 700 : 500,
              background: activeTab === 'history' ? '#0284c7' : 'rgba(255, 255, 255, 0.06)',
              color: activeTab === 'history' ? '#fff' : '#cbd5e1',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            🗂️ Historique des Certificats Délivrés ({certificatesHistory.length})
          </button>
        </div>
      </div>

      {/* CONTENU PRINCIPAL */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px' }}>
        {activeTab === 'templates' ? (
          <div>
            {/* Barre de filtres par catégorie */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Filtrer par catégorie :</span>
              {CERTIFICATE_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: selectedCategory === cat.id ? 700 : 500,
                    background: selectedCategory === cat.id ? '#38bdf8' : 'rgba(255, 255, 255, 0.05)',
                    color: selectedCategory === cat.id ? '#0f172a' : '#cbd5e1',
                    border: '1px solid ' + (selectedCategory === cat.id ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'),
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Grille des Modèles */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px'
            }}>
              {filteredTemplates.map(tpl => (
                <div
                  key={tpl.id}
                  style={{
                    background: 'rgba(30, 41, 59, 0.45)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'border-color 0.15s ease',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.6rem' }}>
                          {tpl.category === 'travail' ? '🛌' : (tpl.category === 'aptitude' ? '⚽' : (tpl.category === 'legal' ? '⚖️' : '📋'))}
                        </span>
                        <div>
                          <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.98rem' }}>
                            {tpl.title}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '2px' }}>
                            Format {tpl.paperFormat || 'A5'} • {tpl.fontSize || '11pt'} • Marges {tpl.margins?.top || 35}mm
                          </div>
                        </div>
                      </div>
                      {tpl.isCustom && (
                        <span style={{ fontSize: '0.68rem', background: 'rgba(168, 85, 247, 0.2)', color: '#d8b4fe', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(168, 85, 247, 0.4)' }}>
                          Personnalisé
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '10px', lineHeight: 1.5 }}>
                      {tpl.description || 'Modèle officiel préconfiguré avec variables dynamiques automatiques.'}
                    </div>

                    {/* Extrait du modèle avec variables */}
                    <div style={{
                      marginTop: '10px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '0.74rem',
                      color: '#64748b',
                      fontFamily: 'Consolas, monospace',
                      maxHeight: '60px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {tpl.body?.slice(0, 160)}...
                    </div>
                  </div>

                  {/* Actions du modèle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedPatient) {
                          alert("Veuillez d'abord sélectionner un patient dans la barre en haut.");
                          return;
                        }
                        setSelectedTemplateForIssue(tpl.id);
                        setIsCertModalOpen(true);
                      }}
                      style={{
                        flex: 1,
                        padding: '7px 12px',
                        borderRadius: '6px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>✍️</span>
                      <span>Établir ce certificat</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditorInitialType('certificate');
                        setIsEditorModalOpen(true);
                      }}
                      style={{
                        padding: '7px 10px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: '#cbd5e1',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Modifier la mise en page, les marges ou les variables"
                    >
                      <span>⚙️</span>
                      <span>Mise en page</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Onglet Historique des certificats */
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ position: 'relative', width: '320px' }}>
                <input
                  type="text"
                  placeholder="🔍 Rechercher dans l'historique (Patient, date, titre)..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                {filteredHistory.length} certificat(s) archivé(s)
              </div>
            </div>

            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                Chargement de l'historique...
              </div>
            ) : filteredHistory.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                background: 'rgba(30, 41, 59, 0.3)',
                borderRadius: '12px',
                border: '1px dashed rgba(255, 255, 255, 0.1)'
              }}>
                <span style={{ fontSize: '2.5rem' }}>🗂️</span>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: '10px' }}>
                  Aucun certificat délivré pour le moment
                </div>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
                  Les certificats générés et enregistrés pour les patients apparaîtront ici pour consultation et réimpression instantanée.
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(30, 41, 59, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                      <th style={{ padding: '12px 16px' }}>Date</th>
                      <th style={{ padding: '12px 16px' }}>Patient</th>
                      <th style={{ padding: '12px 16px' }}>Type de Certificat</th>
                      <th style={{ padding: '12px 16px' }}>Détails / Diagnostic</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map(c => (
                      <tr
                        key={c.id}
                        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', transition: 'background 0.15s ease' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px 16px', color: '#38bdf8', fontWeight: 600 }}>
                          {formatFrenchDate(c.date || c.createdAt)}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#f8fafc' }}>
                          {c.patientName || 'Patient inconnu'}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>
                          <span style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.2)', fontSize: '0.78rem' }}>
                            {c.title || 'Certificat'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.8rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.diagnostic ? `Diag : ${c.diagnostic}` : (c.dureeJours ? `Repos : ${c.dureeJours} jours` : c.content?.slice(0, 60) + '...')}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => handlePrintHistoricalCert(c)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                background: 'rgba(56, 189, 248, 0.15)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              🖨️ Réimprimer
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCertificate(c.id)}
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                cursor: 'pointer',
                                fontSize: '0.78rem'
                              }}
                              title="Supprimer cette archive"
                            >
                              🗑️
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
        )}
      </div>

      {/* MODAL CERTIFICAT POUR ÉMISSION */}
      {isCertModalOpen && selectedPatient && (
        <CertificateModal
          isOpen={isCertModalOpen}
          onClose={() => setIsCertModalOpen(false)}
          patient={selectedPatient}
          onCertificateSaved={() => {
            loadHistory();
          }}
        />
      )}

      {/* MODAL ÉDITEUR DE MISE EN PAGE & MODÈLES */}
      {isEditorModalOpen && (
        <TemplateLayoutEditorModal
          isOpen={isEditorModalOpen}
          onClose={() => {
            setIsEditorModalOpen(false);
            loadTemplates();
          }}
          initialType={editorInitialType}
          patient={selectedPatient}
        />
      )}
    </div>
  );
}
