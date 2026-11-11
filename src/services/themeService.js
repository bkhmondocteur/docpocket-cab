/**
 * DocPocket Cabinet - Service de Gestion des Thèmes Visuels
 * 10 thèmes médicaux élégants et ergonomiques personnalisables par le médecin
 */

export const THEMES_LIST = [
  {
    id: 'ocean',
    name: 'Bleu Océan Médical',
    badge: 'Défaut',
    icon: '🌊',
    tagline: 'Design officiel DocPocket',
    description: 'Bleu nuit profond, ardoise et cyan médical. Contraste optimal et reposant pour les yeux.',
    isLight: false,
    colors: {
      bg: '#0b1329',
      surface: '#0f172a',
      card: '#1e293b',
      border: '#334155',
      primary: '#0284c7',
      secondary: '#0369a1',
      accent: '#38bdf8',
      textMain: '#f8fafc',
      textMuted: '#94a3b8',
      gradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
    }
  },
  {
    id: 'emerald',
    name: 'Émeraude Santé & Nature',
    badge: 'Bio & Zen',
    icon: '🌲',
    tagline: 'Vert thérapeutique apaisant',
    description: 'Tonalités vert forêt, sauge et menthe fraîche. Évoque la guérison naturelle et la sérénité.',
    isLight: false,
    colors: {
      bg: '#061a14',
      surface: '#0b291f',
      card: '#133d2f',
      border: '#1e5441',
      primary: '#059669',
      secondary: '#047857',
      accent: '#34d399',
      textMain: '#f0fdf4',
      textMuted: '#86efac',
      gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)'
    }
  },
  {
    id: 'oled',
    name: 'Nuit Stellaire / Noir OLED',
    badge: 'Éco-Énergie',
    icon: '🌌',
    tagline: 'Noir absolu & Reflets titane',
    description: 'Noir absolu 0% consommation sur smartphones OLED. Idéal pour les gardes et consultations de nuit.',
    isLight: false,
    colors: {
      bg: '#000000',
      surface: '#0a0a0d',
      card: '#141419',
      border: '#272730',
      primary: '#2563eb',
      secondary: '#1d4ed8',
      accent: '#60a5fa',
      textMain: '#fafafa',
      textMuted: '#a1a1aa',
      gradient: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)'
    }
  },
  {
    id: 'amethyst',
    name: 'Améthyste Royale / Neuro',
    badge: 'Prestige',
    icon: '🍇',
    tagline: 'Violet profond & Lavande',
    description: 'Élégance raffinée violette et lavande high-tech. Ambiance feutrée, moderne et stimulante.',
    isLight: false,
    colors: {
      bg: '#0e091e',
      surface: '#17102e',
      card: '#231845',
      border: '#3b296e',
      primary: '#7c3aed',
      secondary: '#6d28d9',
      accent: '#c084fc',
      textMain: '#faf5ff',
      textMuted: '#d8b4fe',
      gradient: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'
    }
  },
  {
    id: 'amber',
    name: 'Ambre & Terracotta',
    badge: 'Anti-Fatigue',
    icon: '🌅',
    tagline: 'Chaleur cuivrée anti-lumière bleue',
    description: 'Tons chauds miel, bronze et terracotta. Réduit considérablement la fatigue visuelle prolongée.',
    isLight: false,
    colors: {
      bg: '#160f09',
      surface: '#23170e',
      card: '#352317',
      border: '#4f3422',
      primary: '#d97706',
      secondary: '#b45309',
      accent: '#fbbf24',
      textMain: '#fffbeb',
      textMuted: '#fde68a',
      gradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
    }
  },
  {
    id: 'teal',
    name: 'Turquoise Lagon / Pédiatrie',
    badge: 'Douceur',
    icon: '🩵',
    tagline: 'Cyan lagon & Fraîcheur marine',
    description: 'Atmosphère douce, rassurante et lumineuse. Très appréciée en pédiatrie et médecine générale.',
    isLight: false,
    colors: {
      bg: '#051618',
      surface: '#0a2428',
      card: '#11383e',
      border: '#1a5059',
      primary: '#0d9488',
      secondary: '#0f766e',
      accent: '#2dd4bf',
      textMain: '#f0fdfa',
      textMuted: '#99f6e4',
      gradient: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)'
    }
  },
  {
    id: 'sapphire',
    name: 'Saphir & Platine',
    badge: 'Précision',
    icon: '💎',
    tagline: 'Bleu cobalt clinique éclatant',
    description: 'Bleu roi haute intensité et contrastes vifs. Clarté chirurgicale et lisibilité maximale.',
    isLight: false,
    colors: {
      bg: '#080f1e',
      surface: '#0e1830',
      card: '#17264a',
      border: '#253c73',
      primary: '#1d4ed8',
      secondary: '#1e40af',
      accent: '#60a5fa',
      textMain: '#eff6ff',
      textMuted: '#93c5fd',
      gradient: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)'
    }
  },
  {
    id: 'ruby',
    name: 'Rubis & Grenat / Cardio',
    badge: 'Cardio',
    icon: '🍷',
    tagline: 'Bordeaux feutré & Corail vif',
    description: 'Nuances grenat feutrées et accents corail. Ambiance feutrée, chaleureuse et distinctive.',
    isLight: false,
    colors: {
      bg: '#17070b',
      surface: '#260c14',
      card: '#3b1320',
      border: '#591d31',
      primary: '#e11d48',
      secondary: '#be123c',
      accent: '#fb7185',
      textMain: '#fff1f2',
      textMuted: '#fecdd3',
      gradient: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)'
    }
  },
  {
    id: 'mocha',
    name: 'Moka & Bois Précieux',
    badge: 'Cabinet Chic',
    icon: '☕',
    tagline: 'Café gourmand & Boiseries',
    description: 'Ambiance cabinet médical traditionnel, cuir noble et boiseries d’acajou feutrées.',
    isLight: false,
    colors: {
      bg: '#14100c',
      surface: '#201a14',
      card: '#302820',
      border: '#483d32',
      primary: '#a16207',
      secondary: '#854d0e',
      accent: '#facc15',
      textMain: '#fefce8',
      textMuted: '#fef08a',
      gradient: 'linear-gradient(135deg, #a16207 0%, #854d0e 100%)'
    }
  },
  {
    id: 'clinical_light',
    name: 'Clair Clinique / Blanc Moderne',
    badge: 'Haute Clarté',
    icon: '☁️',
    tagline: 'Blanc immaculé & Gris clinique',
    description: 'Thème jour haute luminosité. Idéal pour cabinets très ensoleillés ou praticiens préférant le fond blanc.',
    isLight: true,
    colors: {
      bg: '#f1f5f9',
      surface: '#ffffff',
      card: '#e2e8f0',
      border: '#cbd5e1',
      primary: '#0284c7',
      secondary: '#0369a1',
      accent: '#0284c7',
      textMain: '#0f172a',
      textMuted: '#475569',
      gradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
    }
  }
];

