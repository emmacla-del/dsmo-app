// lib/models/landing_config.dart
//
// Super-Admin-controlled content for the public landing page (see
// LandingScreen). Covers narrative programme copy: status line, hero,
// roadmap/components, LMIS pillars, architecture and data-to-intelligence
// pipeline steps, ecosystem/stakeholder blocks, programme purpose
// paragraphs, positioning, CTA. Structural chrome (section titles, nav
// labels, roman numerals) stays in l10n; every field below that mirrors an
// l10n string is used as that string's live-editable override, falling
// back to the l10n default when left empty (see LandingScreen's
// `_orFallback`).
//
// MID-RESTRUCTURE: fields are being regrouped one group at a time from a
// flat shape into nested config classes (HeroConfig first — see its own
// doc comment). Each regrouped field keeps a read-time compatibility shim
// in its fromJson (not a one-time DB migration) so a row saved before its
// group was nested still resolves correctly — see HeroConfig.fromJson's
// `legacyJson` parameter for the pattern the remaining groups will follow.

import '../core/i18n/localized_text.dart';

/// The hero band's editable content — the first group moved from
/// LandingConfig's flat shape into a nested one (see the class-level
/// migration note on [LandingConfig.fromJson]). `title` was `heroHeadline`
/// and `description` was `heroSupport` before this restructure.
class HeroConfig {
  final LocalizedText title;
  final LocalizedText description;

  const HeroConfig({required this.title, required this.description});

  /// Parses the nested `hero` object. [legacyJson] is the *root* config
  /// JSON (not `hero` itself) — read-time compatibility shim for rows
  /// saved before this restructure, which stored these two fields as
  /// top-level `heroHeadline`/`heroSupport` keys instead. Only consulted
  /// when `hero` itself is absent; once a row is saved again through the
  /// current admin UI it has a real `hero` key and this branch never runs
  /// for it again.
  factory HeroConfig.fromJson(
    Map<String, dynamic>? json, {
    required Map<String, dynamic> legacyJson,
    required HeroConfig fallback,
  }) {
    if (json != null) {
      return HeroConfig(
        title: LocalizedText.fromJson(
          json['title'] as Map<String, dynamic>?,
          fallback: fallback.title,
        ),
        description: LocalizedText.fromJson(
          json['description'] as Map<String, dynamic>?,
          fallback: fallback.description,
        ),
      );
    }
    return HeroConfig(
      title: LocalizedText.fromJson(
        legacyJson['heroHeadline'] as Map<String, dynamic>?,
        fallback: fallback.title,
      ),
      description: LocalizedText.fromJson(
        legacyJson['heroSupport'] as Map<String, dynamic>?,
        fallback: fallback.description,
      ),
    );
  }

  Map<String, dynamic> toJson() =>
      {'title': title.toJson(), 'description': description.toJson()};
}

class RoadmapItemConfig {
  final LocalizedText label;
  final LocalizedText description;
  final bool done;

  const RoadmapItemConfig({
    required this.label,
    required this.description,
    required this.done,
  });

  factory RoadmapItemConfig.fromJson(
    Map<String, dynamic> json, {
    required RoadmapItemConfig fallback,
  }) {
    return RoadmapItemConfig(
      label: LocalizedText.fromJson(
        json['label'] as Map<String, dynamic>?,
        fallback: fallback.label,
      ),
      description: LocalizedText.fromJson(
        json['description'] as Map<String, dynamic>?,
        fallback: fallback.description,
      ),
      done: json['done'] as bool? ?? fallback.done,
    );
  }

  Map<String, dynamic> toJson() => {
        'label': label.toJson(),
        'description': description.toJson(),
        'done': done,
      };
}

/// The programme roadmap band's editable content — wraps the existing 4
/// [RoadmapItemConfig] milestones (Components I–IV) plus the caption
/// shown alongside them. `milestones` was the top-level `roadmap` array
/// and `caption` was `roadmapCaption` before this restructure (see the
/// class-level migration note on [LandingConfig.fromJson]). Nested here
/// because `roadmapCaption` is never referenced independently of the
/// roadmap items anywhere in the app — both landing_screen.dart usages
/// sit right beside a roadmap iteration, and the admin editor already
/// groups them in one form section.
class RoadmapConfig {
  final List<RoadmapItemConfig> milestones;
  final LocalizedText caption;

  const RoadmapConfig({required this.milestones, required this.caption});

