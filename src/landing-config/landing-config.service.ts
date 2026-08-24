// src/landing-config/landing-config.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SINGLETON_ID = 'singleton';

// Mirrors LandingConfig.defaults() in lib/models/landing_config.dart exactly
// — keep both in sync if this pre-CMS fallback copy ever changes. Seeded
// into the row on its first-ever fetch (see fetchOrCreate); after that, the
// Super Admin's saved value takes over.
const DEFAULT_LANDING_CONFIG = {
  statusLine: {
    fr: "Initiative MINEFOP / ONEFOP — pilote en attente d'autorisation institutionnelle",
    en: 'MINEFOP / ONEFOP initiative — pilot pending institutional authorization',
  },
  heroSupport: {
    fr: "Une infrastructure numérique pour renforcer la qualité, la couverture et l'exploitabilité des données sur le marché du travail au Cameroun.",
    en: "A digital infrastructure to strengthen the quality, coverage and usability of Cameroon's labour-market data.",
  },
  roadmap: [
    {
      label: { fr: 'Collecte de données', en: 'Data collection' },
      description: {
        fr: "Collecte numérique des enquêtes ONEFOP (entreprises, coopératives, ONG, CTD) et des déclarations de main-d'œuvre DSMO. Prototype fonctionnel prêt pour un pilote supervisé.",
        en: 'Digital collection of ONEFOP surveys (enterprises, cooperatives, NGOs, CTDs) and DSMO workforce declarations. Functional prototype ready for supervised pilot.',
      },
      done: true,
    },
    {
      label: { fr: 'Formation professionnelle', en: 'Training data' },
      description: {
        fr: 'Intégration des données de la formation professionnelle pour compléter le volet compétences du marché du travail.',
        en: 'Integration of professional training data to complete the skills side of the labour-market picture.',
      },
      done: false,
    },
    {
      label: { fr: 'Intelligence', en: 'Intelligence' },
      description: {
        fr: "Couches d'intelligence Ministère et Employeurs pour l'analyse, l'appui aux politiques et la prise de décision.",
        en: 'Ministry and employer intelligence layers for analysis, policy support and decision-making.',
      },
      done: false,
    },
    {
      label: { fr: 'Observatoire public', en: 'Public observatory' },
      description: {
        fr: 'Observatoire public du marché du travail pour la diffusion transparente des indicateurs et analyses.',
        en: 'Public labour-market observatory for transparent dissemination of indicators and insights.',
      },
      done: false,
    },
  ],
  roadmapCaption: {
    fr: 'Composante I opérationnelle · Composantes II–IV planifiées',
    en: 'Component I operational · Components II–IV planned',
  },
  valueCards: [
    {
      title: { fr: 'Intégrité des données', en: 'Data integrity' },
      body: {
        fr: "Validation en temps réel, contrôles de cohérence et piste d'audit complète.",
        en: 'Real-time validation, consistency checks and full audit trail.',
      },
    },
    {
      title: { fr: 'Couverture nationale', en: 'National coverage' },
      body: {
        fr: 'Enquêtes ONEFOP et déclarations DSMO dans un flux numérique unique.',
        en: 'ONEFOP surveys and DSMO declarations in one digital flow.',
      },
    },
    {
      title: { fr: 'Traçabilité', en: 'Traceability' },
      body: {
        fr: 'Historique des soumissions, horodatage et attribution des utilisateurs.',
        en: 'Submission history, timestamps and user attribution.',
      },
    },
    {
      title: { fr: 'Souveraineté', en: 'Sovereignty' },
      body: {
        fr: 'Données hébergées sous contrôle institutionnel camerounais.',
        en: 'Data hosted under Cameroonian institutional control.',
      },
    },
  ],
  aboutParagraphs: [
    {
      fr: "CAM-LEAP (Cameroon Labour and Employment Analytical Platform) est une initiative de transformation numérique du système d'information sur le marché du travail du Cameroun. Elle vise à doter le MINEFOP d'une infrastructure moderne pour améliorer la visibilité, la qualité et l'exploitabilité des données du marché du travail.",
      en: "CAM-LEAP (Cameroon Labour and Employment Analytical Platform) is a digital transformation initiative for Cameroon's labour-market information system. It aims to equip MINEFOP with modern infrastructure to improve the visibility, quality and usability of labour-market data.",
    },
    {
      fr: "Le programme est structuré en quatre composantes séquentielles. La Composante I — collecte numérique des enquêtes ONEFOP et des déclarations de main-d'œuvre DSMO — est achevée et opérationnelle sous forme de prototype fonctionnel. Les Composantes II à IV restent à développer.",
      en: 'The programme is structured in four sequential components. Component I — digital collection of ONEFOP surveys and DSMO workforce declarations — is complete and operational as a functional prototype. Components II–IV remain to be developed.',
    },
    {
      fr: "Le pilote ne constitue ni une adoption institutionnelle, ni une acquisition, un transfert ou une licence de la plateforme. Ces questions seront déterminées par le MINEFOP à la suite de l'évaluation du pilote supervisé.",
      en: 'The pilot does not constitute institutional adoption, acquisition, transfer or licensing of the platform. Those questions will be determined by MINEFOP after evaluation of the supervised pilot.',
    },
  ],
  aboutPositioning: {
    fr: "Conçue à partir de l'expérience opérationnelle au sein du MINEFOP et alignée sur la Vision 2035, la SND30 et les exigences des partenaires au développement en matière d'audit des données.",
    en: 'Designed from operational experience inside MINEFOP and aligned with Vision 2035, SND30 and the data-auditing requirements of development partners.',
  },
  ctaTitle: {
    fr: 'Prêt à découvrir la Composante I ?',
    en: 'Ready to explore Component I?',
  },
  ctaNote: {
    fr: "L'accès au pilote est réservé aux utilisateurs institutionnels autorisés.",
    en: 'Pilot access is limited to authorised institutional users.',
  },
  accessNote: {
    fr: "L'accès au pilote est actuellement réservé aux utilisateurs institutionnels autorisés. Connectez-vous si vous disposez déjà d'un compte, ou demandez-en un.",
    en: 'Pilot access is currently limited to authorised institutional users. Sign in if you already have credentials, or request an account.',
  },
};

@Injectable()
export class LandingConfigService {
  // Read on every landing-page load (public, unauthenticated, potentially
  // high-traffic), so a process-local cache avoids a DB round trip per
  // visitor. Invalidated on update — see SystemSettingsService for the same
  // pattern and its multi-instance caveat.
  private cached: Awaited<ReturnType<LandingConfigService['fetchOrCreate']>> | null = null;

  constructor(private prisma: PrismaService) { }

  /** Returns the flat contract the Flutter client expects — LandingConfig's
   * three fields plus `updatedAt` for the admin form's "last saved" display
   * (harmless extra key for the public consumer, which ignores it). */
  async getConfig() {
    const row = this.cached ?? (this.cached = await this.fetchOrCreate());
    const data = row.data as Record<string, any>;
    return { ...data, updatedAt: row.updatedAt };
  }

  async updateConfig(data: Record<string, any>, updatedBy: string) {
    const row = await this.prisma.landingConfig.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, data, updatedBy },
      update: { data, updatedBy },
    });
    this.cached = row;
    return { ...(row.data as Record<string, any>), updatedAt: row.updatedAt };
  }

  private async fetchOrCreate() {
    const existing = await this.prisma.landingConfig.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (existing) return existing;
    return this.prisma.landingConfig.create({
      data: { id: SINGLETON_ID, data: DEFAULT_LANDING_CONFIG },
    });
  }
}
