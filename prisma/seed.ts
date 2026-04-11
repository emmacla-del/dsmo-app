import { PrismaClient, UserRole, ServiceCategory, PositionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// MINEFOP SERVICE HIERARCHY  (Décret n° 2005/123 du 15 avril 2005)
// ─────────────────────────────────────────────────────────────────────────────
const minefopServices = [
    // ══════════════════════════════════════════════════════════
    // A. SERVICES DÉCONCENTRÉS
    // ══════════════════════════════════════════════════════════
    { code: 'DREFOP', category: 'DECONCENTRE' as ServiceCategory, level: 1, parentCode: null, name: "Délégation Régionale de l'Emploi et de la Formation Professionnelle", acronym: 'DREFOP', roleMapping: 'REGIONAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 1 },
    { code: 'DREFOP-SPE', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DREFOP', name: "Service de la Promotion de l'Emploi", acronym: 'SPE', roleMapping: 'REGIONAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 2 },
    { code: 'DREFOP-SRMO', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DREFOP', name: "Service de la Régulation de la Main-d'Œuvre", acronym: 'SRMO', roleMapping: 'REGIONAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 3 },
    { code: 'DREFOP-SRMO-BEP', category: 'DECONCENTRE' as ServiceCategory, level: 3, parentCode: 'DREFOP-SRMO', name: "Bureau de l'Enregistrement et du Placement", acronym: 'BEP', roleMapping: 'REGIONAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 4 },
    { code: 'DREFOP-SRMO-BFSMOE', category: 'DECONCENTRE' as ServiceCategory, level: 3, parentCode: 'DREFOP-SRMO', name: "Bureau du Fichier et des Statistiques de la Main-d'Œuvre", acronym: 'BFSMOE', roleMapping: 'REGIONAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 5 },
    { code: 'DREFOP-SFPA', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DREFOP', name: "Service de la Formation Professionnelle et de l'Apprentissage", acronym: 'SFPA', roleMapping: 'REGIONAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 6 },
    { code: 'DREFOP-SSOP', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DREFOP', name: "Service de la Sélection et de l'Orientation Professionnelle", acronym: 'SSOP', roleMapping: 'REGIONAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 7 },
    { code: 'DREFOP-SAF', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DREFOP', name: 'Service Administratif et Financier', acronym: 'SAF', roleMapping: 'REGIONAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 8 },
    { code: 'DREFOP-BACL', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DREFOP', name: "Bureau de l'Accueil, du Courrier et de Liaison", acronym: 'BACL', roleMapping: 'REGIONAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 9 },

    { code: 'DDEFOP', category: 'DECONCENTRE' as ServiceCategory, level: 1, parentCode: null, name: "Délégation Départementale de l'Emploi et de la Formation Professionnelle", acronym: 'DDEFOP', roleMapping: 'DIVISIONAL' as UserRole, requiresRegion: true, requiresDepartment: true, orderIndex: 10 },
    { code: 'DDEFOP-BEIS', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DDEFOP', name: "Bureau de l'Emploi, de l'Insertion et des Statistiques", acronym: 'BEIS', roleMapping: 'DIVISIONAL' as UserRole, requiresRegion: true, requiresDepartment: true, orderIndex: 11 },
    { code: 'DDEFOP-BFPOE', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DDEFOP', name: "Bureau de la Formation Professionnelle, de l'Orientation et des Évaluations", acronym: 'BFPOE', roleMapping: 'DIVISIONAL' as UserRole, requiresRegion: true, requiresDepartment: true, orderIndex: 12 },
    { code: 'DDEFOP-BAG', category: 'DECONCENTRE' as ServiceCategory, level: 2, parentCode: 'DDEFOP', name: 'Bureau des Affaires Générales', acronym: 'BAG', roleMapping: 'DIVISIONAL' as UserRole, requiresRegion: true, requiresDepartment: true, orderIndex: 13 },

    // ══════════════════════════════════════════════════════════
    // B. ADMINISTRATION CENTRALE
    // ══════════════════════════════════════════════════════════
    // Cabinet du Ministre
    { code: 'MINISTRE', category: 'CENTRALE' as ServiceCategory, level: 1, parentCode: null, name: "Cabinet du Ministre de l'Emploi et de la Formation Professionnelle", acronym: 'MINEFOP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 20 },
    { code: 'MINISTRE-SP', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'MINISTRE', name: 'Secrétariat Particulier', acronym: 'SP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 21 },
    { code: 'MINISTRE-CT1', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'MINISTRE', name: 'Conseiller Technique N°1', acronym: 'CT1', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 22 },
    { code: 'MINISTRE-CT2', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'MINISTRE', name: 'Conseiller Technique N°2', acronym: 'CT2', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 23 },

    // Inspection Générale
    { code: 'IG', category: 'CENTRALE' as ServiceCategory, level: 1, parentCode: null, name: 'Inspection Générale', acronym: 'IG', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 30 },
    { code: 'IG-INSP1', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'IG', name: 'Inspecteur N°1', acronym: 'INSP1', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 31 },
    { code: 'IG-INSP2', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'IG', name: 'Inspecteur N°2', acronym: 'INSP2', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 32 },
    { code: 'IG-INSP3', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'IG', name: 'Inspecteur N°3', acronym: 'INSP3', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 33 },

    // Secrétariat Général + cellules
    { code: 'SG', category: 'CENTRALE' as ServiceCategory, level: 1, parentCode: null, name: 'Secrétariat Général', acronym: 'SG', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 40 },
    { code: 'SG-CS', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'SG', name: 'Cellule de Suivi', acronym: 'CS', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 41 },
    { code: 'SG-CC', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'SG', name: 'Cellule de Communication', acronym: 'CC', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 42 },
    { code: 'SG-CJ', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'SG', name: 'Cellule Juridique', acronym: 'CJ', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 43 },
    { code: 'SG-CT', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'SG', name: 'Cellule de Traduction', acronym: 'CTRAD', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 44 },
    { code: 'SG-CI', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'SG', name: 'Cellule Informatique', acronym: 'CI', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 45 },
    // SDACL + services + bureaux
    { code: 'SG-SDACL', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'SG', name: "Sous-Direction de l'Accueil, du Courrier et de Liaison", acronym: 'SDACL', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 46 },
    { code: 'SG-SDACL-SAO', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'SG-SDACL', name: "Service de l'Accueil et de l'Orientation", acronym: 'SAO', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 47 },
    { code: 'SG-SDACL-SAO-BAI', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'SG-SDACL-SAO', name: "Bureau de l'Accueil et de l'Information", acronym: 'BAI', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 48 },
    { code: 'SG-SDACL-SAO-BCC', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'SG-SDACL-SAO', name: 'Bureau du Contrôle de Conformité', acronym: 'BCC', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 49 },
    { code: 'SG-SDACL-SCL', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'SG-SDACL', name: 'Service du Courrier et de Liaison', acronym: 'SCL', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 50 },
    { code: 'SG-SDACL-SCL-BCA', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'SG-SDACL-SCL', name: 'Bureau du Courrier-Arrivée', acronym: 'BCA', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 51 },
    { code: 'SG-SDACL-SCL-BCD', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'SG-SDACL-SCL', name: 'Bureau du Courrier-Départ', acronym: 'BCD', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 52 },
    { code: 'SG-SDACL-SCL-BR', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'SG-SDACL-SCL', name: 'Bureau de la Reprographie', acronym: 'BR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 53 },
    { code: 'SG-SDACL-SR', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'SG-SDACL', name: 'Service de la Relance', acronym: 'SR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 54 },
    // SDA + bureaux
    { code: 'SG-SDA', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'SG', name: 'Service de la Documentation et des Archives', acronym: 'SDA', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 55 },
    { code: 'SG-SDA-BDOC', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'SG-SDA', name: 'Bureau de la Documentation', acronym: 'BDOC', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 56 },
    { code: 'SG-SDA-BARC', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'SG-SDA', name: 'Bureau des Archives', acronym: 'BARC', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 57 },

    // DEPC
    { code: 'DEPC', category: 'CENTRALE' as ServiceCategory, level: 1, parentCode: null, name: 'Division des Études, de la Prospective et de la Coopération', acronym: 'DEPC', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 60 },
    { code: 'DEPC-CEP', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DEPC', name: 'Cellule des Études et de la Prospective', acronym: 'CEP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 61 },
    { code: 'DEPC-CCOOP', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DEPC', name: 'Cellule de la Coopération', acronym: 'CCOOP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 62 },

    // DPE
    { code: 'DPE', category: 'CENTRALE' as ServiceCategory, level: 1, parentCode: null, name: "Division de la Promotion de l'Emploi", acronym: 'DPE', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 70 },
    { code: 'DPE-CPDE', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DPE', name: "Cellule de la Planification et du Développement de l'Emploi", acronym: 'CPDE', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 71 },
    { code: 'DPE-CGE', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DPE', name: "Cellule de la Gestion de l'Emploi", acronym: 'CGE', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 72 },

    // DRMOE
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

    // DFOP
    { code: 'DFOP', category: 'CENTRALE' as ServiceCategory, level: 1, parentCode: null, name: "Direction de la Formation et de l'Orientation Professionnelles", acronym: 'DFOP', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 100 },
    { code: 'DFOP-SDGSF', category: 'CENTRALE' as ServiceCategory, level: 2, parentCode: 'DFOP', name: 'Sous-Direction de la Gestion des Structures de Formation', acronym: 'SDGSF', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 101 },
    { code: 'DFOP-SDGSF-SGCISSFA', category: 'CENTRALE' as ServiceCategory, level: 3, parentCode: 'DFOP-SDGSF', name: "Service de Gestion des Centres, Instituts et Structures Spécialisées de FPA", acronym: 'SGCISSFA', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 102 },
    { code: 'DFOP-SDGSF-SGCISSFA-BGCI', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DFOP-SDGSF-SGCISSFA', name: "Bureau de Gestion des Centres et Instituts de FPA", acronym: 'BGCI', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 103 },
    { code: 'DFOP-SDGSF-SGCISSFA-BGSS', category: 'CENTRALE' as ServiceCategory, level: 4, parentCode: 'DFOP-SDGSF-SGCISSFA', name: "Bureau de Gestion des Structures Spécialisées de FPA", acronym: 'BGSS', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 104 },
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

    // DAG
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

    // ══════════════════════════════════════════════════════════
    // C. ORGANISMES RATTACHÉS
    // ══════════════════════════════════════════════════════════
    { code: 'FNE', category: 'RATTACHE' as ServiceCategory, level: 1, parentCode: null, name: "Fonds National de l'Emploi", acronym: 'FNE', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 200 },
    { code: 'FNE-DG', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'FNE', name: 'Direction Générale — FNE', acronym: 'DG', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 201 },
    { code: 'FNE-DR', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'FNE', name: 'Direction Régionale — FNE', acronym: 'DR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: true, requiresDepartment: false, orderIndex: 202 },

    { code: 'CFPA', category: 'RATTACHE' as ServiceCategory, level: 1, parentCode: null, name: "Centre Public de Formation Professionnelle et d'Apprentissage", acronym: 'CFPA', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 210 },
    { code: 'CFPA-DIR', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'CFPA', name: 'Direction — CFPA', acronym: 'DIR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 211 },
    { code: 'CFPA-FORM', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'CFPA', name: 'Département de Formation — CFPA', acronym: 'FORM', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 212 },
    { code: 'CFPA-ADM', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'CFPA', name: 'Service Administratif et Financier — CFPA', acronym: 'ADM', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 213 },

    { code: 'IPFPA', category: 'RATTACHE' as ServiceCategory, level: 1, parentCode: null, name: "Institut Public de Formation Professionnelle et d'Apprentissage", acronym: 'IPFPA', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 220 },
    { code: 'IPFPA-DIR', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'IPFPA', name: "Direction — Institut", acronym: 'DIR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 221 },
    { code: 'IPFPA-FORM', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'IPFPA', name: 'Département de Formation — Institut', acronym: 'FORM', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 222 },

    { code: 'SAR', category: 'RATTACHE' as ServiceCategory, level: 1, parentCode: null, name: 'Section Artisanale et Rurale', acronym: 'SAR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 230 },
    { code: 'SAR-DIR', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'SAR', name: 'Direction — SAR', acronym: 'DIR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 231 },

    { code: 'SM', category: 'RATTACHE' as ServiceCategory, level: 1, parentCode: null, name: 'Section Ménagère', acronym: 'SM', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 240 },
    { code: 'SM-DIR', category: 'RATTACHE' as ServiceCategory, level: 2, parentCode: 'SM', name: 'Direction — Section Ménagère', acronym: 'DIR', roleMapping: 'CENTRAL' as UserRole, requiresRegion: false, requiresDepartment: false, orderIndex: 241 },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE SERVICE POSITIONS  (per Décret Art. 68 + organigram)
//
// RULES applied per service level:
//   MINISTER CABINET (level 1)     → Ministre, Conseillers Techniques, Chef SP
//   IG (level 1)                   → Inspecteur Général + 3 Inspecteurs
//   SG (level 1)                   → Secrétaire Général + Deputy
//   DIRECTION (level 1, CENTRALE)  → Directeur, Directeur Adjoint, Chargés d'Études Assistants (CEA)
//   DIVISION (level 1, CENTRALE)   → Chef de Division, CEA
//   SOUS-DIRECTION (level 2)       → Sous-Directeur + CEA
//   CELLULE (level 2 under DEPC/DPE/DAG/SG) → Chef de Cellule + CEA
//   SERVICE (level 3)              → Chef de Service, Chef de Service Adjoint, CEA
//                                    + all bureaux under it have HEAD + OFFICER + ASSISTANT
//   BUREAU (level 4)               → Chef de Bureau, Chef de Bureau Adjoint, CEA, ASSISTANT
//   DREFOP (level 1, DECONCENTRE)  → Délégué Régional, Délégué Adjoint
//   DREFOP services (level 2)      → Chef de Service, Chef de Service Adjoint, CEA
//   DREFOP bureau (level 2=BACL)   → Chef de Bureau, CEA
//   DREFOP-SRMO bureaux (level 3)  → Chef de Bureau, CEA, ASSISTANT
//   DDEFOP (level 1)               → Délégué Départemental, Délégué Adjoint
//   DDEFOP bureaux (level 2)       → Chef de Bureau, CEA, ASSISTANT
//   RATTACHE level 1               → Directeur Général / Chef de Centre / Directeur Institut / Directeur SAR/SM
//   RATTACHE level 2               → Directeur, Chef de Service Adjoint, OFFICER, ASSISTANT
// ─────────────────────────────────────────────────────────────────────────────
const servicePositions: {
    serviceCode: string;
    positionType: PositionType;
    title: string;
    titleEn: string;
    level: number;
    orderIndex: number;
}[] = [

        // ══════════════════════════════════════════════════════════════════════════
        // CABINET DU MINISTRE
        // ══════════════════════════════════════════════════════════════════════════
        { serviceCode: 'MINISTRE', positionType: 'HEAD', title: 'Ministre de l\'Emploi et de la Formation Professionnelle', titleEn: 'Minister of Employment and Vocational Training', level: 1, orderIndex: 1 },
        { serviceCode: 'MINISTRE', positionType: 'OFFICER', title: 'Conseiller Technique', titleEn: 'Technical Adviser', level: 2, orderIndex: 2 },
        { serviceCode: 'MINISTRE', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        // Secrétariat Particulier (Art. 3 — Chef de SP = rang Chef de Service)
        { serviceCode: 'MINISTRE-SP', positionType: 'HEAD', title: 'Chef de Secrétariat Particulier', titleEn: 'Head of Private Secretariat', level: 1, orderIndex: 1 },
        { serviceCode: 'MINISTRE-SP', positionType: 'ASSISTANT', title: 'Attaché de Cabinet', titleEn: 'Cabinet Attaché', level: 2, orderIndex: 2 },

        // Conseillers Techniques (Art. 4)
        { serviceCode: 'MINISTRE-CT1', positionType: 'HEAD', title: 'Conseiller Technique N°1', titleEn: 'Technical Adviser No. 1', level: 1, orderIndex: 1 },
        { serviceCode: 'MINISTRE-CT2', positionType: 'HEAD', title: 'Conseiller Technique N°2', titleEn: 'Technical Adviser No. 2', level: 1, orderIndex: 1 },

        // ══════════════════════════════════════════════════════════════════════════
        // INSPECTION GÉNÉRALE  (Art. 5 — IG rang SG; 3 Inspecteurs rang Directeur)
        // ══════════════════════════════════════════════════════════════════════════
        { serviceCode: 'IG', positionType: 'HEAD', title: 'Inspecteur Général', titleEn: 'Inspector General', level: 1, orderIndex: 1 },
        { serviceCode: 'IG', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 2, orderIndex: 2 },
        { serviceCode: 'IG-INSP1', positionType: 'HEAD', title: 'Inspecteur N°1', titleEn: 'Inspector No. 1', level: 1, orderIndex: 1 },
        { serviceCode: 'IG-INSP2', positionType: 'HEAD', title: 'Inspecteur N°2', titleEn: 'Inspector No. 2', level: 1, orderIndex: 1 },
        { serviceCode: 'IG-INSP3', positionType: 'HEAD', title: 'Inspecteur N°3', titleEn: 'Inspector No. 3', level: 1, orderIndex: 1 },

        // ══════════════════════════════════════════════════════════════════════════
        // SECRÉTARIAT GÉNÉRAL  (Art. 8)
        // ══════════════════════════════════════════════════════════════════════════
        { serviceCode: 'SG', positionType: 'HEAD', title: 'Secrétaire Général', titleEn: 'Secretary General', level: 1, orderIndex: 1 },
        { serviceCode: 'SG', positionType: 'DEPUTY_HEAD', title: 'Secrétaire Général Adjoint', titleEn: 'Deputy Secretary General', level: 2, orderIndex: 2 },
        { serviceCode: 'SG', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        // Cellule de Suivi (Art. 10 — Chef de Cellule rang Sous-Directeur + 2 CEA)
        { serviceCode: 'SG-CS', positionType: 'HEAD', title: 'Chef de la Cellule de Suivi', titleEn: 'Head of Monitoring Unit', level: 1, orderIndex: 1 },
        { serviceCode: 'SG-CS', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 2, orderIndex: 2 },
        { serviceCode: 'SG-CS', positionType: 'ASSISTANT', title: 'Agent de Suivi', titleEn: 'Monitoring Agent', level: 3, orderIndex: 3 },

        // Cellule de Communication (Art. 11 — Chef Cellule + 2 CEA)
        { serviceCode: 'SG-CC', positionType: 'HEAD', title: 'Chef de la Cellule de Communication', titleEn: 'Head of Communication Unit', level: 1, orderIndex: 1 },
        { serviceCode: 'SG-CC', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant (Communication)', titleEn: 'Assistant Research Officer (Communication)', level: 2, orderIndex: 2 },
        { serviceCode: 'SG-CC', positionType: 'ASSISTANT', title: 'Agent de Protocole', titleEn: 'Protocol Officer', level: 3, orderIndex: 3 },

        // Cellule Juridique (Art. 12 — Chef Cellule + 3 CEA)
        { serviceCode: 'SG-CJ', positionType: 'HEAD', title: 'Chef de la Cellule Juridique', titleEn: 'Head of Legal Unit', level: 1, orderIndex: 1 },
        { serviceCode: 'SG-CJ', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant Juridique', titleEn: 'Legal Assistant Research Officer', level: 2, orderIndex: 2 },
        { serviceCode: 'SG-CJ', positionType: 'ASSISTANT', title: 'Agent Juridique', titleEn: 'Legal Agent', level: 3, orderIndex: 3 },

        // Cellule de Traduction (Art. 13 — Chef Cellule + 2 CEA)
        { serviceCode: 'SG-CT', positionType: 'HEAD', title: 'Chef de la Cellule de Traduction', titleEn: 'Head of Translation Unit', level: 1, orderIndex: 1 },
        { serviceCode: 'SG-CT', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant (Traduction FR)', titleEn: 'Assistant Research Officer (French Translation)', level: 2, orderIndex: 2 },
        { serviceCode: 'SG-CT', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant (Traduction EN)', titleEn: 'Assistant Research Officer (English Translation)', level: 3, orderIndex: 3 },

        // Cellule Informatique (Art. 14 — Chef Cellule + 2 CEA)
        { serviceCode: 'SG-CI', positionType: 'HEAD', title: 'Chef de la Cellule Informatique', titleEn: 'Head of IT Unit', level: 1, orderIndex: 1 },
        { serviceCode: 'SG-CI', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant (Informatique)', titleEn: 'Assistant Research Officer (IT)', level: 2, orderIndex: 2 },
        { serviceCode: 'SG-CI', positionType: 'TECHNICIAN', title: 'Technicien Informatique', titleEn: 'IT Technician', level: 3, orderIndex: 3 },

        // SDACL (Art. 15 — Sous-Directeur)
        { serviceCode: 'SG-SDACL', positionType: 'SUB_DIRECTION_HEAD', title: 'Sous-Directeur de l\'Accueil, du Courrier et de Liaison', titleEn: 'Sub-Director of Reception, Mail and Liaison', level: 1, orderIndex: 1 },
        { serviceCode: 'SG-SDACL', positionType: 'DEPUTY_HEAD', title: 'Sous-Directeur Adjoint', titleEn: 'Deputy Sub-Director', level: 2, orderIndex: 2 },
        { serviceCode: 'SG-SDACL', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        // Service de l'Accueil et de l'Orientation (Art. 16)
        { serviceCode: 'SG-SDACL-SAO', positionType: 'HEAD', title: "Chef du Service de l'Accueil et de l'Orientation", titleEn: 'Head of Reception and Orientation Service', level: 1, orderIndex: 1 },
        { serviceCode: 'SG-SDACL-SAO', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'SG-SDACL-SAO', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'SG-SDACL-SAO', positionType: 'ASSISTANT', title: 'Agent d\'Accueil', titleEn: 'Reception Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'SG-SDACL-SAO-BAI', positionType: 'HEAD', title: "Chef du Bureau de l'Accueil et de l'Information", titleEn: 'Head of Reception and Information Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'SG-SDACL-SAO-BAI', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 2, orderIndex: 2 },
        { serviceCode: 'SG-SDACL-SAO-BAI', positionType: 'ASSISTANT', title: 'Agent d\'Accueil', titleEn: 'Reception Agent', level: 3, orderIndex: 3 },

        { serviceCode: 'SG-SDACL-SAO-BCC', positionType: 'HEAD', title: 'Chef du Bureau du Contrôle de Conformité', titleEn: 'Head of Compliance Control Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'SG-SDACL-SAO-BCC', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 2, orderIndex: 2 },
        { serviceCode: 'SG-SDACL-SAO-BCC', positionType: 'ASSISTANT', title: 'Agent de Contrôle', titleEn: 'Control Agent', level: 3, orderIndex: 3 },

        // Service du Courrier et de Liaison (Art. 17)
        { serviceCode: 'SG-SDACL-SCL', positionType: 'HEAD', title: 'Chef du Service du Courrier et de Liaison', titleEn: 'Head of Mail and Liaison Service', level: 1, orderIndex: 1 },
        { serviceCode: 'SG-SDACL-SCL', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'SG-SDACL-SCL', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'SG-SDACL-SCL', positionType: 'ASSISTANT', title: 'Agent de Liaison', titleEn: 'Liaison Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'SG-SDACL-SCL-BCA', positionType: 'HEAD', title: 'Chef du Bureau du Courrier-Arrivée', titleEn: 'Head of Incoming Mail Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'SG-SDACL-SCL-BCA', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 2, orderIndex: 2 },
        { serviceCode: 'SG-SDACL-SCL-BCA', positionType: 'ASSISTANT', title: 'Préposé au Courrier', titleEn: 'Mail Clerk', level: 3, orderIndex: 3 },

        { serviceCode: 'SG-SDACL-SCL-BCD', positionType: 'HEAD', title: 'Chef du Bureau du Courrier-Départ', titleEn: 'Head of Outgoing Mail Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'SG-SDACL-SCL-BCD', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 2, orderIndex: 2 },
        { serviceCode: 'SG-SDACL-SCL-BCD', positionType: 'ASSISTANT', title: 'Préposé au Courrier', titleEn: 'Mail Clerk', level: 3, orderIndex: 3 },

        { serviceCode: 'SG-SDACL-SCL-BR', positionType: 'HEAD', title: 'Chef du Bureau de la Reprographie', titleEn: 'Head of Reprography Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'SG-SDACL-SCL-BR', positionType: 'TECHNICIAN', title: 'Technicien de Reprographie', titleEn: 'Reprography Technician', level: 2, orderIndex: 2 },
        { serviceCode: 'SG-SDACL-SCL-BR', positionType: 'ASSISTANT', title: 'Agent de Reproduction', titleEn: 'Reproduction Agent', level: 3, orderIndex: 3 },

        // Service de la Relance (Art. 18)
        { serviceCode: 'SG-SDACL-SR', positionType: 'HEAD', title: 'Chef du Service de la Relance', titleEn: 'Head of Follow-up Service', level: 1, orderIndex: 1 },
        { serviceCode: 'SG-SDACL-SR', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 2, orderIndex: 2 },
        { serviceCode: 'SG-SDACL-SR', positionType: 'ASSISTANT', title: 'Agent de Relance', titleEn: 'Follow-up Agent', level: 3, orderIndex: 3 },

        // Service de la Documentation et des Archives (Art. 19)
        { serviceCode: 'SG-SDA', positionType: 'HEAD', title: 'Chef du Service de la Documentation et des Archives', titleEn: 'Head of Documentation and Archives Service', level: 1, orderIndex: 1 },
        { serviceCode: 'SG-SDA', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'SG-SDA', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'SG-SDA', positionType: 'ASSISTANT', title: 'Agent de Documentation', titleEn: 'Documentation Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'SG-SDA-BDOC', positionType: 'HEAD', title: 'Chef du Bureau de la Documentation', titleEn: 'Head of Documentation Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'SG-SDA-BDOC', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 2, orderIndex: 2 },
        { serviceCode: 'SG-SDA-BDOC', positionType: 'ASSISTANT', title: 'Documentaliste', titleEn: 'Documentalist', level: 3, orderIndex: 3 },

        { serviceCode: 'SG-SDA-BARC', positionType: 'HEAD', title: 'Chef du Bureau des Archives', titleEn: 'Head of Archives Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'SG-SDA-BARC', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 2, orderIndex: 2 },
        { serviceCode: 'SG-SDA-BARC', positionType: 'ASSISTANT', title: 'Archiviste', titleEn: 'Archivist', level: 3, orderIndex: 3 },

        // ══════════════════════════════════════════════════════════════════════════
        // DEPC  (Art. 20 — Chef de Division rang Directeur)
        // ══════════════════════════════════════════════════════════════════════════
        { serviceCode: 'DEPC', positionType: 'DIVISION_HEAD', title: 'Chef de la Division des Études, de la Prospective et de la Coopération', titleEn: 'Head of Studies, Foresight and Cooperation Division', level: 1, orderIndex: 1 },
        { serviceCode: 'DEPC', positionType: 'DEPUTY_HEAD', title: 'Chef de Division Adjoint', titleEn: 'Deputy Division Head', level: 2, orderIndex: 2 },
        { serviceCode: 'DEPC', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        // Cellule des Études et de la Prospective (Art. 21 — Chef Cellule + 2 CEA)
        { serviceCode: 'DEPC-CEP', positionType: 'HEAD', title: 'Chef de la Cellule des Études et de la Prospective', titleEn: 'Head of Studies and Foresight Unit', level: 1, orderIndex: 1 },
        { serviceCode: 'DEPC-CEP', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant (Prospective)', titleEn: 'Assistant Research Officer (Foresight)', level: 2, orderIndex: 2 },
        { serviceCode: 'DEPC-CEP', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant (Statistiques)', titleEn: 'Assistant Research Officer (Statistics)', level: 3, orderIndex: 3 },

        // Cellule de la Coopération (Art. 22 — Chef Cellule + 2 CEA)
        { serviceCode: 'DEPC-CCOOP', positionType: 'HEAD', title: 'Chef de la Cellule de la Coopération', titleEn: 'Head of Cooperation Unit', level: 1, orderIndex: 1 },
        { serviceCode: 'DEPC-CCOOP', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant (Bilatéral)', titleEn: 'Assistant Research Officer (Bilateral)', level: 2, orderIndex: 2 },
        { serviceCode: 'DEPC-CCOOP', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant (Multilatéral)', titleEn: 'Assistant Research Officer (Multilateral)', level: 3, orderIndex: 3 },

        // ══════════════════════════════════════════════════════════════════════════
        // DPE  (Art. 23 — Chef de Division rang Directeur)
        // ══════════════════════════════════════════════════════════════════════════
        { serviceCode: 'DPE', positionType: 'DIVISION_HEAD', title: "Chef de la Division de la Promotion de l'Emploi", titleEn: 'Head of Employment Promotion Division', level: 1, orderIndex: 1 },
        { serviceCode: 'DPE', positionType: 'DEPUTY_HEAD', title: 'Chef de Division Adjoint', titleEn: 'Deputy Division Head', level: 2, orderIndex: 2 },
        { serviceCode: 'DPE', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        // Cellule de la Planification et du Développement de l'Emploi (Art. 24 — Chef + 2 CEA)
        { serviceCode: 'DPE-CPDE', positionType: 'HEAD', title: "Chef de la Cellule de la Planification et du Développement de l'Emploi", titleEn: 'Head of Employment Planning and Development Unit', level: 1, orderIndex: 1 },
        { serviceCode: 'DPE-CPDE', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant (Planification)', titleEn: 'Assistant Research Officer (Planning)', level: 2, orderIndex: 2 },
        { serviceCode: 'DPE-CPDE', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant (Développement)', titleEn: 'Assistant Research Officer (Development)', level: 3, orderIndex: 3 },

        // Cellule de la Gestion de l'Emploi (Art. 25 — Chef + 4 CEA)
        { serviceCode: 'DPE-CGE', positionType: 'HEAD', title: "Chef de la Cellule de la Gestion de l'Emploi", titleEn: 'Head of Employment Management Unit', level: 1, orderIndex: 1 },
        { serviceCode: 'DPE-CGE', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 2, orderIndex: 2 },
        { serviceCode: 'DPE-CGE', positionType: 'ASSISTANT', title: 'Agent de Gestion de l\'Emploi', titleEn: 'Employment Management Agent', level: 3, orderIndex: 3 },

        // ══════════════════════════════════════════════════════════════════════════
        // DRMOE  (Art. 26 — Directeur)
        // ══════════════════════════════════════════════════════════════════════════
        { serviceCode: 'DRMOE', positionType: 'HEAD', title: "Directeur de la Régulation de la Main-d'Œuvre", titleEn: 'Director of Labour Regulation', level: 1, orderIndex: 1 },
        { serviceCode: 'DRMOE', positionType: 'DEPUTY_HEAD', title: "Directeur Adjoint de la Régulation de la Main-d'Œuvre", titleEn: 'Deputy Director of Labour Regulation', level: 2, orderIndex: 2 },
        { serviceCode: 'DRMOE', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        // SDPMO (Art. 27 — Sous-Directeur)
        { serviceCode: 'DRMOE-SDPMO', positionType: 'SUB_DIRECTION_HEAD', title: "Sous-Directeur de la Planification de la Main-d'Œuvre", titleEn: 'Sub-Director of Labour Planning', level: 1, orderIndex: 1 },
        { serviceCode: 'DRMOE-SDPMO', positionType: 'DEPUTY_HEAD', title: 'Sous-Directeur Adjoint', titleEn: 'Deputy Sub-Director', level: 2, orderIndex: 2 },
        { serviceCode: 'DRMOE-SDPMO', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        // SERMO (Art. 28 — Chef de Service)
        { serviceCode: 'DRMOE-SDPMO-SERMO', positionType: 'HEAD', title: "Chef du Service des Études et de la Réglementation de la Main-d'Œuvre", titleEn: 'Head of Labour Studies and Regulation Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DRMOE-SDPMO-SERMO', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DRMOE-SDPMO-SERMO', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant (Réglementation)', titleEn: 'Assistant Research Officer (Regulation)', level: 3, orderIndex: 3 },
        { serviceCode: 'DRMOE-SDPMO-SERMO', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant (Statistiques)', titleEn: 'Assistant Research Officer (Statistics)', level: 4, orderIndex: 4 },

        // SFMO (Art. 29 — Chef de Service)
        { serviceCode: 'DRMOE-SDPMO-SFMO', positionType: 'HEAD', title: "Chef du Service des Fichiers sur la Main-d'Œuvre", titleEn: 'Head of Labour Records Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DRMOE-SDPMO-SFMO', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DRMOE-SDPMO-SFMO', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant (Fichiers)', titleEn: 'Assistant Research Officer (Records)', level: 3, orderIndex: 3 },
        { serviceCode: 'DRMOE-SDPMO-SFMO', positionType: 'TECHNICIAN', title: 'Technicien Informatique', titleEn: 'IT Technician', level: 4, orderIndex: 4 },

        // SDIA (Art. 30 — Sous-Directeur)
        { serviceCode: 'DRMOE-SDIA', positionType: 'SUB_DIRECTION_HEAD', title: "Sous-Directeur de l'Insertion et des Agréments", titleEn: 'Sub-Director of Insertion and Approvals', level: 1, orderIndex: 1 },
        { serviceCode: 'DRMOE-SDIA', positionType: 'DEPUTY_HEAD', title: 'Sous-Directeur Adjoint', titleEn: 'Deputy Sub-Director', level: 2, orderIndex: 2 },
        { serviceCode: 'DRMOE-SDIA', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        // SPMO (Art. 31 — Chef de Service + 2 bureaux)
        { serviceCode: 'DRMOE-SDIA-SPMO', positionType: 'HEAD', title: "Chef du Service du Placement de la Main-d'Œuvre", titleEn: 'Head of Labour Placement Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DRMOE-SDIA-SPMO', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DRMOE-SDIA-SPMO', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant (Placement)', titleEn: 'Assistant Research Officer (Placement)', level: 3, orderIndex: 3 },
        { serviceCode: 'DRMOE-SDIA-SPMO', positionType: 'ASSISTANT', title: 'Conseiller en Emploi', titleEn: 'Employment Counsellor', level: 4, orderIndex: 4 },

        { serviceCode: 'DRMOE-SDIA-SPMO-BRMO', positionType: 'HEAD', title: "Chef du Bureau de la Régulation des Mouvements de la Main-d'Œuvre", titleEn: 'Head of Labour Movement Regulation Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DRMOE-SDIA-SPMO-BRMO', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DRMOE-SDIA-SPMO-BRMO', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DRMOE-SDIA-SPMO-BRMO', positionType: 'ASSISTANT', title: 'Agent de Régulation', titleEn: 'Regulation Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DRMOE-SDIA-SPMO-BC', positionType: 'HEAD', title: 'Chef du Bureau des Contrats', titleEn: 'Head of Contracts Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DRMOE-SDIA-SPMO-BC', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DRMOE-SDIA-SPMO-BC', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant (Visa Contrats)', titleEn: 'Assistant Research Officer (Contract Visa)', level: 3, orderIndex: 3 },
        { serviceCode: 'DRMOE-SDIA-SPMO-BC', positionType: 'ASSISTANT', title: 'Agent de Gestion des Contrats', titleEn: 'Contracts Management Agent', level: 4, orderIndex: 4 },

        // SAC (Art. 32 — Chef de Service + 2 bureaux)
        { serviceCode: 'DRMOE-SDIA-SAC', positionType: 'HEAD', title: 'Chef du Service des Agréments et du Contrôle', titleEn: 'Head of Approvals and Control Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DRMOE-SDIA-SAC', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DRMOE-SDIA-SAC', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DRMOE-SDIA-SAC', positionType: 'ASSISTANT', title: 'Agent de Contrôle', titleEn: 'Control Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DRMOE-SDIA-SAC-BCTRL', positionType: 'HEAD', title: 'Chef du Bureau du Contrôle', titleEn: 'Head of Control Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DRMOE-SDIA-SAC-BCTRL', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DRMOE-SDIA-SAC-BCTRL', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DRMOE-SDIA-SAC-BCTRL', positionType: 'ASSISTANT', title: 'Agent de Contrôle de Terrain', titleEn: 'Field Control Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DRMOE-SDIA-SAC-BAGR', positionType: 'HEAD', title: 'Chef du Bureau des Agréments', titleEn: 'Head of Approvals Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DRMOE-SDIA-SAC-BAGR', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DRMOE-SDIA-SAC-BAGR', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DRMOE-SDIA-SAC-BAGR', positionType: 'ASSISTANT', title: 'Agent de Gestion des Agréments', titleEn: 'Approvals Management Agent', level: 4, orderIndex: 4 },

        // ══════════════════════════════════════════════════════════════════════════
        // DFOP  (Art. 33 — Directeur)
        // ══════════════════════════════════════════════════════════════════════════
        { serviceCode: 'DFOP', positionType: 'HEAD', title: "Directeur de la Formation et de l'Orientation Professionnelles", titleEn: 'Director of Vocational Training and Guidance', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP', positionType: 'DEPUTY_HEAD', title: 'Directeur Adjoint', titleEn: 'Deputy Director', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        // SDGSF (Art. 34 — Sous-Directeur)
        { serviceCode: 'DFOP-SDGSF', positionType: 'SUB_DIRECTION_HEAD', title: 'Sous-Directeur de la Gestion des Structures de Formation', titleEn: 'Sub-Director of Training Structures Management', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDGSF', positionType: 'DEPUTY_HEAD', title: 'Sous-Directeur Adjoint', titleEn: 'Deputy Sub-Director', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDGSF', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        // SGCISSFA (Art. 35 — Chef de Service + 2 bureaux)
        { serviceCode: 'DFOP-SDGSF-SGCISSFA', positionType: 'HEAD', title: 'Chef du Service de Gestion des Centres, Instituts et Structures Spécialisées de FPA', titleEn: 'Head of VTC/Institute Management Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDGSF-SGCISSFA', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDGSF-SGCISSFA', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DFOP-SDGSF-SGCISSFA', positionType: 'ASSISTANT', title: 'Agent de Gestion', titleEn: 'Management Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DFOP-SDGSF-SGCISSFA-BGCI', positionType: 'HEAD', title: 'Chef du Bureau de Gestion des Centres et Instituts de FPA', titleEn: 'Head of VTC/Institute Management Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDGSF-SGCISSFA-BGCI', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDGSF-SGCISSFA-BGCI', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DFOP-SDGSF-SGCISSFA-BGCI', positionType: 'ASSISTANT', title: 'Agent de Gestion', titleEn: 'Management Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DFOP-SDGSF-SGCISSFA-BGSS', positionType: 'HEAD', title: 'Chef du Bureau de Gestion des Structures Spécialisées de FPA', titleEn: 'Head of Specialised Structures Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDGSF-SGCISSFA-BGSS', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDGSF-SGCISSFA-BGSS', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DFOP-SDGSF-SGCISSFA-BGSS', positionType: 'ASSISTANT', title: 'Agent de Gestion', titleEn: 'Management Agent', level: 4, orderIndex: 4 },

        // SACD (Art. 36 — Chef de Service)
        { serviceCode: 'DFOP-SDGSF-SACD', positionType: 'HEAD', title: 'Chef du Service des Agréments, du Contrôle et de la Diffusion', titleEn: 'Head of Approvals, Control and Dissemination Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDGSF-SACD', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDGSF-SACD', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant (Agréments)', titleEn: 'Assistant Research Officer (Approvals)', level: 3, orderIndex: 3 },
        { serviceCode: 'DFOP-SDGSF-SACD', positionType: 'ASSISTANT', title: 'Agent de Contrôle', titleEn: 'Control Agent', level: 4, orderIndex: 4 },

        // SDE (Art. 37 — Sous-Directeur)
        { serviceCode: 'DFOP-SDE', positionType: 'SUB_DIRECTION_HEAD', title: 'Sous-Directeur des Évaluations', titleEn: 'Sub-Director of Evaluations', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDE', positionType: 'DEPUTY_HEAD', title: 'Sous-Directeur Adjoint', titleEn: 'Deputy Sub-Director', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDE', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        // SECC (Art. 38 — Chef de Service + 3 bureaux)
        { serviceCode: 'DFOP-SDE-SECC', positionType: 'HEAD', title: 'Chef du Service des Examens, des Concours et de la Certification', titleEn: 'Head of Exams, Competitions and Certification Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDE-SECC', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDE-SECC', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DFOP-SDE-SECC', positionType: 'ASSISTANT', title: 'Agent de Certification', titleEn: 'Certification Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DFOP-SDE-SECC-BOEC', positionType: 'HEAD', title: "Chef du Bureau de l'Organisation des Examens et des Concours", titleEn: 'Head of Exams and Competitions Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDE-SECC-BOEC', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDE-SECC-BOEC', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DFOP-SDE-SECC-BOEC', positionType: 'ASSISTANT', title: 'Agent d\'Organisation', titleEn: 'Organisation Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DFOP-SDE-SECC-BRMAT', positionType: 'HEAD', title: 'Chef du Bureau de Reprographie et du Matériel', titleEn: 'Head of Reprography and Materials Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDE-SECC-BRMAT', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDE-SECC-BRMAT', positionType: 'TECHNICIAN', title: 'Technicien de Reprographie', titleEn: 'Reprography Technician', level: 3, orderIndex: 3 },
        { serviceCode: 'DFOP-SDE-SECC-BRMAT', positionType: 'ASSISTANT', title: 'Agent Matériel', titleEn: 'Materials Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DFOP-SDE-SECC-BCERT', positionType: 'HEAD', title: 'Chef du Bureau de la Certification', titleEn: 'Head of Certification Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDE-SECC-BCERT', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDE-SECC-BCERT', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DFOP-SDE-SECC-BCERT', positionType: 'ASSISTANT', title: 'Agent de Certification', titleEn: 'Certification Agent', level: 4, orderIndex: 4 },

        // SFSIA (Art. 39 — Chef de Service)
        { serviceCode: 'DFOP-SDE-SFSIA', positionType: 'HEAD', title: 'Chef du Service des Formations du Secteur Industriel et des Métiers Agricoles', titleEn: 'Head of Industrial and Agricultural Training Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDE-SFSIA', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDE-SFSIA', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant (Secteur Industriel)', titleEn: 'Assistant Research Officer (Industrial)', level: 3, orderIndex: 3 },
        { serviceCode: 'DFOP-SDE-SFSIA', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant (Métiers Agricoles)', titleEn: 'Assistant Research Officer (Agricultural)', level: 4, orderIndex: 4 },

        // SFTSFG (Art. 39 — Chef de Service)
        { serviceCode: 'DFOP-SDE-SFTSFG', positionType: 'HEAD', title: 'Chef du Service des Formations du Secteur Tertiaire et des Formations Générales', titleEn: 'Head of Tertiary and General Training Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDE-SFTSFG', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDE-SFTSFG', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant (Tertiaire)', titleEn: 'Assistant Research Officer (Tertiary)', level: 3, orderIndex: 3 },
        { serviceCode: 'DFOP-SDE-SFTSFG', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant (Formations Générales)', titleEn: 'Assistant Research Officer (General Training)', level: 4, orderIndex: 4 },

        // SDRP (Art. 40 — Sous-Directeur)
        { serviceCode: 'DFOP-SDRP', positionType: 'SUB_DIRECTION_HEAD', title: 'Sous-Directeur de la Réglementation Psychotechnique', titleEn: 'Sub-Director of Psychotechnical Regulation', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDRP', positionType: 'DEPUTY_HEAD', title: 'Sous-Directeur Adjoint', titleEn: 'Deputy Sub-Director', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDRP', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        // SACOPO (Art. 41 — Chef de Service)
        { serviceCode: 'DFOP-SDRP-SACOPO', positionType: 'HEAD', title: "Chef du Service des Agréments et du Contrôle des Organismes Privés d'Orientation Professionnelle", titleEn: "Head of Private Orientation Bodies Approvals Service", level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDRP-SACOPO', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDRP-SACOPO', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DFOP-SDRP-SACOPO', positionType: 'ASSISTANT', title: 'Agent de Contrôle', titleEn: 'Control Agent', level: 4, orderIndex: 4 },

        // STP (Art. 42 — Chef de Service)
        { serviceCode: 'DFOP-SDRP-STP', positionType: 'HEAD', title: 'Chef du Service des Tests Psychotechniques', titleEn: 'Head of Psychotechnical Tests Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDRP-STP', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDRP-STP', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant (Psychologie)', titleEn: 'Assistant Research Officer (Psychology)', level: 3, orderIndex: 3 },
        { serviceCode: 'DFOP-SDRP-STP', positionType: 'ASSISTANT', title: 'Agent de Tests', titleEn: 'Testing Agent', level: 4, orderIndex: 4 },

        // SDOP (Art. 43 — Sous-Directeur)
        { serviceCode: 'DFOP-SDOP', positionType: 'SUB_DIRECTION_HEAD', title: "Sous-Directeur de l'Orientation Professionnelle", titleEn: 'Sub-Director of Vocational Guidance', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDOP', positionType: 'DEPUTY_HEAD', title: 'Sous-Directeur Adjoint', titleEn: 'Deputy Sub-Director', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDOP', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        // SORP (Art. 44 — Chef de Service)
        { serviceCode: 'DFOP-SDOP-SORP', positionType: 'HEAD', title: "Chef du Service de l'Orientation et des Reclassements Professionnels", titleEn: 'Head of Orientation and Reclassification Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDOP-SORP', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDOP-SORP', positionType: 'OFFICER', title: 'Conseiller d\'Orientation', titleEn: 'Orientation Counsellor', level: 3, orderIndex: 3 },
        { serviceCode: 'DFOP-SDOP-SORP', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 4, orderIndex: 4 },

        // SEPT (Art. 45 — Chef de Service)
        { serviceCode: 'DFOP-SDOP-SEPT', positionType: 'HEAD', title: 'Chef du Service des Études Psychologiques du Travail', titleEn: 'Head of Psychological Studies Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDOP-SEPT', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDOP-SEPT', positionType: 'OFFICER', title: 'Psychologue du Travail', titleEn: 'Work Psychologist', level: 3, orderIndex: 3 },
        { serviceCode: 'DFOP-SDOP-SEPT', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 4, orderIndex: 4 },

        // SDIFF (Art. 46 — Chef de Service)
        { serviceCode: 'DFOP-SDOP-SDIFF', positionType: 'HEAD', title: 'Chef du Service de la Diffusion', titleEn: 'Head of Dissemination Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DFOP-SDOP-SDIFF', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DFOP-SDOP-SDIFF', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant (Diffusion)', titleEn: 'Assistant Research Officer (Dissemination)', level: 3, orderIndex: 3 },
        { serviceCode: 'DFOP-SDOP-SDIFF', positionType: 'ASSISTANT', title: 'Agent de Communication', titleEn: 'Communication Agent', level: 4, orderIndex: 4 },

        // ══════════════════════════════════════════════════════════════════════════
        // DAG  (Art. 47 — Directeur)
        // ══════════════════════════════════════════════════════════════════════════
        { serviceCode: 'DAG', positionType: 'HEAD', title: 'Directeur des Affaires Générales', titleEn: 'Director of General Affairs', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG', positionType: 'DEPUTY_HEAD', title: 'Directeur Adjoint des Affaires Générales', titleEn: 'Deputy Director of General Affairs', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        // Cellule SIGIPES (Art. 48 — Chef Cellule + 2 CEA)
        { serviceCode: 'DAG-CSIGIPES', positionType: 'HEAD', title: 'Chef de la Cellule de Gestion du Projet SIGIPES', titleEn: 'Head of SIGIPES Project Unit', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-CSIGIPES', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant (SIGIPES)', titleEn: 'Assistant Research Officer (SIGIPES)', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-CSIGIPES', positionType: 'TECHNICIAN', title: 'Technicien Informatique SIGIPES', titleEn: 'SIGIPES IT Technician', level: 3, orderIndex: 3 },

        // SDPSP (Art. 49 — Sous-Directeur)
        { serviceCode: 'DAG-SDPSP', positionType: 'SUB_DIRECTION_HEAD', title: 'Sous-Directeur des Personnels, de la Solde et des Pensions', titleEn: 'Sub-Director of Staff, Payroll and Pensions', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDPSP', positionType: 'DEPUTY_HEAD', title: 'Sous-Directeur Adjoint', titleEn: 'Deputy Sub-Director', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDPSP', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        // Service du Personnel (Art. 50 — Chef de Service + 4 bureaux)
        { serviceCode: 'DAG-SDPSP-SP', positionType: 'HEAD', title: 'Chef du Service du Personnel', titleEn: 'Head of Staff Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDPSP-SP', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDPSP-SP', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DAG-SDPSP-SP', positionType: 'ASSISTANT', title: 'Agent de Gestion RH', titleEn: 'HR Management Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DAG-SDPSP-SP-BF', positionType: 'HEAD', title: 'Chef du Bureau du Fichier', titleEn: 'Head of Records Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDPSP-SP-BF', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDPSP-SP-BF', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DAG-SDPSP-SP-BF', positionType: 'ASSISTANT', title: 'Agent du Fichier', titleEn: 'Records Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DAG-SDPSP-SP-BPF', positionType: 'HEAD', title: 'Chef du Bureau du Personnel Fonctionnaire', titleEn: 'Head of Civil Servant Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDPSP-SP-BPF', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDPSP-SP-BPF', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DAG-SDPSP-SP-BPF', positionType: 'ASSISTANT', title: 'Agent de Gestion du Personnel', titleEn: 'Staff Management Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DAG-SDPSP-SP-BPNF', positionType: 'HEAD', title: 'Chef du Bureau du Personnel Non Fonctionnaire', titleEn: 'Head of Non-Civil Servant Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDPSP-SP-BPNF', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDPSP-SP-BPNF', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DAG-SDPSP-SP-BPNF', positionType: 'ASSISTANT', title: 'Agent de Gestion du Personnel', titleEn: 'Staff Management Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DAG-SDPSP-SP-BFORM', positionType: 'HEAD', title: 'Chef du Bureau de la Formation', titleEn: 'Head of Training Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDPSP-SP-BFORM', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDPSP-SP-BFORM', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DAG-SDPSP-SP-BFORM', positionType: 'ASSISTANT', title: 'Agent de Formation', titleEn: 'Training Agent', level: 4, orderIndex: 4 },

        // Service de la Solde et des Pensions (Art. 51 — Chef de Service + 3 bureaux)
        { serviceCode: 'DAG-SDPSP-SSP', positionType: 'HEAD', title: 'Chef du Service de la Solde et des Pensions', titleEn: 'Head of Payroll and Pensions Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDPSP-SSP', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDPSP-SSP', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DAG-SDPSP-SSP', positionType: 'ASSISTANT', title: 'Agent de Solde', titleEn: 'Payroll Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DAG-SDPSP-SSP-BSPD', positionType: 'HEAD', title: 'Chef du Bureau de la Solde et des Prestations Diverses', titleEn: 'Head of Payroll and Allowances Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDPSP-SSP-BSPD', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDPSP-SSP-BSPD', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DAG-SDPSP-SSP-BSPD', positionType: 'ASSISTANT', title: 'Agent de Solde', titleEn: 'Payroll Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DAG-SDPSP-SSP-BPENS', positionType: 'HEAD', title: 'Chef du Bureau des Pensions', titleEn: 'Head of Pensions Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDPSP-SSP-BPENS', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDPSP-SSP-BPENS', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DAG-SDPSP-SSP-BPENS', positionType: 'ASSISTANT', title: 'Agent des Pensions', titleEn: 'Pensions Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DAG-SDPSP-SSP-BRR', positionType: 'HEAD', title: 'Chef du Bureau des Requêtes et de la Relance', titleEn: 'Head of Requests and Follow-up Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDPSP-SSP-BRR', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDPSP-SSP-BRR', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DAG-SDPSP-SSP-BRR', positionType: 'ASSISTANT', title: 'Agent de Relance', titleEn: 'Follow-up Agent', level: 4, orderIndex: 4 },

        // Service de l'Action Sociale (Art. 52 — Chef de Service)
        { serviceCode: 'DAG-SDPSP-SAS', positionType: 'HEAD', title: "Chef du Service de l'Action Sociale", titleEn: 'Head of Social Action Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDPSP-SAS', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDPSP-SAS', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DAG-SDPSP-SAS', positionType: 'ASSISTANT', title: 'Agent Social', titleEn: 'Social Agent', level: 4, orderIndex: 4 },

        // SDBMM (Art. 53 — Sous-Directeur)
        { serviceCode: 'DAG-SDBMM', positionType: 'SUB_DIRECTION_HEAD', title: 'Sous-Directeur du Budget, du Matériel et de la Maintenance', titleEn: 'Sub-Director of Budget, Materials and Maintenance', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDBMM', positionType: 'DEPUTY_HEAD', title: 'Sous-Directeur Adjoint', titleEn: 'Deputy Sub-Director', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDBMM', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        // Service du Budget et du Matériel (Art. 54 — Chef + 2 bureaux)
        { serviceCode: 'DAG-SDBMM-SBM', positionType: 'HEAD', title: 'Chef du Service du Budget et du Matériel', titleEn: 'Head of Budget and Materials Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDBMM-SBM', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDBMM-SBM', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DAG-SDBMM-SBM', positionType: 'ASSISTANT', title: 'Agent Financier', titleEn: 'Finance Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DAG-SDBMM-SBM-BB', positionType: 'HEAD', title: 'Chef du Bureau du Budget', titleEn: 'Head of Budget Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDBMM-SBM-BB', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDBMM-SBM-BB', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DAG-SDBMM-SBM-BB', positionType: 'ASSISTANT', title: 'Agent Budgétaire', titleEn: 'Budget Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DAG-SDBMM-SBM-BMAT', positionType: 'HEAD', title: 'Chef du Bureau du Matériel', titleEn: 'Head of Materials Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDBMM-SBM-BMAT', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDBMM-SBM-BMAT', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DAG-SDBMM-SBM-BMAT', positionType: 'ASSISTANT', title: 'Agent de Gestion du Matériel', titleEn: 'Materials Management Agent', level: 4, orderIndex: 4 },

        // Service des Marchés (Art. 55 — Chef de Service)
        { serviceCode: 'DAG-SDBMM-SM', positionType: 'HEAD', title: 'Chef du Service des Marchés', titleEn: 'Head of Procurement Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDBMM-SM', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDBMM-SM', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DAG-SDBMM-SM', positionType: 'ASSISTANT', title: 'Agent des Marchés', titleEn: 'Procurement Agent', level: 4, orderIndex: 4 },

        // Service de la Maintenance (Art. 56 — Chef + 2 bureaux)
        { serviceCode: 'DAG-SDBMM-SMAINT', positionType: 'HEAD', title: 'Chef du Service de la Maintenance', titleEn: 'Head of Maintenance Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDBMM-SMAINT', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDBMM-SMAINT', positionType: 'TECHNICIAN', title: 'Technicien de Maintenance', titleEn: 'Maintenance Technician', level: 3, orderIndex: 3 },
        { serviceCode: 'DAG-SDBMM-SMAINT', positionType: 'ASSISTANT', title: 'Agent de Maintenance', titleEn: 'Maintenance Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DAG-SDBMM-SMAINT-BMAINT', positionType: 'HEAD', title: 'Chef du Bureau de la Maintenance', titleEn: 'Head of Maintenance Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDBMM-SMAINT-BMAINT', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDBMM-SMAINT-BMAINT', positionType: 'TECHNICIAN', title: 'Technicien de Maintenance', titleEn: 'Maintenance Technician', level: 3, orderIndex: 3 },
        { serviceCode: 'DAG-SDBMM-SMAINT-BMAINT', positionType: 'ASSISTANT', title: 'Agent de Maintenance', titleEn: 'Maintenance Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DAG-SDBMM-SMAINT-BPROP', positionType: 'HEAD', title: 'Chef du Bureau de la Propreté', titleEn: 'Head of Cleanliness Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DAG-SDBMM-SMAINT-BPROP', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DAG-SDBMM-SMAINT-BPROP', positionType: 'ASSISTANT', title: 'Agent de Propreté', titleEn: 'Cleaning Agent', level: 3, orderIndex: 3 },

        // ══════════════════════════════════════════════════════════════════════════
        // DÉLÉGATION RÉGIONALE — DREFOP  (Art. 58–64)
        // ══════════════════════════════════════════════════════════════════════════
        { serviceCode: 'DREFOP', positionType: 'HEAD', title: "Délégué Régional de l'Emploi et de la Formation Professionnelle", titleEn: 'Regional Delegate of Employment and Vocational Training', level: 1, orderIndex: 1 },
        { serviceCode: 'DREFOP', positionType: 'DEPUTY_HEAD', title: 'Délégué Régional Adjoint', titleEn: 'Deputy Regional Delegate', level: 2, orderIndex: 2 },
        { serviceCode: 'DREFOP', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        // Service de la Promotion de l'Emploi (Art. 59)
        { serviceCode: 'DREFOP-SPE', positionType: 'HEAD', title: "Chef du Service de la Promotion de l'Emploi", titleEn: 'Head of Employment Promotion Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DREFOP-SPE', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DREFOP-SPE', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DREFOP-SPE', positionType: 'ASSISTANT', title: 'Agent de Promotion', titleEn: 'Promotion Agent', level: 4, orderIndex: 4 },

        // Service de la Régulation de la Main-d'Œuvre (Art. 60 — 2 bureaux)
        { serviceCode: 'DREFOP-SRMO', positionType: 'HEAD', title: "Chef du Service de la Régulation de la Main-d'Œuvre", titleEn: 'Head of Labour Regulation Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DREFOP-SRMO', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DREFOP-SRMO', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DREFOP-SRMO', positionType: 'ASSISTANT', title: 'Agent de Régulation', titleEn: 'Regulation Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DREFOP-SRMO-BEP', positionType: 'HEAD', title: "Chef du Bureau de l'Enregistrement et du Placement", titleEn: 'Head of Registration and Placement Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DREFOP-SRMO-BEP', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DREFOP-SRMO-BEP', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DREFOP-SRMO-BEP', positionType: 'ASSISTANT', title: 'Agent de Placement', titleEn: 'Placement Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DREFOP-SRMO-BFSMOE', positionType: 'HEAD', title: "Chef du Bureau du Fichier et des Statistiques de la Main-d'Œuvre", titleEn: 'Head of Labour Records and Statistics Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DREFOP-SRMO-BFSMOE', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DREFOP-SRMO-BFSMOE', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DREFOP-SRMO-BFSMOE', positionType: 'ASSISTANT', title: 'Agent Statisticien', titleEn: 'Statistics Agent', level: 4, orderIndex: 4 },

        // Service de la Formation Professionnelle et de l'Apprentissage (Art. 61)
        { serviceCode: 'DREFOP-SFPA', positionType: 'HEAD', title: "Chef du Service de la Formation Professionnelle et de l'Apprentissage", titleEn: 'Head of VT and Apprenticeship Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DREFOP-SFPA', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DREFOP-SFPA', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DREFOP-SFPA', positionType: 'ASSISTANT', title: 'Agent de Formation', titleEn: 'Training Agent', level: 4, orderIndex: 4 },

        // Service de la Sélection et de l'Orientation Professionnelle (Art. 62)
        { serviceCode: 'DREFOP-SSOP', positionType: 'HEAD', title: "Chef du Service de la Sélection et de l'Orientation Professionnelle", titleEn: 'Head of Selection and Guidance Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DREFOP-SSOP', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DREFOP-SSOP', positionType: 'OFFICER', title: 'Conseiller d\'Orientation', titleEn: 'Orientation Counsellor', level: 3, orderIndex: 3 },
        { serviceCode: 'DREFOP-SSOP', positionType: 'ASSISTANT', title: 'Agent d\'Orientation', titleEn: 'Orientation Agent', level: 4, orderIndex: 4 },

        // Service Administratif et Financier (Art. 63)
        { serviceCode: 'DREFOP-SAF', positionType: 'HEAD', title: 'Chef du Service Administratif et Financier', titleEn: 'Head of Administrative and Financial Service', level: 1, orderIndex: 1 },
        { serviceCode: 'DREFOP-SAF', positionType: 'DEPUTY_HEAD', title: 'Chef de Service Adjoint', titleEn: 'Deputy Head of Service', level: 2, orderIndex: 2 },
        { serviceCode: 'DREFOP-SAF', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DREFOP-SAF', positionType: 'ASSISTANT', title: 'Agent Administratif et Financier', titleEn: 'Administrative and Finance Agent', level: 4, orderIndex: 4 },

        // Bureau de l'Accueil, du Courrier et de Liaison (Art. 64 — Chef de Bureau)
        { serviceCode: 'DREFOP-BACL', positionType: 'HEAD', title: "Chef du Bureau de l'Accueil, du Courrier et de Liaison", titleEn: 'Head of Reception, Mail and Liaison Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DREFOP-BACL', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 2, orderIndex: 2 },
        { serviceCode: 'DREFOP-BACL', positionType: 'ASSISTANT', title: 'Agent d\'Accueil', titleEn: 'Reception Agent', level: 3, orderIndex: 3 },

        // ══════════════════════════════════════════════════════════════════════════
        // DÉLÉGATION DÉPARTEMENTALE — DDEFOP  (Art. 65)
        // ══════════════════════════════════════════════════════════════════════════
        { serviceCode: 'DDEFOP', positionType: 'HEAD', title: "Délégué Départemental de l'Emploi et de la Formation Professionnelle", titleEn: 'Divisional Delegate of Employment and Vocational Training', level: 1, orderIndex: 1 },
        { serviceCode: 'DDEFOP', positionType: 'DEPUTY_HEAD', title: 'Délégué Départemental Adjoint', titleEn: 'Deputy Divisional Delegate', level: 2, orderIndex: 2 },
        { serviceCode: 'DDEFOP', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        { serviceCode: 'DDEFOP-BEIS', positionType: 'HEAD', title: "Chef du Bureau de l'Emploi, de l'Insertion et des Statistiques", titleEn: 'Head of Employment, Insertion and Statistics Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DDEFOP-BEIS', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DDEFOP-BEIS', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DDEFOP-BEIS', positionType: 'ASSISTANT', title: 'Agent de Terrain', titleEn: 'Field Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DDEFOP-BFPOE', positionType: 'HEAD', title: "Chef du Bureau de la Formation Professionnelle, de l'Orientation et des Évaluations", titleEn: 'Head of VT, Orientation and Evaluations Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DDEFOP-BFPOE', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DDEFOP-BFPOE', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DDEFOP-BFPOE', positionType: 'ASSISTANT', title: 'Agent de Formation', titleEn: 'Training Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'DDEFOP-BAG', positionType: 'HEAD', title: 'Chef du Bureau des Affaires Générales', titleEn: 'Head of General Affairs Bureau', level: 1, orderIndex: 1 },
        { serviceCode: 'DDEFOP-BAG', positionType: 'DEPUTY_HEAD', title: 'Chef de Bureau Adjoint', titleEn: 'Deputy Head of Bureau', level: 2, orderIndex: 2 },
        { serviceCode: 'DDEFOP-BAG', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'DDEFOP-BAG', positionType: 'ASSISTANT', title: 'Agent Administratif', titleEn: 'Administrative Agent', level: 4, orderIndex: 4 },

        // ══════════════════════════════════════════════════════════════════════════
        // ORGANISMES RATTACHÉS  (Art. 66 + Art. 68 rank equivalences)
        // ══════════════════════════════════════════════════════════════════════════

        // FNE — Fonds National de l'Emploi
        { serviceCode: 'FNE', positionType: 'HEAD', title: "Directeur Général du Fonds National de l'Emploi", titleEn: 'Director General of the National Employment Fund', level: 1, orderIndex: 1 },
        { serviceCode: 'FNE', positionType: 'DEPUTY_HEAD', title: 'Directeur Général Adjoint', titleEn: 'Deputy Director General', level: 2, orderIndex: 2 },
        { serviceCode: 'FNE', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        { serviceCode: 'FNE-DG', positionType: 'HEAD', title: 'Directeur — Direction Générale FNE', titleEn: 'Director — FNE General Directorate', level: 1, orderIndex: 1 },
        { serviceCode: 'FNE-DG', positionType: 'DEPUTY_HEAD', title: 'Directeur Adjoint', titleEn: 'Deputy Director', level: 2, orderIndex: 2 },
        { serviceCode: 'FNE-DG', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'FNE-DG', positionType: 'ASSISTANT', title: 'Agent Administratif', titleEn: 'Administrative Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'FNE-DR', positionType: 'HEAD', title: 'Directeur Régional — FNE', titleEn: 'Regional Director — FNE', level: 1, orderIndex: 1 },
        { serviceCode: 'FNE-DR', positionType: 'DEPUTY_HEAD', title: 'Directeur Régional Adjoint — FNE', titleEn: 'Deputy Regional Director — FNE', level: 2, orderIndex: 2 },
        { serviceCode: 'FNE-DR', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },
        { serviceCode: 'FNE-DR', positionType: 'ASSISTANT', title: 'Agent de Placement', titleEn: 'Placement Agent', level: 4, orderIndex: 4 },

        // CFPA — Centre Public de FPA  (Art. 68: Chef CFPA = rang Chef de Service)
        { serviceCode: 'CFPA', positionType: 'HEAD', title: "Chef de Centre Public de Formation Professionnelle et d'Apprentissage", titleEn: 'Head of Public VTC', level: 1, orderIndex: 1 },
        { serviceCode: 'CFPA', positionType: 'DEPUTY_HEAD', title: 'Chef de Centre Adjoint', titleEn: 'Deputy Head of Centre', level: 2, orderIndex: 2 },
        { serviceCode: 'CFPA', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        { serviceCode: 'CFPA-DIR', positionType: 'HEAD', title: 'Directeur Pédagogique — CFPA', titleEn: 'Academic Director — CFPA', level: 1, orderIndex: 1 },
        { serviceCode: 'CFPA-DIR', positionType: 'DEPUTY_HEAD', title: 'Directeur Pédagogique Adjoint', titleEn: 'Deputy Academic Director', level: 2, orderIndex: 2 },
        { serviceCode: 'CFPA-DIR', positionType: 'OFFICER', title: 'Formateur Principal', titleEn: 'Senior Trainer', level: 3, orderIndex: 3 },
        { serviceCode: 'CFPA-DIR', positionType: 'ASSISTANT', title: 'Formateur', titleEn: 'Trainer', level: 4, orderIndex: 4 },

        { serviceCode: 'CFPA-FORM', positionType: 'HEAD', title: 'Chef du Département de Formation — CFPA', titleEn: 'Head of Training Department — CFPA', level: 1, orderIndex: 1 },
        { serviceCode: 'CFPA-FORM', positionType: 'OFFICER', title: 'Formateur Principal', titleEn: 'Senior Trainer', level: 2, orderIndex: 2 },
        { serviceCode: 'CFPA-FORM', positionType: 'ASSISTANT', title: 'Formateur', titleEn: 'Trainer', level: 3, orderIndex: 3 },

        { serviceCode: 'CFPA-ADM', positionType: 'HEAD', title: 'Chef du Service Administratif et Financier — CFPA', titleEn: 'Head of Admin and Finance Service — CFPA', level: 1, orderIndex: 1 },
        { serviceCode: 'CFPA-ADM', positionType: 'OFFICER', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 2, orderIndex: 2 },
        { serviceCode: 'CFPA-ADM', positionType: 'ASSISTANT', title: 'Agent Administratif', titleEn: 'Administrative Agent', level: 3, orderIndex: 3 },

        // IPFPA — Institut Public de FPA  (Art. 68: Directeur Institut = rang Chef de Service)
        { serviceCode: 'IPFPA', positionType: 'HEAD', title: "Directeur de l'Institut Public de Formation Professionnelle et d'Apprentissage", titleEn: 'Director of Public VT Institute', level: 1, orderIndex: 1 },
        { serviceCode: 'IPFPA', positionType: 'DEPUTY_HEAD', title: 'Directeur Adjoint', titleEn: 'Deputy Director', level: 2, orderIndex: 2 },
        { serviceCode: 'IPFPA', positionType: 'ASSISTANT', title: 'Chargé d\'Études Assistant', titleEn: 'Assistant Research Officer', level: 3, orderIndex: 3 },

        { serviceCode: 'IPFPA-DIR', positionType: 'HEAD', title: 'Directeur des Études — Institut', titleEn: 'Director of Studies — Institute', level: 1, orderIndex: 1 },
        { serviceCode: 'IPFPA-DIR', positionType: 'DEPUTY_HEAD', title: 'Directeur des Études Adjoint', titleEn: 'Deputy Director of Studies', level: 2, orderIndex: 2 },
        { serviceCode: 'IPFPA-DIR', positionType: 'OFFICER', title: 'Enseignant Principal', titleEn: 'Senior Instructor', level: 3, orderIndex: 3 },
        { serviceCode: 'IPFPA-DIR', positionType: 'ASSISTANT', title: 'Enseignant', titleEn: 'Instructor', level: 4, orderIndex: 4 },

        { serviceCode: 'IPFPA-FORM', positionType: 'HEAD', title: 'Chef du Département de Formation — Institut', titleEn: 'Head of Training Department — Institute', level: 1, orderIndex: 1 },
        { serviceCode: 'IPFPA-FORM', positionType: 'OFFICER', title: 'Enseignant Principal', titleEn: 'Senior Instructor', level: 2, orderIndex: 2 },
        { serviceCode: 'IPFPA-FORM', positionType: 'ASSISTANT', title: 'Enseignant', titleEn: 'Instructor', level: 3, orderIndex: 3 },

        // SAR — Section Artisanale et Rurale  (Art. 68: Directeur SAR = rang Chef de Service Adjoint)
        { serviceCode: 'SAR', positionType: 'HEAD', title: 'Directeur de la Section Artisanale et Rurale', titleEn: 'Director of Artisanal and Rural Section', level: 1, orderIndex: 1 },
        { serviceCode: 'SAR', positionType: 'DEPUTY_HEAD', title: 'Directeur Adjoint', titleEn: 'Deputy Director', level: 2, orderIndex: 2 },
        { serviceCode: 'SAR', positionType: 'OFFICER', title: 'Formateur en Métiers Artisanaux', titleEn: 'Artisanal Trades Trainer', level: 3, orderIndex: 3 },
        { serviceCode: 'SAR', positionType: 'ASSISTANT', title: 'Agent Administratif', titleEn: 'Administrative Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'SAR-DIR', positionType: 'HEAD', title: 'Chef de la Direction — SAR', titleEn: 'Head of SAR Directorate', level: 1, orderIndex: 1 },
        { serviceCode: 'SAR-DIR', positionType: 'OFFICER', title: 'Formateur Artisanal', titleEn: 'Artisanal Trainer', level: 2, orderIndex: 2 },
        { serviceCode: 'SAR-DIR', positionType: 'ASSISTANT', title: 'Agent de Formation', titleEn: 'Training Agent', level: 3, orderIndex: 3 },

        // SM — Section Ménagère  (Art. 68: Directeur SM = rang Chef de Service Adjoint)
        { serviceCode: 'SM', positionType: 'HEAD', title: 'Directeur de la Section Ménagère', titleEn: 'Director of Home Economics Section', level: 1, orderIndex: 1 },
        { serviceCode: 'SM', positionType: 'DEPUTY_HEAD', title: 'Directeur Adjoint', titleEn: 'Deputy Director', level: 2, orderIndex: 2 },
        { serviceCode: 'SM', positionType: 'OFFICER', title: 'Formatrice en Économie Ménagère', titleEn: 'Home Economics Trainer', level: 3, orderIndex: 3 },
        { serviceCode: 'SM', positionType: 'ASSISTANT', title: 'Agent Administratif', titleEn: 'Administrative Agent', level: 4, orderIndex: 4 },

        { serviceCode: 'SM-DIR', positionType: 'HEAD', title: 'Chef de la Direction — Section Ménagère', titleEn: 'Head of SM Directorate', level: 1, orderIndex: 1 },
        { serviceCode: 'SM-DIR', positionType: 'OFFICER', title: 'Formatrice Ménagère', titleEn: 'Home Economics Instructor', level: 2, orderIndex: 2 },
        { serviceCode: 'SM-DIR', positionType: 'ASSISTANT', title: 'Agent de Formation', titleEn: 'Training Agent', level: 3, orderIndex: 3 },
    ];

// ─────────────────────────────────────────────────────────────────────────────
// SEED FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
async function seed() {
    console.log('🌱 Starting database seed...\n');

    try {
        // ── SECTORS ─────────────────────────────────────────────────────────────
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
        for (const s of sectors) {
            await prisma.sector.upsert({ where: { name: s.name }, update: {}, create: s });
        }
        console.log(`   ✅ ${sectors.length} sectors`);

        // ── MINEFOP SERVICES ─────────────────────────────────────────────────────
        console.log('🏛️  Creating MINEFOP service hierarchy...');
        for (const s of minefopServices) {
            await prisma.minefopService.upsert({
                where: { code: s.code },
                update: { name: s.name, acronym: s.acronym ?? null, category: s.category, level: s.level, parentCode: s.parentCode ?? null, roleMapping: s.roleMapping, requiresRegion: s.requiresRegion, requiresDepartment: s.requiresDepartment, orderIndex: s.orderIndex, isActive: true },
                create: { code: s.code, name: s.name, acronym: s.acronym ?? null, category: s.category, level: s.level, parentCode: s.parentCode ?? null, roleMapping: s.roleMapping, requiresRegion: s.requiresRegion, requiresDepartment: s.requiresDepartment, orderIndex: s.orderIndex, isActive: true },
            });
        }
        console.log(`   ✅ ${minefopServices.length} services`);

        // ── SERVICE POSITIONS ────────────────────────────────────────────────────
        console.log('👔 Creating service positions...');
        let posCreated = 0;
        for (const pos of servicePositions) {
            try {
                await prisma.servicePosition.upsert({
                    where: { serviceCode_positionType: { serviceCode: pos.serviceCode, positionType: pos.positionType } },
                    update: { title: pos.title, titleEn: pos.titleEn, level: pos.level, orderIndex: pos.orderIndex },
                    create: pos,
                });
                posCreated++;
            } catch (e) {
                console.warn(`  ⚠ Skipped ${pos.serviceCode}/${pos.positionType}:`, (e as Error).message);
            }
        }
        console.log(`   ✅ ${posCreated} / ${servicePositions.length} positions`);

        // ── REGIONS, DEPARTMENTS, SUBDIVISIONS ───────────────────────────────────
        console.log('🗺️  Creating locations...');
        const regionsData = [
            {
                name: 'Adamaoua', departments: [
                    { name: 'Djérem', subdivisions: ['Mbakaou', 'Ngaoundal', 'Tibati'] },
                    { name: 'Faro-et-Déo', subdivisions: ['Galim-Tignère', 'Kontcha', 'Mayo-Baléo', 'Tignère'] },
                    { name: 'Mayo-Banyo', subdivisions: ['Bankim', 'Banyo', 'Mayo-Darle', 'Ngan-Ha'] },
                    { name: 'Mbéré', subdivisions: ['Djohong', 'Gonmé', 'Meiganga', 'Ngaoui'] },
                    { name: 'Vina', subdivisions: ['Belel', 'Martap', 'Meidougou', 'Ngaoundéré I', 'Ngaoundéré II', 'Ngaoundéré III', 'Nyambaka'] },
                ]
            },
            {
                name: 'Centre', departments: [
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
                name: 'Est', departments: [
                    { name: 'Boumba-et-Ngoko', subdivisions: ['Gari-Gombo', 'Moloundou', 'Salapoumbé', 'Yokadouma'] },
                    { name: 'Haut-Nyong', subdivisions: ['Abong-Mbang', 'Angossas', 'Atok', 'Dimako', 'Doumaintang', 'Doume', 'Lomié', 'Mboma', 'Messamena', 'Mindourou', 'Ngoyla', 'Nguelemendouka', 'Somalomo'] },
                    { name: 'Kadey', subdivisions: ['Batouri', 'Kette', 'Mbang', 'Ndelele', 'Nguelebok', 'Ouli'] },
                    { name: 'Lom-et-Djérem', subdivisions: ['Bélabo', 'Bertoua I', 'Bertoua II', 'Betaré-Oya', 'Diang', 'Ngoura'] },
                ]
            },
            {
                name: 'Extrême-Nord', departments: [
                    { name: 'Diamaré', subdivisions: ['Gazawa', 'Maroua I', 'Maroua II', 'Maroua III', 'Meri', 'Ndoukoula', 'Pette'] },
                    { name: 'Logone-et-Chari', subdivisions: ['Fotokol', 'Goulfey', 'Hilé-Alifa', 'Kousseri', 'Logone-Birni', 'Makary', 'Waza', 'Zina'] },
                    { name: 'Mayo-Danay', subdivisions: ['Datcheka', 'Gazawa', 'Kaélé', 'Kar-Hay', 'Maga', 'Mindif', 'Moulouvaye', 'Tchatibali', 'Yagoua'] },
                    { name: 'Mayo-Kani', subdivisions: ['Blangoua', 'Guidiguis', 'Kaïkaï', 'Moulvoudaye', 'Tchanaga', 'Toulourou'] },
                    { name: 'Mayo-Sava', subdivisions: ['Kolofata', 'Limani', 'Méri', 'Mora', 'Tokombéré'] },
                    { name: 'Mayo-Tsanaga', subdivisions: ['Bourha', 'Hina', 'Koza', 'Mogodé', 'Mokolo', 'Mozogo', 'Roua', 'Soulédé-Roua'] },
                ]
            },
            {
                name: 'Littoral', departments: [
                    { name: 'Moungo', subdivisions: ['Bare-Bakem', 'Bonalea', 'Dibombari', 'Ekom', 'Loum', 'Manjo', 'Mbanga', 'Melong', 'Mombo', 'Njombe-Penja', 'Nkongsamba I', 'Nkongsamba II', 'Nkongsamba III'] },
                    { name: 'Nkam', subdivisions: ['Ndom', 'Ngambe', 'Yabassi', 'Yingui'] },
                    { name: 'Sanaga-Maritime', subdivisions: ['Dibamba', 'Dizangue', 'Édéa I', 'Édéa II', 'Mouanko', 'Ndom', 'Ngambe', 'Nyanon', 'Pouma'] },
                    { name: 'Wouri', subdivisions: ['Douala I', 'Douala II', 'Douala III', 'Douala IV', 'Douala V', 'Manoka'] },
                ]
            },
            {
                name: 'Nord', departments: [
                    { name: 'Bénoué', subdivisions: ['Bibemi', 'Dembo', 'Garoua I', 'Garoua II', 'Garoua III', 'Lagdo', 'Ngong', 'Pitoa', 'Tchéboa'] },
                    { name: 'Faro', subdivisions: ['Beka', 'Poli'] },
                    { name: 'Mayo-Louti', subdivisions: ['Figuil', 'Guider', 'Mayo-Oulo'] },
                    { name: 'Mayo-Rey', subdivisions: ['Pignde', 'Rey-Bouba', 'Tcholliré', 'Touboro'] },
                ]
            },
            {
                name: 'Nord-Ouest', departments: [
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
                name: 'Ouest', departments: [
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
                name: 'Sud', departments: [
                    { name: 'Dja-et-Lobo', subdivisions: ['Bengbis', 'Djoum', 'Meyomessala', 'Meyomessi', 'Mintom', 'Mvangan', 'Oveng', 'Sangmélima'] },
                    { name: 'Mvila', subdivisions: ['Ambam', 'Bengbis', 'Ebolowa I', 'Ebolowa II', 'Efoulan', "Ma'an", 'Mengong', 'Mvangan', 'Ngoulemakong'] },
                    { name: 'Océan', subdivisions: ['Akom II', 'Campo', 'Grand Batanga', 'Kribi I', 'Kribi II', 'Lolodorf', 'Mvengue'] },
                    { name: 'Vallée-du-Ntem', subdivisions: ['Biwong-Bané', 'Biwong-Bulu', 'Djoum', 'Meyomessala', 'Nkpwa'] },
                ]
            },
            {
                name: 'Sud-Ouest', departments: [
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
        for (const r of regionsData) {
            const region = await prisma.region.upsert({ where: { name: r.name }, update: {}, create: { name: r.name } });
            regionMap.set(r.name, region.id);
        }
        for (const r of regionsData) {
            const regionId = regionMap.get(r.name)!;
            for (const d of r.departments) {
                const dept = await prisma.department.upsert({ where: { regionId_name: { regionId, name: d.name } }, update: {}, create: { name: d.name, regionId } });
                await prisma.subdivision.createMany({ data: d.subdivisions.map(name => ({ name, departmentId: dept.id })), skipDuplicates: true });
            }
        }
        console.log('   ✅ All locations created');

        // ── TEST USERS ────────────────────────────────────────────────────────────
        console.log('👥 Creating test users...');
        const centralUser = await prisma.user.upsert({
            where: { email: 'central@ministry.cm' }, update: {},
            create: { email: 'central@ministry.cm', firstName: 'Paul', lastName: 'Biya', passwordHash: await bcrypt.hash('password123', 10), role: 'CENTRAL', region: null, department: null, serviceCode: 'DRMOE', positionType: 'HEAD' },
        });
        await prisma.user.upsert({
            where: { email: 'regional.centre@ministry.cm' }, update: {},
            create: { email: 'regional.centre@ministry.cm', firstName: 'Jean', lastName: 'Nkuéta', passwordHash: await bcrypt.hash('password123', 10), role: 'REGIONAL', region: 'Centre', department: null, serviceCode: 'DREFOP', positionType: 'HEAD' },
        });
        await prisma.user.upsert({
            where: { email: 'divisional.mfoundi@ministry.cm' }, update: {},
            create: { email: 'divisional.mfoundi@ministry.cm', firstName: 'Marie', lastName: 'Ebanda', passwordHash: await bcrypt.hash('password123', 10), role: 'DIVISIONAL', region: 'Centre', department: 'Mfoundi', serviceCode: 'DDEFOP', positionType: 'HEAD' },
        });

        // ── SAMPLE COMPANIES & DECLARATIONS ──────────────────────────────────────
        console.log('🏢 Creating sample companies and declarations...');
        const companies: any[] = [];
        const sectorList = await prisma.sector.findMany();
        const regionList = await prisma.region.findMany();
        const departmentList = await prisma.department.findMany();

        for (let i = 1; i <= 20; i++) {
            const region = regionList[Math.floor(Math.random() * regionList.length)];
            const department = departmentList[Math.floor(Math.random() * departmentList.length)];
            const sector = sectorList[Math.floor(Math.random() * sectorList.length)];
            const companyEmail = `company${i}@example.cm`;

            const companyUser = await prisma.user.upsert({
                where: { email: companyEmail },
                update: {
                    firstName: 'Company',
                    lastName: `${i}`,
                    role: 'COMPANY',
                    region: region.name,
                    department: department.name,
                },
                create: {
                    email: companyEmail,
                    firstName: 'Company',
                    lastName: `${i}`,
                    passwordHash: await bcrypt.hash('password123', 10),
                    role: 'COMPANY',
                    region: region.name,
                    department: department.name,
                },
            });

            const company = await prisma.company.upsert({
                where: { userId: companyUser.id },
                update: {
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
                create: {
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

        console.log('\n✅ Seed completed!\n');
        console.log('📝 Credentials:');
        console.log('   CENTRAL:    central@ministry.cm / password123');
        console.log('   REGIONAL:   regional.centre@ministry.cm / password123');
        console.log('   DIVISIONAL: divisional.mfoundi@ministry.cm / password123');
        console.log('   COMPANY:    company1..company20@example.cm / password123');
        console.log(`\n🏛️  Services: ${minefopServices.length}  |  Positions: ${posCreated}\n`);

    } catch (error) {
        console.error('❌ Seed error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

seed();