  /// Parses the nested `roadmap` object. [legacyJson] is the *root*
  /// config JSON — read-time compatibility shim for rows saved before
  /// this restructure, which stored the 4 items as a top-level `roadmap`
  /// ARRAY (not an object) and the caption as a separate top-level
  /// `roadmapCaption` key. [json] is null both when `roadmap` is absent
  /// *and* when it's still the old flat array — callers are expected to
  /// pass `legacyJson['roadmap']` through untouched in the latter case so
  /// this factory can fall back to it.
  factory RoadmapConfig.fromJson(
    Map<String, dynamic>? json, {
    required Map<String, dynamic> legacyJson,
    required RoadmapConfig fallback,
  }) {
    List<RoadmapItemConfig> parseMilestones(List<dynamic>? raw) {
      if (raw == null || raw.length != fallback.milestones.length) {
        return fallback.milestones;
      }
      return [
        for (var i = 0; i < fallback.milestones.length; i++)
          RoadmapItemConfig.fromJson(
            raw[i] as Map<String, dynamic>,
            fallback: fallback.milestones[i],
          ),
      ];
    }

    if (json != null) {
      return RoadmapConfig(
        milestones: parseMilestones(json['milestones'] as List<dynamic>?),
        caption: LocalizedText.fromJson(
          json['caption'] as Map<String, dynamic>?,
          fallback: fallback.caption,
        ),
      );
    }
    // The legacy top-level `roadmap` key held the milestone array itself
    // (not an object), so it's read directly here rather than via a
    // `['milestones']` lookup.
    return RoadmapConfig(
      milestones: parseMilestones(legacyJson['roadmap'] as List<dynamic>?),
      caption: LocalizedText.fromJson(
        legacyJson['roadmapCaption'] as Map<String, dynamic>?,
        fallback: fallback.caption,
      ),
    );
  }

  Map<String, dynamic> toJson() => {
        'milestones': [for (final m in milestones) m.toJson()],
        'caption': caption.toJson(),
      };
}

class ValueCardConfig {
  final LocalizedText title;
  final LocalizedText body;

  const ValueCardConfig({required this.title, required this.body});

  factory ValueCardConfig.fromJson(
    Map<String, dynamic> json, {
    required ValueCardConfig fallback,
  }) {
    return ValueCardConfig(
      title: LocalizedText.fromJson(
        json['title'] as Map<String, dynamic>?,
        fallback: fallback.title,
      ),
      body: LocalizedText.fromJson(
        json['body'] as Map<String, dynamic>?,
        fallback: fallback.body,
      ),
    );
  }

  Map<String, dynamic> toJson() => {'title': title.toJson(), 'body': body.toJson()};
}

/// The value-proposition cards band's editable content — wraps the 4
/// [ValueCardConfig] items (LMIS pillars Collect / Integrate / Analyse /
/// Inform) under one group. `cards` keeps its pre-restructure per-item
/// shape and positional pairing with `whyPillarKickers`/the admin
/// screen's icons unchanged — only the top-level grouping changed (see
/// the class-level migration note on [LandingConfig.fromJson]).
class ValuePropositionConfig {
  final List<ValueCardConfig> cards;

  const ValuePropositionConfig({required this.cards});

  /// Parses the nested `valueProposition` object. [legacyJson] is the
  /// *root* config JSON — read-time compatibility shim for rows saved
  /// before this restructure, which stored these 4 cards as a top-level
  /// `valueCards` array instead. Only consulted when `valueProposition`
  /// itself is absent; once a row is saved again through the current
  /// admin UI it has a real `valueProposition` key and this branch never
  /// runs for it again.
  factory ValuePropositionConfig.fromJson(
    Map<String, dynamic>? json, {
    required Map<String, dynamic> legacyJson,
    required ValuePropositionConfig fallback,
  }) {
    List<ValueCardConfig> parseCards(List<dynamic>? raw) {
      if (raw == null || raw.length != fallback.cards.length) return fallback.cards;
      return [
        for (var i = 0; i < fallback.cards.length; i++)
          ValueCardConfig.fromJson(
            raw[i] as Map<String, dynamic>,
            fallback: fallback.cards[i],
          ),
      ];
    }

    if (json != null) {
      return ValuePropositionConfig(cards: parseCards(json['cards'] as List<dynamic>?));
    }
    return ValuePropositionConfig(
      cards: parseCards(legacyJson['valueCards'] as List<dynamic>?),
    );
  }

  Map<String, dynamic> toJson() => {'cards': [for (final c in cards) c.toJson()]};
}

/// The platform-capabilities band's editable content — wraps the existing
/// 7-step "from data to intelligence" pipeline (collect, validate,
/// centralise, integrate, analyse, generate indicators, inform
/// decisions). `items` was the top-level `dataToIntelligencePipeline`
/// array before this restructure. Plain LocalizedText items (not
/// structured objects like [ValuePropositionConfig]'s cards), so a
/// wrong-length array is replaced wholesale rather than repaired
/// item-by-item — same treatment [IntroductionConfig]'s paragraphs get.
class PlatformCapabilitiesConfig {
  final List<LocalizedText> items;

  const PlatformCapabilitiesConfig({required this.items});

