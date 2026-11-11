# 📘 GUIDE COMMERCIAL & ARCHITECTURE FIREBASE - DOCPOCKET CABINET
> **Destiné au Concepteur / Vendeur de l'Application Médicale**  
> *Dernière mise à jour : 2026*

---

## 🎯 1. Vue d'Ensemble & Vision Commerciale

Lorsque vous commercialisez cette application auprès d'autres médecins et spécialistes :
- **Les médecins ne sont pas des informaticiens :** ils ne doivent jamais avoir à ouvrir la console Google Cloud, ni configurer des clés d'API complexes, ni taper des lignes de commande.
- **Zéro Configuration Côté Acheteur :** le médecin saisit simplement son adresse Google (Gmail ou compte professionnel Google Workspace) dans l'application.
- **Partitionnement Étanche (Multi-Tenant) :** chaque médecin acheteur dispose de son propre espace étanche chiffré dans le Cloud. Les dossiers patients, consultations, ordonnances et quittances d'un cabinet sont strictement isolés de ceux des autres cabinets.

---

## 🏗️ 2. Architecture Cloud & Pont de Synchronisation Hybride

L'application utilise une architecture hybride économe et ultra-rapide :

```
┌─────────────────────────────────────────────────────────────┐
│                 VOTRE PROJET FIREBASE CLOUD                 │
│                 (Hébergé par vous, le vendeur)              │
└──────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
┌──────────────────────────────┐       ┌──────────────────────────────┐
│  Cabinet Dr. A (Tunis)       │       │  Cabinet Dr. B (Sousse)      │
│  /docpocket_bridge/cab_drA/  │       │  /docpocket_bridge/cab_drB/  │
│  ├── meta.json               │       │  ├── meta.json               │
│  ├── backup_latest.json      │       │  ├── backup_latest.json      │
│  └── chunks/ (150 Ko max)    │       │  └── chunks/ (150 Ko max)    │
└──────────────┬───────────────┘       └──────────────┬───────────────┘
               │                                      │
       ┌───────┴───────┐                      ┌───────┴───────┐
       ▼               ▼                      ▼               ▼
  [PC Windows]   [Smartphone]            [PC Windows]   [Smartphone]
```

### Avantages Majeurs :
1. **Respect strict des quotas gratuits Google Firebase :** les données transitent sous forme de paquets éphémères de 150 Ko.
2. **Fonctionnement 100% hors-ligne (Offline-First) :** le cabinet fonctionne même en cas de coupure Internet grâce à SQLite / IndexedDB local. Dès que la connexion revient, la synchronisation s'effectue automatiquement.
3. **Détection de la dernière sauvegarde :** qu'une modification soit faite sur PC ou Smartphone, le pont compare les horodatages et applique la version la plus récente en fusionnant intelligemment les consultations sans aucun doublon de patient.

---

## 🔐 3. Règles de Sécurité Firebase (Production)

Pour votre projet Firebase Cloud centralisé, configurez les règles de sécurité dans Firebase Console -> **Realtime Database** -> **Règles** (ou via le fichier `database.rules.json`) :

### Règle Standard Multi-Cabinets (Prête à l'Emploi) :
```json
{
  "rules": {
    "docpocket_bridge": {
      ".read": true,
      ".write": true,
      "$cabinetId": {
        ".indexOn": ["timestamp", "updatedAt"]
      }
    }
  }
}
```

### Règle Sécurisée avec Authentification Firebase (Optionnelle avec Google Auth) :
```json
{
  "rules": {
    "docpocket_bridge": {
      "$cabinetId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

---

## 🚀 4. Instructions Pas à Pas pour les Mises à Jour Futures

Lorsque vous améliorez l'application (nouveaux médicaments Avicenna, nouvelles rubriques de consultation, barèmes CNAM 2026-2027) :

### Étape 1 : Mettre à jour le code Web / Electron
Dans le dossier du projet :
```bash
npm run build
```
Le dossier `dist/` contient la version compilée prête à être déployée.

### Étape 2 : Déployer les mises à jour sans impacter les données des médecins
Pour mettre à jour le serveur ou les règles Firebase en 1 seule commande :
```bash
firebase deploy --only database,rules
```
> [!IMPORTANT]
> Les données des médecins sont stockées sous leur identifiant propre `cab_*`. Déployer des règles ou une nouvelle version du frontend n'efface JAMAIS les données des praticiens.

### Étape 3 : Si vous modifiez la structure de données d'un acte ou d'une ordonnance
- Les migrations sont gérées de façon rétrocompatible dans `patientStorage.js`.
- Les anciens dossiers continuent de s'ouvrir normalement sans conversion forcée.

---

## 💼 5. Guide de Mise en Route pour le Médecin Acheteur

Voici la notice en 3 étapes simples à fournir à tout confrère qui vous achète le logiciel :

1. **Installation :** Ouvrez DocPocket Cabinet sur votre ordinateur et installez le raccourci sur votre smartphone Android / iPhone.
2. **Association Google :** Allez dans **Paramètres** -> Onglet **Pont Firebase** -> Saisissez simplement votre adresse Gmail dans l'encadré bleu.
3. **Validation :** Cliquez sur **« Se Connecter avec Google & Initialiser le Cabinet »**.
   * Un badge vert apparaît immédiatement : `🟢 Cabinet Cloud Actif & Associé à votre Compte Google`.
   * Le PC et le smartphone sont désormais reliés pour toujours. Chaque consultation, ordonnance ou quittance est synchronisée automatiquement.

---

## 📞 Support & Maintenance
- **Changement d'ordinateur du médecin :** Il installe l'application, connecte son compte Google, et clique sur *« Télécharger & Fusionner »* : l'intégralité de son cabinet est restaurée en 10 secondes.
- **Sauvegarde locale automatique :** En parallèle du Cloud, l'application écrit automatiquement une sauvegarde miroir sur le disque dur local après chaque consultation.
