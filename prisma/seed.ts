import { PrismaClient, UserRole, DeclarationStatus, MovementType, ServiceCategory, PositionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ── MinefopService definitions (Décret n° 2005/123 du 15 avril 2005) ─────────
const minefopServices = [
    // ═══════════════════════════════════════════
    // A. SERVICES DÉCONCENTRÉS
    // ═══════════════════════════════════════════

    // A1 — Délégations Régionales (DREFOP) → REGIONAL
    { code: 'DREFOP', category: 'DECONCENTRE' as ServiceCategory, level: 1, parentCode: null, name: "Délégation Régionale de l'Emploi et de la Formation Professionnelle", acronym: 'DREFOP', roleMapping: 'REGIONAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 1 },
    { code: 'DREFOP-SPE', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DREFOP', name: "Service de la Promotion de l'Emploi", acronym: 'SPE', roleMapping: 'REGIONAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 2 },
    { code: 'DREFOP-SRMO', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DREFOP', name: "Service de la Régulation de la Main-d'Œuvre", acronym: 'SRMO', roleMapping: 'REGIONAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 3 },
    { code: 'DREFOP-SFPA', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DREFOP', name: "Service de la Formation Professionnelle et de l'Apprentissage", acronym: 'SFPA', roleMapping: 'REGIONAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 4 },
    { code: 'DREFOP-SSOP', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DREFOP', name: "Service de la Sélection et de l'Orientation Professionnelle", acronym: 'SSOP', roleMapping: 'REGIONAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 5 },
    { code: 'DREFOP-SAF', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DREFOP', name: 'Service Administratif et Financier', acronym: 'SAF', roleMapping: 'REGIONAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 6 },
    { code: 'DREFOP-BACL', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DREFOP', name: "Bureau de l'Accueil, du Courrier et de Liaison", acronym: 'BACL', roleMapping: 'REGIONAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 7 },

    // A2 — Délégations Départementales (DDEFOP) → DIVISIONAL
    { code: 'DDEFOP', category: 'DECONCENTRE' as ServiceCategory, level: 1, parentCode: null, name: "Délégation Départementale de l'Emploi et de la Formation Professionnelle", acronym: 'DDEFOP', roleMapping: 'DIVISIONAL' as UserRole, requiresRegion: true, requiresDepartment: true, orderIndex: 10 },
    { code: 'DDEFOP-BEIS', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DDEFOP', name: "Bureau de l'Emploi, de l'Insertion et des Statistiques", acronym: 'BEIS', roleMapping: 'DIVISIONAL' as UserRole, requiresRegion: true, requiresDepartment: true, orderIndex: 11 },
    { code: 'DDEFOP-BFPOE', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DDEFOP', name: "Bureau de la Formation Professionnelle, de l'Orientation et des Évaluations", acronym: 'BFPOE', roleMapping: 'DIVISIONAL' as UserRole, requiresRegion: true, requiresDepartment: true, orderIndex: 12 },
    { code: 'DDEFOP-BAG', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DDEFOP', name: 'Bureau des Affaires Générales', acronym: 'BAG', roleMapping: 'DIVISIONAL' as UserRole, requiresRegion: true, requiresDepartment: true, orderIndex: 13 },

    // ═══════════════════════════════════════════
    // B. ADMINISTRATION CENTRALE → CENTRAL
    // ═══════════════════════════════════════════

    // B0 — Cabinet du Ministre
    { code: 'MINISTRE', category: 'CENTRALE' as ServiceCategory, level: 1, parentCode: null, name: "Cabinet du Ministre de l'Emploi et de la Formation Professionnelle", acronym: 'MINEFOP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 20 },
    { code: 'MINISTRE-SP', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'MINISTRE', name: 'Secrétariat Particulier', acronym: 'SP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 21 },
    { code: 'MINISTRE-CT1', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'MINISTRE', name: 'Conseiller Technique N°1', acronym: 'CT1', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 22 },
    { code: 'MINISTRE-CT2', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'MINISTRE', name: 'Conseiller Technique N°2', acronym: 'CT2', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 23 },

    // B1 — Inspection Générale
    { code: 'IG', category: 'CENTRALE' as ServiceCategory, level: 1, parentCode: null, name: 'Inspection Générale', acronym: 'IG', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 30 },
    { code: 'IG-INSP1', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'IG', name: 'Inspecteur N°1', acronym: 'INSP1', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 31 },
    { code: 'IG-INSP2', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'IG', name: 'Inspecteur N°2', acronym: 'INSP2', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 32 },
    { code: 'IG-INSP3', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'IG', name: 'Inspecteur N°3', acronym: 'INSP3', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 33 },

    // B2 — Secrétariat Général
    { code: 'SG', category: 'CENTRALE' as ServiceCategory, level: 1, parentCode: null, name: 'Secrétariat Général', acronym: 'SG', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 40 },
    { code: 'SG-CS', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'SG', name: 'Cellule de Suivi', acronym: 'CS', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 41 },
    { code: 'SG-CC', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'SG', name: 'Cellule de Communication', acronym: 'CC', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 42 },
    { code: 'SG-CJ', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'SG', name: 'Cellule Juridique', acronym: 'CJ', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 43 },
    { code: 'SG-CT', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'SG', name: 'Cellule de Traduction', acronym: 'CTRAD', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 44 },
    { code: 'SG-CI', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'SG', name: 'Cellule Informatique', acronym: 'CI', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 45 },
    { code: 'SG-SDACL', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'SG', name: "Sous-Direction de l'Accueil, du Courrier et de Liaison", acronym: 'SDACL', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 46 },
    { code: 'SG-SDACL-SAO', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'SG-SDACL', name: "Service de l'Accueil et de l'Orientation", acronym: 'SAO', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 47 },
    { code: 'SG-SDACL-SAO-BAI', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'SG-SDACL-SAO', name: "Bureau de l'Accueil et de l'Information", acronym: 'BAI', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 48 },
    { code: 'SG-SDACL-SAO-BCC', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'SG-SDACL-SAO', name: 'Bureau du Contrôle de Conformité', acronym: 'BCC', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 49 },
    { code: 'SG-SDACL-SCL', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'SG-SDACL', name: 'Service du Courrier et de Liaison', acronym: 'SCL', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 50 },
    { code: 'SG-SDACL-SCL-BCA', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'SG-SDACL-SCL', name: 'Bureau du Courrier-Arrivée', acronym: 'BCA', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 51 },
    { code: 'SG-SDACL-SCL-BCD', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'SG-SDACL-SCL', name: 'Bureau du Courrier-Départ', acronym: 'BCD', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 52 },
    { code: 'SG-SDACL-SCL-BR', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'SG-SDACL-SCL', name: 'Bureau de la Reprographie', acronym: 'BR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 53 },
    { code: 'SG-SDACL-SR', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'SG-SDACL', name: 'Service de la Relance', acronym: 'SR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 54 },
    { code: 'SG-SDA', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'SG', name: 'Service de la Documentation et des Archives', acronym: 'SDA', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 55 },
    { code: 'SG-SDA-BDOC', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'SG-SDA', name: 'Bureau de la Documentation', acronym: 'BDOC', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 56 },
    { code: 'SG-SDA-BARC', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'SG-SDA', name: 'Bureau des Archives', acronym: 'BARC', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 57 },

    // B3 — Division des Études, de la Prospective et de la Coopération
    { code: 'DEPC', category: 'CENTRALE' as ServiceCategory, level: 1, parentCode: null, name: 'Division des Études, de la Prospective et de la Coopération', acronym: 'DEPC', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 60 },
    { code: 'DEPC-CEP', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DEPC', name: 'Cellule des Études et de la Prospective', acronym: 'CEP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 61 },
    { code: 'DEPC-CCOOP', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DEPC', name: 'Cellule de la Coopération', acronym: 'CCOOP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 62 },

    // B4 — Division de la Promotion de l'Emploi
    { code: 'DPE', category: 'CENTRALE' as ServiceCategory, level: 1, parentCode: null, name: "Division de la Promotion de l'Emploi", acronym: 'DPE', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 70 },
    { code: 'DPE-CPDE', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DPE', name: "Cellule de la Planification et du Développement de l'Emploi", acronym: 'CPDE', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 71 },
    { code: 'DPE-CGE', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DPE', name: "Cellule de la Gestion de l'Emploi", acronym: 'CGE', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 72 },

    // B5 — Direction de la Régulation de la Main-d'Œuvre (DRMOE)
    { code: 'DRMOE', category: 'CENTRALE' as ServiceCategory, level: 1, parentCode: null, name: "Direction de la Régulation de la Main-d'Œuvre", acronym: 'DRMOE', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 80 },
    { code: 'DRMOE-SDPMO', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DRMOE', name: "Sous-Direction de la Planification de la Main-d'Œuvre", acronym: 'SDPMO', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 81 },
    { code: 'DRMOE-SDPMO-SERMO', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DRMOE-SDPMO', name: "Service des Études et de la Réglementation de la Main-d'Œuvre", acronym: 'SERMO', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 82 },
    { code: 'DRMOE-SDPMO-SFMO', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DRMOE-SDPMO', name: "Service des Fichiers sur la Main-d'Œuvre", acronym: 'SFMO', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 83 },
    { code: 'DRMOE-SDIA', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DRMOE', name: "Sous-Direction de l'Insertion et des Agréments", acronym: 'SDIA', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 84 },
    { code: 'DRMOE-SDIA-SPMO', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DRMOE-SDIA', name: "Service du Placement de la Main-d'Œuvre", acronym: 'SPMO', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 85 },
    { code: 'DRMOE-SDIA-SPMO-BRMO', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DRMOE-SDIA-SPMO', name: "Bureau de la Régulation des Mouvements de la Main-d'Œuvre", acronym: 'BRMO', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 86 },
    { code: 'DRMOE-SDIA-SPMO-BC', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DRMOE-SDIA-SPMO', name: 'Bureau des Contrats', acronym: 'BC', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 87 },
    { code: 'DRMOE-SDIA-SAC', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DRMOE-SDIA', name: 'Service des Agréments et du Contrôle', acronym: 'SAC', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 88 },
    { code: 'DRMOE-SDIA-SAC-BCTRL', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DRMOE-SDIA-SAC', name: 'Bureau du Contrôle', acronym: 'BCTRL', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 89 },
    { code: 'DRMOE-SDIA-SAC-BAGR', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DRMOE-SDIA-SAC', name: 'Bureau des Agréments', acronym: 'BAGR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 90 },

    // B6 — Direction de la Formation et de l'Orientation Professionnelles
    { code: 'DFOP', category: 'CENTRALE' as ServiceCategory, level: 1, parentCode: null, name: "Direction de la Formation et de l'Orientation Professionnelles", acronym: 'DFOP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 100 },
    { code: 'DFOP-SDGSF', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DFOP', name: 'Sous-Direction de la Gestion des Structures de Formation', acronym: 'SDGSF', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 101 },
    { code: 'DFOP-SDGSF-SGCISSFA', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DFOP-SDGSF', name: "Service de Gestion des Centres, Instituts et Structures Spécialisées de Formation Professionnelle et d'Apprentissage", acronym: 'SGCISSFA', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 102 },
    { code: 'DFOP-SDGSF-SGCISSFA-BGCI', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DFOP-SDGSF-SGCISSFA', name: "Bureau de Gestion des Centres et Instituts de Formation Professionnelle et d'Apprentissage", acronym: 'BGCI', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 103 },
    { code: 'DFOP-SDGSF-SGCISSFA-BGSS', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DFOP-SDGSF-SGCISSFA', name: "Bureau de Gestion des Structures Spécialisées de Formation Professionnelle et d'Apprentissage", acronym: 'BGSS', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 104 },
    { code: 'DFOP-SDGSF-SACD', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DFOP-SDGSF', name: 'Service des Agréments, du Contrôle et de la Diffusion', acronym: 'SACD', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 105 },
    { code: 'DFOP-SDE', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DFOP', name: 'Sous-Direction des Évaluations', acronym: 'SDE', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 110 },
    { code: 'DFOP-SDE-SECC', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DFOP-SDE', name: 'Service des Examens, des Concours et de la Certification', acronym: 'SECC', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 111 },
    { code: 'DFOP-SDE-SECC-BOEC', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DFOP-SDE-SECC', name: "Bureau de l'Organisation des Examens et des Concours", acronym: 'BOEC', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 112 },
    { code: 'DFOP-SDE-SECC-BRMAT', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DFOP-SDE-SECC', name: 'Bureau de Reprographie et du Matériel', acronym: 'BRMAT', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 113 },
    { code: 'DFOP-SDE-SECC-BCERT', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DFOP-SDE-SECC', name: 'Bureau de la Certification', acronym: 'BCERT', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 114 },
    { code: 'DFOP-SDE-SFSIA', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DFOP-SDE', name: 'Service des Formations du Secteur Industriel et des Métiers Agricoles', acronym: 'SFSIA', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 115 },
    { code: 'DFOP-SDE-SFTSFG', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DFOP-SDE', name: 'Service des Formations du Secteur Tertiaire et des Formations Générales', acronym: 'SFTSFG', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 116 },
    { code: 'DFOP-SDRP', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DFOP', name: 'Sous-Direction de la Réglementation Psychotechnique', acronym: 'SDRP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 120 },
    { code: 'DFOP-SDRP-SACOPO', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DFOP-SDRP', name: "Service des Agréments et du Contrôle des Organismes Privés d'Orientation Professionnelle", acronym: 'SACOPO', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 121 },
    { code: 'DFOP-SDRP-STP', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DFOP-SDRP', name: 'Service des Tests Psychotechniques', acronym: 'STP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 122 },
    { code: 'DFOP-SDOP', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DFOP', name: "Sous-Direction de l'Orientation Professionnelle", acronym: 'SDOP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 130 },
    { code: 'DFOP-SDOP-SORP', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DFOP-SDOP', name: "Service de l'Orientation et des Reclassements Professionnels", acronym: 'SORP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 131 },
    { code: 'DFOP-SDOP-SEPT', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DFOP-SDOP', name: 'Service des Études Psychologiques du Travail', acronym: 'SEPT', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 132 },
    { code: 'DFOP-SDOP-SDIFF', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DFOP-SDOP', name: 'Service de la Diffusion', acronym: 'SDIFF', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 133 },

    // B7 — Direction des Affaires Générales
    { code: 'DAG', category: 'CENTRALE' as ServiceCategory, level: 1, parentCode: null, name: 'Direction des Affaires Générales', acronym: 'DAG', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 140 },
    { code: 'DAG-CSIGIPES', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DAG', name: 'Cellule de Gestion du Projet SIGIPES', acronym: 'CSIGIPES', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 141 },
    { code: 'DAG-SDPSP', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DAG', name: 'Sous-Direction des Personnels, de la Solde et des Pensions', acronym: 'SDPSP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 142 },
    { code: 'DAG-SDPSP-SP', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DAG-SDPSP', name: 'Service du Personnel', acronym: 'SP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 143 },
    { code: 'DAG-SDPSP-SP-BF', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DAG-SDPSP-SP', name: 'Bureau du Fichier', acronym: 'BF', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 144 },
    { code: 'DAG-SDPSP-SP-BPF', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DAG-SDPSP-SP', name: 'Bureau du Personnel Fonctionnaire', acronym: 'BPF', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 145 },
    { code: 'DAG-SDPSP-SP-BPNF', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DAG-SDPSP-SP', name: 'Bureau du Personnel Non Fonctionnaire', acronym: 'BPNF', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 146 },
    { code: 'DAG-SDPSP-SP-BFORM', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DAG-SDPSP-SP', name: 'Bureau de la Formation', acronym: 'BFORM', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 147 },
    { code: 'DAG-SDPSP-SSP', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DAG-SDPSP', name: 'Service de la Solde et des Pensions', acronym: 'SSP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 148 },
    { code: 'DAG-SDPSP-SSP-BSPD', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DAG-SDPSP-SSP', name: 'Bureau de la Solde et des Prestations Diverses', acronym: 'BSPD', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 149 },
    { code: 'DAG-SDPSP-SSP-BPENS', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DAG-SDPSP-SSP', name: 'Bureau des Pensions', acronym: 'BPENS', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 150 },
    { code: 'DAG-SDPSP-SSP-BRR', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DAG-SDPSP-SSP', name: 'Bureau des Requêtes et de la Relance', acronym: 'BRR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 151 },
    { code: 'DAG-SDPSP-SAS', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DAG-SDPSP', name: "Service de l'Action Sociale", acronym: 'SAS', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 152 },
    { code: 'DAG-SDBMM', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DAG', name: 'Sous-Direction du Budget, du Matériel et de la Maintenance', acronym: 'SDBMM', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 153 },
    { code: 'DAG-SDBMM-SBM', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DAG-SDBMM', name: 'Service du Budget et du Matériel', acronym: 'SBM', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 154 },
    { code: 'DAG-SDBMM-SBM-BB', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DAG-SDBMM-SBM', name: 'Bureau du Budget', acronym: 'BB', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 155 },
    { code: 'DAG-SDBMM-SBM-BMAT', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DAG-SDBMM-SBM', name: 'Bureau du Matériel', acronym: 'BMAT', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 156 },
    { code: 'DAG-SDBMM-SM', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DAG-SDBMM', name: 'Service des Marchés', acronym: 'SM', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 157 },
    { code: 'DAG-SDBMM-SMAINT', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DAG-SDBMM', name: 'Service de la Maintenance', acronym: 'SMAINT', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 158 },
    { code: 'DAG-SDBMM-SMAINT-BMAINT', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DAG-SDBMM-SMAINT', name: 'Bureau de la Maintenance', acronym: 'BMAINT', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 159 },
    { code: 'DAG-SDBMM-SMAINT-BPROP', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DAG-SDBMM-SMAINT', name: 'Bureau de la Propreté', acronym: 'BPROP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 160 },

    // ═══════════════════════════════════════════
    // C. ORGANISMES RATTACHÉS → CENTRAL
    // ═══════════════════════════════════════════

    { code: 'FNE', category: 'RATTACHE' as ServiceCategory, level: 1, parentCode: null, name: "Fonds National de l'Emploi", acronym: 'FNE', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 200 },
    { code: 'FNE-DG', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'FNE', name: 'Direction Générale — FNE', acronym: 'DG', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 201 },
    { code: 'FNE-DR', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'FNE', name: 'Direction Régionale — FNE', acronym: 'DR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 202 },

    { code: 'CFPA', category: 'RATTACHE' as ServiceCategory, level: 1, parentCode: null, name: "Centre Public de Formation Professionnelle et d'Apprentissage", acronym: 'CFPA', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 210 },
    { code: 'CFPA-DIR', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'CFPA', name: 'Direction — CFPA', acronym: 'DIR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 211 },
    { code: 'CFPA-FORM', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'CFPA', name: 'Département de Formation — CFPA', acronym: 'FORM', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 212 },
    { code: 'CFPA-ADM', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'CFPA', name: 'Service Administratif et Financier — CFPA', acronym: 'ADM', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 213 },

    { code: 'IPFPA', category: 'RATTACHE' as ServiceCategory, level: 1, parentCode: null, name: "Institut Public de Formation Professionnelle et d'Apprentissage", acronym: 'IPFPA', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 220 },
    { code: 'IPFPA-DIR', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'IPFPA', name: 'Direction — Institut', acronym: 'DIR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 221 },
    { code: 'IPFPA-FORM', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'IPFPA', name: 'Département de Formation — Institut', acronym: 'FORM', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 222 },

    { code: 'SAR', category: 'RATTACHE' as ServiceCategory, level: 1, parentCode: null, name: 'Section Artisanale et Rurale', acronym: 'SAR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 230 },
    { code: 'SAR-DIR', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'SAR', name: 'Direction — SAR', acronym: 'DIR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 231 },

    { code: 'SM', category: 'RATTACHE' as ServiceCategory, level: 1, parentCode: null, name: 'Section Ménagère', acronym: 'SM', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 240 },
    { code: 'SM-DIR', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'SM', name: 'Direction — Section Ménagère', acronym: 'DIR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 241 },
];

// ── Service Positions (Roles within each service) ─────────────────────────────
const servicePositions = [
    // ============================================================
    // DIRECTION DE LA RÉGULATION DE LA MAIN-D'ŒUVRE (DRMOE)
    // ============================================================
    // Direction level
    { serviceCode: 'DRMOE', positionType: 'HEAD' as PositionType, title: 'Directeur de la Régulation de la Main-d\'Œuvre', titleEn: 'Director of Labour Regulation', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMOE', positionType: 'DEPUTY_HEAD' as PositionType, title: 'Directeur Adjoint de la Régulation de la Main-d\'Œuvre', titleEn: 'Deputy Director of Labour Regulation', level: 2, orderIndex: 2 },

    // Sous-Direction de la Planification de la Main-d'Œuvre (SDPMO)
    { serviceCode: 'DRMOE-SDPMO', positionType: 'SUB_DIRECTION_HEAD' as PositionType, title: 'Chef de la Sous-Direction de la Planification de la Main-d\'Œuvre', titleEn: 'Head of Labour Planning Sub-Directorate', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMOE-SDPMO', positionType: 'DEPUTY_HEAD' as PositionType, title: 'Chef de Sous-Direction Adjoint', titleEn: 'Deputy Head of Sub-Directorate', level: 2, orderIndex: 2 },

    // Service des Études et de la Réglementation de la Main-d'Œuvre (SERMO)
    { serviceCode: 'DRMOE-SDPMO-SERMO', positionType: 'HEAD' as PositionType, title: 'Chef du Service des Études et de la Réglementation', titleEn: 'Head of Studies and Regulations Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMOE-SDPMO-SERMO', positionType: 'DEPUTY_HEAD' as PositionType, title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
    { serviceCode: 'DRMOE-SDPMO-SERMO', positionType: 'OFFICER' as PositionType, title: 'Chargé d\'Études Juridiques', titleEn: 'Legal Study Officer', level: 3, orderIndex: 3 },
    { serviceCode: 'DRMOE-SDPMO-SERMO', positionType: 'OFFICER' as PositionType, title: 'Chargé d\'Études Économiques', titleEn: 'Economic Study Officer', level: 3, orderIndex: 4 },
    { serviceCode: 'DRMOE-SDPMO-SERMO', positionType: 'OFFICER' as PositionType, title: 'Chargé d\'Études Statistiques', titleEn: 'Statistics Study Officer', level: 3, orderIndex: 5 },

    // Service des Fichiers sur la Main-d'Œuvre (SFMO)
    { serviceCode: 'DRMOE-SDPMO-SFMO', positionType: 'HEAD' as PositionType, title: 'Chef du Service des Fichiers', titleEn: 'Head of Records Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMOE-SDPMO-SFMO', positionType: 'OFFICER' as PositionType, title: 'Chargé de la Base de Données', titleEn: 'Database Officer', level: 3, orderIndex: 2 },
    { serviceCode: 'DRMOE-SDPMO-SFMO', positionType: 'TECHNICIAN' as PositionType, title: 'Technicien Informatique', titleEn: 'IT Technician', level: 4, orderIndex: 3 },
    { serviceCode: 'DRMOE-SDPMO-SFMO', positionType: 'ASSISTANT' as PositionType, title: 'Assistant de Gestion des Fichiers', titleEn: 'Records Management Assistant', level: 4, orderIndex: 4 },

    // Sous-Direction de l'Insertion et des Agréments (SDIA)
    { serviceCode: 'DRMOE-SDIA', positionType: 'SUB_DIRECTION_HEAD' as PositionType, title: 'Chef de la Sous-Direction de l\'Insertion et des Agréments', titleEn: 'Head of Insertion and Approvals Sub-Directorate', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMOE-SDIA', positionType: 'DEPUTY_HEAD' as PositionType, title: 'Chef de Sous-Direction Adjoint', titleEn: 'Deputy Head of Sub-Directorate', level: 2, orderIndex: 2 },

    // Service du Placement de la Main-d'Œuvre (SPMO)
    { serviceCode: 'DRMOE-SDIA-SPMO', positionType: 'HEAD' as PositionType, title: 'Chef du Service du Placement', titleEn: 'Head of Placement Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMOE-SDIA-SPMO', positionType: 'DEPUTY_HEAD' as PositionType, title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
    { serviceCode: 'DRMOE-SDIA-SPMO', positionType: 'OFFICER' as PositionType, title: 'Chargé du Placement', titleEn: 'Placement Officer', level: 3, orderIndex: 3 },
    { serviceCode: 'DRMOE-SDIA-SPMO', positionType: 'OFFICER' as PositionType, title: 'Conseiller en Emploi', titleEn: 'Employment Advisor', level: 3, orderIndex: 4 },
    { serviceCode: 'DRMOE-SDIA-SPMO', positionType: 'OFFICER' as PositionType, title: 'Chargé des Relations avec les Entreprises', titleEn: 'Corporate Relations Officer', level: 3, orderIndex: 5 },

    // Bureau de la Régulation des Mouvements de la Main-d'Œuvre (BRMO)
    { serviceCode: 'DRMOE-SDIA-SPMO-BRMO', positionType: 'HEAD' as PositionType, title: 'Chef du Bureau de la Régulation des Mouvements', titleEn: 'Head of Movement Regulation Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMOE-SDIA-SPMO-BRMO', positionType: 'DEPUTY_HEAD' as PositionType, title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
    { serviceCode: 'DRMOE-SDIA-SPMO-BRMO', positionType: 'OFFICER' as PositionType, title: 'Chargé des Mouvements', titleEn: 'Movement Officer', level: 3, orderIndex: 3 },
    { serviceCode: 'DRMOE-SDIA-SPMO-BRMO', positionType: 'ASSISTANT' as PositionType, title: 'Assistant de Régulation', titleEn: 'Regulation Assistant', level: 4, orderIndex: 4 },
    { serviceCode: 'DRMOE-SDIA-SPMO-BRMO', positionType: 'TECHNICIAN' as PositionType, title: 'Technicien de Suivi', titleEn: 'Monitoring Technician', level: 4, orderIndex: 5 },

    // Bureau des Contrats (BC)
    { serviceCode: 'DRMOE-SDIA-SPMO-BC', positionType: 'HEAD' as PositionType, title: 'Chef du Bureau des Contrats', titleEn: 'Head of Contracts Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMOE-SDIA-SPMO-BC', positionType: 'DEPUTY_HEAD' as PositionType, title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
    { serviceCode: 'DRMOE-SDIA-SPMO-BC', positionType: 'OFFICER' as PositionType, title: 'Chargé des Contrats', titleEn: 'Contracts Officer', level: 3, orderIndex: 3 },
    { serviceCode: 'DRMOE-SDIA-SPMO-BC', positionType: 'OFFICER' as PositionType, title: 'Chargé du Visa des Contrats', titleEn: 'Contract Visa Officer', level: 3, orderIndex: 4 },
    { serviceCode: 'DRMOE-SDIA-SPMO-BC', positionType: 'ASSISTANT' as PositionType, title: 'Assistant Juridique', titleEn: 'Legal Assistant', level: 4, orderIndex: 5 },

    // Service des Agréments et du Contrôle (SAC)
    { serviceCode: 'DRMOE-SDIA-SAC', positionType: 'HEAD' as PositionType, title: 'Chef du Service des Agréments et du Contrôle', titleEn: 'Head of Approvals and Control Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMOE-SDIA-SAC', positionType: 'DEPUTY_HEAD' as PositionType, title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
    { serviceCode: 'DRMOE-SDIA-SAC', positionType: 'OFFICER' as PositionType, title: 'Chargé des Agréments', titleEn: 'Approvals Officer', level: 3, orderIndex: 3 },
    { serviceCode: 'DRMOE-SDIA-SAC', positionType: 'OFFICER' as PositionType, title: 'Chargé du Contrôle', titleEn: 'Control Officer', level: 3, orderIndex: 4 },

    // Bureau du Contrôle (BCTRL)
    { serviceCode: 'DRMOE-SDIA-SAC-BCTRL', positionType: 'HEAD' as PositionType, title: 'Chef du Bureau du Contrôle', titleEn: 'Head of Control Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMOE-SDIA-SAC-BCTRL', positionType: 'OFFICER' as PositionType, title: 'Chargé du Contrôle sur le Terrain', titleEn: 'Field Control Officer', level: 3, orderIndex: 2 },
    { serviceCode: 'DRMOE-SDIA-SAC-BCTRL', positionType: 'OFFICER' as PositionType, title: 'Chargé du Contrôle Administratif', titleEn: 'Administrative Control Officer', level: 3, orderIndex: 3 },

    // Bureau des Agréments (BAGR)
    { serviceCode: 'DRMOE-SDIA-SAC-BAGR', positionType: 'HEAD' as PositionType, title: 'Chef du Bureau des Agréments', titleEn: 'Head of Approvals Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMOE-SDIA-SAC-BAGR', positionType: 'OFFICER' as PositionType, title: 'Chargé des Agréments des Entreprises', titleEn: 'Company Approvals Officer', level: 3, orderIndex: 2 },
    { serviceCode: 'DRMOE-SDIA-SAC-BAGR', positionType: 'OFFICER' as PositionType, title: 'Chargé des Agréments des Organismes de Placement', titleEn: 'Placement Agency Approvals Officer', level: 3, orderIndex: 3 },

    // ============================================================
    // DÉLÉGATION RÉGIONALE (DREFOP)
    // ============================================================
    { serviceCode: 'DREFOP', positionType: 'HEAD' as PositionType, title: 'Délégué Régional de l\'Emploi et de la Formation Professionnelle', titleEn: 'Regional Delegate of Employment and Vocational Training', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP', positionType: 'DEPUTY_HEAD' as PositionType, title: 'Délégué Régional Adjoint', titleEn: 'Deputy Regional Delegate', level: 2, orderIndex: 2 },
    { serviceCode: 'DREFOP', positionType: 'OFFICER' as PositionType, title: 'Chef de Service', titleEn: 'Service Head', level: 3, orderIndex: 3 },
    { serviceCode: 'DREFOP', positionType: 'OFFICER' as PositionType, title: 'Chargé d\'Études', titleEn: 'Study Officer', level: 4, orderIndex: 4 },
    { serviceCode: 'DREFOP', positionType: 'ASSISTANT' as PositionType, title: 'Assistant Administratif', titleEn: 'Administrative Assistant', level: 4, orderIndex: 5 },

    // Service de la Régulation de la Main-d'Œuvre (SRMO) - Regional level
    { serviceCode: 'DREFOP-SRMO', positionType: 'HEAD' as PositionType, title: 'Chef du Service de la Régulation de la Main-d\'Œuvre', titleEn: 'Head of Labour Regulation Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP-SRMO', positionType: 'OFFICER' as PositionType, title: 'Chargé de la Régulation', titleEn: 'Regulation Officer', level: 3, orderIndex: 2 },
    { serviceCode: 'DREFOP-SRMO', positionType: 'OFFICER' as PositionType, title: 'Chargé des Statistiques', titleEn: 'Statistics Officer', level: 3, orderIndex: 3 },

    // ============================================================
    // DÉLÉGATION DÉPARTEMENTALE (DDEFOP)
    // ============================================================
    { serviceCode: 'DDEFOP', positionType: 'HEAD' as PositionType, title: 'Délégué Départemental de l\'Emploi et de la Formation Professionnelle', titleEn: 'Departmental Delegate of Employment and Vocational Training', level: 1, orderIndex: 1 },
    { serviceCode: 'DDEFOP', positionType: 'DEPUTY_HEAD' as PositionType, title: 'Délégué Départemental Adjoint', titleEn: 'Deputy Departmental Delegate', level: 2, orderIndex: 2 },
    { serviceCode: 'DDEFOP', positionType: 'OFFICER' as PositionType, title: 'Chef de Bureau', titleEn: 'Bureau Head', level: 3, orderIndex: 3 },
    { serviceCode: 'DDEFOP', positionType: 'OFFICER' as PositionType, title: 'Agent de Terrain', titleEn: 'Field Officer', level: 4, orderIndex: 4 },

    // ============================================================
    // DIRECTION DES AFFAIRES GÉNÉRALES (DAG)
    // ============================================================
    { serviceCode: 'DAG', positionType: 'HEAD' as PositionType, title: 'Directeur des Affaires Générales', titleEn: 'Director of General Affairs', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG', positionType: 'DEPUTY_HEAD' as PositionType, title: 'Directeur Adjoint des Affaires Générales', titleEn: 'Deputy Director of General Affairs', level: 2, orderIndex: 2 },

    // Sous-Direction des Personnels (SDPSP)
    { serviceCode: 'DAG-SDPSP', positionType: 'SUB_DIRECTION_HEAD' as PositionType, title: 'Chef de la Sous-Direction des Personnels, de la Solde et des Pensions', titleEn: 'Head of Staff, Payroll and Pensions Sub-Directorate', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDPSP', positionType: 'DEPUTY_HEAD' as PositionType, title: 'Chef de Sous-Direction Adjoint', titleEn: 'Deputy Head of Sub-Directorate', level: 2, orderIndex: 2 },

    // Service du Personnel (SP)
    { serviceCode: 'DAG-SDPSP-SP', positionType: 'HEAD' as PositionType, title: 'Chef du Service du Personnel', titleEn: 'Head of Staff Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDPSP-SP', positionType: 'DEPUTY_HEAD' as PositionType, title: 'Chef du Service du Personnel Adjoint', titleEn: 'Deputy Head of Staff Service', level: 2, orderIndex: 2 },
    { serviceCode: 'DAG-SDPSP-SP', positionType: 'OFFICER' as PositionType, title: 'Chargé d\'Études', titleEn: 'Study Officer', level: 3, orderIndex: 3 },
    { serviceCode: 'DAG-SDPSP-SP', positionType: 'ASSISTANT' as PositionType, title: 'Assistant de Gestion', titleEn: 'Management Assistant', level: 4, orderIndex: 4 },

    // Bureau du Personnel Fonctionnaire (BPF)
    { serviceCode: 'DAG-SDPSP-SP-BPF', positionType: 'HEAD' as PositionType, title: 'Chef du Bureau du Personnel Fonctionnaire', titleEn: 'Head of Civil Servant Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDPSP-SP-BPF', positionType: 'DEPUTY_HEAD' as PositionType, title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
    { serviceCode: 'DAG-SDPSP-SP-BPF', positionType: 'OFFICER' as PositionType, title: 'Chargé d\'Études', titleEn: 'Study Officer', level: 3, orderIndex: 3 },
    { serviceCode: 'DAG-SDPSP-SP-BPF', positionType: 'TECHNICIAN' as PositionType, title: 'Technicien RH', titleEn: 'HR Technician', level: 4, orderIndex: 4 },
];

async function seed() {
    console.log('🌱 Starting database seed...\n');

    try {
        // ==================== SECTORS ====================
        console.log('🏭 Creating socioprofessional sectors...');

        const sectors = [
            { name: 'Agriculture, élevage, sylviculture et pêche', category: 'Primary' },
            { name: 'Industries extractives', category: 'Primary' },
            { name: 'Industrie manufacturière', category: 'Secondary' },
            { name: "Production et distribution d'eau, électricité et gaz", category: 'Secondary' },
            { name: 'Construction et BTP', category: 'Secondary' },
            { name: 'Commerce de gros et de détail', category: 'Tertiary' },
            { name: 'Transport et entreposage', category: 'Tertiary' },
            { name: 'Hôtellerie et restauration', category: 'Tertiary' },
            { name: 'Information et communication', category: 'Tertiary' },
            { name: "Activités financières et d'assurance", category: 'Tertiary' },
            { name: 'Activités immobilières', category: 'Tertiary' },
            { name: 'Activités juridiques, comptables et de conseil', category: 'Tertiary' },
            { name: 'Recherche et développement', category: 'Tertiary' },
            { name: 'Enseignement', category: 'Tertiary' },
            { name: 'Santé humaine et action sociale', category: 'Tertiary' },
            { name: 'Arts, spectacles et loisirs', category: 'Tertiary' },
            { name: 'Autres activités de services', category: 'Tertiary' },
            { name: 'Administration publique et défense', category: 'Public' },
            { name: 'Organismes extraterritoriaux', category: 'Public' },
        ];

        for (const sector of sectors) {
            await prisma.sector.upsert({
                where: { name: sector.name },
                update: {},
                create: sector,
            });
        }
        console.log(`   ✅ ${sectors.length} sectors created`);

        // ==================== MINEFOP SERVICES ====================
        console.log('🏛️ Creating MINEFOP service hierarchy (Décret 2005/123)...');

        for (const s of minefopServices) {
            await prisma.minefopService.upsert({
                where: { code: s.code },
                update: {
                    name: s.name,
                    acronym: s.acronym ?? null,
                    category: s.category,
                    level: s.level,
                    parentCode: s.parentCode ?? null,
                    roleMapping: s.roleMapping,
                    requiresRegion: s.requiresRegion,
                    requiresDepartment: s.requiresDepartment,
                    orderIndex: s.orderIndex,
                    isActive: true,
                },
                create: {
                    code: s.code,
                    name: s.name,
                    acronym: s.acronym ?? null,
                    category: s.category,
                    level: s.level,
                    parentCode: s.parentCode ?? null,
                    roleMapping: s.roleMapping,
                    requiresRegion: s.requiresRegion,
                    requiresDepartment: s.requiresDepartment,
                    orderIndex: s.orderIndex,
                    isActive: true,
                },
            });
        }
        console.log(`   ✅ ${minefopServices.length} MINEFOP services created`);

        // ==================== SERVICE POSITIONS ====================
        console.log('👔 Creating service positions (roles)...');

        for (const pos of servicePositions) {
            await prisma.servicePosition.upsert({
                where: {
                    serviceCode_positionType: {
                        serviceCode: pos.serviceCode,
                        positionType: pos.positionType
                    }
                },
                update: {},
                create: pos,
            });
        }
        console.log(`   ✅ ${servicePositions.length} service positions created`);

        // ==================== REGIONS, DEPARTMENTS, SUBDIVISIONS ====================
        console.log('🗺️ Creating regions, departments, and subdivisions...');

        const regionsData = [
            {
                name: 'Adamaoua',
                departments: [
                    { name: 'Djérem', subdivisions: ['Mbakaou', 'Ngaoundal', 'Tibati'] },
                    { name: 'Faro-et-Déo', subdivisions: ['Galim-Tignère', 'Kontcha', 'Mayo-Baléo', 'Tignère'] },
                    { name: 'Mayo-Banyo', subdivisions: ['Bankim', 'Banyo', 'Mayo-Darle', 'Ngan-Ha'] },
                    { name: 'Mbéré', subdivisions: ['Djohong', 'Gonmé', 'Meiganga', 'Ngaoui'] },
                    { name: 'Vina', subdivisions: ['Belel', 'Martap', 'Meidougou', 'Ngaoundéré I', 'Ngaoundéré II', 'Ngaoundéré III', 'Nyambaka'] },
                ]
            },
            {
                name: 'Centre',
                departments: [
                    { name: 'Haute-Sanaga', subdivisions: ['Lembe-Yezoum', 'Minta', 'Nanga-Eboko', 'Nkoteng'] },
                    { name: 'Lékié', subdivisions: ['Batchenga', 'Ebebda', 'Elig-Mfomo', 'Evodoula', 'Monatélé', 'Obala', "Sa'a"] },
                    { name: 'Mbam-et-Inoubou', subdivisions: ['Bafia', 'Bokito', 'Deuk', 'Kiiki', 'Koro', 'Makénéné', 'Ndikiniméki', 'Nitoukou', 'Ombessa'] },
                    { name: 'Mbam-et-Kim', subdivisions: ['Mbangassina', 'Ngambe-Tikar', 'Ngoro', 'Ntui', 'Yoko'] },
                    { name: 'Méfou-et-Afamba', subdivisions: ['Awaé', 'Esse', 'Mfou', 'Nkolafamba', 'Soa', 'Yaoundé VII'] },
                    { name: 'Méfou-et-Akono', subdivisions: ['Akono', 'Bikok', 'Dzeng', 'Mengueme', 'Ngog-Mapubi', 'Ngoumou'] },
                    { name: 'Mfoundi', subdivisions: ['Yaoundé I', 'Yaoundé II', 'Yaoundé III', 'Yaoundé IV', 'Yaoundé V', 'Yaoundé VI'] },
                    { name: 'Nyong-et-Kellé', subdivisions: ['Éséka', 'Makak', 'Matomb', 'Messondo', 'Ngog-Mapubi', 'Nyanon', 'Pouma'] },
                    { name: 'Nyong-et-Mfoumou', subdivisions: ['Akonolinga', 'Ayos', 'Endom', 'Kobdombo', 'Menomale', 'Ngomedzap'] },
                    { name: "Nyong-et-So'o", subdivisions: ['Dzeng', 'Mbalmayo', 'Mbankomo', 'Mengueme', 'Mfou', 'Ngomedzap', 'Ngoumou'] },
                ]
            },
            {
                name: 'Est',
                departments: [
                    { name: 'Boumba-et-Ngoko', subdivisions: ['Gari-Gombo', 'Moloundou', 'Salapoumbé', 'Yokadouma'] },
                    { name: 'Haut-Nyong', subdivisions: ['Abong-Mbang', 'Angossas', 'Atok', 'Dimako', 'Doumaintang', 'Doume', 'Lomié', 'Mboma', 'Messamena', 'Mindourou', 'Ngoyla', 'Nguelemendouka', 'Somalomo'] },
                    { name: 'Kadey', subdivisions: ['Batouri', 'Kette', 'Mbang', 'Ndelele', 'Nguelebok', 'Ouli'] },
                    { name: 'Lom-et-Djérem', subdivisions: ['Bélabo', 'Bertoua I', 'Bertoua II', 'Betaré-Oya', 'Diang', 'Ngoura'] },
                ]
            },
            {
                name: 'Extrême-Nord',
                departments: [
                    { name: 'Diamaré', subdivisions: ['Gazawa', 'Maroua I', 'Maroua II', 'Maroua III', 'Meri', 'Ndoukoula', 'Pette'] },
                    { name: 'Logone-et-Chari', subdivisions: ['Fotokol', 'Goulfey', 'Hilé-Alifa', 'Kousseri', 'Logone-Birni', 'Makary', 'Waza', 'Zina'] },
                    { name: 'Mayo-Danay', subdivisions: ['Datcheka', 'Gazawa', 'Kaélé', 'Kar-Hay', 'Maga', 'Mindif', 'Moulouvaye', 'Tchatibali', 'Yagoua'] },
                    { name: 'Mayo-Kani', subdivisions: ['Blangoua', 'Guidiguis', 'Kaïkaï', 'Moulvoudaye', 'Tchanaga', 'Toulourou'] },
                    { name: 'Mayo-Sava', subdivisions: ['Kolofata', 'Limani', 'Méri', 'Mora', 'Tokombéré'] },
                    { name: 'Mayo-Tsanaga', subdivisions: ['Bourha', 'Hina', 'Koza', 'Mogodé', 'Mokolo', 'Mozogo', 'Roua', 'Soulédé-Roua'] },
                ]
            },
            {
                name: 'Littoral',
                departments: [
                    { name: 'Moungo', subdivisions: ['Bare-Bakem', 'Bonalea', 'Dibombari', 'Ekom', 'Loum', 'Manjo', 'Mbanga', 'Melong', 'Mombo', 'Njombe-Penja', 'Nkongsamba I', 'Nkongsamba II', 'Nkongsamba III'] },
                    { name: 'Nkam', subdivisions: ['Ndom', 'Ngambe', 'Yabassi', 'Yingui'] },
                    { name: 'Sanaga-Maritime', subdivisions: ['Dibamba', 'Dizangue', 'Édéa I', 'Édéa II', 'Mouanko', 'Ndom', 'Ngambe', 'Nyanon', 'Pouma'] },
                    { name: 'Wouri', subdivisions: ['Douala I', 'Douala II', 'Douala III', 'Douala IV', 'Douala V', 'Manoka'] },
                ]
            },
            {
                name: 'Nord',
                departments: [
                    { name: 'Bénoué', subdivisions: ['Bibemi', 'Dembo', 'Garoua I', 'Garoua II', 'Garoua III', 'Lagdo', 'Ngong', 'Pitoa', 'Tchéboa'] },
                    { name: 'Faro', subdivisions: ['Beka', 'Poli'] },
                    { name: 'Mayo-Louti', subdivisions: ['Figuil', 'Guider', 'Mayo-Oulo'] },
                    { name: 'Mayo-Rey', subdivisions: ['Pignde', 'Rey-Bouba', 'Tcholliré', 'Touboro'] },
                ]
            },
            {
                name: 'Nord-Ouest',
                departments: [
                    { name: 'Boyo', subdivisions: ['Belo', 'Fonfuka', 'Fundong'] },
                    { name: 'Bui', subdivisions: ['Jakiri', 'Kumbo', 'Mbven', 'Nkum', 'Noni', 'Oku'] },
                    { name: 'Donga-Mantung', subdivisions: ['Ako', 'Ndu', 'Nkambe', 'Nwa'] },
                    { name: 'Menchum', subdivisions: ['Benakuma', 'Fungom', 'Wum', 'Zhoa'] },
                    { name: 'Mezam', subdivisions: ['Bafut', 'Bali', 'Bamenda I', 'Bamenda II', 'Bamenda III', 'Santa', 'Tubah'] },
                    { name: 'Momo', subdivisions: ['Batibo', 'Mbengwi', 'Njikwa', 'Widikum-Menka'] },
                    { name: 'Ngo-Ketunjia', subdivisions: ['Babessi', 'Balikumbat', 'Ndop'] },
                ]
            },
            {
                name: 'Ouest',
                departments: [
                    { name: 'Bamboutos', subdivisions: ['Babadjou', 'Batcham', 'Galim', 'Mbouda'] },
                    { name: 'Haut-Nkam', subdivisions: ['Bafang', 'Banka', 'Bandja', 'Batcham', 'Kekem'] },
                    { name: 'Hauts-Plateaux', subdivisions: ['Baham', 'Bamendjou', 'Bangou', 'Bansoa'] },
                    { name: 'Koung-Khi', subdivisions: ['Bamendjou', 'Kouoptamo', 'Poumougne'] },
                    { name: 'Menoua', subdivisions: ['Dschang', 'Fongo-Tongo', 'Fokoué', 'Kekem', 'Nkong-Ni', 'Penka-Michel', 'Santchou'] },
                    { name: 'Mifi', subdivisions: ['Bafoussam I', 'Bafoussam II', 'Bafoussam III'] },
                    { name: 'Ndé', subdivisions: ['Bangangté', 'Bassamba', 'Bazou', 'Tonga'] },
                    { name: 'Noun', subdivisions: ['Foumban', 'Foumbot', 'Kouoptamo', 'Koutaba', 'Magba', 'Malantouen', 'Massangam', 'Njimom'] },
                ]
            },
            {
                name: 'Sud',
                departments: [
                    { name: 'Dja-et-Lobo', subdivisions: ['Bengbis', 'Djoum', 'Meyomessala', 'Meyomessi', 'Mintom', 'Mvangan', 'Oveng', 'Sangmélima'] },
                    { name: 'Mvila', subdivisions: ['Ambam', 'Bengbis', 'Ebolowa I', 'Ebolowa II', 'Efoulan', "Ma'an", 'Mengong', 'Mvangan', 'Ngoulemakong'] },
                    { name: 'Océan', subdivisions: ['Akom II', 'Campo', 'Grand Batanga', 'Kribi I', 'Kribi II', 'Lolodorf', 'Mvengue'] },
                    { name: 'Vallée-du-Ntem', subdivisions: ['Biwong-Bané', 'Biwong-Bulu', 'Djoum', 'Meyomessala', 'Nkpwa'] },
                ]
            },
            {
                name: 'Sud-Ouest',
                departments: [
                    { name: 'Fako', subdivisions: ['Buea', 'Limbe I', 'Limbe II', 'Limbe III', 'Muyuka', 'Tiko'] },
                    { name: 'Koupé-Muanenguba', subdivisions: ['Bangem', 'Nguti', 'Tombel'] },
                    { name: 'Lebialem', subdivisions: ['Alou', 'Fontem', 'Wabane'] },
                    { name: 'Manyu', subdivisions: ['Akwaya', 'Eyumojock', 'Mamfe', 'Tinto'] },
                    { name: 'Meme', subdivisions: ['Konye', 'Kumba I', 'Kumba II', 'Kumba III', 'Mbonge'] },
                    { name: 'Ndian', subdivisions: ['Ekondo-Titi', 'Isangele', 'Kombo-Abedimo', 'Kombo-Itindi', 'Mundemba'] },
                ]
            },
        ];

        const regionMap = new Map<string, string>();
        for (const regionData of regionsData) {
            const region = await prisma.region.upsert({
                where: { name: regionData.name },
                update: {},
                create: { name: regionData.name },
            });
            regionMap.set(regionData.name, region.id);
        }

        type DeptMeta = { id: string; subdivisions: string[] };
        const deptMap = new Map<string, DeptMeta>();
        for (const regionData of regionsData) {
            const regionId = regionMap.get(regionData.name)!;
            for (const deptData of regionData.departments) {
                const department = await prisma.department.upsert({
                    where: { regionId_name: { regionId, name: deptData.name } },
                    update: {},
                    create: { name: deptData.name, regionId },
                });
                deptMap.set(`${regionId}|${deptData.name}`, { id: department.id, subdivisions: deptData.subdivisions });
            }
        }

        for (const meta of deptMap.values()) {
            await prisma.subdivision.createMany({
                data: meta.subdivisions.map(name => ({ name, departmentId: meta.id })),
                skipDuplicates: true,
            });
        }
        console.log('   ✅ All regions, departments, and subdivisions created');

        // ==================== TEST USERS ====================
        console.log('👥 Creating test users...');

        const centralUser = await prisma.user.upsert({
            where: { email: 'central@ministry.cm' },
            update: {},
            create: {
                email: 'central@ministry.cm',
                firstName: 'Paul',
                lastName: 'Biya',
                passwordHash: await bcrypt.hash('password123', 10),
                role: 'CENTRAL',
                region: null,
                department: null,
            },
        });

        const regionalUser = await prisma.user.upsert({
            where: { email: 'regional.centre@ministry.cm' },
            update: {},
            create: {
                email: 'regional.centre@ministry.cm',
                firstName: 'Jean',
                lastName: 'Nkuéta',
                passwordHash: await bcrypt.hash('password123', 10),
                role: 'REGIONAL',
                region: 'Centre',
                department: null,
            },
        });

        const divisionalUser = await prisma.user.upsert({
            where: { email: 'divisional.mfoundi@ministry.cm' },
            update: {},
            create: {
                email: 'divisional.mfoundi@ministry.cm',
                firstName: 'Marie',
                lastName: 'Ebanda',
                passwordHash: await bcrypt.hash('password123', 10),
                role: 'DIVISIONAL',
                region: 'Centre',
                department: 'Mfoundi',
            },
        });

        // ==================== SAMPLE COMPANIES & DECLARATIONS ====================
        console.log('🏢 Creating sample companies...');

        const companies = [];
        const sectorList = await prisma.sector.findMany();
        const regionList = await prisma.region.findMany();
        const departmentList = await prisma.department.findMany();

        for (let i = 1; i <= 20; i++) {
            const region = regionList[Math.floor(Math.random() * regionList.length)];
            const department = departmentList[Math.floor(Math.random() * departmentList.length)];
            const sector = sectorList[Math.floor(Math.random() * sectorList.length)];

            const companyUser = await prisma.user.create({
                data: {
                    email: `company${i}@example.cm`,
                    firstName: 'Company',
                    lastName: `${i}`,
                    passwordHash: await bcrypt.hash('password123', 10),
                    role: 'COMPANY',
                    region: region.name,
                    department: department.name,
                },
            });

            const company = await prisma.company.create({
                data: {
                    userId: companyUser.id,
                    name: `${sector.name} Company ${i}`,
                    mainActivity: sector.name,
                    secondaryActivity: 'General Services',
                    region: region.name,
                    department: department.name,
                    district: 'Yaoundé',
                    address: `P.O. Box ${1000 + i}, Yaoundé`,
                    taxNumber: `CT${String(i).padStart(6, '0')}`,
                    cnpsNumber: `CN${String(i).padStart(6, '0')}`,
                    socialCapital: 50000000 + i * 1000000,
                    totalEmployees: 50 + i * 10,
                    menCount: Math.floor((50 + i * 10) * 0.65),
                    womenCount: Math.floor((50 + i * 10) * 0.35),
                    lastYearTotal: 40 + i * 8,
                },
            });
            companies.push(company);
        }

        console.log('📋 Creating sample declarations...');

        for (const company of companies) {
            const totalEmployees = 50 + Math.floor(Math.random() * 200);
            const declaration = await prisma.declaration.create({
                data: {
                    year: 2024,
                    fillingDate: new Date(),
                    companyId: company.id,
                    region: company.region,
                    division: company.department,
                    status: (['DRAFT', 'SUBMITTED', 'DIVISION_APPROVED', 'REGION_APPROVED', 'FINAL_APPROVED'] as const)[Math.floor(Math.random() * 5)],
                    submittedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
                },
            });

            const employees = [];
            for (let j = 0; j < totalEmployees; j++) {
                employees.push({
                    declarationId: declaration.id,
                    fullName: `Employee ${j + 1}`,
                    gender: Math.random() > 0.35 ? 'M' : 'F',
                    age: 25 + Math.floor(Math.random() * 35),
                    nationality: 'Cameroonian',
                    diploma: ['CEP', 'BEPC', 'Baccalauréat', 'Licence', 'Master'][Math.floor(Math.random() * 5)],
                    function: ['Ouvrier', 'Employé', 'Superviseur', 'Cadre', 'Direction'][Math.floor(Math.random() * 5)],
                    seniority: Math.floor(Math.random() * 20),
                    salaryCategory: ['1-3', '4-6', '7-9', '10-12'][Math.floor(Math.random() * 4)],
                });
            }
            await prisma.employee.createMany({ data: employees });

            await prisma.declarationMovement.createMany({
                data: [
                    { declarationId: declaration.id, movementType: 'RECRUITMENT', cat1_3: Math.floor(Math.random() * 10), cat4_6: Math.floor(Math.random() * 15), cat7_9: Math.floor(Math.random() * 8), cat10_12: Math.floor(Math.random() * 5), catNonDeclared: 0 },
                    { declarationId: declaration.id, movementType: 'DISMISSAL', cat1_3: Math.floor(Math.random() * 3), cat4_6: Math.floor(Math.random() * 5), cat7_9: Math.floor(Math.random() * 3), cat10_12: Math.floor(Math.random() * 2), catNonDeclared: 0 },
                    { declarationId: declaration.id, movementType: 'RETIREMENT', cat1_3: 0, cat4_6: Math.floor(Math.random() * 2), cat7_9: Math.floor(Math.random() * 3), cat10_12: Math.floor(Math.random() * 2), catNonDeclared: 0 },
                ],
            });

            await prisma.qualitativeQuestion.create({
                data: {
                    declarationId: declaration.id,
                    questionType: 'QUALITATIVE',
                    section: 'GENERAL',
                    questionText: 'Informations qualitatives',
                    hasTrainingCenter: Math.random() > 0.5,
                    recruitmentPlansNext: Math.random() > 0.4,
                    camerounisationPlan: Math.random() > 0.3,
                    usesTempAgencies: Math.random() > 0.6,
                    temporaryWorkerCount: Math.floor(Math.random() * 20),
                },
            });

            await prisma.validationStep.createMany({
                data: [
                    { declarationId: declaration.id, stepType: 'GENDER_SUM', isValid: true },
                    { declarationId: declaration.id, stepType: 'CATEGORY_SUM', isValid: true },
                    { declarationId: declaration.id, stepType: 'MOVEMENT_CONSISTENCY', isValid: true },
                    { declarationId: declaration.id, stepType: 'WORKFORCE_GROWTH', isValid: true },
                    { declarationId: declaration.id, stepType: 'EMPLOYEE_VALIDATION', isValid: true },
                ],
            });

            await prisma.auditLog.create({
                data: {
                    userId: company.userId,
                    declarationId: declaration.id,
                    action: 'CREATE',
                    resourceType: 'Declaration',
                    resourceId: declaration.id,
                    details: 'Declaration created for year 2024',
                },
            });
        }

        // ==================== NOTIFICATIONS ====================
        console.log('📧 Creating sample notifications...');

        const notification = await prisma.notification.create({
            data: {
                sentBy: centralUser.id,
                regionFilter: 'Centre',
                subject: "Rappel: Échéance de soumission DSM-O 2024",
                message: "Veuillez soumettre votre Déclaration sur la Situation de la Main d'Œuvre avant le 31 décembre 2024.",
                recipientCount: 8,
            },
        });

        for (let i = 0; i < 8; i++) {
            await prisma.notificationRecipient.create({
                data: {
                    notificationId: notification.id,
                    companyId: companies[i].id,
                    email: `company${i + 1}@example.cm`,
                    status: 'SENT',
                    sentAt: new Date(),
                    openedAt: Math.random() > 0.3 ? new Date() : null,
                },
            });
        }

        // ==================== ANALYTICS ====================
        console.log('📊 Creating analytics snapshots...');

        for (const year of [2022, 2023, 2024]) {
            await prisma.analyticsSnapshot.create({
                data: {
                    year,
                    region: 'Centre',
                    totalEmployment: 150000 + year * 5000,
                    maleEmployment: 95000 + year * 3000,
                    femaleEmployment: 55000 + year * 2000,
                    totalRecruitment: 10000 + year * 500,
                    totalDismissals: 2000 + year * 100,
                    companiesSubmitted: 340 + year * 10,
                    companiesApproved: 320 + year * 8,
                    companiesPending: 20,
                },
            });
        }

        console.log('\n✅ Database seed completed successfully!\n');
        console.log('📝 Test Credentials:');
        console.log('   CENTRAL User:     central@ministry.cm / password123');
        console.log('   REGIONAL User:    regional.centre@ministry.cm / password123');
        console.log('   DIVISIONAL User:  divisional.mfoundi@ministry.cm / password123');
        console.log('   COMPANY Users:    company1@example.cm ... company20@example.cm / password123');
        console.log(`\n🏛️ MINEFOP Services: ${minefopServices.length} services seeded across 3 categories`);
        console.log('   DECONCENTRE: DREFOP (Regional) + DDEFOP (Departmental)');
        console.log('   CENTRALE:    Cabinet · IG · SG · DEPC · DPE · DRMOE · DFOP · DAG');
        console.log('   RATTACHE:    FNE · CFPA · IPFPA · SAR · SM');
        console.log(`\n👔 Service Positions: ${servicePositions.length} positions seeded across services\n`);

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Call the seed function
seed();