const THEME_STORAGE_KEY = 'docpocket_app_theme';

/**
 * Récupère l'identifiant du thème actif en mémoire
 */
export function getCurrentThemeId() {
  try {
    if (typeof localStorage === 'undefined') return 'ocean';
    return localStorage.getItem(THEME_STORAGE_KEY) || 'ocean';
  } catch {
    return 'ocean';
  }
}

/**
 * Récupère l'objet complet du thème actif
 */
export function getCurrentTheme() {
  const currentId = getCurrentThemeId();
  return THEMES_LIST.find(t => t.id === currentId) || THEMES_LIST[0];
}

/**
 * Applique immédiatement le thème dans tout le DOM
 */
export function applyTheme(themeId) {
  const theme = THEMES_LIST.find(t => t.id === themeId) || THEMES_LIST[0];
  const { colors, isLight } = theme;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme.id);
    }
  } catch (e) {
    console.warn("Impossible de mémoriser le thème dans localStorage:", e);
  }

  if (typeof document === 'undefined') return theme;

  // Mise à jour de l'attribut HTML et du Body
  document.documentElement.setAttribute('data-theme', theme.id);
  document.body.setAttribute('data-theme', theme.id);

  // Mise à jour des variables CSS racines
  const root = document.documentElement;
  root.style.setProperty('--bg-color', colors.bg);
  root.style.setProperty('--surface-color', colors.surface);
  root.style.setProperty('--surface-card', colors.card);
  root.style.setProperty('--border-color', colors.border);
  root.style.setProperty('--primary-color', colors.primary);
  root.style.setProperty('--secondary-color', colors.secondary);
  root.style.setProperty('--accent-color', colors.accent);
  root.style.setProperty('--text-main', colors.textMain);
  root.style.setProperty('--text-muted', colors.textMuted);
  root.style.setProperty('--primary-gradient', colors.gradient);

  // Injection / Mise à jour de la feuille de style dynamique d'écrasement des couleurs
  let styleTag = document.getElementById('docpocket-theme-dynamic-stylesheet');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'docpocket-theme-dynamic-stylesheet';
    document.head.appendChild(styleTag);
  }

  // Styles CSS d'injection globale avec haute spécificité pour garantir l'application instantanée
  styleTag.textContent = `
    /* ======================================================== */
    /* DOCPOCKET CABINET - THEME ACTIF : ${theme.name.toUpperCase()} */
    /* ======================================================== */
    :root, [data-theme="${theme.id}"] {
      --bg-color: ${colors.bg};
      --surface-color: ${colors.surface};
      --surface-card: ${colors.card};
      --border-color: ${colors.border};
      --primary-color: ${colors.primary};
      --secondary-color: ${colors.secondary};
      --accent-color: ${colors.accent};
      --text-main: ${colors.textMain};
      --text-muted: ${colors.textMuted};
      --primary-gradient: ${colors.gradient};
    }

    body[data-theme="${theme.id}"],
    [data-theme="${theme.id}"] #root,
    [data-theme="${theme.id}"] .docpocket-app-container {
      background-color: ${colors.bg} !important;
      color: ${colors.textMain} !important;
    }

    /* Remplacement dynamique des fonds profonds */
    [data-theme="${theme.id}"] [style*="#0b1329"],
    [data-theme="${theme.id}"] [style*="rgb(11, 19, 41)"],
    [data-theme="${theme.id}"] [style*="rgb(11,19,41)"] {
      background-color: ${colors.bg} !important;
      ${isLight ? `color: ${colors.textMain} !important;` : ''}
    }

    /* Remplacement dynamique des surfaces (sidebars, barres d'outils, fiches) */
    [data-theme="${theme.id}"] [style*="#0f172a"],
    [data-theme="${theme.id}"] [style*="rgb(15, 23, 42)"],
    [data-theme="${theme.id}"] [style*="rgb(15,23,42)"] {
      background-color: ${colors.surface} !important;
      ${isLight ? `color: ${colors.textMain} !important; border-color: ${colors.border} !important;` : ''}
    }

    /* Remplacement dynamique des cartes et en-têtes de tableaux */
    [data-theme="${theme.id}"] [style*="#1e293b"],
    [data-theme="${theme.id}"] [style*="rgb(30, 41, 59)"],
    [data-theme="${theme.id}"] [style*="rgb(30,41,59)"] {
      background-color: ${colors.card} !important;
      ${isLight ? `color: ${colors.textMain} !important; border-color: ${colors.border} !important;` : ''}
    }

    /* Remplacement des bordures par défaut */
    [data-theme="${theme.id}"] [style*="#334155"],
    [data-theme="${theme.id}"] [style*="rgb(51, 65, 85)"],
    [data-theme="${theme.id}"] [style*="rgb(51,65,85)"] {
      border-color: ${colors.border} !important;
    }

    /* Remplacement des boutons et accents primaires */
    [data-theme="${theme.id}"] button[style*="#0284c7"],
    [data-theme="${theme.id}"] span[style*="#0284c7"],
    [data-theme="${theme.id}"] div[style*="#0284c7"] {
      background-color: ${colors.primary} !important;
      color: #fff !important;
    }

    /* Remplacement des gradients primaires */
    [data-theme="${theme.id}"] [style*="#0284c7"][style*="#0369a1"] {
      background: ${colors.gradient} !important;
      color: #fff !important;
    }

    /* Remplacement des accents textuels cyan */
    [data-theme="${theme.id}"] span[style*="#38bdf8"],
    [data-theme="${theme.id}"] h3[style*="#38bdf8"],
    [data-theme="${theme.id}"] h4[style*="#38bdf8"],
    [data-theme="${theme.id}"] strong[style*="#38bdf8"],
    [data-theme="${theme.id}"] div[style*="#38bdf8"]:not([style*="background"]) {
      color: ${colors.accent} !important;
    }

    /* Anneau de focus aux couleurs du thème */
    [data-theme="${theme.id}"] input:focus,
    [data-theme="${theme.id}"] select:focus,
    [data-theme="${theme.id}"] textarea:focus {
      outline: none !important;
      box-shadow: 0 0 0 2px ${colors.accent} !important;
      border-color: ${colors.accent} !important;
    }

    ${isLight ? `
      /* Adaptations spécifiques pour le thème clair clinique */
      [data-theme="clinical_light"] [style*="#f8fafc"],
      [data-theme="clinical_light"] [style*="rgb(248, 250, 252)"] {
        color: #0f172a !important;
      }
      [data-theme="clinical_light"] [style*="#cbd5e1"],
      [data-theme="clinical_light"] [style*="#94a3b8"] {
        color: #475569 !important;
      }
      [data-theme="clinical_light"] button[style*="linear-gradient"],
      [data-theme="clinical_light"] button[style*="#0284c7"],
      [data-theme="clinical_light"] button[style*="#059669"],
      [data-theme="clinical_light"] button[style*="#7c3aed"],
      [data-theme="clinical_light"] span[style*="background: #0284c7"] {
        color: #ffffff !important;
      }
      [data-theme="clinical_light"] input,
      [data-theme="clinical_light"] select,
      [data-theme="clinical_light"] textarea {
        background: #ffffff !important;
        color: #0f172a !important;
        border-color: #cbd5e1 !important;
      }
    ` : ''}
  `;

  // Notification d'événement global
  try {
    window.dispatchEvent(new CustomEvent('docpocket-theme-changed', { detail: theme }));
  } catch (e) {
    // Navigateur ancien sans CustomEvent
  }

  return theme;
}

/**
 * Initialisation au chargement de l'application
 */
export function initTheme() {
  const currentId = getCurrentThemeId();
  return applyTheme(currentId);
}
