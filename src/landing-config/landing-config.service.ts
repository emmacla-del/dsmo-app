// src/landing-config/landing-config.service.ts
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { LandingConfigDto } from './dto/landing-config.dto';

const SINGLETON_ID = 'singleton';
const MAX_VERSIONS = 20;

// Fixed lengths for every top-level array field in the contract — mirrors
// LandingConfig.fromJson's fixedList calls on the Dart side. Used by
// mergeWithDefaults to decide "whole array missing/wrong shape" the same
// way the client does. A correctly-sized array can still hold internally
// stale items — see OBJECT_ARRAY_FIELDS below for that repair. Does NOT
// include roadmap.milestones, valueProposition.cards,
// introduction.paragraphs, platformCapabilities.items,
// institutionalMessage.stakeholders, or lmisArchitecture.steps — all six
// are nested one level deep, so they're handled by their own dedicated
// migrateLegacyRoadmapShape/migrateLegacyValuePropositionShape/
// migrateLegacyIntroductionShape/migrateLegacyPlatformCapabilitiesShape/
// migrateLegacyInstitutionalMessageShape/migrateLegacyLmisArchitectureShape
// instead of this generic top-level-keys mechanism. observatory.indicators
// is also nested one level deep but has no migrateLegacy* counterpart —
// unlike those six, `observatory` never existed as a prior flat key, so a
// snapshot predating it simply lacks the whole `observatory` object and
// this generic mechanism's whole-object replacement (see the `else if`
// branch below) is sufficient.
const ARRAY_FIELD_LENGTHS: Record<string, number> = {
  whyPillarKickers: 4,
};

// Which of the top-level array fields above hold structured objects (not
// plain LocalizedText) whose own sub-fields can independently predate a
// given snapshot even when the array itself is the expected length.
// Repaired item-by-item against DEFAULT_LANDING_CONFIG's item at the same
// index — safe because roadmap.milestones/valueProposition.cards/
// institutionalMessage.stakeholders (all repaired separately — see
// migrateLegacyRoadmapShape/migrateLegacyValuePropositionShape/
// migrateLegacyInstitutionalMessageShape) are all rendered by positional
// index everywhere (landing_screen.dart's roman numerals/icons,
// LandingConfig.fromJson's fixedList), never looked up by an id or key.
// Not extended to whyPillarKickers/introduction.paragraphs/
// platformCapabilities.items/lmisArchitecture.steps — those are plain
// LocalizedText[], already covered by the whole-array-length check above
// plus LandingConfigDto's own field validators.
const OBJECT_ARRAY_FIELDS: string[] = [];

