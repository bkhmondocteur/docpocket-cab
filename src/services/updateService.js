// ==============================================================
// DOCPOCKET CABINET - SERVICE DE MISE À JOUR ET INFORMATIONS SYSTÈME
// VÉRIFICATION EN DIRECT DES MISES À JOUR SUR GITHUB RELEASES & GITHUB PAGES
// ==============================================================

export const CURRENT_APP_INFO = {
  name: 'DocPocket Cab',
  fullName: 'DocPocket Cabinet Médical',
  version: '2.3.0',
  versionCode: 6,
  releaseDate: '2026-11-25',
  author: 'Dr. Hamed BEN KHALIFA',
  specialite: 'Médecine Générale - Addictologie',
  cabinet: 'Complexe Médical Dar Attabib, Mahdia, Tunisie',
  numOrdre: '12052',
  codeConventionnelCnam: '010002763183',
  officialRepoUrl: 'https://github.com/bkhmondocteur/docpocket-cab',
  livePwaUrl: 'https://bkhmondocteur.github.io/docpocket-cab/',
  downloadApkUrl: 'https://github.com/bkhmondocteur/docpocket-cab/releases/download/v2.3.0/DocPocket-Cab.apk',
  downloadExeUrl: 'https://github.com/bkhmondocteur/docpocket-cab/releases/download/v2.3.0/DocPocket-Cab-Setup.exe',
  releasesApiUrl: 'https://api.github.com/repos/bkhmondocteur/docpocket-cab/releases/latest',
  versionManifestUrl: 'https://bkhmondocteur.github.io/docpocket-cab/version.json'
};

/**
 * Compare deux chaînes de version semver (ex: "2.3.0" vs "2.2.1")
 * Retourne 1 si v1 > v2, -1 si v1 < v2, 0 si égales
 */
export function compareVersions(v1, v2) {
  if (!v1 || !v2) return 0;
  const p1 = String(v1).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = String(v2).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * Vérifie la disponibilité d'une mise à jour logicielle.
 * Tente d'abord le fichier version.json sur GitHub Pages, puis l'API GitHub Releases.
 */
export async function checkForAppUpdates() {
  const currentVersion = CURRENT_APP_INFO.version;
  const currentCode = CURRENT_APP_INFO.versionCode;

  try {
    // 1. Tenter le fichier de version hébergé avec le site
    const manifestResponse = await fetch(`${CURRENT_APP_INFO.versionManifestUrl}?t=${Date.now()}`, {
      cache: 'no-store'
    });

    if (manifestResponse.ok) {
      const data = await manifestResponse.json();
      const latestVersion = data.versionName || data.version;
      const latestCode = Number(data.versionCode) || 0;

      const isNewer = (latestCode > currentCode) || (compareVersions(latestVersion, currentVersion) > 0);

      return {
        success: true,
        hasUpdate: isNewer,
        currentVersion,
        latestVersion,
        releaseDate: data.releaseDate || 'Récent',
        changelog: data.changelog || 'Améliorations générales et optimisations du cabinet.',
        downloadApkUrl: data.downloadApkUrl || CURRENT_APP_INFO.downloadApkUrl,
        downloadExeUrl: data.downloadExeUrl || CURRENT_APP_INFO.downloadExeUrl,
        githubReleaseUrl: data.githubReleaseUrl || CURRENT_APP_INFO.officialRepoUrl
      };
    }
  } catch (err) {
    console.warn("Vérification version.json échouée, tentative GitHub Releases API:", err);
  }

  // 2. Repli vers l'API GitHub Releases
  try {
    const ghResponse = await fetch(CURRENT_APP_INFO.releasesApiUrl, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
      cache: 'no-store'
    });

    if (ghResponse.ok) {
      const release = await ghResponse.json();
      const tagName = release.tag_name || release.name || '';
      const cleanTag = tagName.replace(/^v/i, '');
      const isNewer = compareVersions(cleanTag, currentVersion) > 0;

      // Recherche des assets (.apk et .exe)
      let apkAsset = null;
      let exeAsset = null;
      if (Array.isArray(release.assets)) {
        apkAsset = release.assets.find(a => a.name.endsWith('.apk'))?.browser_download_url;
        exeAsset = release.assets.find(a => a.name.endsWith('.exe'))?.browser_download_url;
      }

      return {
        success: true,
        hasUpdate: isNewer,
        currentVersion,
        latestVersion: cleanTag,
        releaseDate: release.published_at ? release.published_at.slice(0, 10) : 'Récent',
        changelog: release.body || 'Mise à jour officielle disponible sur GitHub.',
        downloadApkUrl: apkAsset || CURRENT_APP_INFO.downloadApkUrl,
        downloadExeUrl: exeAsset || CURRENT_APP_INFO.downloadExeUrl,
        githubReleaseUrl: release.html_url || CURRENT_APP_INFO.officialRepoUrl
      };
    }
  } catch (err) {
    console.warn("Échec requête GitHub Releases API:", err);
  }

  // Si hors-ligne ou aucune mise à jour détectée
  return {
    success: false,
    hasUpdate: false,
    currentVersion,
    latestVersion: currentVersion,
    message: "Impossible de joindre le serveur de mise à jour. Vérifiez votre connexion Internet."
  };
}