  /// Parses the nested `platformCapabilities` object. [legacyJson] is the
  /// *root* config JSON — read-time compatibility shim for rows saved
  /// before this restructure, which stored these 7 items as a top-level
  /// `dataToIntelligencePipeline` array instead. `platformCapabilities`
  /// doesn't reuse that old key's name, so unlike [RoadmapConfig] no
  /// array-vs-object shape check is needed here — presence of the new key
  /// alone distinguishes old from new.
  factory PlatformCapabilitiesConfig.fromJson(
    Map<String, dynamic>? json, {
    required Map<String, dynamic> legacyJson,
    required PlatformCapabilitiesConfig fallback,
  }) {
    List<LocalizedText> parseItems(List<dynamic>? raw) {
      if (raw == null || raw.length != fallback.items.length) return fallback.items;
      return [
        for (var i = 0; i < fallback.items.length; i++)
          LocalizedText.fromJson(
            raw[i] as Map<String, dynamic>,
            fallback: fallback.items[i],
          ),
      ];
    }

    if (json != null) {
      return PlatformCapabilitiesConfig(items: parseItems(json['items'] as List<dynamic>?));
    }
    return PlatformCapabilitiesConfig(
      items: parseItems(legacyJson['dataToIntelligencePipeline'] as List<dynamic>?),
    );
  }

  Map<String, dynamic> toJson() => {'items': [for (final i in items) i.toJson()]};
}

/// The LMIS-architecture band's editable content — wraps the 6 pipeline
/// steps, in order: data sources, collection, integration, analysis,
/// intelligence, decision-making. `steps` was the top-level
/// `architecturePipeline` array before this restructure. Plain
/// LocalizedText items (not structured objects), so a wrong-length array
/// is replaced wholesale rather than repaired item-by-item — same
/// treatment [PlatformCapabilitiesConfig]'s items get.
class LmisArchitectureConfig {
  final List<LocalizedText> steps;

  const LmisArchitectureConfig({required this.steps});

  /// Parses the nested `lmisArchitecture` object. [legacyJson] is the
  /// *root* config JSON — read-time compatibility shim for rows saved
  /// before this restructure, which stored these 6 steps as a top-level
  /// `architecturePipeline` array instead. `lmisArchitecture` doesn't
  /// reuse that old key's name, so unlike [RoadmapConfig] no
  /// array-vs-object shape check is needed here — presence of the new key
  /// alone distinguishes old from new.
  factory LmisArchitectureConfig.fromJson(
    Map<String, dynamic>? json, {
    required Map<String, dynamic> legacyJson,
    required LmisArchitectureConfig fallback,
  }) {
    List<LocalizedText> parseSteps(List<dynamic>? raw) {
      if (raw == null || raw.length != fallback.steps.length) return fallback.steps;
      return [
        for (var i = 0; i < fallback.steps.length; i++)
          LocalizedText.fromJson(
            raw[i] as Map<String, dynamic>,
            fallback: fallback.steps[i],
          ),
      ];
    }

    if (json != null) {
      return LmisArchitectureConfig(steps: parseSteps(json['steps'] as List<dynamic>?));
    }
    return LmisArchitectureConfig(
      steps: parseSteps(legacyJson['architecturePipeline'] as List<dynamic>?),
    );
  }

  Map<String, dynamic> toJson() => {'steps': [for (final s in steps) s.toJson()]};
}

/// Title + body pair for one ecosystem/stakeholder block (Government,
/// Employment services, Skills institutions, Employers, Researchers).
/// Structurally identical to [ValueCardConfig] — kept as its own class
/// (rather than reusing ValueCardConfig) so the two lists can't be
/// accidentally cross-wired despite sharing a shape today.
class StakeholderConfig {
  final LocalizedText title;
  final LocalizedText body;

  const StakeholderConfig({required this.title, required this.body});

  factory StakeholderConfig.fromJson(
    Map<String, dynamic> json, {
    required StakeholderConfig fallback,
  }) {
    return StakeholderConfig(
      title: LocalizedText.fromJson(
        json['title'] as Map<String, dynamic>?,
        fallback: fallback.title,
      ),
      body: LocalizedText.fromJson(
        json['body'] as Map<String, dynamic>?,
        fallback: fallback.body,
      ),
    );
  }

  Map<String, dynamic> toJson() => {'title': title.toJson(), 'body': body.toJson()};
}

/// The institutional-ecosystem band's editable content — wraps the 5
/// [StakeholderConfig] blocks (government, employment services, skills
/// institutions, employers, researchers). `stakeholders` was the
/// top-level `ecosystemStakeholders` array before this restructure.
/// Structured objects (not plain LocalizedText, like
/// [PlatformCapabilitiesConfig]'s items), so per-item repair of a
/// stale sub-field happens server-side (see
/// OBJECT_ARRAY_FIELDS/mergeItemWithDefault) — same treatment
/// [RoadmapConfig]'s milestones and [ValuePropositionConfig]'s cards get.
class InstitutionalMessageConfig {
  final List<StakeholderConfig> stakeholders;

