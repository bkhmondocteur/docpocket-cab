import React, { useState, useEffect } from 'react';
import {
  getConfreresDirectory,
  publishDoctorToDirectory,
  isMyProfilePublishedInDirectory,
  generateOrientationReport,
  SPECIALITES_LIST,
  VILLES_LIST
} from '../services/confreresDirectoryService';

export default function DirectoryView({ patients = [], initialSelectedPatient = null }) {
  const [confreres, setConfreres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialite, setSelectedSpecialite] = useState('Toutes les Spécialités');
  const [selectedVille, setSelectedVille] = useState('Toutes les Villes');

  // Modal d'Orientation Patient
  const [orientationConfrere, setOrientationConfrere] = useState(null);
  const [orientationPatientId, setOrientationPatientId] = useState(initialSelectedPatient?.id || '');
  const [orientationMotif, setOrientationMotif] = useState('');
  const [orientationObservations, setOrientationObservations] = useState('');

  // Modal Mon Inscription
  const [showMyProfileModal, setShowMyProfileModal] = useState(false);
  const [myProfile, setMyProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('docpocket_doctor_profile') || '{}');
    } catch {
      return {};
    }
  });
  const [publishing, setPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(() => isMyProfilePublishedInDirectory());

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const loadDirectory = async () => {
    try {
      setLoading(true);
      const data = await getConfreresDirectory();
      setConfreres(data);
    } catch (e) {
      console.warn("Erreur chargement annuaire:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory();
  }, []);

  useEffect(() => {
    if (initialSelectedPatient) {
      setOrientationPatientId(initialSelectedPatient.id);
    }
  }, [initialSelectedPatient]);

  // Filtrage des confrères
  const filteredConfreres = confreres.filter(c => {
    if (selectedSpecialite !== 'Toutes les Spécialités' && c.specialite !== selectedSpecialite) {
      return false;
    }
    if (selectedVille !== 'Toutes les Villes' && c.ville !== selectedVille) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNom = `${c.nom} ${c.prenom}`.toLowerCase().includes(q);
      const matchSpec = (c.specialite || '').toLowerCase().includes(q);
      const matchVille = (c.ville || '').toLowerCase().includes(q);
      const matchAdr = (c.adresse || '').toLowerCase().includes(q);
      if (!matchNom && !matchSpec && !matchVille && !matchAdr) return false;
    }
    return true;
  });

  // Action Publication Profil
  const handlePublishMyProfile = async (e) => {
    e.preventDefault();
    try {
      setPublishing(true);
      const res = await publishDoctorToDirectory(myProfile);
      if (res.success) {
        setIsPublished(true);
        alert("✓ Vos coordonnées ont été enregistrées avec succès dans l'Annuaire Médical Partagé DocPocket Cab ! Tous vos confrères peuvent désormais vous contacter et vous adresser des patients.");
        setShowMyProfileModal(false);
        loadDirectory();
      } else {
        alert("Erreur : " + res.error);
      }
    } catch (err) {
      alert("Erreur publication : " + err.message);
    } finally {
      setPublishing(false);
    }
  };

  // Action Génération Lettre d'Orientation
  const handleGenerateLetter = (e) => {
    e.preventDefault();
    const pat = patients.find(p => String(p.id) === String(orientationPatientId));
    if (!pat) {
      alert("Veuillez sélectionner un patient à orienter.");
      return;
    }
    generateOrientationReport(pat, orientationConfrere, {
      motif: orientationMotif,
      antecedents: pat.antecedents || pat.notes || "Sans antécédent particulier mentionné.",
      observations: orientationObservations,
      traitement: pat.traitements || "Traitement habituel en cours."
    });
    setOrientationConfrere(null);
    setOrientationMotif('');
    setOrientationObservations('');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '14px' : '20px',
      maxWidth: '100%',
      boxSizing: 'border-box'
    }}>
      {/* 1. BANNIÈRE D'EN-TÊTE RÉSEAU MÉDICAL */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.2) 0%, rgba(15, 23, 42, 0.85) 100%)',
        border: '1.5px solid #0284c7',
        borderRadius: '14px',
        padding: isMobile ? '16px' : '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
        gap: '14px',
        boxShadow: '0 8px 24px rgba(2, 132, 199, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: isMobile ? '44px' : '52px',
            height: isMobile ? '44px' : '52px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isMobile ? '1.5rem' : '1.8rem',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
            flexShrink: 0
          }}>
            👥
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: isMobile ? '1.15rem' : '1.35rem', color: '#f8fafc', fontWeight: 800 }}>
                Annuaire Médical des Confrères
              </h2>
              <span style={{
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#4ade80',
                border: '1px solid #10b981',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 700
              }}>
                ● Réseau Partagé DocPocket Cab
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: isMobile ? '0.78rem' : '0.85rem', color: '#cbd5e1' }}>
              Réseau confraternel national : trouvez des confrères spécialistes, contactez-les et adressez vos patients en 1 clic.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowMyProfileModal(true)}
          style={{
            padding: isMobile ? '10px 14px' : '10px 18px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            color: '#fff',
            fontWeight: 700,
            fontSize: isMobile ? '0.82rem' : '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
            whiteSpace: 'nowrap'
          }}
        >
          <span>📋</span> Mon inscription à l'Annuaire
        </button>
      </div>

      {/* 2. BARRE DE RECHERCHE ET FILTRES RAPIDES */}
      <div style={{
        background: '#1e293b',
        padding: isMobile ? '12px' : '16px 20px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center'
      }}>
        {/* Recherche libre */}
        <div style={{ flex: '1', minWidth: isMobile ? '100%' : '260px' }}>
          <input
            type="text"
            placeholder="🔍 Rechercher par nom de médecin, clinique, spécialité..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#0f172a',
              border: '1px solid #334155',
              color: '#fff',
              fontSize: '0.88rem'
            }}
          />
        </div>

        {/* Filtre Spécialité */}
        <div style={{ width: isMobile ? '100%' : '240px' }}>
          <select
            value={selectedSpecialite}
            onChange={(e) => setSelectedSpecialite(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              background: '#0f172a',
              border: '1px solid #334155',
              color: '#fff',
              fontSize: '0.85rem'
            }}
          >
            {SPECIALITES_LIST.map(spec => (
              <option key={spec} value={spec}>{spec}</option>
            ))}
          </select>
        </div>

        {/* Filtre Ville */}
        <div style={{ width: isMobile ? '100%' : '180px' }}>
          <select
            value={selectedVille}
            onChange={(e) => setSelectedVille(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              background: '#0f172a',
              border: '1px solid #334155',
              color: '#fff',
              fontSize: '0.85rem'
            }}
          >
            {VILLES_LIST.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Compteur de résultats */}
        <div style={{ fontSize: '0.82rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
          <strong>{filteredConfreres.length}</strong> confrère{filteredConfreres.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* 3. GRILLE DES CARTES CONFRÈRES */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          Chargement de l'annuaire des confrères...
        </div>
      ) : filteredConfreres.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          background: '#1e293b',
          borderRadius: '12px',
          color: '#94a3b8'
        }}>
          Aucun confrère ne correspond à vos critères de recherche.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: isMobile ? '12px' : '16px'
        }}>
          {filteredConfreres.map(confrere => {
            const initials = `${(confrere.prenom || 'M')[0]}${(confrere.nom || 'D')[0]}`.toUpperCase();
            const telClean = (confrere.telephone || '').split('/')[0].trim().replace(/\s+/g, '');
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${confrere.titre || 'Dr.'} ${confrere.prenom} ${confrere.nom} ${confrere.adresse || ''} ${confrere.ville}`)}`;

            return (
              <div
                key={confrere.id}
                style={{
                  background: '#1e293b',
                  border: confrere.isFoundingDoctor ? '1.5px solid #0284c7' : '1px solid #334155',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
                  transition: 'transform 0.15s ease'
                }}
              >
                <div>
                  {/* Ligne 1 : Avatar, Nom, Badge CNAM */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      background: confrere.isFoundingDoctor ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : '#334155',
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

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', fontWeight: 800 }}>
                          {confrere.titre || 'Dr.'} {confrere.prenom} {confrere.nom}
                        </h3>
                        {confrere.isFoundingDoctor && (
                          <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontWeight: 700 }}>
                            ★ Référent
                          </span>
                        )}
                      </div>

                      <div style={{ color: '#38bdf8', fontSize: '0.84rem', fontWeight: 700, marginTop: '2px' }}>
                        {confrere.specialite}
                      </div>
                    </div>
                  </div>

                  {/* Coordonnées détaillées */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.8rem', color: '#cbd5e1' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <span style={{ color: '#94a3b8' }}>📍</span>
                      <span>
                        <strong style={{ color: '#fff' }}>{confrere.ville}</strong>
                        {confrere.adresse ? ` • ${confrere.adresse}` : ''}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#94a3b8' }}>📞</span>
                      <span>{confrere.telephone || 'Non renseigné'}</span>
                    </div>

                    {confrere.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#94a3b8' }}>✉️</span>
                        <span style={{ color: '#94a3b8' }}>{confrere.email}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', fontSize: '0.74rem', color: '#64748b' }}>
                      {confrere.cnamId && (
                        <span>CNAM : <strong style={{ color: '#34d399' }}>{confrere.cnamId}</strong></span>
                      )}
                      {confrere.ordreId && (
                        <span>N° Ordre : <strong style={{ color: '#cbd5e1' }}>{confrere.ordreId}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Boutons d'Action Directe (Appeler, Mail, Maps, Lettre d'orientation) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '6px',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  {/* Bouton Appeler */}
                  <a
                    href={`tel:${telClean}`}
                    style={{
                      padding: '7px 6px',
                      borderRadius: '6px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: '#34d399',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      textDecoration: 'none'
                    }}
                    title="Appeler directement"
                  >
                    📞 Appel
                  </a>

                  {/* Bouton Email */}
                  {confrere.email ? (
                    <a
                      href={`mailto:${confrere.email}?subject=Contact%20Confraternel%20DocPocket%20Cab`}
                      style={{
                        padding: '7px 6px',
                        borderRadius: '6px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        color: '#38bdf8',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        textDecoration: 'none'
                      }}
                      title="Envoyer un email"
                    >
                      ✉️ Email
                    </a>
                  ) : (
                    <button
                      disabled
                      style={{
                        padding: '7px 6px',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: '#475569',
                        fontSize: '0.75rem'
                      }}
                    >
                      ✉️ Email
                    </button>
                  )}

                  {/* Bouton Itinéraire Google Maps */}
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '7px 6px',
                      borderRadius: '6px',
                      background: 'rgba(234, 179, 8, 0.15)',
                      border: '1px solid rgba(234, 179, 8, 0.35)',
                      color: '#facc15',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      textDecoration: 'none'
                    }}
                    title="Voir l'emplacement sur Google Maps"
                  >
                    📍 Plan
                  </a>

                  {/* Bouton Lettre d'Orientation Patient */}
                  <button
                    type="button"
                    onClick={() => setOrientationConfrere(confrere)}
                    style={{
                      padding: '7px 6px',
                      borderRadius: '6px',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
                    }}
                    title="Adresser un patient avec une lettre d'orientation officielle"
                  >
                    📄 Orienter
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. MODAL DE RÉDACTION D'UNE LETTRE D'ORIENTATION */}
      {orientationConfrere && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(5px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1.5px solid #0284c7',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '560px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📄</span> Lettre d'Orientation Médicale
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                  Destinataire : <strong>{orientationConfrere.titre || 'Dr.'} {orientationConfrere.prenom} {orientationConfrere.nom}</strong> ({orientationConfrere.specialite})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrientationConfrere(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateLetter} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Patient(e) à orienter *
                </label>
                <select
                  required
                  value={orientationPatientId}
                  onChange={(e) => setOrientationPatientId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.88rem'
                  }}
                >
                  <option value="">-- Choisissez un patient de votre cabinet --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.fullname || `${p.nom} ${p.prenom}`} {p.birthdate ? `(${p.birthdate})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Motif de l'adressage & Avis demandé *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Avis cardiologique devant précordialgies d'effort, Bilan échographique..."
                  value={orientationMotif}
                  onChange={(e) => setOrientationMotif(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Observations cliniques & éléments complémentaires
                </label>
                <textarea
                  rows={4}
                  placeholder="Constatations à l'examen clinique, constantes (TA, FC), résultats d'analyses ou examens récents..."
                  value={orientationObservations}
                  onChange={(e) => setOrientationObservations(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.88rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setOrientationConfrere(null)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid #475569',
                    color: '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
                  }}
                >
                  <span>🖨️</span> Générer la Lettre PDF / Imprimer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL MON INSCRIPTION À L'ANNUAIRE */}
      {showMyProfileModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(5px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1.5px solid #10b981',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, color: '#34d399', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📋</span> Mon Inscription à l'Annuaire Médical
              </h3>
              <button
                type="button"
                onClick={() => setShowMyProfileModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.45 }}>
              Publiez vos coordonnées professionnelles dans le Réseau des Médecins DocPocket Cab pour que vos confrères puissent vous trouver, vous joindre et vous adresser des patients.
            </p>

            <form onSubmit={handlePublishMyProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Titre</label>
                  <select
                    value={myProfile.titre || 'Dr.'}
                    onChange={(e) => setMyProfile({ ...myProfile, titre: e.target.value })}
                    style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  >
                    <option value="Dr.">Dr.</option>
                    <option value="Pr.">Pr.</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Nom & Prénom *</label>
                  <input
                    type="text"
                    required
                    value={myProfile.nom || ''}
                    onChange={(e) => setMyProfile({ ...myProfile, nom: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Spécialité</label>
                  <input
                    type="text"
                    value={myProfile.specialite || 'Médecine Générale'}
                    onChange={(e) => setMyProfile({ ...myProfile, specialite: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Ville</label>
                  <input
                    type="text"
                    value={myProfile.ville || 'Mahdia'}
                    onChange={(e) => setMyProfile({ ...myProfile, ville: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Adresse du Cabinet</label>
                <input
                  type="text"
                  value={myProfile.adresse || ''}
                  onChange={(e) => setMyProfile({ ...myProfile, adresse: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Téléphone Cabinet / Mobile</label>
                  <input
                    type="text"
                    value={myProfile.telephone || ''}
                    onChange={(e) => setMyProfile({ ...myProfile, telephone: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Email Professionnel</label>
                  <input
                    type="email"
                    value={myProfile.email || ''}
                    onChange={(e) => setMyProfile({ ...myProfile, email: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowMyProfileModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid #475569', color: '#94a3b8', cursor: 'pointer' }}
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  disabled={publishing}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {publishing ? 'Publication...' : '✓ Mettre à jour dans l\'Annuaire'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
