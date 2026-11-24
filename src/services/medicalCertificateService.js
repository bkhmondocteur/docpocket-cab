/**
 * Service de Gestion et Génération des Certificats & Attestations Médicales
 * DocPocket Cabinet - Conforme aux modèles du cabinet du Dr. Hamed BEN KHALIFA
 * Ordre des Médecins N° 12052 - Mahdia, Tunisie
 */

export const DEFAULT_DOCTOR_INFO = {
  nom: 'Dr. Hamed BEN KHALIFA',
  specialite: 'Médecine Générale - Addictologie',
  titres: 'Ancien Médecin des Hôpitaux - Addictologue',
  numOrdre: '12052',
  codeConventionnel: '',
  adresse: 'Complexe Médical Dar Attabib, Ave Taieb Mhiri, 5100 Mahdia',
  telephone: '+216 73 680 888 / 98 250 500',
  ville: 'Mahdia',
  email: 'bkhmondocteur@gmail.com',
  stampUrl: './assets/tampon-bkhmondocteur.png',
  sigUrl: './assets/sig1.png'
};

export const CERTIFICATE_CATEGORIES = [
  { id: 'all', label: 'Tous les modèles' },
  { id: 'travail', label: 'Arrêt de travail & Repos' },
  { id: 'aptitude', label: 'Aptitude & Sport' },
  { id: 'legal', label: 'Médicolégal & CMI' },
  { id: 'attestation', label: 'Attestations & Présence' },
  { id: 'rapport', label: 'Rapports cliniques' }
];