  const InstitutionalMessageConfig({required this.stakeholders});

  /// Parses the nested `institutionalMessage` object. [legacyJson] is the
  /// *root* config JSON — read-time compatibility shim for rows saved
  /// before this restructure, which stored these 5 blocks as a top-level
  /// `ecosystemStakeholders` array instead. `institutionalMessage` doesn't
  /// reuse that old key's name, so unlike [RoadmapConfig] no
  /// array-vs-object shape check is needed here — presence of the new key
  /// alone distinguishes old from new.
  factory InstitutionalMessageConfig.fromJson(
    Map<String, dynamic>? json, {
    required Map<String, dynamic> legacyJson,
    required InstitutionalMessageConfig fallback,
  }) {
    List<StakeholderConfig> parseStakeholders(List<dynamic>? raw) {
      if (raw == null || raw.length != fallback.stakeholders.length) {
        return fallback.stakeholders;
      }
      return [
        for (var i = 0; i < fallback.stakeholders.length; i++)
          StakeholderConfig.fromJson(
            raw[i] as Map<String, dynamic>,
            fallback: fallback.stakeholders[i],
          ),
      ];
    }

    if (json != null) {
      return InstitutionalMessageConfig(
        stakeholders: parseStakeholders(json['stakeholders'] as List<dynamic>?),
      );
    }
    return InstitutionalMessageConfig(
      stakeholders: parseStakeholders(legacyJson['ecosystemStakeholders'] as List<dynamic>?),
    );
  }

  Map<String, dynamic> toJson() =>
      {'stakeholders': [for (final s in stakeholders) s.toJson()]};
}

/// The programme-introduction band's editable content — `paragraphs` was
/// `aboutParagraphs` and `positioning` was `aboutPositioning` before this
/// restructure (see the class-level migration note on
/// [LandingConfig.fromJson]).
class IntroductionConfig {
  final List<LocalizedText> paragraphs;
  final LocalizedText positioning;

  const IntroductionConfig({required this.paragraphs, required this.positioning});

  /// Parses the nested `introduction` object. [legacyJson] is the *root*
  /// config JSON — read-time compatibility shim for rows saved before this
  /// restructure, which stored these two fields as top-level
  /// `aboutParagraphs`/`aboutPositioning` keys instead. Each field falls
  /// back independently (per-field, not whole-object), same as
  /// [HeroConfig.fromJson]. `paragraphs` is a plain LocalizedText list (not
  /// structured objects like [ValuePropositionConfig]'s cards), so a
  /// wrong-length array is replaced wholesale rather than repaired
  /// item-by-item.
  factory IntroductionConfig.fromJson(
    Map<String, dynamic>? json, {
    required Map<String, dynamic> legacyJson,
    required IntroductionConfig fallback,
  }) {
    List<LocalizedText> parseParagraphs(List<dynamic>? raw) {
      if (raw == null || raw.length != fallback.paragraphs.length) {
        return fallback.paragraphs;
      }
      return [
        for (var i = 0; i < fallback.paragraphs.length; i++)
          LocalizedText.fromJson(
            raw[i] as Map<String, dynamic>,
            fallback: fallback.paragraphs[i],
          ),
      ];
    }

    if (json != null) {
      return IntroductionConfig(
        paragraphs: parseParagraphs(json['paragraphs'] as List<dynamic>?),
        positioning: LocalizedText.fromJson(
          json['positioning'] as Map<String, dynamic>?,
          fallback: fallback.positioning,
        ),
      );
    }
    return IntroductionConfig(
      paragraphs: parseParagraphs(legacyJson['aboutParagraphs'] as List<dynamic>?),
      positioning: LocalizedText.fromJson(
        legacyJson['aboutPositioning'] as Map<String, dynamic>?,
        fallback: fallback.positioning,
      ),
    );
  }

  Map<String, dynamic> toJson() => {
        'paragraphs': [for (final p in paragraphs) p.toJson()],
        'positioning': positioning.toJson(),
      };
}

/// The public "/observatory" page's editable content — a brand-new group
/// with no prior flat-key existence (unlike hero/roadmap/etc.), so unlike
/// most other groups this factory takes no `legacyJson` param: a config
/// saved before this field existed simply lacks the whole `observatory`
/// key, and the top-level `LandingConfig.fromJson` below already falls
/// back to [LandingConfig.defaults]'s value for a missing/malformed group.
/// Content is placeholder pending real Super-Admin-authored copy — see the
/// "in preparation" badge on ObservatoryScreen and the admin editor's note
/// banner for this section.
class ObservatoryConfig {
  final LocalizedText title;
  final LocalizedText description;

