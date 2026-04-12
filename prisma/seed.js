"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
// ============================================================
// MINEFOP SERVICE HIERARCHY (Décret 2012)
// – For CENTRALE category: roots are the main directorates
// – For DECONCENTRE: roots are DREFOP, DDEFOP
// – For RATTACHE: roots are ONEFOP, PIAASI, COSUP
// ============================================================
const minefopServices = [
    // ─── CENTRALE – roots (level 1, parentCode = null) ─────────────────────────
    { code: 'CAB', category: 'CENTRALE', level: 1, parentCode: null, name: 'Cabinet du Ministre', acronym: 'CAB', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 1 },
    { code: 'IGS', category: 'CENTRALE', level: 1, parentCode: null, name: 'Inspection Générale des Services', acronym: 'IGS', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 2 },
    { code: 'IGF', category: 'CENTRALE', level: 1, parentCode: null, name: 'Inspection Générale des Formations', acronym: 'IGF', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 3 },
    { code: 'SG', category: 'CENTRALE', level: 1, parentCode: null, name: 'Secrétariat Général', acronym: 'SG', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 4 },
    { code: 'DPE', category: 'CENTRALE', level: 1, parentCode: null, name: "Division de la Promotion de l'Emploi", acronym: 'DPE', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 5 },
    { code: 'DRMO', category: 'CENTRALE', level: 1, parentCode: null, name: "Direction de la Régulation de la Main-d'Oeuvre", acronym: 'DRMO', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 6 },
    { code: 'DFOP', category: 'CENTRALE', level: 1, parentCode: null, name: "Direction de la Formation et de l'Orientation Professionnelles", acronym: 'DFOP', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 7 },
    { code: 'DEPC', category: 'CENTRALE', level: 1, parentCode: null, name: "Division des Études, de la Prospective et de la Coopération", acronym: 'DEPC', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 8 },
    { code: 'DAG', category: 'CENTRALE', level: 1, parentCode: null, name: 'Direction des Affaires Générales', acronym: 'DAG', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 9 },
    // ─── CENTRALE – children under CAB (level 2) ───────────────────────────────
    { code: 'SP', category: 'CENTRALE', level: 2, parentCode: 'CAB', name: 'Secrétariat Particulier', acronym: 'SP', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 10 },
    { code: 'CT', category: 'CENTRALE', level: 2, parentCode: 'CAB', name: 'Conseillers Techniques', acronym: 'CT', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 11 },
    // ─── CENTRALE – children under SG (Secrétariat Général) ────────────────────
    { code: 'SG-DAJ', category: 'CENTRALE', level: 2, parentCode: 'SG', name: 'Division des Affaires Juridiques', acronym: 'DAJ', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 20 },
    { code: 'SG-DAJ-CER', category: 'CENTRALE', level: 3, parentCode: 'SG-DAJ', name: 'Cellule des Études et de la Réglementation', acronym: 'CER', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 21 },
    { code: 'SG-DAJ-CC', category: 'CENTRALE', level: 3, parentCode: 'SG-DAJ', name: 'Cellule du Contentieux', acronym: 'CC', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 22 },
    { code: 'SG-CS', category: 'CENTRALE', level: 2, parentCode: 'SG', name: 'Cellule de Suivi', acronym: 'CS', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 23 },
    { code: 'SG-CC', category: 'CENTRALE', level: 2, parentCode: 'SG', name: 'Cellule de Communication', acronym: 'CC', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 24 },
    { code: 'SG-CI', category: 'CENTRALE', level: 2, parentCode: 'SG', name: 'Cellule Informatique', acronym: 'CI', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 25 },
    { code: 'SG-CT', category: 'CENTRALE', level: 2, parentCode: 'SG', name: 'Cellule de Traduction', acronym: 'CT', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 26 },
    { code: 'SG-SDACL', category: 'CENTRALE', level: 2, parentCode: 'SG', name: "Sous-Direction de l'Accueil, du Courrier et de Liaison", acronym: 'SDACL', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 27 },
    { code: 'SG-SDACL-SAO', category: 'CENTRALE', level: 3, parentCode: 'SG-SDACL', name: "Service de l'Accueil et de l'Orientation", acronym: 'SAO', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 28 },
    { code: 'SG-SDACL-SAO-BAI', category: 'CENTRALE', level: 4, parentCode: 'SG-SDACL-SAO', name: "Bureau de l'Accueil et de l'Information", acronym: 'BAI', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 29 },
    { code: 'SG-SDACL-SAO-BCC', category: 'CENTRALE', level: 4, parentCode: 'SG-SDACL-SAO', name: "Bureau du Contrôle de Conformité", acronym: 'BCC', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 30 },
    { code: 'SG-SDACL-SCL', category: 'CENTRALE', level: 3, parentCode: 'SG-SDACL', name: "Service du Courrier et de Liaison", acronym: 'SCL', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 31 },
    { code: 'SG-SDACL-SCL-BCA', category: 'CENTRALE', level: 4, parentCode: 'SG-SDACL-SCL', name: "Bureau du Courrier « Arrivée »", acronym: 'BCA', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 32 },
    { code: 'SG-SDACL-SCL-BCD', category: 'CENTRALE', level: 4, parentCode: 'SG-SDACL-SCL', name: "Bureau du Courrier « Départ »", acronym: 'BCD', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 33 },
    { code: 'SG-SDACL-SCL-BR', category: 'CENTRALE', level: 4, parentCode: 'SG-SDACL-SCL', name: "Bureau de la Reprographie", acronym: 'BR', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 34 },
    { code: 'SG-SDACL-SR', category: 'CENTRALE', level: 3, parentCode: 'SG-SDACL', name: "Service de la Relance", acronym: 'SR', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 35 },
    { code: 'SG-SDDA', category: 'CENTRALE', level: 2, parentCode: 'SG', name: "Sous-Direction de la Documentation et des Archives", acronym: 'SDDA', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 36 },
    { code: 'SG-SDDA-SD', category: 'CENTRALE', level: 3, parentCode: 'SG-SDDA', name: "Service de la Documentation", acronym: 'SD', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 37 },
    { code: 'SG-SDDA-SD-BRD', category: 'CENTRALE', level: 4, parentCode: 'SG-SDDA-SD', name: "Bureau de la Reprographie et de la Diffusion", acronym: 'BRD', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 38 },
    { code: 'SG-SDDA-SD-BDOC', category: 'CENTRALE', level: 4, parentCode: 'SG-SDDA-SD', name: "Bureau de la Documentation", acronym: 'BDOC', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 39 },
    { code: 'SG-SDDA-SA', category: 'CENTRALE', level: 3, parentCode: 'SG-SDDA', name: "Service des Archives", acronym: 'SA', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 40 },
    { code: 'SG-SDDA-SA-BC', category: 'CENTRALE', level: 4, parentCode: 'SG-SDDA-SA', name: "Bureau du Classement", acronym: 'BC', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 41 },
    { code: 'SG-SDDA-SA-BN', category: 'CENTRALE', level: 4, parentCode: 'SG-SDDA-SA', name: "Bureau de la Numérique", acronym: 'BN', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 42 },
    // ─── CENTRALE – children under DPE ────────────────────────────────────────
    { code: 'DPE-CPDE', category: 'CENTRALE', level: 2, parentCode: 'DPE', name: "Cellule de la Planification et du Développement de l'Emploi", acronym: 'CPDE', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 50 },
    { code: 'DPE-CLC', category: 'CENTRALE', level: 2, parentCode: 'DPE', name: "Cellule de Lutte contre le Chômage", acronym: 'CLC', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 51 },
    // ─── CENTRALE – children under DRMO ───────────────────────────────────────
    { code: 'DRMO-SDRPMO', category: 'CENTRALE', level: 2, parentCode: 'DRMO', name: "Sous-Direction de la Réglementation et de la Planification de la Main-d'Oeuvre", acronym: 'SDRPMO', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 60 },
    { code: 'DRMO-SDRPMO-SRMO', category: 'CENTRALE', level: 3, parentCode: 'DRMO-SDRPMO', name: "Service de la Réglementation de la Main-d'Oeuvre", acronym: 'SRMO', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 61 },
    { code: 'DRMO-SDRPMO-SSPMO', category: 'CENTRALE', level: 3, parentCode: 'DRMO-SDRPMO', name: "Service des Statistiques et de la Planification de la Main-d'Oeuvre", acronym: 'SSPMO', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 62 },
    { code: 'DRMO-SDRPMO-SSPMO-BF', category: 'CENTRALE', level: 4, parentCode: 'DRMO-SDRPMO-SSPMO', name: "Bureau des Fichiers", acronym: 'BF', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 63 },
    { code: 'DRMO-SDRPMO-SSPMO-BSP', category: 'CENTRALE', level: 4, parentCode: 'DRMO-SDRPMO-SSPMO', name: "Bureau des Statistiques et de la Planification", acronym: 'BSP', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 64 },
    { code: 'DRMO-SDIA', category: 'CENTRALE', level: 2, parentCode: 'DRMO', name: "Sous-Direction de l'Insertion et des Agréments", acronym: 'SDIA', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 65 },
    { code: 'DRMO-SDIA-SI', category: 'CENTRALE', level: 3, parentCode: 'DRMO-SDIA', name: "Service de l'Insertion", acronym: 'SI', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 66 },
    { code: 'DRMO-SDIA-SI-BCDCE', category: 'CENTRALE', level: 4, parentCode: 'DRMO-SDIA-SI', name: "Bureau de Centralisation des Données sur les Chercheurs d'Emplois", acronym: 'BCDCE', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 67 },
    { code: 'DRMO-SDIA-SI-BPOE', category: 'CENTRALE', level: 4, parentCode: 'DRMO-SDIA-SI', name: "Bureau de Prospection des Opportunités d'Emplois", acronym: 'BPOE', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 68 },
    { code: 'DRMO-SDIA-SC', category: 'CENTRALE', level: 3, parentCode: 'DRMO-SDIA', name: "Service des Contrats", acronym: 'SC', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 69 },
    { code: 'DRMO-SDIA-SC-BCTN', category: 'CENTRALE', level: 4, parentCode: 'DRMO-SDIA-SC', name: "Bureau des Contrats de Travail des Nationaux", acronym: 'BCTN', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 70 },
    { code: 'DRMO-SDIA-SC-BCTE', category: 'CENTRALE', level: 4, parentCode: 'DRMO-SDIA-SC', name: "Bureau des Contrats de Travail des Expatriés", acronym: 'BCTE', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 71 },
    { code: 'DRMO-SDIA-SAC', category: 'CENTRALE', level: 3, parentCode: 'DRMO-SDIA', name: "Service des Agréments et des Contrôles", acronym: 'SAC', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 72 },
    { code: 'DRMO-SDIA-SAC-BA', category: 'CENTRALE', level: 4, parentCode: 'DRMO-SDIA-SAC', name: "Bureau des Agréments", acronym: 'BA', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 73 },
    { code: 'DRMO-SDIA-SAC-BSA', category: 'CENTRALE', level: 4, parentCode: 'DRMO-SDIA-SAC', name: "Bureau du Suivi des Activités", acronym: 'BSA', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 74 },
    // ─── CENTRALE – children under DFOP ───────────────────────────────────────
    { code: 'DFOP-SDGSF', category: 'CENTRALE', level: 2, parentCode: 'DFOP', name: "Sous-Direction de la Gestion des Structures de Formation", acronym: 'SDGSF', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 80 },
    { code: 'DFOP-SDGSF-SSFPA', category: 'CENTRALE', level: 3, parentCode: 'DFOP-SDGSF', name: "Service de Suivi des Structures de Formation Professionnelle", acronym: 'SSFPA', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 81 },
    { code: 'DFOP-SDGSF-SSFPA-BSSPP', category: 'CENTRALE', level: 4, parentCode: 'DFOP-SDGSF-SSFPA', name: "Bureau du Suivi des Structures Publiques et Privées de Formation Professionnelle", acronym: 'BSSPP', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 82 },
    { code: 'DFOP-SDGSF-SSFPA-BSSS', category: 'CENTRALE', level: 4, parentCode: 'DFOP-SDGSF-SSFPA', name: "Bureau du Suivi des Structures Spécialisées de Formation Professionnelle", acronym: 'BSSS', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 83 },
    { code: 'DFOP-SDGSF-SACD', category: 'CENTRALE', level: 3, parentCode: 'DFOP-SDGSF', name: "Service des Agréments, du Contrôle et de la Diffusion", acronym: 'SACD', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 84 },
    { code: 'DFOP-SDGSF-SACD-BCA', category: 'CENTRALE', level: 4, parentCode: 'DFOP-SDGSF-SACD', name: "Bureau du Contrôle et d'Agrément des structures privées de formation professionnelle", acronym: 'BCA', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 85 },
    { code: 'DFOP-SDGSF-SACD-BDDA', category: 'CENTRALE', level: 4, parentCode: 'DFOP-SDGSF-SACD', name: "Bureau de la Diffusion, de la Documentation et des Archives", acronym: 'BDDA', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 86 },
    { code: 'DFOP-SDECC', category: 'CENTRALE', level: 2, parentCode: 'DFOP', name: "Sous-Direction des Examens, des Concours et de la Certification", acronym: 'SDECC', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 87 },
    { code: 'DFOP-SDECC-SOEC', category: 'CENTRALE', level: 3, parentCode: 'DFOP-SDECC', name: "Service de l'Organisation des Examens et Concours", acronym: 'SOEC', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 88 },
    { code: 'DFOP-SDECC-SOEC-BOEC', category: 'CENTRALE', level: 4, parentCode: 'DFOP-SDECC-SOEC', name: "Bureau de l'Organisation des Examens et Concours", acronym: 'BOEC', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 89 },
    { code: 'DFOP-SDECC-SOEC-BMR', category: 'CENTRALE', level: 4, parentCode: 'DFOP-SDECC-SOEC', name: "Bureau du Matériel et de la Reprographie", acronym: 'BMR', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 90 },
    { code: 'DFOP-SDECC-SCAS', category: 'CENTRALE', level: 3, parentCode: 'DFOP-SDECC', name: "Service de la Certification, des Archives et des Statistiques", acronym: 'SCAS', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 91 },
    { code: 'DFOP-SDECC-SCAS-BC', category: 'CENTRALE', level: 4, parentCode: 'DFOP-SDECC-SCAS', name: "Bureau de la Certification", acronym: 'BC', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 92 },
    { code: 'DFOP-SDECC-SCAS-BAS', category: 'CENTRALE', level: 4, parentCode: 'DFOP-SDECC-SCAS', name: "Bureau des Archives et des Statistiques", acronym: 'BAS', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 93 },
    { code: 'DFOP-SDOP', category: 'CENTRALE', level: 2, parentCode: 'DFOP', name: "Sous-Direction de l'Orientation Professionnelle", acronym: 'SDOP', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 94 },
    { code: 'DFOP-SDOP-SOP', category: 'CENTRALE', level: 3, parentCode: 'DFOP-SDOP', name: "Service de l'Orientation Professionnelle", acronym: 'SOP', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 95 },
    { code: 'DFOP-SDOP-SOP-BOIP', category: 'CENTRALE', level: 4, parentCode: 'DFOP-SDOP-SOP', name: "Bureau de l'Orientation, de l'Information et de la Production", acronym: 'BOIP', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 96 },
    { code: 'DFOP-SDOP-SOP-BSA', category: 'CENTRALE', level: 4, parentCode: 'DFOP-SDOP-SOP', name: "Bureau des Statistiques et des Archives", acronym: 'BSA', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 97 },
    { code: 'DFOP-SDOP-SRP', category: 'CENTRALE', level: 3, parentCode: 'DFOP-SDOP', name: "Service du Reclassement Professionnel", acronym: 'SRP', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 98 },
    { code: 'DFOP-SDOP-SRP-BRP', category: 'CENTRALE', level: 4, parentCode: 'DFOP-SDOP-SRP', name: "Bureau de la Réglementation Psychotechnique", acronym: 'BRP', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 99 },
    { code: 'DFOP-SDOP-SRP-BARP', category: 'CENTRALE', level: 4, parentCode: 'DFOP-SDOP-SRP', name: "Bureau des Agréments et des Reclassements Professionnels", acronym: 'BARP', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 100 },
    // ─── CENTRALE – children under DEPC ────────────────────────────────────────
    { code: 'DEPC-CEPS', category: 'CENTRALE', level: 2, parentCode: 'DEPC', name: "Cellule des Études, de la Prospective et des Statistiques", acronym: 'CEPS', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 110 },
    { code: 'DEPC-CC', category: 'CENTRALE', level: 2, parentCode: 'DEPC', name: "Cellule de la Coopération", acronym: 'CC', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 111 },
    // ─── CENTRALE – children under DAG ─────────────────────────────────────────
    { code: 'DAG-CSIGIPES', category: 'CENTRALE', level: 2, parentCode: 'DAG', name: "Cellule de Gestion du Projet SIGIPES", acronym: 'CSIGIPES', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 120 },
    { code: 'DAG-SDPSP', category: 'CENTRALE', level: 2, parentCode: 'DAG', name: "Sous-Direction du Personnel, de la Solde et des Pensions", acronym: 'SDPSP', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 121 },
    { code: 'DAG-SDPSP-SPFC', category: 'CENTRALE', level: 3, parentCode: 'DAG-SDPSP', name: "Service du Personnel et de la Formation Continue", acronym: 'SPFC', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 122 },
    { code: 'DAG-SDPSP-SPFC-BPF', category: 'CENTRALE', level: 4, parentCode: 'DAG-SDPSP-SPFC', name: "Bureau du Personnel Fonctionnaire", acronym: 'BPF', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 123 },
    { code: 'DAG-SDPSP-SPFC-BPNF', category: 'CENTRALE', level: 4, parentCode: 'DAG-SDPSP-SPFC', name: "Bureau du Personnel non Fonctionnaire", acronym: 'BPNF', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 124 },
    { code: 'DAG-SDPSP-SPFC-BFC', category: 'CENTRALE', level: 4, parentCode: 'DAG-SDPSP-SPFC', name: "Bureau de la Formation Continue", acronym: 'BFC', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 125 },
    { code: 'DAG-SDPSP-SPFC-BGPE', category: 'CENTRALE', level: 4, parentCode: 'DAG-SDPSP-SPFC', name: "Bureau de la Gestion Prévisionnelle des Effectifs", acronym: 'BGPE', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 126 },
    { code: 'DAG-SDPSP-SSP', category: 'CENTRALE', level: 3, parentCode: 'DAG-SDPSP', name: "Service de la Solde et des Pensions", acronym: 'SSP', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 127 },
    { code: 'DAG-SDPSP-SSP-BSPD', category: 'CENTRALE', level: 4, parentCode: 'DAG-SDPSP-SSP', name: "Bureau de la Solde et des Prestations Diverses", acronym: 'BSPD', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 128 },
    { code: 'DAG-SDPSP-SSP-BP', category: 'CENTRALE', level: 4, parentCode: 'DAG-SDPSP-SSP', name: "Bureau des Pensions", acronym: 'BP', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 129 },
    { code: 'DAG-SDPSP-SAS', category: 'CENTRALE', level: 3, parentCode: 'DAG-SDPSP', name: "Service de l'Action Sociale", acronym: 'SAS', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 130 },
    { code: 'DAG-SDB', category: 'CENTRALE', level: 2, parentCode: 'DAG', name: "Sous-Direction du Budget", acronym: 'SDB', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 131 },
    { code: 'DAG-SDB-SB', category: 'CENTRALE', level: 3, parentCode: 'DAG-SDB', name: "Service du Budget", acronym: 'SB', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 132 },
    { code: 'DAG-SDB-SB-BPB', category: 'CENTRALE', level: 4, parentCode: 'DAG-SDB-SB', name: "Bureau de la Préparation du Budget", acronym: 'BPB', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 133 },
    { code: 'DAG-SDB-SB-BSEB', category: 'CENTRALE', level: 4, parentCode: 'DAG-SDB-SB', name: "Bureau du Suivi de l'exécution du Budget", acronym: 'BSEB', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 134 },
    { code: 'DAG-SDB-SMP', category: 'CENTRALE', level: 3, parentCode: 'DAG-SDB', name: "Service des Marchés Publics", acronym: 'SMP', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 135 },
    { code: 'DAG-SDB-SMP-BAO', category: 'CENTRALE', level: 4, parentCode: 'DAG-SDB-SMP', name: "Bureau des Appels d'Offre", acronym: 'BAO', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 136 },
    { code: 'DAG-SDB-SMP-BSCEM', category: 'CENTRALE', level: 4, parentCode: 'DAG-SDB-SMP', name: "Bureau du Suivi et du Contrôle de l'Exécution des Marchés", acronym: 'BSCEM', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 137 },
    { code: 'DAG-SDIEM', category: 'CENTRALE', level: 2, parentCode: 'DAG', name: "Sous-Direction des Infrastructures, des Equipements et de la Maintenance", acronym: 'SDIEM', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 138 },
    { code: 'DAG-SDIEM-SNC', category: 'CENTRALE', level: 3, parentCode: 'DAG-SDIEM', name: "Service des Normes de Construction", acronym: 'SNC', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 139 },
    { code: 'DAG-SDIEM-SMEM', category: 'CENTRALE', level: 3, parentCode: 'DAG-SDIEM', name: "Service du Matériel, des Equipements et de la Maintenance", acronym: 'SMEM', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 140 },
    // ─── DECONCENTRE – roots ───────────────────────────────────────────────────
    { code: 'DREFOP', category: 'DECONCENTRE', level: 1, parentCode: null, name: "Délégation Régionale de l'Emploi et de la Formation Professionnelle", acronym: 'DREFOP', roleMapping: 'REGIONAL', requiresRegion: true, requiresDepartment: false, orderIndex: 100 },
    { code: 'DDEFOP', category: 'DECONCENTRE', level: 1, parentCode: null, name: "Délégation Départementale de l'Emploi et de la Formation Professionnelle", acronym: 'DDEFOP', roleMapping: 'DIVISIONAL', requiresRegion: true, requiresDepartment: true, orderIndex: 101 },
    // ─── DECONCENTRE – children under DREFOP ───────────────────────────────────
    { code: 'DREFOP-IRF', category: 'DECONCENTRE', level: 2, parentCode: 'DREFOP', name: "Inspection Régionale des Formations", acronym: 'IRF', roleMapping: 'REGIONAL', requiresRegion: true, requiresDepartment: false, orderIndex: 200 },
    { code: 'DREFOP-SPE', category: 'DECONCENTRE', level: 2, parentCode: 'DREFOP', name: "Service de la Promotion de l'Emploi", acronym: 'SPE', roleMapping: 'REGIONAL', requiresRegion: true, requiresDepartment: false, orderIndex: 201 },
    { code: 'DREFOP-SPE-BAE', category: 'DECONCENTRE', level: 3, parentCode: 'DREFOP-SPE', name: "Bureau de la promotion de l'auto emploi", acronym: 'BAE', roleMapping: 'REGIONAL', requiresRegion: true, requiresDepartment: false, orderIndex: 202 },
    { code: 'DREFOP-SPE-BHIMO', category: 'DECONCENTRE', level: 3, parentCode: 'DREFOP-SPE', name: "Bureau de la promotion de l'approche HIMO", acronym: 'BHIMO', roleMapping: 'REGIONAL', requiresRegion: true, requiresDepartment: false, orderIndex: 203 },
    { code: 'DREFOP-SPE-BMISF', category: 'DECONCENTRE', level: 3, parentCode: 'DREFOP-SPE', name: "Bureau de Migration du secteur Informel vers le secteur formel", acronym: 'BMISF', roleMapping: 'REGIONAL', requiresRegion: true, requiresDepartment: false, orderIndex: 204 },
    { code: 'DREFOP-SRMO', category: 'DECONCENTRE', level: 2, parentCode: 'DREFOP', name: "Service de la Régulation de la Main-d'Oeuvre", acronym: 'SRMO', roleMapping: 'REGIONAL', requiresRegion: true, requiresDepartment: false, orderIndex: 205 },
    { code: 'DREFOP-SRMO-BEP', category: 'DECONCENTRE', level: 3, parentCode: 'DREFOP-SRMO', name: "Bureau de l'enregistrement et du placement", acronym: 'BEP', roleMapping: 'REGIONAL', requiresRegion: true, requiresDepartment: false, orderIndex: 206 },
    { code: 'DREFOP-SRMO-BFS', category: 'DECONCENTRE', level: 3, parentCode: 'DREFOP-SRMO', name: "Bureau du fichier et des statistiques", acronym: 'BFS', roleMapping: 'REGIONAL', requiresRegion: true, requiresDepartment: false, orderIndex: 207 },
    { code: 'DREFOP-SFOP', category: 'DECONCENTRE', level: 2, parentCode: 'DREFOP', name: "Service de la Formation et de l'Orientation Professionnelle", acronym: 'SFOP', roleMapping: 'REGIONAL', requiresRegion: true, requiresDepartment: false, orderIndex: 208 },
    { code: 'DREFOP-SFOP-BGSF', category: 'DECONCENTRE', level: 3, parentCode: 'DREFOP-SFOP', name: "Bureau de gestion des structures de formation professionnelle", acronym: 'BGSF', roleMapping: 'REGIONAL', requiresRegion: true, requiresDepartment: false, orderIndex: 209 },
    { code: 'DREFOP-SFOP-BE', category: 'DECONCENTRE', level: 3, parentCode: 'DREFOP-SFOP', name: "Bureau des Evaluations", acronym: 'BE', roleMapping: 'REGIONAL', requiresRegion: true, requiresDepartment: false, orderIndex: 210 },
    { code: 'DREFOP-SFOP-BOTP', category: 'DECONCENTRE', level: 3, parentCode: 'DREFOP-SFOP', name: "Bureau de l'Orientation, des tests psychotechniques et du contrôle des conditions psychologiques du travail", acronym: 'BOTP', roleMapping: 'REGIONAL', requiresRegion: true, requiresDepartment: false, orderIndex: 211 },
    { code: 'DREFOP-SAF', category: 'DECONCENTRE', level: 2, parentCode: 'DREFOP', name: "Service Administratif et Financier", acronym: 'SAF', roleMapping: 'REGIONAL', requiresRegion: true, requiresDepartment: false, orderIndex: 212 },
    { code: 'DREFOP-SAF-BP', category: 'DECONCENTRE', level: 3, parentCode: 'DREFOP-SAF', name: "Bureau du personnel", acronym: 'BP', roleMapping: 'REGIONAL', requiresRegion: true, requiresDepartment: false, orderIndex: 213 },
    { code: 'DREFOP-SAF-BBM', category: 'DECONCENTRE', level: 3, parentCode: 'DREFOP-SAF', name: "Bureau du budget et du Matériel", acronym: 'BBM', roleMapping: 'REGIONAL', requiresRegion: true, requiresDepartment: false, orderIndex: 214 },
    { code: 'DREFOP-BACL', category: 'DECONCENTRE', level: 2, parentCode: 'DREFOP', name: "Bureau de l'Accueil, du Courrier et de Liaison", acronym: 'BACL', roleMapping: 'REGIONAL', requiresRegion: true, requiresDepartment: false, orderIndex: 215 },
    // ─── DECONCENTRE – children under DDEFOP ───────────────────────────────────
    { code: 'DDEFOP-SLSCJ', category: 'DECONCENTRE', level: 2, parentCode: 'DDEFOP', name: "Service de lutte contre le sous-emploi et le chômage des jeunes", acronym: 'SLSCJ', roleMapping: 'DIVISIONAL', requiresRegion: true, requiresDepartment: true, orderIndex: 300 },
    { code: 'DDEFOP-SLSCJ-BES', category: 'DECONCENTRE', level: 3, parentCode: 'DDEFOP-SLSCJ', name: "Bureau de l'emploi Salarié", acronym: 'BES', roleMapping: 'DIVISIONAL', requiresRegion: true, requiresDepartment: true, orderIndex: 301 },
    { code: 'DDEFOP-SLSCJ-BEI', category: 'DECONCENTRE', level: 3, parentCode: 'DDEFOP-SLSCJ', name: "Bureau de l'emploi Indépendant", acronym: 'BEI', roleMapping: 'DIVISIONAL', requiresRegion: true, requiresDepartment: true, orderIndex: 302 },
    { code: 'DDEFOP-SLSCJ-BCS', category: 'DECONCENTRE', level: 3, parentCode: 'DDEFOP-SLSCJ', name: "Bureau des contrôles et des statistiques", acronym: 'BCS', roleMapping: 'DIVISIONAL', requiresRegion: true, requiresDepartment: true, orderIndex: 303 },
    { code: 'DDEFOP-SFOE', category: 'DECONCENTRE', level: 2, parentCode: 'DDEFOP', name: "Service de la formation, de l'orientation professionnelle et des évaluations", acronym: 'SFOE', roleMapping: 'DIVISIONAL', requiresRegion: true, requiresDepartment: true, orderIndex: 304 },
    { code: 'DDEFOP-SFOE-BACE', category: 'DECONCENTRE', level: 3, parentCode: 'DDEFOP-SFOE', name: "Bureau de l'accueil des chercheurs d'emploi", acronym: 'BACE', roleMapping: 'DIVISIONAL', requiresRegion: true, requiresDepartment: true, orderIndex: 305 },
    { code: 'DDEFOP-SFOE-BOP', category: 'DECONCENTRE', level: 3, parentCode: 'DDEFOP-SFOE', name: "Bureau de l'orientation professionnelle", acronym: 'BOP', roleMapping: 'DIVISIONAL', requiresRegion: true, requiresDepartment: true, orderIndex: 306 },
    { code: 'DDEFOP-SFOE-BGSF', category: 'DECONCENTRE', level: 3, parentCode: 'DDEFOP-SFOE', name: "Bureau de la gestion des structures de formation", acronym: 'BGSF', roleMapping: 'DIVISIONAL', requiresRegion: true, requiresDepartment: true, orderIndex: 307 },
    { code: 'DDEFOP-BAG', category: 'DECONCENTRE', level: 2, parentCode: 'DDEFOP', name: "Bureau des Affaires Générales", acronym: 'BAG', roleMapping: 'DIVISIONAL', requiresRegion: true, requiresDepartment: true, orderIndex: 308 },
    { code: 'DDEFOP-BACL', category: 'DECONCENTRE', level: 2, parentCode: 'DDEFOP', name: "Bureau de l'Accueil, du Courrier et de Liaison", acronym: 'BACL', roleMapping: 'DIVISIONAL', requiresRegion: true, requiresDepartment: true, orderIndex: 309 },
    // ─── RATTACHE – roots ──────────────────────────────────────────────────────
    { code: 'ONEFOP', category: 'RATTACHE', level: 1, parentCode: null, name: "Observatoire National de l'Emploi et de la Formation Professionnelle", acronym: 'ONEFOP', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 400 },
    { code: 'PIAASI', category: 'RATTACHE', level: 1, parentCode: null, name: "Projet Intégré d'Appui aux Acteurs du Secteur Informel", acronym: 'PIAASI', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 401 },
    { code: 'COSUP', category: 'RATTACHE', level: 1, parentCode: null, name: "Centres d'Organisation Scolaire, Universitaire et Professionnelle", acronym: 'COSUP', roleMapping: 'CENTRAL', requiresRegion: false, requiresDepartment: false, orderIndex: 402 },
];
// ============================================================
// EXPLICIT SERVICE POSITIONS (from the decree, corrected titles)
// ============================================================
const servicePositions = [
    // Cabinet du Ministre
    { serviceCode: 'CAB', positionType: 'MINISTRE', title: 'Ministre de l\'Emploi et de la Formation Professionnelle', titleEn: 'Minister of Employment and Vocational Training', level: 1, orderIndex: 1 },
    { serviceCode: 'SP', positionType: 'CHEF_SECRETARIAT_PARTICULIER', title: 'Secrétaire Particulier du Ministre', titleEn: 'Private Secretary to the Minister', level: 1, orderIndex: 1 },
    { serviceCode: 'CT', positionType: 'CONSEILLER_TECHNIQUE', title: 'Conseiller Technique du Ministre', titleEn: 'Technical Adviser to the Minister', level: 1, orderIndex: 1 },
    { serviceCode: 'CT', positionType: 'CONSEILLER_TECHNIQUE', title: 'Conseiller Technique du Ministre (N°2)', titleEn: 'Technical Adviser to the Minister (No. 2)', level: 1, orderIndex: 2 },
    // Inspections
    { serviceCode: 'IGS', positionType: 'INSPECTEUR_GENERAL_SERVICES', title: 'Inspecteur Général des Services', titleEn: 'Inspector General of Services', level: 1, orderIndex: 1 },
    { serviceCode: 'IGS', positionType: 'INSPECTEUR_SERVICES', title: 'Inspecteur des Services', titleEn: 'Inspector of Services', level: 2, orderIndex: 2 },
    { serviceCode: 'IGF', positionType: 'INSPECTEUR_GENERAL_FORMATIONS', title: 'Inspecteur Général des Formations', titleEn: 'Inspector General of Training', level: 1, orderIndex: 1 },
    { serviceCode: 'IGF', positionType: 'INSPECTEUR_FORMATIONS', title: 'Inspecteur des Formations', titleEn: 'Inspector of Training', level: 2, orderIndex: 2 },
    { serviceCode: 'IGF', positionType: 'ATTACHE_PEDAGOGIQUE', title: 'Attaché Pédagogique', titleEn: 'Pedagogical Attaché', level: 3, orderIndex: 3 },
    // Secrétariat Général
    { serviceCode: 'SG', positionType: 'SECRETAIRE_GENERAL', title: 'Secrétaire Général', titleEn: 'Secretary General', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-DAJ', positionType: 'CHEF_DIVISION', title: 'Chef de la Division des Affaires Juridiques', titleEn: 'Head of Legal Affairs Division', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-DAJ-CER', positionType: 'CHEF_CELLULE', title: 'Chef de la Cellule des Études et de la Réglementation', titleEn: 'Head of Studies and Regulation Unit', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-DAJ-CER', positionType: 'CHARGE_ETUDES_ASSISTANT', title: 'Chargé d\'Études', titleEn: 'Research Officer', level: 2, orderIndex: 2 },
    { serviceCode: 'SG-DAJ-CC', positionType: 'CHEF_CELLULE', title: 'Chef de la Cellule du Contentieux', titleEn: 'Head of Litigation Unit', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-DAJ-CC', positionType: 'CHARGE_ETUDES_ASSISTANT', title: 'Chargé d\'Études', titleEn: 'Research Officer', level: 2, orderIndex: 2 },
    { serviceCode: 'SG-CS', positionType: 'CHEF_CELLULE', title: 'Chef de la Cellule de Suivi', titleEn: 'Head of Monitoring Unit', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-CS', positionType: 'CHARGE_ETUDES_ASSISTANT', title: 'Chargé d\'Études', titleEn: 'Research Officer', level: 2, orderIndex: 2 },
    { serviceCode: 'SG-CC', positionType: 'CHEF_CELLULE', title: 'Chef de la Cellule de Communication', titleEn: 'Head of Communication Unit', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-CC', positionType: 'CHARGE_ETUDES_ASSISTANT', title: 'Chargé d\'Études', titleEn: 'Research Officer', level: 2, orderIndex: 2 },
    { serviceCode: 'SG-CI', positionType: 'CHEF_CELLULE', title: 'Chef de la Cellule Informatique', titleEn: 'Head of IT Unit', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-CI', positionType: 'CHARGE_ETUDES_ASSISTANT', title: 'Chargé d\'Études', titleEn: 'Research Officer', level: 2, orderIndex: 2 },
    { serviceCode: 'SG-CT', positionType: 'CHEF_CELLULE', title: 'Chef de la Cellule de Traduction', titleEn: 'Head of Translation Unit', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-CT', positionType: 'CHARGE_ETUDES_ASSISTANT', title: 'Chargé d\'Études (Français)', titleEn: 'Research Officer (French)', level: 2, orderIndex: 2 },
    { serviceCode: 'SG-CT', positionType: 'CHARGE_ETUDES_ASSISTANT', title: 'Chargé d\'Études (Anglais)', titleEn: 'Research Officer (English)', level: 2, orderIndex: 3 },
    { serviceCode: 'SG-SDACL', positionType: 'SOUS_DIRECTEUR', title: 'Sous-Directeur de l\'Accueil, du Courrier et de Liaison', titleEn: 'Sub-Director of Reception, Mail and Liaison', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-SDACL-SAO', positionType: 'CHEF_SERVICE', title: 'Chef du Service de l\'Accueil et de l\'Orientation', titleEn: 'Head of Reception and Orientation Service', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-SDACL-SAO-BAI', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de l\'Accueil et de l\'Information', titleEn: 'Head of Reception and Information Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-SDACL-SAO-BCC', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau du Contrôle de Conformité', titleEn: 'Head of Compliance Control Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-SDACL-SCL', positionType: 'CHEF_SERVICE', title: 'Chef du Service du Courrier et de Liaison', titleEn: 'Head of Mail and Liaison Service', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-SDACL-SCL-BCA', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau du Courrier « Arrivée »', titleEn: 'Head of Incoming Mail Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-SDACL-SCL-BCD', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau du Courrier « Départ »', titleEn: 'Head of Outgoing Mail Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-SDACL-SCL-BR', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de la Reprographie', titleEn: 'Head of Reprography Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-SDACL-SR', positionType: 'CHEF_SERVICE', title: 'Chef du Service de la Relance', titleEn: 'Head of Follow-up Service', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-SDDA', positionType: 'SOUS_DIRECTEUR', title: 'Sous-Directeur de la Documentation et des Archives', titleEn: 'Sub-Director of Documentation and Archives', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-SDDA-SD', positionType: 'CHEF_SERVICE', title: 'Chef du Service de la Documentation', titleEn: 'Head of Documentation Service', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-SDDA-SD-BRD', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de la Reprographie et de la Diffusion', titleEn: 'Head of Reprography and Dissemination Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-SDDA-SD-BDOC', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de la Documentation', titleEn: 'Head of Documentation Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-SDDA-SA', positionType: 'CHEF_SERVICE', title: 'Chef du Service des Archives', titleEn: 'Head of Archives Service', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-SDDA-SA-BC', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau du Classement', titleEn: 'Head of Classification Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'SG-SDDA-SA-BN', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de la Numérique', titleEn: 'Head of Digital Bureau', level: 1, orderIndex: 1 },
    // DPE
    { serviceCode: 'DPE', positionType: 'CHEF_DIVISION', title: 'Chef de la Division de la Promotion de l\'Emploi', titleEn: 'Head of Employment Promotion Division', level: 1, orderIndex: 1 },
    { serviceCode: 'DPE-CPDE', positionType: 'CHEF_CELLULE', title: 'Chef de la Cellule de la Planification et du Développement de l\'Emploi', titleEn: 'Head of Employment Planning and Development Unit', level: 1, orderIndex: 1 },
    { serviceCode: 'DPE-CPDE', positionType: 'CHARGE_ETUDES_ASSISTANT', title: 'Chargé d\'Études', titleEn: 'Research Officer', level: 2, orderIndex: 2 },
    { serviceCode: 'DPE-CLC', positionType: 'CHEF_CELLULE', title: 'Chef de la Cellule de Lutte contre le Chômage', titleEn: 'Head of Anti-Unemployment Unit', level: 1, orderIndex: 1 },
    { serviceCode: 'DPE-CLC', positionType: 'CHARGE_ETUDES_ASSISTANT', title: 'Chargé d\'Études', titleEn: 'Research Officer', level: 2, orderIndex: 2 },
    // DRMO
    { serviceCode: 'DRMO', positionType: 'DIRECTEUR', title: 'Directeur de la Régulation de la Main-d\'Oeuvre', titleEn: 'Director of Labour Regulation', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMO-SDRPMO', positionType: 'SOUS_DIRECTEUR', title: 'Sous-Directeur de la Réglementation et de la Planification de la Main-d\'Oeuvre', titleEn: 'Sub-Director of Labour Regulation and Planning', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMO-SDRPMO-SRMO', positionType: 'CHEF_SERVICE', title: 'Chef du Service de la Réglementation de la Main-d\'Oeuvre', titleEn: 'Head of Labour Regulation Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMO-SDRPMO-SSPMO', positionType: 'CHEF_SERVICE', title: 'Chef du Service des Statistiques et de la Planification de la Main-d\'Oeuvre', titleEn: 'Head of Labour Statistics and Planning Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMO-SDRPMO-SSPMO-BF', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau des Fichiers', titleEn: 'Head of Records Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMO-SDRPMO-SSPMO-BSP', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau des Statistiques et de la Planification', titleEn: 'Head of Statistics and Planning Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMO-SDIA', positionType: 'SOUS_DIRECTEUR', title: 'Sous-Directeur de l\'Insertion et des Agréments', titleEn: 'Sub-Director of Insertion and Approvals', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMO-SDIA-SI', positionType: 'CHEF_SERVICE', title: 'Chef du Service de l\'Insertion', titleEn: 'Head of Insertion Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMO-SDIA-SI-BCDCE', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de Centralisation des Données sur les Chercheurs d\'Emplois', titleEn: 'Head of Job Seekers Data Centralization Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMO-SDIA-SI-BPOE', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de Prospection des Opportunités d\'Emplois', titleEn: 'Head of Employment Opportunities Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMO-SDIA-SC', positionType: 'CHEF_SERVICE', title: 'Chef du Service des Contrats', titleEn: 'Head of Contracts Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMO-SDIA-SC-BCTN', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau des Contrats de Travail des Nationaux', titleEn: 'Head of National Employment Contracts Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMO-SDIA-SC-BCTE', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau des Contrats de Travail des Expatriés', titleEn: 'Head of Expatriate Employment Contracts Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMO-SDIA-SAC', positionType: 'CHEF_SERVICE', title: 'Chef du Service des Agréments et des Contrôles', titleEn: 'Head of Approvals and Controls Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMO-SDIA-SAC-BA', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau des Agréments', titleEn: 'Head of Approvals Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DRMO-SDIA-SAC-BSA', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau du Suivi des Activités', titleEn: 'Head of Activity Monitoring Bureau', level: 1, orderIndex: 1 },
    // DFOP
    { serviceCode: 'DFOP', positionType: 'DIRECTEUR', title: 'Directeur de la Formation et de l\'Orientation Professionnelles', titleEn: 'Director of Vocational Training and Guidance', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDGSF', positionType: 'SOUS_DIRECTEUR', title: 'Sous-Directeur de la Gestion des Structures de Formation', titleEn: 'Sub-Director of Training Structures Management', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDGSF-SSFPA', positionType: 'CHEF_SERVICE', title: 'Chef du Service de Suivi des Structures de Formation Professionnelle', titleEn: 'Head of VTC Monitoring Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDGSF-SSFPA-BSSPP', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau du Suivi des Structures Publiques et Privées de Formation Professionnelle', titleEn: 'Head of Public and Private VTC Monitoring Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDGSF-SSFPA-BSSS', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau du Suivi des Structures Spécialisées de Formation Professionnelle', titleEn: 'Head of Specialised VTC Monitoring Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDGSF-SACD', positionType: 'CHEF_SERVICE', title: 'Chef du Service des Agréments, du Contrôle et de la Diffusion', titleEn: 'Head of Approvals, Control and Dissemination Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDGSF-SACD-BCA', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau du Contrôle et d\'Agrément des structures privées de formation professionnelle', titleEn: 'Head of Private VTC Control and Approval Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDGSF-SACD-BDDA', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de la Diffusion, de la Documentation et des Archives', titleEn: 'Head of Dissemination, Documentation and Archives Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDECC', positionType: 'SOUS_DIRECTEUR', title: 'Sous-Directeur des Examens, des Concours et de la Certification', titleEn: 'Sub-Director of Exams, Competitions and Certification', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDECC-SOEC', positionType: 'CHEF_SERVICE', title: 'Chef du Service de l\'Organisation des Examens et Concours', titleEn: 'Head of Exams and Competitions Organisation Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDECC-SOEC-BOEC', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de l\'Organisation des Examens et Concours', titleEn: 'Head of Exams and Competitions Organisation Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDECC-SOEC-BMR', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau du Matériel et de la Reprographie', titleEn: 'Head of Equipment and Reprography Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDECC-SCAS', positionType: 'CHEF_SERVICE', title: 'Chef du Service de la Certification, des Archives et des Statistiques', titleEn: 'Head of Certification, Archives and Statistics Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDECC-SCAS-BC', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de la Certification', titleEn: 'Head of Certification Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDECC-SCAS-BAS', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau des Archives et des Statistiques', titleEn: 'Head of Archives and Statistics Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDOP', positionType: 'SOUS_DIRECTEUR', title: 'Sous-Directeur de l\'Orientation Professionnelle', titleEn: 'Sub-Director of Vocational Guidance', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDOP-SOP', positionType: 'CHEF_SERVICE', title: 'Chef du Service de l\'Orientation Professionnelle', titleEn: 'Head of Vocational Guidance Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDOP-SOP-BOIP', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de l\'Orientation, de l\'Information et de la Production', titleEn: 'Head of Orientation, Information and Production Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDOP-SOP-BSA', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau des Statistiques et des Archives', titleEn: 'Head of Statistics and Archives Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDOP-SRP', positionType: 'CHEF_SERVICE', title: 'Chef du Service du Reclassement Professionnel', titleEn: 'Head of Professional Reclassification Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDOP-SRP-BRP', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de la Réglementation Psychotechnique', titleEn: 'Head of Psychotechnical Regulation Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DFOP-SDOP-SRP-BARP', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau des Agréments et des Reclassements Professionnels', titleEn: 'Head of Approvals and Professional Reclassification Bureau', level: 1, orderIndex: 1 },
    // DEPC
    { serviceCode: 'DEPC', positionType: 'CHEF_DIVISION', title: 'Chef de la Division des Études, de la Prospective et de la Coopération', titleEn: 'Head of Studies, Foresight and Cooperation Division', level: 1, orderIndex: 1 },
    { serviceCode: 'DEPC-CEPS', positionType: 'CHEF_CELLULE', title: 'Chef de la Cellule des Études, de la Prospective et des Statistiques', titleEn: 'Head of Studies, Foresight and Statistics Unit', level: 1, orderIndex: 1 },
    { serviceCode: 'DEPC-CEPS', positionType: 'CHARGE_ETUDES_ASSISTANT', title: 'Chargé d\'Études', titleEn: 'Research Officer', level: 2, orderIndex: 2 },
    { serviceCode: 'DEPC-CC', positionType: 'CHEF_CELLULE', title: 'Chef de la Cellule de la Coopération', titleEn: 'Head of Cooperation Unit', level: 1, orderIndex: 1 },
    { serviceCode: 'DEPC-CC', positionType: 'CHARGE_ETUDES_ASSISTANT', title: 'Chargé d\'Études', titleEn: 'Research Officer', level: 2, orderIndex: 2 },
    // DAG
    { serviceCode: 'DAG', positionType: 'DIRECTEUR', title: 'Directeur des Affaires Générales', titleEn: 'Director of General Affairs', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-CSIGIPES', positionType: 'CHEF_CELLULE', title: 'Chef de la Cellule de Gestion du Projet SIGIPES', titleEn: 'Head of SIGIPES Project Unit', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-CSIGIPES', positionType: 'CHARGE_ETUDES_ASSISTANT', title: 'Chargé d\'Études', titleEn: 'Research Officer', level: 2, orderIndex: 2 },
    { serviceCode: 'DAG-SDPSP', positionType: 'SOUS_DIRECTEUR', title: 'Sous-Directeur du Personnel, de la Solde et des Pensions', titleEn: 'Sub-Director of Staff, Payroll and Pensions', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDPSP-SPFC', positionType: 'CHEF_SERVICE', title: 'Chef du Service du Personnel et de la Formation Continue', titleEn: 'Head of Staff and Continuing Education Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDPSP-SPFC-BPF', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau du Personnel Fonctionnaire', titleEn: 'Head of Civil Servant Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDPSP-SPFC-BPNF', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau du Personnel non Fonctionnaire', titleEn: 'Head of Non-Civil Servant Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDPSP-SPFC-BFC', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de la Formation Continue', titleEn: 'Head of Continuing Education Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDPSP-SPFC-BGPE', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de la Gestion Prévisionnelle des Effectifs', titleEn: 'Head of Workforce Planning Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDPSP-SSP', positionType: 'CHEF_SERVICE', title: 'Chef du Service de la Solde et des Pensions', titleEn: 'Head of Payroll and Pensions Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDPSP-SSP-BSPD', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de la Solde et des Prestations Diverses', titleEn: 'Head of Payroll and Allowances Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDPSP-SSP-BP', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau des Pensions', titleEn: 'Head of Pensions Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDPSP-SAS', positionType: 'CHEF_SERVICE', title: 'Chef du Service de l\'Action Sociale', titleEn: 'Head of Social Action Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDB', positionType: 'SOUS_DIRECTEUR', title: 'Sous-Directeur du Budget', titleEn: 'Sub-Director of Budget', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDB-SB', positionType: 'CHEF_SERVICE', title: 'Chef du Service du Budget', titleEn: 'Head of Budget Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDB-SB-BPB', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de la Préparation du Budget', titleEn: 'Head of Budget Preparation Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDB-SB-BSEB', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau du Suivi de l\'exécution du Budget', titleEn: 'Head of Budget Execution Monitoring Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDB-SMP', positionType: 'CHEF_SERVICE', title: 'Chef du Service des Marchés Publics', titleEn: 'Head of Public Procurement Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDB-SMP-BAO', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau des Appels d\'Offre', titleEn: 'Head of Tender Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDB-SMP-BSCEM', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau du Suivi et du Contrôle de l\'Exécution des Marchés', titleEn: 'Head of Procurement Execution Monitoring Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDIEM', positionType: 'SOUS_DIRECTEUR', title: 'Sous-Directeur des Infrastructures, des Equipements et de la Maintenance', titleEn: 'Sub-Director of Infrastructure, Equipment and Maintenance', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDIEM-SNC', positionType: 'CHEF_SERVICE', title: 'Chef du Service des Normes de Construction', titleEn: 'Head of Construction Standards Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DAG-SDIEM-SMEM', positionType: 'CHEF_SERVICE', title: 'Chef du Service du Matériel, des Equipements et de la Maintenance', titleEn: 'Head of Equipment and Maintenance Service', level: 1, orderIndex: 1 },
    // DREFOP
    { serviceCode: 'DREFOP', positionType: 'DELEGUE_REGIONAL', title: 'Délégué Régional de l\'Emploi et de la Formation Professionnelle', titleEn: 'Regional Delegate of Employment and Vocational Training', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP-IRF', positionType: 'INSPECTEUR_REGIONAL_FORMATIONS', title: 'Inspecteur Régional des Formations', titleEn: 'Regional Training Inspector', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP-IRF', positionType: 'CONSEILLER_REGIONAL_FORMATIONS', title: 'Conseiller Régional des Formations', titleEn: 'Regional Training Adviser', level: 2, orderIndex: 2 },
    { serviceCode: 'DREFOP-SPE', positionType: 'CHEF_SERVICE', title: 'Chef du Service de la Promotion de l\'Emploi', titleEn: 'Head of Employment Promotion Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP-SPE-BAE', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de la promotion de l\'auto emploi', titleEn: 'Head of Self-Employment Promotion Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP-SPE-BHIMO', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de la promotion de l\'approche HIMO', titleEn: 'Head of HIMO Approach Promotion Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP-SPE-BMISF', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de Migration du secteur Informel vers le secteur formel', titleEn: 'Head of Informal to Formal Sector Migration Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP-SRMO', positionType: 'CHEF_SERVICE', title: 'Chef du Service de la Régulation de la Main-d\'Oeuvre', titleEn: 'Head of Labour Regulation Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP-SRMO-BEP', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de l\'enregistrement et du placement', titleEn: 'Head of Registration and Placement Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP-SRMO-BFS', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau du fichier et des statistiques', titleEn: 'Head of Records and Statistics Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP-SFOP', positionType: 'CHEF_SERVICE', title: 'Chef du Service de la Formation et de l\'Orientation Professionnelle', titleEn: 'Head of Training and Vocational Guidance Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP-SFOP-BGSF', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de gestion des structures de formation professionnelle', titleEn: 'Head of VTC Management Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP-SFOP-BE', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau des Evaluations', titleEn: 'Head of Evaluations Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP-SFOP-BOTP', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de l\'Orientation, des tests psychotechniques et du contrôle des conditions psychologiques du travail', titleEn: 'Head of Orientation, Psychotechnical Tests and Working Conditions Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP-SAF', positionType: 'CHEF_SERVICE', title: 'Chef du Service Administratif et Financier', titleEn: 'Head of Administrative and Financial Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP-SAF-BP', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau du personnel', titleEn: 'Head of Staff Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP-SAF-BBM', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau du budget et du Matériel', titleEn: 'Head of Budget and Equipment Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DREFOP-BACL', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de l\'Accueil, du Courrier et de Liaison', titleEn: 'Head of Reception, Mail and Liaison Bureau', level: 1, orderIndex: 1 },
    // DDEFOP
    { serviceCode: 'DDEFOP', positionType: 'DELEGUE_DEPARTEMENTAL', title: 'Délégué Départemental de l\'Emploi et de la Formation Professionnelle', titleEn: 'Divisional Delegate of Employment and Vocational Training', level: 1, orderIndex: 1 },
    { serviceCode: 'DDEFOP-SLSCJ', positionType: 'CHEF_SERVICE', title: 'Chef du Service de lutte contre le sous-emploi et le chômage des jeunes', titleEn: 'Head of Underemployment and Youth Unemployment Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DDEFOP-SLSCJ-BES', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de l\'emploi Salarié', titleEn: 'Head of Salaried Employment Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DDEFOP-SLSCJ-BEI', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de l\'emploi Indépendant', titleEn: 'Head of Self-Employment Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DDEFOP-SLSCJ-BCS', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau des contrôles et des statistiques', titleEn: 'Head of Controls and Statistics Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DDEFOP-SFOE', positionType: 'CHEF_SERVICE', title: 'Chef du Service de la formation, de l\'orientation professionnelle et des évaluations', titleEn: 'Head of Training, Guidance and Evaluations Service', level: 1, orderIndex: 1 },
    { serviceCode: 'DDEFOP-SFOE-BACE', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de l\'accueil des chercheurs d\'emploi', titleEn: 'Head of Job Seekers Reception Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DDEFOP-SFOE-BOP', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de l\'orientation professionnelle', titleEn: 'Head of Vocational Guidance Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DDEFOP-SFOE-BGSF', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de la gestion des structures de formation', titleEn: 'Head of Training Structures Management Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DDEFOP-BAG', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau des Affaires Générales', titleEn: 'Head of General Affairs Bureau', level: 1, orderIndex: 1 },
    { serviceCode: 'DDEFOP-BACL', positionType: 'CHEF_BUREAU', title: 'Chef du Bureau de l\'Accueil, du Courrier et de Liaison', titleEn: 'Head of Reception, Mail and Liaison Bureau', level: 1, orderIndex: 1 },
];
// ============================================================
// CAMEROON REGIONS, DEPARTMENTS AND SUBDIVISIONS (full)
// ============================================================
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
// ============================================================
// SEED FUNCTION
// ============================================================
async function seed() {
    console.log('🌱 Starting MINEFOP seed (Décret 2012) – Directorates as roots for CENTRALE\n');
    async function withRetry(fn, retries = 3, delay = 2000) {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            }
            catch (e) {
                if (e.code === 'P1017' && i < retries - 1) {
                    console.log(`   🔄 Retry ${i + 1}/${retries} after connection error...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                throw e;
            }
        }
        throw new Error('Unreachable');
    }
    try {
        const categoryMap = {
            'CENTRALE': client_1.ServiceCategory.CENTRALE,
            'DECONCENTRE': client_1.ServiceCategory.DECONCENTRE,
            'RATTACHE': client_1.ServiceCategory.RATTACHE,
        };
        const roleMap = {
            'CENTRAL': client_1.UserRole.CENTRAL,
            'REGIONAL': client_1.UserRole.REGIONAL,
            'DIVISIONAL': client_1.UserRole.DIVISIONAL,
        };
        // 1. Create services
        console.log('🏛️  Creating MINEFOP service hierarchy...');
        let serviceCount = 0;
        for (const s of minefopServices) {
            await withRetry(async () => {
                const exists = await prisma.minefopService.findUnique({ where: { code: s.code } });
                if (!exists) {
                    await prisma.minefopService.create({
                        data: {
                            code: s.code,
                            name: s.name,
                            acronym: s.acronym ?? null,
                            category: categoryMap[s.category],
                            level: s.level,
                            parentCode: s.parentCode ?? null,
                            roleMapping: roleMap[s.roleMapping],
                            requiresRegion: s.requiresRegion,
                            requiresDepartment: s.requiresDepartment,
                            orderIndex: s.orderIndex,
                            isActive: true,
                        },
                    });
                    serviceCount++;
                }
            });
            if (serviceCount % 30 === 0 && serviceCount > 0)
                console.log(`   ... ${serviceCount}/${minefopServices.length} services processed`);
        }
        console.log(`   ✅ ${serviceCount} new services created (${minefopServices.length - serviceCount} already existed)`);
        // 2. Create explicit positions
        console.log('👔 Creating explicit service positions...');
        let posCreated = 0;
        for (const pos of servicePositions) {
            await withRetry(async () => {
                const exists = await prisma.servicePosition.findUnique({
                    where: { serviceCode_positionType: { serviceCode: pos.serviceCode, positionType: pos.positionType } }
                });
                if (!exists) {
                    await prisma.servicePosition.create({ data: pos });
                    posCreated++;
                }
            });
            if (posCreated % 30 === 0 && posCreated > 0)
                console.log(`   ... ${posCreated} new positions created`);
        }
        console.log(`   ✅ ${posCreated} new explicit positions created (${servicePositions.length - posCreated} already existed)`);
        // 3. Add STAFF position for EVERY service – title 'Cadre' (not 'Agent de service')
        console.log('👥 Adding STAFF positions for all services...');
        const allServices = await prisma.minefopService.findMany();
        let staffCreated = 0;
        for (const service of allServices) {
            await withRetry(async () => {
                await prisma.servicePosition.upsert({
                    where: {
                        serviceCode_positionType: {
                            serviceCode: service.code,
                            positionType: 'STAFF'
                        }
                    },
                    update: {
                        title: 'Cadre',
                        titleEn: 'Officer',
                        level: 2,
                        orderIndex: 999,
                        isActive: true,
                    },
                    create: {
                        serviceCode: service.code,
                        positionType: 'STAFF',
                        title: 'Cadre',
                        titleEn: 'Officer',
                        level: 2,
                        orderIndex: 999,
                        isActive: true,
                    },
                });
                staffCreated++;
            });
        }
        console.log(`   ✅ ${staffCreated} STAFF positions created/updated`);
        // 4. Create sectors
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
        let sectorCreated = 0;
        for (const s of sectors) {
            await withRetry(async () => {
                const exists = await prisma.sector.findUnique({ where: { name: s.name } });
                if (!exists) {
                    await prisma.sector.create({ data: s });
                    sectorCreated++;
                }
            });
        }
        console.log(`   ✅ ${sectorCreated} new sectors (${sectors.length - sectorCreated} already existed)`);
        // 5. Create regions, departments, subdivisions
        console.log('🗺️  Creating locations...');
        const regionMap = new Map();
        for (const r of regionsData) {
            const region = await withRetry(async () => {
                let region = await prisma.region.findUnique({ where: { name: r.name } });
                if (!region) {
                    region = await prisma.region.create({ data: { name: r.name } });
                    console.log(`   ✅ Created region: ${r.name}`);
                }
                else {
                    console.log(`   ⏭️  Region already exists: ${r.name}`);
                }
                return region;
            });
            regionMap.set(r.name, region.id);
        }
        let deptCreated = 0;
        let subdivCreated = 0;
        for (const r of regionsData) {
            const regionId = regionMap.get(r.name);
            if (!regionId)
                continue;
            for (const d of r.departments) {
                const dept = await withRetry(async () => {
                    let dept = await prisma.department.findUnique({
                        where: { regionId_name: { regionId, name: d.name } }
                    });
                    if (!dept) {
                        dept = await prisma.department.create({
                            data: { name: d.name, regionId }
                        });
                        deptCreated++;
                        console.log(`   ✅ Created department: ${r.name} → ${d.name}`);
                    }
                    else {
                        console.log(`   ⏭️  Department already exists: ${r.name} → ${d.name}`);
                    }
                    return dept;
                });
                for (const sub of d.subdivisions) {
                    await withRetry(async () => {
                        const exists = await prisma.subdivision.findUnique({
                            where: { departmentId_name: { departmentId: dept.id, name: sub } }
                        });
                        if (!exists) {
                            await prisma.subdivision.create({
                                data: { name: sub, departmentId: dept.id }
                            });
                            subdivCreated++;
                        }
                    });
                }
            }
        }
        const totalDepts = regionsData.reduce((acc, r) => acc + r.departments.length, 0);
        const totalSubdivs = regionsData.reduce((acc, r) => acc + r.departments.reduce((a, d) => a + d.subdivisions.length, 0), 0);
        console.log(`   ✅ ${deptCreated}/${totalDepts} departments created, ${subdivCreated}/${totalSubdivs} subdivisions created`);
        // 6. Create test users
        console.log('👥 Creating test users...');
        const testUsers = [
            { email: 'minister@minefop.cm', firstName: 'Paul', lastName: 'Biya', role: client_1.UserRole.CENTRAL, serviceCode: 'CAB', positionType: client_1.PositionType.MINISTRE, region: null, department: null },
            { email: 'regional.centre@minefop.cm', firstName: 'Jean', lastName: 'Nkuéta', role: client_1.UserRole.REGIONAL, region: 'Centre', department: null, serviceCode: 'DREFOP', positionType: client_1.PositionType.DELEGUE_REGIONAL },
            { email: 'divisional.mfoundi@minefop.cm', firstName: 'Marie', lastName: 'Ebanda', role: client_1.UserRole.DIVISIONAL, region: 'Centre', department: 'Mfoundi', serviceCode: 'DDEFOP', positionType: client_1.PositionType.DELEGUE_DEPARTEMENTAL },
        ];
        for (const userData of testUsers) {
            await withRetry(async () => {
                const exists = await prisma.user.findUnique({ where: { email: userData.email } });
                if (!exists) {
                    await prisma.user.create({
                        data: {
                            email: userData.email,
                            firstName: userData.firstName,
                            lastName: userData.lastName,
                            passwordHash: await bcrypt.hash('password123', 10),
                            role: userData.role,
                            region: userData.region,
                            department: userData.department,
                            serviceCode: userData.serviceCode,
                            positionType: userData.positionType,
                        },
                    });
                    console.log(`   ✅ Created user: ${userData.email}`);
                }
                else {
                    console.log(`   ⏭️  User already exists: ${userData.email}`);
                }
            });
        }
        // 7. Create sample companies
        console.log('🏢 Creating sample companies...');
        const sectorList = await prisma.sector.findMany();
        const regionList = await prisma.region.findMany();
        const departmentList = await prisma.department.findMany({ include: { subdivisions: true } });
        let companyCreated = 0;
        for (let i = 1; i <= 20; i++) {
            const region = regionList[Math.floor(Math.random() * regionList.length)];
            const department = departmentList[Math.floor(Math.random() * departmentList.length)];
            const sector = sectorList[Math.floor(Math.random() * sectorList.length)];
            const companyEmail = `company${i}@example.cm`;
            await withRetry(async () => {
                const existingUser = await prisma.user.findUnique({ where: { email: companyEmail } });
                if (!existingUser) {
                    const companyUser = await prisma.user.create({
                        data: {
                            email: companyEmail,
                            firstName: 'Company',
                            lastName: `${i}`,
                            passwordHash: await bcrypt.hash('password123', 10),
                            role: client_1.UserRole.COMPANY,
                            region: region.name,
                            department: department.name,
                        },
                    });
                    await prisma.company.create({
                        data: {
                            userId: companyUser.id,
                            name: `${sector.name} Company ${i}`,
                            mainActivity: sector.name,
                            secondaryActivity: 'General Services',
                            region: region.name,
                            department: department.name,
                            district: department.subdivisions?.[0]?.name || 'Unknown',
                            address: `P.O. Box ${1000 + i}, ${region.name}`,
                            taxNumber: `CT${String(i).padStart(6, '0')}`,
                            cnpsNumber: `CN${String(i).padStart(6, '0')}`,
                            socialCapital: 50000000 + i * 1000000,
                            totalEmployees: 50 + i * 10,
                            menCount: Math.floor((50 + i * 10) * 0.65),
                            womenCount: Math.floor((50 + i * 10) * 0.35),
                            lastYearTotal: 40 + i * 8,
                        },
                    });
                    companyCreated++;
                }
            });
            if (i % 5 === 0)
                console.log(`   ... ${i} companies processed`);
        }
        console.log(`   ✅ ${companyCreated} new companies created`);
        console.log('\n✅ Seed completed!\n');
        console.log('📝 Credentials (all use password "password123"):');
        console.log('   MINISTER:      minister@minefop.cm');
        console.log('   REGIONAL:      regional.centre@minefop.cm');
        console.log('   DIVISIONAL:    divisional.mfoundi@minefop.cm');
        console.log('   COMPANY:       company1@example.cm ... company20@example.cm');
        console.log(`\n🏛️  Services: ${serviceCount} new | Positions: ${posCreated} new + ${staffCreated} staff`);
        console.log(`🗺️  Regions: ${regionsData.length}\n`);
    }
    catch (error) {
        console.error('❌ Seed error:', error);
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
    }
}
seed();