export const CERTIFICATE_TEMPLATES = [
  {
    id: 'repos_medical',
    category: 'travail',
    title: 'Certificat de Repos Médical',
    shortLabel: 'Repos médical',
    icon: '🛌',
    language: 'fr',
    defaultDays: 3,
    fields: ['dureeJours', 'dateDebut', 'diagnosticOptionnel', 'remarques'],
    generateText: (p, data, doc) => {
      const patientName = p?.fullname || `${p?.nom || ''} ${p?.prenom || ''}`.trim() || '........................................';
      const cin = p?.cin ? `titulaire de la CIN n° ${p.cin}` : (p?.passport ? `titulaire du passeport n° ${p.passport}` : 'titulaire de la CIN n° ....................');
      const jours = data.dureeJours || 3;
      const debut = data.dateDebut || new Date().toISOString().slice(0, 10);
      const diagPart = data.afficherDiagnostic && data.diagnostic ? `\n\nDiagnostic clinique : ${data.diagnostic}.` : '';
      const remPart = data.remarques ? `\n\nObservations : ${data.remarques}` : '';

      return `Je soussigné, ${doc.nom}, certifie avoir examiné ce jour le(la) patient(e) :\n` +
             `M./Mme : ${patientName}, ${cin}.\n\n` +
             `À l'issue de cet examen clinique, il ressort que son état de santé justifie un repos médical et des soins d'une durée de ${jours} (${convertNumberToFrenchWords(jours)}) jours, à compter du ${formatFrenchDate(debut)}, sous réserve de complication ultérieure.${diagPart}${remPart}\n\n` +
             `Le présent certificat est délivré à l'intéressé(e) pour servir et faire valoir ce que de droit.`;
    }
  },
  {
    id: 'prolongation_repos',
    category: 'travail',
    title: 'Prolongation d\'Arrêt de Travail',
    shortLabel: 'Prolongation repos',
    icon: '⏳',
    language: 'fr',
    defaultDays: 5,
    fields: ['dureeJours', 'dateDebut', 'diagnosticOptionnel', 'remarques'],
    generateText: (p, data, doc) => {
      const patientName = p?.fullname || `${p?.nom || ''} ${p?.prenom || ''}`.trim() || '........................................';
      const cin = p?.cin ? `titulaire de la CIN n° ${p.cin}` : 'titulaire de la CIN n° ....................';
      const jours = data.dureeJours || 5;
      const debut = data.dateDebut || new Date().toISOString().slice(0, 10);
      const diagPart = data.afficherDiagnostic && data.diagnostic ? `\n\nMotif médical : ${data.diagnostic}.` : '';

      return `Je soussigné, ${doc.nom}, certifie avoir examiné ce jour :\n` +
             `M./Mme : ${patientName}, ${cin}.\n\n` +
             `Et atteste que l'évolution de son état de santé nécessite une PROLONGATION de son repos médical pour une durée supplémentaire de ${jours} (${convertNumberToFrenchWords(jours)}) jours, à compter du ${formatFrenchDate(debut)} inclus, sous réserve de complication ultérieure.${diagPart}\n\n` +
             `Certificat délivré à la demande de l'intéressé(e) pour servir et faire valoir ce que de droit.`;
    }
  },
  {
    id: 'reprise_travail',
    category: 'travail',
    title: 'Certificat de Reprise de Travail / Guérison',
    shortLabel: 'Reprise de travail',
    icon: '✅',
    language: 'fr',
    fields: ['dateReprise', 'remarques'],
    generateText: (p, data, doc) => {
      const patientName = p?.fullname || `${p?.nom || ''} ${p?.prenom || ''}`.trim() || '........................................';
      const cin = p?.cin ? `titulaire de la CIN n° ${p.cin}` : 'titulaire de la CIN n° ....................';
      const reprise = data.dateReprise || new Date().toISOString().slice(0, 10);

      return `Je soussigné, ${doc.nom}, certifie avoir examiné ce jour :\n` +
             `M./Mme : ${patientName}, ${cin}.\n\n` +
             `À l'issue de cet examen de contrôle, je constate la guérison clinique de l'affection en cause et l'aptitude médicale du/de la patient(e) à reprendre son activité professionnelle à compter du ${formatFrenchDate(reprise)}.\n\n` +
             `Délivré à la demande de l'intéressé(e) pour faire valoir ce que de droit.`;
    }
  },
  {
    id: 'aptitude_sport',
    category: 'aptitude',
    title: 'Certificat Médical d\'Aptitude au Sport',
    shortLabel: 'Aptitude au sport',
    icon: '🏃‍♂️',
    language: 'fr',
    fields: ['disciplineSportive', 'remarques'],
    generateText: (p, data, doc) => {
      const patientName = p?.fullname || `${p?.nom || ''} ${p?.prenom || ''}`.trim() || '........................................';
      const age = p?.age ? `${p.age} ans` : (p?.birthdate ? `né(e) le ${formatFrenchDate(p.birthdate)}` : '');
      const cin = p?.cin ? `(CIN n° ${p.cin})` : '';
      const sport = data.disciplineSportive ? `la pratique du sport : « ${data.disciplineSportive} » (y compris en compétition)` : 'la pratique des activités physiques et sportives';

      return `Je soussigné, ${doc.nom}, certifie avoir examiné ce jour :\n` +
             `M./Mme : ${patientName} ${age} ${cin}.\n\n` +
             `L'examen clinique complet et l'interrogatoire n'ont pas révélé à ce jour de contre-indication médicale apparente à ${sport}.\n\n` +
             `Le présent certificat est délivré pour servir et faire valoir ce que de droit.`;
    }
  },
  {
    id: 'aptitude_embauche',
    category: 'aptitude',
    title: 'Certificat d\'Aptitude Physique à l\'Embauche',
    shortLabel: 'Aptitude embauche',
    icon: '💼',
    language: 'fr',
    fields: ['posteEmploi', 'remarques'],
    generateText: (p, data, doc) => {
      const patientName = p?.fullname || `${p?.nom || ''} ${p?.prenom || ''}`.trim() || '........................................';
      const cin = p?.cin ? `titulaire de la CIN n° ${p.cin}` : 'titulaire de la CIN n° ....................';
      const poste = data.posteEmploi ? `au poste de : ${data.posteEmploi}` : 'à l\'emploi sollicité';

      return `Je soussigné, ${doc.nom}, certifie avoir examiné ce jour :\n` +
             `M./Mme : ${patientName}, ${cin}.\n\n` +
             `L'examen clinique général ne met en évidence aucune contre-indication médicale apparente à l'exercice d'une activité professionnelle et à l'embauche ${poste}.\n\n` +
             `Certificat délivré à l'intéressé(e) pour servir et valoir ce que de droit.`;
    }
  },
  {
    id: 'fit_to_fly',
    category: 'aptitude',
    title: 'Medical Certificate of Fitness for Air Travel (Fit to Fly)',
    shortLabel: 'Aptitude vol (Fit to Fly)',
    icon: '✈️',
    language: 'bilingue',
    fields: ['passport', 'nationalite', 'destination', 'remarques'],
    generateText: (p, data, doc) => {
      const patientName = p?.fullname || `${p?.nom || ''} ${p?.prenom || ''}`.trim() || '........................................';
      const dob = p?.birthdate ? formatFrenchDate(p.birthdate) : (p?.age ? `${p.age} years old` : '....................');
      const pass = data.passport || p?.passport || p?.cin || '....................';
      const nat = data.nationalite || 'Tunisian';

      return `MEDICAL CERTIFICATE OF FITNESS FOR AIR TRAVEL / CERTIFICAT D'APTITUDE AU VOL\n\n` +
             `To Whom It May Concern / À qui de droit :\n\n` +
             `I, ${doc.nom}, a duly registered medical doctor (Medical Council Registration No. ${doc.numOrdre}), hereby certify that I have personally examined:\n\n` +
             `Full Name / Nom complet : ${patientName}\n` +
             `Date of Birth / Date de naissance : ${dob}\n` +
             `Nationality / Nationalité : ${nat}\n` +
             `Passport No. / N° Passeport : ${pass}\n\n` +
             `Based on the medical assessment and examination performed on this day, the patient is in a stable clinical condition and presents NO medical contraindication to commercial air travel.\n\n` +
             `In my professional medical opinion, the above-named individual is FIT TO FLY and capable of undertaking international air travel without requiring special in-flight medical assistance.\n\n` +
             `Issued at Mahdia, upon patient's request for presentation to airlines, civil aviation, and border authorities.`;
    }
  },
  {
    id: 'accompagnement',
    category: 'attestation',
    title: 'Certificat Médical d\'Accompagnement',
    shortLabel: 'Accompagnement malade',
    icon: '🤝',
    language: 'fr',
    defaultDays: 3,
    fields: ['dureeJours', 'dateDebut', 'nomMalade', 'lienParente', 'etablissement'],
    generateText: (p, data, doc) => {
      const patientName = p?.fullname || `${p?.nom || ''} ${p?.prenom || ''}`.trim() || '........................................';
      const cin = p?.cin ? `titulaire de la CIN n° ${p.cin}` : 'titulaire de la CIN n° ....................';
      const jours = data.dureeJours || 3;
      const debut = data.dateDebut || new Date().toISOString().slice(0, 10);
      const malade = data.nomMalade || 'son proche';
      const lien = data.lienParente ? `(${data.lienParente})` : '';
      const etabl = data.etablissement ? `actuellement pris(e) en charge à ${data.etablissement}` : 'nécessitant une assistance permanente';

      return `Je soussigné, ${doc.nom}, certifie que :\n` +
             `M./Mme : ${patientName}, ${cin}.\n\n` +
             `Nécessite une dispense de présence et un repos de ${jours} (${convertNumberToFrenchWords(jours)}) jours, à compter du ${formatFrenchDate(debut)}, afin d'accompagner et d'assister ${malade} ${lien}, ${etabl}.\n\n` +
             `Délivré à la demande de l'intéressé(e) pour servir et faire valoir ce que de droit.`;
    }
  },
  {
    id: 'bonne_sante',
    category: 'attestation',
    title: 'Certificat de Bonne Santé / شهادة طبية في الصحة الجيدة',
    shortLabel: 'Bonne santé (FR/AR)',
    icon: '🩺',
    language: 'ar_fr',
    fields: ['remarques'],
    generateText: (p, data, doc) => {
      const patientName = p?.fullname || `${p?.nom || ''} ${p?.prenom || ''}`.trim() || '........................................';
      const cin = p?.cin ? `titulaire de la CIN n° ${p.cin}` : 'titulaire de la CIN n° ....................';

      return `CERTIFICAT MÉDICAL DE BONNE SANTÉ / شهادة طبية في الصحة الجيدة\n\n` +
             `Je soussigné, ${doc.nom}, médecin inscrit au tableau de l'Ordre National des Médecins sous le N° ${doc.numOrdre}, certifie avoir examiné ce jour :\n` +
             `M./Mme : ${patientName}, ${cin}.\n\n` +
             `Il ressort de cet examen clinique que l'intéressé(e) ne présente aucun signe clinique apparent d'affection évolutive, contagieuse ou transmissible susceptible de porter atteinte à la santé publique.\n\n` +
             `------------------------------------------------------------\n\n` +
             `إني الممضي أسفله الدكتور حامد بن خليفة، المرسم بعمادة الأطباء التونسيين تحت رقم 12052، أشهد أن السيد(ة) :\n` +
             `${patientName}، صاحب(ة) بطاقة التعريف الوطنية رقم : ${p?.cin || '....................'}\n\n` +
             `معافى(ة) من جميع الأمراض المعدية أو السارية التي قد تنجر عنها انعكاسات على الصحة العامة طبقاً للوائح الصحية الجاري بها العمل.\n\n` +
             `سلمت هذه الشهادة للمعني(ة) بالأمر للإدلاء بها عند الحاجة.`;
    }
  },
  {
    id: 'presence',
    category: 'attestation',
    title: 'Attestation de Présence / Consultation au Cabinet',
    shortLabel: 'Attestation de présence',
    icon: '🕒',
    language: 'fr',
    fields: ['heureArrivee', 'heureDepart', 'remarques'],
    generateText: (p, data, doc) => {
      const patientName = p?.fullname || `${p?.nom || ''} ${p?.prenom || ''}`.trim() || '........................................';
      const cin = p?.cin ? `titulaire de la CIN n° ${p.cin}` : '';
      const now = new Date();
      const hArr = data.heureArrivee || `${String(now.getHours()).padStart(2, '0')}:00`;
      const hDep = data.heureDepart || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      return `ATTESTATION DE PRÉSENCE AU CABINET MÉDICAL\n\n` +
             `Je soussigné, ${doc.nom}, certifie que :\n` +
             `M./Mme : ${patientName} ${cin}\n\n` +
             `S'est présenté(e) ce jour à mon cabinet médical pour une consultation et a été présent(e) de ${hArr} à ${hDep}.\n\n` +
             `La présente attestation lui est délivrée pour justifier de son absence auprès de qui de droit.`;
    }
  },
  {
    id: 'cmi_agression',
    category: 'legal',
    title: 'Certificat Médical Initial (CMI) - Agression / Coups & Blessures',
    shortLabel: 'CMI Agression / ITT',
    icon: '⚖️',
    language: 'fr',
    defaultDays: 10,
    fields: ['dateFaits', 'heureFaits', 'doleances', 'examenClinique', 'dureeItt', 'remarques'],
    generateText: (p, data, doc) => {
      const patientName = p?.fullname || `${p?.nom || ''} ${p?.prenom || ''}`.trim() || '........................................';
      const cin = p?.cin ? `titulaire de la carte d'identité nationale n° ${p.cin}` : 'titulaire de la CIN n° ....................';
      const age = p?.age ? `${p.age} ans` : (p?.birthdate ? `né(e) le ${formatFrenchDate(p.birthdate)}` : '');
      const adresse = p?.adresse || 'Mahdia';
      const dateFaits = data.dateFaits ? formatFrenchDate(data.dateFaits) : 'ce jour';
      const heureFaits = data.heureFaits ? `à ${data.heureFaits}` : '';
      const doleances = data.doleances || 'Rapporte avoir été victime d\'une agression physique et verbale.';
      const examen = data.examenClinique || 'Patient conscient, orienté, état anxieux réactionnel.\nLésions traumatiques objectivables à détailler lors de l\'examen.';
      const itt = data.dureeItt || 10;

      return `CERTIFICAT MÉDICAL INITIAL (C.M.I.)\n(Établi à la demande expresse de la victime)\n\n` +
             `Je soussigné, ${doc.nom}, docteur en médecine inscrit au tableau de l'Ordre des Médecins sous le N° ${doc.numOrdre}, exerçant à ${doc.adresse}, certifie avoir examiné ce jour :\n\n` +
             `M./Mme : ${patientName}, ${age}, demeurant à ${adresse}, ${cin}.\n\n` +
             `Qui me déclare avoir été victime d'une agression le ${dateFaits} ${heureFaits}.\n\n` +
             `1. DOLÉANCES DU/DE LA PATIENT(E) :\n${doleances}\n\n` +
             `2. EXAMEN CLINIQUE :\n${examen}\n\n` +
             `3. CONCLUSION ET INCAPACITÉ TEMPORAIRE DE TRAVAIL :\n` +
             `Au vu de ces constatations cliniques, les lésions et le retentissement observés justifient une Incapacité Temporaire Totale de Travail (I.T.T.) de ${itt} (${convertNumberToFrenchWords(itt)}) jours, sous réserve de complications ultérieures ou d'éléments nouveaux lors d'un examen ultérieur.\n\n` +
             `Fait à Mahdia, remis en mains propres à l'intéressé(e) pour faire valoir ce que de droit.`;
    }
  },
  {
    id: 'permis_conduire',
    category: 'aptitude',
    title: 'Certificat d\'Aptitude au Permis de Conduire (FR & AR)',
    shortLabel: 'Permis de conduire',
    icon: '🚗',
    language: 'ar_fr',
    fields: ['categoriePermis', 'acuiteVisuelle', 'avecCorrection', 'remarques'],
    generateText: (p, data, doc) => {
      const patientName = p?.fullname || `${p?.nom || ''} ${p?.prenom || ''}`.trim() || '........................................';
      const cin = p?.cin ? `titulaire de la CIN n° ${p.cin}` : 'titulaire de la CIN n° ....................';
      const cat = data.categoriePermis || 'B (Tourisme)';
      const corr = data.avecCorrection ? 'avec verres correcteurs / port obligatoire de lunettes' : 'sans correction optique';
      const av = data.acuiteVisuelle ? `Acuité visuelle : ${data.acuiteVisuelle}` : '';

      return `CERTIFICAT MÉDICAL D'APTITUDE À LA CONDUITE / شهادة الكفاءة الطبية لسياقة السيارات\n\n` +
             `Je soussigné, ${doc.nom}, certifie avoir examiné ce jour :\n` +
             `M./Mme : ${patientName}, ${cin}.\n\n` +
             `Candidat(e) à l'obtention ou au renouvellement du permis de conduire de catégorie : « ${cat} ».\n\n` +
             `L'examen somatique, cardiovasculaire, neurologique et l'acuité visuelle (${corr}${av ? ' - ' + av : ''}) concluent à :\n` +
             `APTITUDE MÉDICALE À LA CONDUITE DES VÉHICULES AUTOMOBILES.\n\n` +
             `يشهد الدكتور حامد بن خليفة بعد الفحص السريري والتأكد من البصر والقدرات البدنية أن المعني بالأمر مؤهل طبياً لسياقة عربات الصنف ${cat}.`;
    }
  },
  {
    id: 'rapport_medical',
    category: 'rapport',
    title: 'Rapport Médical Confidentiel / Compte Rendu Clinique',
    shortLabel: 'Rapport médical',
    icon: '📋',
    language: 'fr',
    fields: ['antecedents', 'diagnosticDetaille', 'traitementsEnCours', 'evolutionClinique', 'conclusion'],
    generateText: (p, data, doc) => {
      const patientName = p?.fullname || `${p?.nom || ''} ${p?.prenom || ''}`.trim() || '........................................';
      const dob = p?.birthdate ? `né(e) le ${formatFrenchDate(p.birthdate)}` : (p?.age ? `âgé(e) de ${p.age} ans` : '');
      const cin = p?.cin ? `(CIN n° ${p.cin})` : (p?.passport ? `(Passeport n° ${p.passport})` : '');
      const atcd = data.antecedents || p?.antecedents || 'Néant particulier.';
      const diag = data.diagnosticDetaille || data.diagnostic || 'Affection médicale sous traitement.';
      const ttt = data.traitementsEnCours || 'Traitement adapté selon prescription.';
      const evo = data.evolutionClinique || 'Patient régulièrement suivi au cabinet médical avec stabilité clinique.';
      const concl = data.conclusion || 'Ce rapport est rédigé à la demande du/de la patient(e) pour servir et faire valoir ce que de droit.';

      return `RAPPORT MÉDICAL CONFIDENTIEL\n(Couvert par le secret professionnel - Article 378 du Code Pénal)\n\n` +
             `Concerne : M./Mme ${patientName} ${dob} ${cin}\n\n` +
             `1. HISTOIRE CLINIQUE & ANTÉCÉDENTS :\n${atcd}\n\n` +
             `2. DIAGNOSTIC RETENU :\n${diag}\n\n` +
             `3. TRAITEMENTS & PRISE EN CHARGE EN COURS :\n${ttt}\n\n` +
             `4. ÉVOLUTION ET ÉTAT CLINIQUE ACTUEL :\n${evo}\n\n` +
             `5. CONCLUSION ET RECOMMANDATIONS :\n${concl}\n\n` +
             `Fait à Mahdia en toute sincérité pour servir à la continuité des soins.`;
    }
  },
  {
    id: 'deces',
    category: 'legal',
    title: 'Certificat Médical de Décès (Modèle Officiel MSP)',
    shortLabel: 'Certificat de décès',
    icon: '🕊️',
    language: 'fr',
    fields: ['dateDeces', 'heureDeces', 'lieuDeces', 'obstacleMedicoLegal', 'miseEnBiere', 'remarques'],
    generateText: (p, data, doc) => {
      const patientName = p?.fullname || `${p?.nom || ''} ${p?.prenom || ''}`.trim() || '........................................';
      const cin = p?.cin ? `titulaire de la CIN n° ${p.cin}` : 'titulaire de la CIN n° ....................';
      const dateDeces = data.dateDeces ? formatFrenchDate(data.dateDeces) : '....................';
      const heureDeces = data.heureDeces || '.... h ....';
      const lieu = data.lieuDeces || 'Mahdia';
      const obstacle = data.obstacleMedicoLegal ? 'OUI (Contacter le parquet)' : 'NON (Mort naturelle)';
      const miseEnBiere = data.miseEnBiere ? 'OUI (Mise en bière immédiate obligatoire)' : 'NON';

      return `RÉPUBLIQUE TUNISIENNE - MINISTÈRE DE LA SANTÉ PUBLIQUE\n` +
             `CERTIFICAT MÉDICAL DE DÉCÈS\n\n` +
             `Le Docteur en Médecine soussigné, ${doc.nom}, inscrit à l'Ordre National sous le N° ${doc.numOrdre}, certifie de visu la mort de :\n\n` +
             `Nom et Prénom du défunt : ${patientName}, ${cin}.\n\n` +
             `Date du décès : ${dateDeces} à ${heureDeces}\n` +
             `Lieu du décès : ${lieu}\n\n` +
             `- Obstacle médico-légal à l'inhumation : ${obstacle}\n` +
             `- Obligation de mise en bière immédiate : ${miseEnBiere}\n\n` +
             `Délivré à Mahdia pour l'accomplissement des formalités légales d'inhumation.`;
    }
  }
];

// ==============================================================
// UTILITAIRES DE FORMATION DE TEXTE ET DATES EN FRANÇAIS
// ==============================================================

export function formatFrenchDate(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = String(dateStr).slice(0, 10).split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      const monthNames = [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
      ];
      const mIdx = parseInt(month, 10) - 1;
      return `${parseInt(day, 10)} ${monthNames[mIdx] || month} ${year}`;
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

export function convertNumberToFrenchWords(n) {
  const num = parseInt(n, 10);
  if (isNaN(num)) return '';
  const units = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
                 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingts', 'quatre-vingt-dix'];

  if (num < 20) return units[num];
  if (num < 100) {
    const t = Math.floor(num / 10);
    const u = num % 10;
    if (u === 0) return tens[t];
    if (u === 1 && (t === 2 || t === 3 || t === 4 || t === 5 || t === 6)) return `${tens[t]} et un`;
    return `${tens[t]}-${units[u]}`;
  }
  return String(num);
}