  /// Always exactly 3 items — short placeholder teasers for what the
  /// eventual public observatory will cover.
  final List<LocalizedText> indicators;

  const ObservatoryConfig({
    required this.title,
    required this.description,
    required this.indicators,
  });

  factory ObservatoryConfig.fromJson(
    Map<String, dynamic>? json, {
    required ObservatoryConfig fallback,
  }) {
    List<LocalizedText> parseIndicators(List<dynamic>? raw) {
      if (raw == null || raw.length != fallback.indicators.length) {
        return fallback.indicators;
      }
      return [
        for (var i = 0; i < fallback.indicators.length; i++)
          LocalizedText.fromJson(
            raw[i] as Map<String, dynamic>,
            fallback: fallback.indicators[i],
          ),
      ];
    }

    if (json == null) return fallback;
    return ObservatoryConfig(
      title: LocalizedText.fromJson(
        json['title'] as Map<String, dynamic>?,
        fallback: fallback.title,
      ),
      description: LocalizedText.fromJson(
        json['description'] as Map<String, dynamic>?,
        fallback: fallback.description,
      ),
      indicators: parseIndicators(json['indicators'] as List<dynamic>?),
    );
  }

  Map<String, dynamic> toJson() => {
        'title': title.toJson(),
        'description': description.toJson(),
        'indicators': [for (final i in indicators) i.toJson()],
      };
}

class LandingConfig {
  final LocalizedText statusLine;
  final HeroConfig hero;

  /// Always exactly 4 milestones — Components I–IV. The roman numeral
  /// shown for each is positional (index 0 = "I", ...); label,
  /// description and done/planned status are remotely configurable.
  final RoadmapConfig roadmap;

  /// Cards mapped to the LMIS pillars Collect / Integrate / Analyse /
  /// Inform (title and body) — always exactly 4 items.
  final ValuePropositionConfig valueProposition;

  /// Always exactly 4 items — the short kicker word shown above each
  /// pillar's title in [valueProposition]'s cards (index-aligned:
  /// 0=Collect, 1=Integrate, 2=Analyse, 3=Inform).
  final List<LocalizedText> whyPillarKickers;

  final LmisArchitectureConfig lmisArchitecture;

  final PlatformCapabilitiesConfig platformCapabilities;

  final InstitutionalMessageConfig institutionalMessage;

  final IntroductionConfig introduction;

  final ObservatoryConfig observatory;

  final LocalizedText ctaTitle;
  final LocalizedText ctaNote;

  final LocalizedText accessNote;

  const LandingConfig({
    required this.statusLine,
    required this.hero,
    required this.roadmap,
    required this.valueProposition,
    required this.whyPillarKickers,
    required this.lmisArchitecture,
    required this.platformCapabilities,
    required this.institutionalMessage,
    required this.introduction,
    required this.observatory,
    required this.ctaTitle,
    required this.ctaNote,
    required this.accessNote,
  });

  /// Parses the `/public/landing-config` response. Any missing, malformed,
  /// or wrong-length field falls back to the matching [defaults] value
  /// field-by-field, so a partial edit on the backend can never blank out
  /// or crash the page.
  factory LandingConfig.fromJson(Map<String, dynamic> json) {
    final fallback = LandingConfig.defaults();

    List<T> fixedList<T>(
      String key,
      int length,
      List<T> defaultList,
      T Function(Map<String, dynamic> json, T fallback) itemFromJson,
    ) {
      final raw = json[key] as List<dynamic>?;
      if (raw == null || raw.length != length) return defaultList;
      return [
        for (var i = 0; i < length; i++)
          itemFromJson(raw[i] as Map<String, dynamic>, defaultList[i]),
      ];
    }

    return LandingConfig(
      statusLine: LocalizedText.fromJson(
        json['statusLine'] as Map<String, dynamic>?,
        fallback: fallback.statusLine,
      ),
      hero: HeroConfig.fromJson(
        json['hero'] as Map<String, dynamic>?,
        legacyJson: json,
        fallback: fallback.hero,
      ),
      // The old flat `roadmap` key held the milestone ARRAY itself (see
      // RoadmapConfig's migration note), so it can't be blind-cast to a
      // Map the way hero/valueProposition/introduction's legacy keys
      // could — checking `is Map` first avoids a cast exception when
      // `roadmap` is still that old array.
      roadmap: RoadmapConfig.fromJson(
        json['roadmap'] is Map<String, dynamic>
            ? json['roadmap'] as Map<String, dynamic>
            : null,
        legacyJson: json,
        fallback: fallback.roadmap,
      ),
      valueProposition: ValuePropositionConfig.fromJson(
        json['valueProposition'] as Map<String, dynamic>?,
        legacyJson: json,
        fallback: fallback.valueProposition,
      ),
      whyPillarKickers: fixedList(
        'whyPillarKickers',
        4,
        fallback.whyPillarKickers,
        (item, fb) => LocalizedText.fromJson(item, fallback: fb),
      ),
      lmisArchitecture: LmisArchitectureConfig.fromJson(
        json['lmisArchitecture'] as Map<String, dynamic>?,
        legacyJson: json,
        fallback: fallback.lmisArchitecture,
      ),
      platformCapabilities: PlatformCapabilitiesConfig.fromJson(
        json['platformCapabilities'] as Map<String, dynamic>?,
        legacyJson: json,
        fallback: fallback.platformCapabilities,
      ),
      institutionalMessage: InstitutionalMessageConfig.fromJson(
        json['institutionalMessage'] as Map<String, dynamic>?,
        legacyJson: json,
        fallback: fallback.institutionalMessage,
      ),
      introduction: IntroductionConfig.fromJson(
        json['introduction'] as Map<String, dynamic>?,
        legacyJson: json,
        fallback: fallback.introduction,
      ),
      observatory: ObservatoryConfig.fromJson(
        json['observatory'] as Map<String, dynamic>?,
        fallback: fallback.observatory,
      ),
      ctaTitle: LocalizedText.fromJson(
        json['ctaTitle'] as Map<String, dynamic>?,
        fallback: fallback.ctaTitle,
      ),
      ctaNote: LocalizedText.fromJson(
        json['ctaNote'] as Map<String, dynamic>?,
        fallback: fallback.ctaNote,
      ),
      accessNote: LocalizedText.fromJson(
        json['accessNote'] as Map<String, dynamic>?,
        fallback: fallback.accessNote,
      ),
    );
  }