// Mirrors LandingConfig.defaults() in lib/models/landing_config.dart exactly
// — keep both in sync if this pre-CMS fallback copy ever changes. Seeded
// into the row on its first-ever fetch (see fetchOrCreate); after that, the
// Super Admin's saved value takes over.
const DEFAULT_LANDING_CONFIG = {
  statusLine: {
    fr: "Phase fondatrice · Composante I — collecte numérique des données du travail et de l'emploi",
    en: 'Foundation phase · Component I — digital labour and employment data collection',
  },
  hero: {
    title: {
      fr: "Bâtir le système d'information sur le marché du travail du Cameroun",
      en: "Building Cameroon's Labour Market Information System",
    },
    description: {
      fr: "CAMLEAP est le programme d'infrastructure numérique par lequel l'ONEFOP développe progressivement un système national de collecte, d'intégration, de gestion et d'analyse des informations sur le travail et l'emploi.",
      en: 'CAMLEAP is the digital infrastructure programme through which ONEFOP is progressively developing a national system for collecting, integrating, managing and analysing labour and employment information.',
    },
  },
  roadmap: {
    milestones: [
      {
        label: { fr: 'Collecte numérique des données', en: 'Digital data collection' },
        description: {
          fr: "Digitalisation des instruments ONEFOP et DSMO et mise en place de l'infrastructure de données fondatrice du SIMT national. Composante actuellement mise en œuvre.",
          en: 'Digitising ONEFOP and DSMO instruments and establishing the foundational data infrastructure required for the national LMIS. This component is the current implementation.',
        },
        done: true,
      },
      {
        label: { fr: 'Intégration et gestion des données', en: 'Data integration & management' },
        description: {
          fr: 'Composante planifiée, destinée à relier les informations sur le marché du travail issues des sources et processus institutionnels concernés.',
          en: 'Planned component, designed to connect labour-market information from relevant sources and institutional processes.',
        },
        done: false,
      },
      {
        label: { fr: 'Analytique du marché du travail', en: 'Labour-market analytics' },
        description: {
          fr: "Composante planifiée, destinée à transformer l'information structurée en indicateurs et en éléments de preuve sur le marché du travail.",
          en: 'Planned component, designed to transform structured information into labour-market indicators and evidence.',
        },
        done: false,
      },
      {
        label: { fr: 'Intelligence et diffusion', en: 'Labour-market intelligence & dissemination' },
        description: {
          fr: "Composante planifiée, destinée à appuyer la diffusion de l'intelligence du marché du travail pour l'action publique et la décision.",
          en: 'Planned component, designed to support dissemination of labour-market intelligence for policy and decision-making.',
        },
        done: false,
      },
    ],
    caption: {
      fr: 'Composante I en cours de mise en œuvre · Composantes II–IV planifiées',
      en: 'Component I currently being implemented · Components II–IV planned',
    },
  },
  valueProposition: {
    cards: [
      {
        title: { fr: 'Collecter', en: 'Collect' },
        body: {
          fr: "Digitaliser et standardiser la collecte des données sur le travail et l'emploi.",
          en: 'Digitise and standardise labour and employment data collection.',
        },
      },
      {
        title: { fr: 'Intégrer', en: 'Integrate' },
        body: {
          fr: 'Relier progressivement les informations issues des sources et processus institutionnels concernés.',
          en: 'Connect information from relevant sources and institutional processes.',
        },
      },
      {
        title: { fr: 'Analyser', en: 'Analyse' },
        body: {
          fr: "Transformer l'information structurée en indicateurs et en éléments de preuve sur le marché du travail.",
          en: 'Transform structured information into labour-market indicators and evidence.',
        },
      },
      {
        title: { fr: 'Informer', en: 'Inform' },
        body: {
          fr: "Appuyer les politiques d'emploi, la planification, le suivi et la décision.",
          en: 'Support employment policy, planning, monitoring and decision-making.',
        },
      },
    ],
  },
  whyPillarKickers: [
    { fr: 'Collecter', en: 'Collect' },
    { fr: 'Intégrer', en: 'Integrate' },
    { fr: 'Analyser', en: 'Analyse' },
    { fr: 'Informer', en: 'Inform' },
  ],
  lmisArchitecture: {
    steps: [
      { fr: 'Sources de données', en: 'Data sources' },
      { fr: 'Collecte', en: 'Collection' },
      { fr: 'Intégration', en: 'Integration' },
      { fr: 'Analyse', en: 'Analysis' },
      { fr: 'Intelligence', en: 'Intelligence' },
      { fr: 'Décision', en: 'Decision-making' },
    ],
  },
  platformCapabilities: {
    items: [
      { fr: 'Collecter', en: 'Collect' },
      { fr: 'Valider', en: 'Validate' },
      { fr: 'Centraliser', en: 'Centralise' },
      { fr: 'Intégrer', en: 'Integrate' },
      { fr: 'Analyser', en: 'Analyse' },
      { fr: 'Produire des indicateurs', en: 'Generate indicators' },
      { fr: 'Éclairer les décisions', en: 'Inform decisions' },
    ],
  },
  institutionalMessage: {
    stakeholders: [
      {
        title: { fr: 'Gouvernement et décideurs', en: 'Government & policy makers' },
        body: {
          fr: "Conçu pour appuyer les politiques d'emploi, la planification et le suivi par des éléments de preuve.",
          en: 'Designed to support evidence for employment policy, planning and monitoring.',
        },
      },
      {
        title: { fr: "Services de l'emploi", en: 'Employment services' },
        body: {
          fr: "Conçu pour appuyer une meilleure compréhension de l'offre, de la demande et des tendances de l'emploi.",
          en: 'Designed to support a better understanding of labour supply, demand and employment trends.',
        },
      },
      {
        title: { fr: 'Établissements de formation', en: 'Skills & training institutions' },
        body: {
          fr: "Conçu pour appuyer l'adéquation entre le développement des compétences et les besoins du marché du travail.",
          en: 'Designed to support alignment between skills development and labour-market needs.',
        },
      },
      {
        title: { fr: 'Employeurs et partenaires sociaux', en: 'Employers & social partners' },
        body: {
          fr: "Conçu pour appuyer une information fiable sur la dynamique de l'emploi et de la main-d'œuvre.",
          en: 'Designed to support reliable information on workforce and employment dynamics.',
        },
      },
      {
        title: { fr: 'Chercheurs et analystes', en: 'Researchers & analysts' },
        body: {
          fr: "Conçu pour appuyer une information structurée sur le marché du travail, pour l'analyse et la recherche.",
          en: 'Designed to support structured labour-market information for analysis and research.',
        },
      },
    ],
  },
  introduction: {
    paragraphs: [
      {
        fr: "Le Cameroun produit des informations sur le travail et l'emploi à travers plusieurs instruments, institutions et processus. CAMLEAP est développé pour transformer progressivement ces flux fragmentés en une infrastructure nationale d'information sur le marché du travail plus cohérente, fiable et exploitable.",
        en: 'Cameroon generates labour and employment information through different instruments, institutions and processes. CAMLEAP is being developed to progressively transform these fragmented information flows into a more coherent, reliable and usable national labour-market information infrastructure.',
      },
      {
        fr: "Le programme est structuré en quatre composantes séquentielles, de la collecte numérique à l'intégration, l'analytique et l'intelligence du marché du travail. La Composante I — digitalisation de la collecte des données ONEFOP et DSMO — est la mise en œuvre actuelle.",
        en: 'The programme is structured in four sequential components, from digital data collection through integration, analytics and labour-market intelligence. Component I — digitalisation of ONEFOP and DSMO labour and employment data collection — is the current implementation.',
      },
      {
        fr: "La mise en œuvre actuelle ne constitue ni un déploiement national du SIMT, ni une adoption institutionnelle, un transfert ou une licence de la plateforme. Ces questions seront déterminées par le MINEFOP.",
        en: 'The current implementation does not constitute nationwide LMIS deployment, institutional adoption, transfer or licensing of the platform. Those questions will be determined by MINEFOP.',
      },
    ],
    positioning: {
      fr: "Conçue à partir de l'expérience opérationnelle au sein du MINEFOP et alignée sur la Vision 2035, la SND30 et les exigences des partenaires au développement en matière d'audit des données.",
      en: 'Designed from operational experience inside MINEFOP and aligned with Vision 2035, SND30 and the data-auditing requirements of development partners.',
    },
  },
  // Placeholder content — no real copy exists yet for the public
  // observatory page. Flagged as provisional in the admin editor's note
  // banner and with an in-preparation badge on the public page itself
  // (see ObservatoryScreen). Super Admin fills these in when real copy is
  // ready.
  observatory: {
    title: {
      fr: "L'Observatoire du marché du travail",
      en: 'The Labour Market Observatory',
    },
    description: {
      fr: "L'Observatoire mettra à disposition du public des indicateurs sur le marché du travail camerounais, à mesure que les composantes du SIMT seront mises en œuvre. Son contenu est en cours de préparation.",
      en: "The Observatory will make labour-market indicators for Cameroon publicly available as LMIS components are implemented. Its content is currently in preparation.",
    },
    indicators: [
      { fr: 'Emploi et chômage', en: 'Employment & unemployment' },
      { fr: 'Compétences et formation', en: 'Skills & training' },
      { fr: 'Salaires et conditions de travail', en: 'Wages & working conditions' },
    ],
  },
  ctaTitle: {
    fr: 'Accéder à la plateforme CAMLEAP',
    en: 'Access the CAMLEAP platform',
  },
  ctaNote: {
    fr: "Les services numériques de CAMLEAP sont progressivement mis à la disposition des utilisateurs autorisés et des institutions participantes, au fur et à mesure de la mise en œuvre des composantes du programme.",
    en: 'CAMLEAP digital services are progressively being made available to authorised users and participating institutions as programme components are implemented.',
  },
  accessNote: {
    fr: "L'accès est actuellement réservé aux utilisateurs institutionnels autorisés. Connectez-vous si vous disposez déjà d'un compte, ou demandez l'accès.",
    en: 'Access is currently limited to authorised institutional users. Sign in if you already have credentials, or request access.',
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
    const existing = await this.prisma.landingConfig.findUnique({
      where: { id: SINGLETON_ID },
    });

    // Snapshot what's about to be overwritten, so every save is undoable —
    // including a restore itself, which just calls updateConfig again.
    if (existing) {
      await this.prisma.landingConfigVersion.create({
        data: { data: existing.data, updatedBy: existing.updatedBy },
      });
      await this.pruneVersions();
    }

    const row = await this.prisma.landingConfig.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, data, updatedBy },
      update: { data, updatedBy },
    });
    this.cached = row;
    return { ...(row.data as Record<string, any>), updatedAt: row.updatedAt };
  }

  /** Last MAX_VERSIONS pre-overwrite snapshots, most recent first, each with
   * a short text preview so the admin can tell them apart without opening
   * one. */
  async listVersions() {
    const versions = await this.prisma.landingConfigVersion.findMany({
      orderBy: { createdAt: 'desc' },
      take: MAX_VERSIONS,
    });
    return versions.map((v) => ({
      id: v.id,
      createdAt: v.createdAt,
      updatedBy: v.updatedBy,
      preview: this.buildPreview(v.data as Record<string, any>),
    }));
  }

  async restoreVersion(versionId: string, restoredBy: string) {
    const version = await this.prisma.landingConfigVersion.findUniqueOrThrow({
      where: { id: versionId },
    });

    // A snapshot can predate fields added to the schema since it was taken
    // (e.g. the LMIS-redesign fields) — backfill those with the current
    // defaults before writing it back, so restoring an old version can
    // never silently blank out fields it never had, or leave the row in a
    // shape newer code doesn't expect.
    const merged = this.mergeWithDefaults(version.data as Record<string, any>);

    // Validate the backfilled result against the same DTO the live PUT
    // path enforces — catches genuine corruption (wrong types, malformed
    // nested shapes), not just "missing a field that didn't exist yet"
    // (mergeWithDefaults already handled that). forbidNonWhitelisted is
    // deliberately off here (unlike the PUT controller): a years-old
    // snapshot may carry a since-removed key, and that shouldn't block a
    // restore the way it blocks a malformed live edit.
    const instance = plainToInstance(LandingConfigDto, merged);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });
    if (errors.length > 0) {
      throw new UnprocessableEntityException(
        "This version's data no longer matches the current landing-config schema and cannot be restored.",
      );
    }

    return this.updateConfig(merged, restoredBy);
  }

  /** Backfills any field missing or the wrong shape in [data] — most
   * commonly a version snapshot taken before that field existed — with
   * DEFAULT_LANDING_CONFIG's value for it. Array fields are replaced whole
   * when absent or the wrong length; scalar (LocalizedText) fields are
   * replaced whole when absent or not an object. Legacy-shape migrations
   * (see migrateLegacyHeroShape, migrateLegacyValuePropositionShape,
   * migrateLegacyIntroductionShape, migrateLegacyRoadmapShape,
   * migrateLegacyPlatformCapabilitiesShape,
   * migrateLegacyInstitutionalMessageShape,
   * migrateLegacyLmisArchitectureShape) run first, so a pre-restructure
   * row's flat hero, valueCards, about-, roadmap-,
   * dataToIntelligencePipeline-, ecosystemStakeholders-, and
   * architecturePipeline-prefixed fields are read into their new nested
   * shapes rather than discarded in favour of the default objects. */
  private mergeWithDefaults(data: Record<string, any>): Record<string, any> {
    let merged: Record<string, any> = this.migrateLegacyHeroShape({ ...data });
    merged = this.migrateLegacyValuePropositionShape(merged);
    merged = this.migrateLegacyIntroductionShape(merged);
    merged = this.migrateLegacyRoadmapShape(merged);
    merged = this.migrateLegacyPlatformCapabilitiesShape(merged);
    merged = this.migrateLegacyInstitutionalMessageShape(merged);
    merged = this.migrateLegacyLmisArchitectureShape(merged);
    for (const key of Object.keys(DEFAULT_LANDING_CONFIG)) {
      const expectedLength = ARRAY_FIELD_LENGTHS[key];
      const defaultValue = (DEFAULT_LANDING_CONFIG as Record<string, any>)[key];
      if (expectedLength !== undefined) {
        const raw = merged[key];
        if (!Array.isArray(raw) || raw.length !== expectedLength) {
          merged[key] = defaultValue;
        } else if (OBJECT_ARRAY_FIELDS.includes(key)) {
          // Right length, but an individual item can still be an old
          // shape — repair each item against its positional default
          // rather than trusting the whole array just because the count
          // matches.
          merged[key] = raw.map((item: unknown, i: number) =>
            this.mergeItemWithDefault(item, defaultValue[i]),
          );
        }
      } else if (merged[key] == null || typeof merged[key] !== 'object') {
        merged[key] = defaultValue;
      }
    }
    return merged;
  }

  /** Read-time compatibility shim (deliberately not a one-time data
   * migration): a row saved before the Hero group was nested stores
   * `heroHeadline`/`heroSupport` at the top level instead of under a
   * `hero` key. Chosen over a migration script because it also covers any
   * LandingConfigVersion snapshot taken before this change — including
   * ones that don't exist yet — with no production write required. Only
   * fires when `hero` itself isn't already present; a row saved again
   * through the current admin UI always has a real `hero` key (the
   * Flutter client only ever sends the new nested shape), so this never
   * runs for it again. Falls back to DEFAULT_LANDING_CONFIG.hero per
   * sub-field, mirroring HeroConfig.fromJson's `legacyJson` handling on
   * the Dart side. */
  private migrateLegacyHeroShape(data: Record<string, any>): Record<string, any> {
    if (data.hero != null && typeof data.hero === 'object') return data;
    const { heroHeadline, heroSupport, ...rest } = data;
    if (heroHeadline == null && heroSupport == null) return data;
    return {
      ...rest,
      hero: {
        title: heroHeadline ?? DEFAULT_LANDING_CONFIG.hero.title,
        description: heroSupport ?? DEFAULT_LANDING_CONFIG.hero.description,
      },
    };
  }

  /** Read-time compatibility shim for the ValueProposition group (same
   * rationale as migrateLegacyHeroShape): a row saved before this group
   * was nested stores its 4 cards as a top-level `valueCards` array
   * instead of under `valueProposition.cards`. Also does the per-item
   * repair OBJECT_ARRAY_FIELDS applies to roadmap/ecosystemStakeholders,
   * reimplemented here because valueProposition.cards is no longer a
   * top-level key the generic loop in mergeWithDefaults can reach
   * directly. Prefers an already-nested `valueProposition.cards` over the
   * legacy flat key when both happen to be present. */
  private migrateLegacyValuePropositionShape(
    data: Record<string, any>,
  ): Record<string, any> {
    const defaultCards = DEFAULT_LANDING_CONFIG.valueProposition.cards;
    const nestedCards = data.valueProposition?.cards;
    const source = Array.isArray(nestedCards)
      ? nestedCards
      : Array.isArray(data.valueCards)
        ? data.valueCards
        : null;

    const { valueCards, ...rest } = data;
    if (source == null || source.length !== defaultCards.length) {
      return { ...rest, valueProposition: { cards: defaultCards } };
    }
    return {
      ...rest,
      valueProposition: {
        cards: source.map((item: unknown, i: number) =>
          this.mergeItemWithDefault(item, defaultCards[i]),
        ),
      },
    };
  }

  /** Read-time compatibility shim for the Introduction group (same
   * rationale as migrateLegacyHeroShape): a row saved before this group
   * was nested stores `aboutParagraphs`/`aboutPositioning` at the top
   * level instead of under an `introduction` key. Each field falls back
   * independently (per-field, not whole-object), same as
   * migrateLegacyHeroShape. `paragraphs` is a plain LocalizedText[] (not
   * structured objects like valueProposition.cards), so a wrong-length
   * array is replaced wholesale rather than repaired item-by-item — same
   * treatment ARRAY_FIELD_LENGTHS gives whyPillarKickers/
   * architecturePipeline/dataToIntelligencePipeline. Prefers an
   * already-nested `introduction` field over the legacy flat key when
   * both happen to be present. */
  private migrateLegacyIntroductionShape(
    data: Record<string, any>,
  ): Record<string, any> {
    const defaults = DEFAULT_LANDING_CONFIG.introduction;
    const nested = data.introduction;

    const nestedParagraphs = nested?.paragraphs;
    const paragraphsSource = Array.isArray(nestedParagraphs)
      ? nestedParagraphs
      : Array.isArray(data.aboutParagraphs)
        ? data.aboutParagraphs
        : null;
    const paragraphs =
      paragraphsSource != null && paragraphsSource.length === defaults.paragraphs.length
        ? paragraphsSource
        : defaults.paragraphs;

    const positioning =
      (nested != null && typeof nested === 'object' ? nested.positioning : undefined) ??
      data.aboutPositioning ??
      defaults.positioning;

    const { aboutParagraphs, aboutPositioning, ...rest } = data;
    return { ...rest, introduction: { paragraphs, positioning } };
  }

  /** Read-time compatibility shim for the Roadmap group — extra care
   * versus the other migrate* methods because the new nested key reuses
   * the exact name (`roadmap`) the old flat milestone ARRAY used, unlike
   * hero/valueProposition/introduction where old and new key names
   * differ. `data.roadmap` therefore has to be shape-checked (array =
   * old flat milestones, object = new nested {milestones, caption})
   * rather than just checked for presence. This is also the group whose
   * per-item repair matters most in practice: the live singleton row's
   * only populated fields are statusLine/roadmap/roadmapCaption, and its
   * roadmap items have `label`/`done` but no `description` — the exact
   * shape that first broke restoreVersion's strict DTO validation before
   * mergeItemWithDefault existed (see this method's dry-run coverage). */
  private migrateLegacyRoadmapShape(data: Record<string, any>): Record<string, any> {
    const defaults = DEFAULT_LANDING_CONFIG.roadmap;
    const rawRoadmap = data.roadmap;
    const isNestedObject =
      rawRoadmap != null && typeof rawRoadmap === 'object' && !Array.isArray(rawRoadmap);

    const nestedMilestones = isNestedObject ? rawRoadmap.milestones : undefined;
    const milestonesSource = Array.isArray(nestedMilestones)
      ? nestedMilestones
      : Array.isArray(rawRoadmap)
        ? rawRoadmap
        : null;
    const milestones =
      milestonesSource != null && milestonesSource.length === defaults.milestones.length
        ? milestonesSource.map((item: unknown, i: number) =>
            this.mergeItemWithDefault(item, defaults.milestones[i]),
          )
        : defaults.milestones;

    const caption = (isNestedObject ? rawRoadmap.caption : undefined) ??
      data.roadmapCaption ??
      defaults.caption;

    const { roadmapCaption, ...rest } = data;
    return { ...rest, roadmap: { milestones, caption } };
  }

  /** Read-time compatibility shim for the PlatformCapabilities group: a row
   * saved before this group was nested stores the 7-step "from data to
   * intelligence" pipeline as a top-level `dataToIntelligencePipeline`
   * array instead of under `platformCapabilities.items`. Unlike
   * migrateLegacyRoadmapShape, `platformCapabilities` is a brand-new key
   * name that never collided with the old flat key, so no
   * array-vs-object shape check is needed here — presence of the new key
   * alone distinguishes old from new. `items` is a plain LocalizedText[]
   * (not structured objects), so a wrong-length array is replaced
   * wholesale rather than repaired item-by-item, same treatment
   * migrateLegacyIntroductionShape gives `paragraphs`. */
  private migrateLegacyPlatformCapabilitiesShape(
    data: Record<string, any>,
  ): Record<string, any> {
    const defaults = DEFAULT_LANDING_CONFIG.platformCapabilities;
    const nestedItems = data.platformCapabilities?.items;
    const source = Array.isArray(nestedItems)
      ? nestedItems
      : Array.isArray(data.dataToIntelligencePipeline)
        ? data.dataToIntelligencePipeline
        : null;
    const items =
      source != null && source.length === defaults.items.length ? source : defaults.items;

    const { dataToIntelligencePipeline, ...rest } = data;
    return { ...rest, platformCapabilities: { items } };
  }

  /** Read-time compatibility shim for the InstitutionalMessage group: a row
   * saved before this group was nested stores the 5 stakeholder blocks as
   * a top-level `ecosystemStakeholders` array instead of under
   * `institutionalMessage.stakeholders`. Like migrateLegacyPlatformCapabilitiesShape
   * (and unlike migrateLegacyRoadmapShape), `institutionalMessage` is a
   * brand-new key name that never collided with the old flat key, so no
   * array-vs-object shape check is needed — presence of the new key alone
   * distinguishes old from new. `stakeholders` holds structured
   * `{title, body}` objects (not plain LocalizedText), so — like
   * migrateLegacyValuePropositionShape's cards — individual items are
   * repaired against their positional default via mergeItemWithDefault
   * rather than the whole array being replaced just because an old-shape
   * item is missing a sub-field. */
  private migrateLegacyInstitutionalMessageShape(
    data: Record<string, any>,
  ): Record<string, any> {
    const defaults = DEFAULT_LANDING_CONFIG.institutionalMessage;
    const nestedStakeholders = data.institutionalMessage?.stakeholders;
    const source = Array.isArray(nestedStakeholders)
      ? nestedStakeholders
      : Array.isArray(data.ecosystemStakeholders)
        ? data.ecosystemStakeholders
        : null;

    const { ecosystemStakeholders, ...rest } = data;
    if (source == null || source.length !== defaults.stakeholders.length) {
      return { ...rest, institutionalMessage: { stakeholders: defaults.stakeholders } };
    }
    return {
      ...rest,
      institutionalMessage: {
        stakeholders: source.map((item: unknown, i: number) =>
          this.mergeItemWithDefault(item, defaults.stakeholders[i]),
        ),
      },
    };
  }

  /** Read-time compatibility shim for the LmisArchitecture group: a row
   * saved before this group was nested stores the 6 architecture pipeline
   * steps as a top-level `architecturePipeline` array instead of under
   * `lmisArchitecture.steps`. Like migrateLegacyPlatformCapabilitiesShape
   * (and unlike migrateLegacyRoadmapShape), `lmisArchitecture` is a
   * brand-new key name that never collided with the old flat key, so no
   * array-vs-object shape check is needed — presence of the new key alone
   * distinguishes old from new. `steps` is a plain LocalizedText[] (not
   * structured objects), so a wrong-length array is replaced wholesale
   * rather than repaired item-by-item, same treatment
   * migrateLegacyPlatformCapabilitiesShape gives `items`. */
  private migrateLegacyLmisArchitectureShape(
    data: Record<string, any>,
  ): Record<string, any> {
    const defaults = DEFAULT_LANDING_CONFIG.lmisArchitecture;
    const nestedSteps = data.lmisArchitecture?.steps;
    const source = Array.isArray(nestedSteps)
      ? nestedSteps
      : Array.isArray(data.architecturePipeline)
        ? data.architecturePipeline
        : null;
    const steps =
      source != null && source.length === defaults.steps.length ? source : defaults.steps;

    const { architecturePipeline, ...rest } = data;
    return { ...rest, lmisArchitecture: { steps } };
  }

  /** Fills any key missing or null on [item] from [defaultItem] at the
   * same index — e.g. an old roadmap entry that has `label`/`done` but no
   * `description` gets `description` from the current default for that
   * position. Falls back to the default item outright if [item] itself
   * isn't an object. */
  private mergeItemWithDefault(
    item: unknown,
    defaultItem: Record<string, any>,
  ): Record<string, any> {
    if (item == null || typeof item !== 'object') return defaultItem;
    const mergedItem: Record<string, any> = { ...(item as Record<string, any>) };
    for (const key of Object.keys(defaultItem)) {
      if (mergedItem[key] == null) {
        mergedItem[key] = defaultItem[key];
      }
    }
    return mergedItem;
  }

  private buildPreview(data: Record<string, any>): string {
    const statusLine = data?.statusLine ?? {};
    const text = (statusLine.en as string | undefined)?.trim()
      ? statusLine.en
      : (statusLine.fr as string | undefined) ?? '';
    return text.length > 60 ? `${text.slice(0, 60)}…` : text;
  }

  private async pruneVersions() {
    const stale = await this.prisma.landingConfigVersion.findMany({
      orderBy: { createdAt: 'desc' },
      skip: MAX_VERSIONS,
      select: { id: true },
    });
    if (stale.length) {
      await this.prisma.landingConfigVersion.deleteMany({
        where: { id: { in: stale.map((v) => v.id) } },
      });
    }
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