  /// The `PUT /admin/landing-config` request body — always the whole
  /// config, matching that endpoint's replace-the-resource semantics.
  Map<String, dynamic> toJson() => {
        'statusLine': statusLine.toJson(),
        'hero': hero.toJson(),
        'roadmap': roadmap.toJson(),
        'valueProposition': valueProposition.toJson(),
        'whyPillarKickers': [for (final k in whyPillarKickers) k.toJson()],
        'lmisArchitecture': lmisArchitecture.toJson(),
        'platformCapabilities': platformCapabilities.toJson(),
        'institutionalMessage': institutionalMessage.toJson(),
        'introduction': introduction.toJson(),
        'observatory': observatory.toJson(),
        'ctaTitle': ctaTitle.toJson(),
        'ctaNote': ctaNote.toJson(),
        'accessNote': accessNote.toJson(),
      };

  /// Reproduces the hard-coded copy the landing page shipped with before
  /// this became Super-Admin-editable. Used whenever the config endpoint
  /// is unreachable, offline, or returns something malformed — the page
  /// must never break or go blank because of a bad remote value. Mirrors
  /// the current l10n strings for every field added after the LMIS
  /// redesign (heroHeadline, whyPillarKickers, architecturePipeline,
  /// dataToIntelligencePipeline, ecosystemStakeholders) so a fresh/offline
  /// load reads identically to before those fields existed.
  factory LandingConfig.defaults() {
    return const LandingConfig(
      statusLine: LocalizedText(
        fr:
            'Phase fondatrice · Composante I — collecte numérique des données du travail et de l\'emploi',
        en:
            'Foundation phase · Component I — digital labour and employment data collection',
      ),
      hero: HeroConfig(
        title: LocalizedText(
          fr:
              "Bâtir le système d'information sur le marché du travail du Cameroun",
          en: "Building Cameroon's Labour Market Information System",
        ),
        description: LocalizedText(
          fr:
              "CAMLEAP est le programme d'infrastructure numérique par lequel l'ONEFOP développe progressivement un système national de collecte, d'intégration, de gestion et d'analyse des informations sur le travail et l'emploi.",
          en:
              'CAMLEAP is the digital infrastructure programme through which ONEFOP is progressively developing a national system for collecting, integrating, managing and analysing labour and employment information.',
        ),
      ),
      roadmap: RoadmapConfig(milestones: [
        RoadmapItemConfig(
          label: LocalizedText(
              fr: 'Collecte numérique des données',
              en: 'Digital data collection'),
          description: LocalizedText(
            fr:
                "Digitalisation des instruments ONEFOP et DSMO et mise en place de l'infrastructure de données fondatrice du SIMT national. Composante actuellement mise en œuvre.",
            en:
                'Digitising ONEFOP and DSMO instruments and establishing the foundational data infrastructure required for the national LMIS. This component is the current implementation.',
          ),
          done: true,
        ),
        RoadmapItemConfig(
          label: LocalizedText(
              fr: 'Intégration et gestion des données',
              en: 'Data integration & management'),
          description: LocalizedText(
            fr:
                'Composante planifiée, destinée à relier les informations sur le marché du travail issues des sources et processus institutionnels concernés.',
            en:
                'Planned component, designed to connect labour-market information from relevant sources and institutional processes.',
          ),
          done: false,
        ),
        RoadmapItemConfig(
          label: LocalizedText(
              fr: 'Analytique du marché du travail',
              en: 'Labour-market analytics'),
          description: LocalizedText(
            fr:
                "Composante planifiée, destinée à transformer l'information structurée en indicateurs et en éléments de preuve sur le marché du travail.",
            en:
                'Planned component, designed to transform structured information into labour-market indicators and evidence.',
          ),
          done: false,
        ),
        RoadmapItemConfig(
          label: LocalizedText(
              fr: 'Intelligence et diffusion',
              en: 'Labour-market intelligence & dissemination'),
          description: LocalizedText(
            fr:
                "Composante planifiée, destinée à appuyer la diffusion de l'intelligence du marché du travail pour l'action publique et la décision.",
            en:
                'Planned component, designed to support dissemination of labour-market intelligence for policy and decision-making.',
          ),
          done: false,
        ),
      ], caption: LocalizedText(
          fr:
              'Composante I en cours de mise en œuvre · Composantes II–IV planifiées',
          en:
              'Component I currently being implemented · Components II–IV planned',
        ),
      ),
      valueProposition: ValuePropositionConfig(cards: [
        ValueCardConfig(
          title: LocalizedText(fr: 'Collecter', en: 'Collect'),
          body: LocalizedText(
            fr:
                'Digitaliser et standardiser la collecte des données sur le travail et l\'emploi.',
            en:
                'Digitise and standardise labour and employment data collection.',
          ),
        ),
        ValueCardConfig(
          title: LocalizedText(fr: 'Intégrer', en: 'Integrate'),
          body: LocalizedText(
            fr:
                'Relier progressivement les informations issues des sources et processus institutionnels concernés.',
            en:
                'Connect information from relevant sources and institutional processes.',
          ),
        ),
        ValueCardConfig(
          title: LocalizedText(fr: 'Analyser', en: 'Analyse'),
          body: LocalizedText(
            fr:
                "Transformer l'information structurée en indicateurs et en éléments de preuve sur le marché du travail.",
            en:
                'Transform structured information into labour-market indicators and evidence.',
          ),
        ),
        ValueCardConfig(
          title: LocalizedText(fr: 'Informer', en: 'Inform'),
          body: LocalizedText(
            fr:
                "Appuyer les politiques d'emploi, la planification, le suivi et la décision.",
            en:
                'Support employment policy, planning, monitoring and decision-making.',
          ),
        ),
      ]),
      whyPillarKickers: [
        LocalizedText(fr: 'Collecter', en: 'Collect'),
        LocalizedText(fr: 'Intégrer', en: 'Integrate'),
        LocalizedText(fr: 'Analyser', en: 'Analyse'),
        LocalizedText(fr: 'Informer', en: 'Inform'),
      ],
      lmisArchitecture: LmisArchitectureConfig(steps: [
        LocalizedText(fr: 'Sources de données', en: 'Data sources'),
        LocalizedText(fr: 'Collecte', en: 'Collection'),
        LocalizedText(fr: 'Intégration', en: 'Integration'),
        LocalizedText(fr: 'Analyse', en: 'Analysis'),
        LocalizedText(fr: 'Intelligence', en: 'Intelligence'),
        LocalizedText(fr: 'Décision', en: 'Decision-making'),
      ]),
      platformCapabilities: PlatformCapabilitiesConfig(items: [
        LocalizedText(fr: 'Collecter', en: 'Collect'),
        LocalizedText(fr: 'Valider', en: 'Validate'),
        LocalizedText(fr: 'Centraliser', en: 'Centralise'),
        LocalizedText(fr: 'Intégrer', en: 'Integrate'),
        LocalizedText(fr: 'Analyser', en: 'Analyse'),
        LocalizedText(
            fr: 'Produire des indicateurs', en: 'Generate indicators'),
        LocalizedText(fr: 'Éclairer les décisions', en: 'Inform decisions'),
      ]),
      institutionalMessage: InstitutionalMessageConfig(stakeholders: [
        StakeholderConfig(
          title: LocalizedText(
              fr: 'Gouvernement et décideurs',
              en: 'Government & policy makers'),
          body: LocalizedText(
            fr:
                "Conçu pour appuyer les politiques d'emploi, la planification et le suivi par des éléments de preuve.",
            en:
                'Designed to support evidence for employment policy, planning and monitoring.',
          ),
        ),
        StakeholderConfig(
          title: LocalizedText(
              fr: "Services de l'emploi", en: 'Employment services'),
          body: LocalizedText(
            fr:
                "Conçu pour appuyer une meilleure compréhension de l'offre, de la demande et des tendances de l'emploi.",
            en:
                'Designed to support a better understanding of labour supply, demand and employment trends.',
          ),
        ),
        StakeholderConfig(
          title: LocalizedText(
              fr: 'Établissements de formation',
              en: 'Skills & training institutions'),
          body: LocalizedText(
            fr:
                "Conçu pour appuyer l'adéquation entre le développement des compétences et les besoins du marché du travail.",
            en:
                'Designed to support alignment between skills development and labour-market needs.',
          ),
        ),
        StakeholderConfig(
          title: LocalizedText(
              fr: 'Employeurs et partenaires sociaux',
              en: 'Employers & social partners'),
          body: LocalizedText(
            fr:
                "Conçu pour appuyer une information fiable sur la dynamique de l'emploi et de la main-d'œuvre.",
            en:
                'Designed to support reliable information on workforce and employment dynamics.',
          ),
        ),
        StakeholderConfig(
          title: LocalizedText(
              fr: 'Chercheurs et analystes', en: 'Researchers & analysts'),
          body: LocalizedText(
            fr:
                "Conçu pour appuyer une information structurée sur le marché du travail, pour l'analyse et la recherche.",
            en:
                'Designed to support structured labour-market information for analysis and research.',
          ),
        ),
      ]),
      introduction: IntroductionConfig(
        paragraphs: [
          LocalizedText(
            fr:
                "Le Cameroun produit des informations sur le travail et l'emploi à travers plusieurs instruments, institutions et processus. CAMLEAP est développé pour transformer progressivement ces flux fragmentés en une infrastructure nationale d'information sur le marché du travail plus cohérente, fiable et exploitable.",
            en:
                'Cameroon generates labour and employment information through different instruments, institutions and processes. CAMLEAP is being developed to progressively transform these fragmented information flows into a more coherent, reliable and usable national labour-market information infrastructure.',
          ),
          LocalizedText(
            fr:
                "Le programme est structuré en quatre composantes séquentielles, de la collecte numérique à l'intégration, l'analytique et l'intelligence du marché du travail. La Composante I — digitalisation de la collecte des données ONEFOP et DSMO — est la mise en œuvre actuelle.",
            en:
                'The programme is structured in four sequential components, from digital data collection through integration, analytics and labour-market intelligence. Component I — digitalisation of ONEFOP and DSMO labour and employment data collection — is the current implementation.',
          ),
          LocalizedText(
            fr:
                "La mise en œuvre actuelle ne constitue ni un déploiement national du SIMT, ni une adoption institutionnelle, un transfert ou une licence de la plateforme. Ces questions seront déterminées par le MINEFOP.",
            en:
                'The current implementation does not constitute nationwide LMIS deployment, institutional adoption, transfer or licensing of the platform. Those questions will be determined by MINEFOP.',
          ),
        ],
        positioning: LocalizedText(
          fr:
              "Conçue à partir de l'expérience opérationnelle au sein du MINEFOP et alignée sur la Vision 2035, la SND30 et les exigences des partenaires au développement en matière d'audit des données.",
          en:
              'Designed from operational experience inside MINEFOP and aligned with Vision 2035, SND30 and the data-auditing requirements of development partners.',
        ),
      ),
      observatory: ObservatoryConfig(
        title: LocalizedText(
          fr: "L'Observatoire du marché du travail",
          en: 'The Labour Market Observatory',
        ),
        description: LocalizedText(
          fr:
              "L'Observatoire mettra à disposition du public des indicateurs sur le marché du travail camerounais, à mesure que les composantes du SIMT seront mises en œuvre. Son contenu est en cours de préparation.",
          en:
              'The Observatory will make labour-market indicators for Cameroon publicly available as LMIS components are implemented. Its content is currently in preparation.',
        ),
        indicators: [
          LocalizedText(fr: 'Emploi et chômage', en: 'Employment & unemployment'),
          LocalizedText(fr: 'Compétences et formation', en: 'Skills & training'),
          LocalizedText(
              fr: 'Salaires et conditions de travail',
              en: 'Wages & working conditions'),
        ],
      ),
      ctaTitle: LocalizedText(
        fr: 'Accéder à la plateforme CAMLEAP',
        en: 'Access the CAMLEAP platform',
      ),
      ctaNote: LocalizedText(
        fr:
            "Les services numériques de CAMLEAP sont progressivement mis à la disposition des utilisateurs autorisés et des institutions participantes, au fur et à mesure de la mise en œuvre des composantes du programme.",
        en:
            'CAMLEAP digital services are progressively being made available to authorised users and participating institutions as programme components are implemented.',
      ),
      accessNote: LocalizedText(
        fr:
            "L'accès est actuellement réservé aux utilisateurs institutionnels autorisés. Connectez-vous si vous disposez déjà d'un compte, ou demandez l'accès.",
        en:
            'Access is currently limited to authorised institutional users. Sign in if you already have credentials, or request access.',
      ),
    );
  }
}
