// lib/screens/admin/landing_config_screen.dart
//
// SUPER_ADMIN-only editor for the public landing page copy (see
// lib/screens/landing_screen.dart). Backed by the singleton LandingConfig
// row (src/landing-config). Reached from Paramètres → "Page d'accueil
// publique", same pattern as RegionsSectorsScreen.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dsmo_app/core/i18n/l10n_ext.dart';
import '../../core/i18n/localized_text.dart';
import '../../data/api_client.dart';
import '../../models/landing_config.dart';
import '../../providers/landing_config_provider.dart';
import '../../theme/ultra_theme.dart';
import '../../widgets/admin_kit.dart';
import '../../widgets/public_chrome.dart';
import '../../widgets/responsive_helpers.dart';

// Positional LMIS pillars (Collect / Integrate / Analyse / Inform) —
// shown here so the admin can tell the 4 cards apart at a glance.
const _valueCardIcons = [
  Icons.assignment_outlined,
  Icons.account_tree_outlined,
  Icons.insights_outlined,
  Icons.policy_outlined,
];

class LandingConfigScreen extends ConsumerStatefulWidget {
  const LandingConfigScreen({super.key});

  @override
  ConsumerState<LandingConfigScreen> createState() =>
      _LandingConfigScreenState();
}

class _LandingConfigScreenState extends ConsumerState<LandingConfigScreen> {
  bool _loading = true;
  bool _saving = false;
  String? _error;
  DateTime? _updatedAt;
  String _previewLocale = 'fr';

  List<Map<String, dynamic>> _history = [];
  bool _historyLoading = false;
  String? _restoringId;

  final _statusLineFrCtrl = TextEditingController();
  final _statusLineEnCtrl = TextEditingController();
  final _heroDescriptionFrCtrl = TextEditingController();
  final _heroDescriptionEnCtrl = TextEditingController();
  final _captionFrCtrl = TextEditingController();
  final _captionEnCtrl = TextEditingController();
  final _aboutPositioningFrCtrl = TextEditingController();
  final _aboutPositioningEnCtrl = TextEditingController();
  final _ctaTitleFrCtrl = TextEditingController();
  final _ctaTitleEnCtrl = TextEditingController();
  final _ctaNoteFrCtrl = TextEditingController();
  final _ctaNoteEnCtrl = TextEditingController();
  final _accessNoteFrCtrl = TextEditingController();
  final _accessNoteEnCtrl = TextEditingController();
  final _heroTitleFrCtrl = TextEditingController();
  final _heroTitleEnCtrl = TextEditingController();

  final List<TextEditingController> _pillarKickerFrCtrls =
      List.generate(4, (_) => TextEditingController());
  final List<TextEditingController> _pillarKickerEnCtrls =
      List.generate(4, (_) => TextEditingController());

  final List<TextEditingController> _archStepFrCtrls =
      List.generate(6, (_) => TextEditingController());
  final List<TextEditingController> _archStepEnCtrls =
      List.generate(6, (_) => TextEditingController());

  final List<TextEditingController> _intelStepFrCtrls =
      List.generate(7, (_) => TextEditingController());
  final List<TextEditingController> _intelStepEnCtrls =
      List.generate(7, (_) => TextEditingController());

  final List<TextEditingController> _stakeTitleFrCtrls =
      List.generate(5, (_) => TextEditingController());
  final List<TextEditingController> _stakeTitleEnCtrls =
      List.generate(5, (_) => TextEditingController());
  final List<TextEditingController> _stakeBodyFrCtrls =
      List.generate(5, (_) => TextEditingController());
  final List<TextEditingController> _stakeBodyEnCtrls =
      List.generate(5, (_) => TextEditingController());

  static const _romanNumerals = ['I', 'II', 'III', 'IV'];
  final List<TextEditingController> _roadmapLabelFrCtrls =
      List.generate(4, (_) => TextEditingController());
  final List<TextEditingController> _roadmapLabelEnCtrls =
      List.generate(4, (_) => TextEditingController());
  final List<TextEditingController> _roadmapDescFrCtrls =
      List.generate(4, (_) => TextEditingController());
  final List<TextEditingController> _roadmapDescEnCtrls =
      List.generate(4, (_) => TextEditingController());
  final List<bool> _roadmapDone = List.filled(4, false);

  final List<TextEditingController> _valueTitleFrCtrls =
      List.generate(4, (_) => TextEditingController());
  final List<TextEditingController> _valueTitleEnCtrls =
      List.generate(4, (_) => TextEditingController());
  final List<TextEditingController> _valueBodyFrCtrls =
      List.generate(4, (_) => TextEditingController());
  final List<TextEditingController> _valueBodyEnCtrls =
      List.generate(4, (_) => TextEditingController());

  final List<TextEditingController> _aboutParaFrCtrls =
      List.generate(3, (_) => TextEditingController());
  final List<TextEditingController> _aboutParaEnCtrls =
      List.generate(3, (_) => TextEditingController());

  final _observatoryTitleFrCtrl = TextEditingController();
  final _observatoryTitleEnCtrl = TextEditingController();
  final _observatoryDescriptionFrCtrl = TextEditingController();
  final _observatoryDescriptionEnCtrl = TextEditingController();
  final List<TextEditingController> _observatoryIndicatorFrCtrls =
      List.generate(3, (_) => TextEditingController());
  final List<TextEditingController> _observatoryIndicatorEnCtrls =
      List.generate(3, (_) => TextEditingController());

  List<TextEditingController> get _allControllers => [
        _statusLineFrCtrl,
        _statusLineEnCtrl,
        _heroDescriptionFrCtrl,
        _heroDescriptionEnCtrl,
        _captionFrCtrl,
        _captionEnCtrl,
        _aboutPositioningFrCtrl,
        _aboutPositioningEnCtrl,
        _ctaTitleFrCtrl,
        _ctaTitleEnCtrl,
        _ctaNoteFrCtrl,
        _ctaNoteEnCtrl,
        _accessNoteFrCtrl,
        _accessNoteEnCtrl,
        _heroTitleFrCtrl,
        _heroTitleEnCtrl,
        ..._roadmapLabelFrCtrls,
        ..._roadmapLabelEnCtrls,
        ..._roadmapDescFrCtrls,
        ..._roadmapDescEnCtrls,
        ..._valueTitleFrCtrls,
        ..._valueTitleEnCtrls,
        ..._valueBodyFrCtrls,
        ..._valueBodyEnCtrls,
        ..._pillarKickerFrCtrls,
        ..._pillarKickerEnCtrls,
        ..._archStepFrCtrls,
        ..._archStepEnCtrls,
        ..._intelStepFrCtrls,
        ..._intelStepEnCtrls,
        ..._stakeTitleFrCtrls,
        ..._stakeTitleEnCtrls,
        ..._stakeBodyFrCtrls,
        ..._stakeBodyEnCtrls,
        ..._aboutParaFrCtrls,
        ..._aboutParaEnCtrls,
        _observatoryTitleFrCtrl,
        _observatoryTitleEnCtrl,
        _observatoryDescriptionFrCtrl,
        _observatoryDescriptionEnCtrl,
        ..._observatoryIndicatorFrCtrls,
        ..._observatoryIndicatorEnCtrls,
      ];

  @override
  void initState() {
    super.initState();
    _load();
    _loadHistory();
  }

  @override
  void dispose() {
    for (final c in _allControllers) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final raw = await api.getLandingConfig();
      final config = LandingConfig.fromJson(raw);
      if (!mounted) return;
      setState(() {
        _statusLineFrCtrl.text = config.statusLine.fr;
        _statusLineEnCtrl.text = config.statusLine.en;
        _heroDescriptionFrCtrl.text = config.hero.description.fr;
        _heroDescriptionEnCtrl.text = config.hero.description.en;
        _captionFrCtrl.text = config.roadmap.caption.fr;
        _captionEnCtrl.text = config.roadmap.caption.en;
        _aboutPositioningFrCtrl.text = config.introduction.positioning.fr;
        _aboutPositioningEnCtrl.text = config.introduction.positioning.en;
        _ctaTitleFrCtrl.text = config.ctaTitle.fr;
        _ctaTitleEnCtrl.text = config.ctaTitle.en;
        _ctaNoteFrCtrl.text = config.ctaNote.fr;
        _ctaNoteEnCtrl.text = config.ctaNote.en;
        _accessNoteFrCtrl.text = config.accessNote.fr;
        _accessNoteEnCtrl.text = config.accessNote.en;
        _heroTitleFrCtrl.text = config.hero.title.fr;
        _heroTitleEnCtrl.text = config.hero.title.en;
        for (var i = 0; i < 4; i++) {
          _roadmapLabelFrCtrls[i].text = config.roadmap.milestones[i].label.fr;
          _roadmapLabelEnCtrls[i].text = config.roadmap.milestones[i].label.en;
          _roadmapDescFrCtrls[i].text = config.roadmap.milestones[i].description.fr;
          _roadmapDescEnCtrls[i].text = config.roadmap.milestones[i].description.en;
          _roadmapDone[i] = config.roadmap.milestones[i].done;
          _valueTitleFrCtrls[i].text = config.valueProposition.cards[i].title.fr;
          _valueTitleEnCtrls[i].text = config.valueProposition.cards[i].title.en;
          _valueBodyFrCtrls[i].text = config.valueProposition.cards[i].body.fr;
          _valueBodyEnCtrls[i].text = config.valueProposition.cards[i].body.en;
          _pillarKickerFrCtrls[i].text = config.whyPillarKickers[i].fr;
          _pillarKickerEnCtrls[i].text = config.whyPillarKickers[i].en;
        }
        for (var i = 0; i < 6; i++) {
          _archStepFrCtrls[i].text = config.lmisArchitecture.steps[i].fr;
          _archStepEnCtrls[i].text = config.lmisArchitecture.steps[i].en;
        }
        for (var i = 0; i < 7; i++) {
          _intelStepFrCtrls[i].text = config.platformCapabilities.items[i].fr;
          _intelStepEnCtrls[i].text = config.platformCapabilities.items[i].en;
        }
        for (var i = 0; i < 5; i++) {
          _stakeTitleFrCtrls[i].text =
              config.institutionalMessage.stakeholders[i].title.fr;
          _stakeTitleEnCtrls[i].text =
              config.institutionalMessage.stakeholders[i].title.en;
          _stakeBodyFrCtrls[i].text =
              config.institutionalMessage.stakeholders[i].body.fr;
          _stakeBodyEnCtrls[i].text =
              config.institutionalMessage.stakeholders[i].body.en;
        }
        for (var i = 0; i < 3; i++) {
          _aboutParaFrCtrls[i].text = config.introduction.paragraphs[i].fr;
          _aboutParaEnCtrls[i].text = config.introduction.paragraphs[i].en;
          _observatoryIndicatorFrCtrls[i].text =
              config.observatory.indicators[i].fr;
          _observatoryIndicatorEnCtrls[i].text =
              config.observatory.indicators[i].en;
        }
        _observatoryTitleFrCtrl.text = config.observatory.title.fr;
        _observatoryTitleEnCtrl.text = config.observatory.title.en;
        _observatoryDescriptionFrCtrl.text = config.observatory.description.fr;
        _observatoryDescriptionEnCtrl.text = config.observatory.description.en;
        final updatedAt = raw['updatedAt'] as String?;
        _updatedAt = updatedAt != null ? DateTime.tryParse(updatedAt) : null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadHistory() async {
    setState(() => _historyLoading = true);
    try {
      final api = ref.read(apiClientProvider);
      final history = await api.getLandingConfigHistory();
      if (!mounted) return;
      setState(() => _history = history);
    } catch (_) {
      // History is a convenience, not core to the form — fail silently and
      // just show an empty list rather than blocking/erroring the screen.
    } finally {
      if (mounted) setState(() => _historyLoading = false);
    }
  }

  Future<void> _restore(String versionId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(context.l10n.landingConfigRestoreDialogTitle),
        content: Text(context.l10n.landingConfigRestoreDialogBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(context.l10n.cancelButton),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(context.l10n.landingConfigRestoreButton),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _restoringId = versionId);
    try {
      final api = ref.read(apiClientProvider);
      await api.restoreLandingConfigVersion(versionId);
      // The public page (if mounted elsewhere in this same app instance)
      // re-fetches immediately instead of waiting for its own next visit —
      // same reasoning as _save().
      ref.invalidate(landingConfigProvider);
      await _load();
      await _loadHistory();
      if (!mounted) return;
      showAdminToast(context, context.l10n.landingConfigVersionRestoredToast, UltraTheme.success,
          Icons.check_circle_outline_rounded);
    } catch (e) {
      if (!mounted) return;
      showAdminToast(context, context.l10n.landingConfigRestoreFailedToast(e.toString()),
          UltraTheme.error, Icons.error_outline_rounded);
    } finally {
      if (mounted) setState(() => _restoringId = null);
    }
  }

  LandingConfig get _draft => LandingConfig(
        statusLine: LocalizedText(
            fr: _statusLineFrCtrl.text, en: _statusLineEnCtrl.text),
        hero: HeroConfig(
          title: LocalizedText(
              fr: _heroTitleFrCtrl.text, en: _heroTitleEnCtrl.text),
          description: LocalizedText(
              fr: _heroDescriptionFrCtrl.text, en: _heroDescriptionEnCtrl.text),
        ),
        roadmap: RoadmapConfig(
          milestones: [
            for (var i = 0; i < 4; i++)
              RoadmapItemConfig(
                label: LocalizedText(
                    fr: _roadmapLabelFrCtrls[i].text,
                    en: _roadmapLabelEnCtrls[i].text),
                description: LocalizedText(
                    fr: _roadmapDescFrCtrls[i].text,
                    en: _roadmapDescEnCtrls[i].text),
                done: _roadmapDone[i],
              ),
          ],
          caption:
              LocalizedText(fr: _captionFrCtrl.text, en: _captionEnCtrl.text),
        ),
        valueProposition: ValuePropositionConfig(cards: [
          for (var i = 0; i < 4; i++)
            ValueCardConfig(
              title: LocalizedText(
                  fr: _valueTitleFrCtrls[i].text,
                  en: _valueTitleEnCtrls[i].text),
              body: LocalizedText(
                  fr: _valueBodyFrCtrls[i].text, en: _valueBodyEnCtrls[i].text),
            ),
        ]),
        whyPillarKickers: [
          for (var i = 0; i < 4; i++)
            LocalizedText(
                fr: _pillarKickerFrCtrls[i].text,
                en: _pillarKickerEnCtrls[i].text),
        ],
        lmisArchitecture: LmisArchitectureConfig(steps: [
          for (var i = 0; i < 6; i++)
            LocalizedText(
                fr: _archStepFrCtrls[i].text, en: _archStepEnCtrls[i].text),
        ]),
        platformCapabilities: PlatformCapabilitiesConfig(items: [
          for (var i = 0; i < 7; i++)
            LocalizedText(
                fr: _intelStepFrCtrls[i].text, en: _intelStepEnCtrls[i].text),
        ]),
        institutionalMessage: InstitutionalMessageConfig(stakeholders: [
          for (var i = 0; i < 5; i++)
            StakeholderConfig(
              title: LocalizedText(
                  fr: _stakeTitleFrCtrls[i].text,
                  en: _stakeTitleEnCtrls[i].text),
              body: LocalizedText(
                  fr: _stakeBodyFrCtrls[i].text, en: _stakeBodyEnCtrls[i].text),
            ),
        ]),
        introduction: IntroductionConfig(
          paragraphs: [
            for (var i = 0; i < 3; i++)
              LocalizedText(
                  fr: _aboutParaFrCtrls[i].text, en: _aboutParaEnCtrls[i].text),
          ],
          positioning: LocalizedText(
              fr: _aboutPositioningFrCtrl.text, en: _aboutPositioningEnCtrl.text),
        ),
        observatory: ObservatoryConfig(
          title: LocalizedText(
              fr: _observatoryTitleFrCtrl.text,
              en: _observatoryTitleEnCtrl.text),
          description: LocalizedText(
              fr: _observatoryDescriptionFrCtrl.text,
              en: _observatoryDescriptionEnCtrl.text),
          indicators: [
            for (var i = 0; i < 3; i++)
              LocalizedText(
                  fr: _observatoryIndicatorFrCtrls[i].text,
                  en: _observatoryIndicatorEnCtrls[i].text),
          ],
        ),
        ctaTitle:
            LocalizedText(fr: _ctaTitleFrCtrl.text, en: _ctaTitleEnCtrl.text),
        ctaNote:
            LocalizedText(fr: _ctaNoteFrCtrl.text, en: _ctaNoteEnCtrl.text),
        accessNote: LocalizedText(
            fr: _accessNoteFrCtrl.text, en: _accessNoteEnCtrl.text),
      );

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final response = await api.updateLandingConfig(_draft.toJson());
      // The public page (if mounted elsewhere in this same app instance)
      // re-fetches immediately instead of waiting for its own next visit.
      ref.invalidate(landingConfigProvider);
      if (!mounted) return;
      setState(() {
        final updatedAt = response['updatedAt'] as String?;
        _updatedAt = updatedAt != null ? DateTime.tryParse(updatedAt) : null;
      });
      showAdminToast(context, context.l10n.landingConfigUpdatedToast, UltraTheme.success,
          Icons.check_circle_outline_rounded);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
      showAdminToast(context, context.l10n.landingConfigSaveFailedToast(e.toString()),
          UltraTheme.error, Icons.error_outline_rounded);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: UltraTheme.background,
      appBar: AppBar(
        title: Text(context.l10n.landingConfigAppBarTitle,
            style: const TextStyle(fontWeight: FontWeight.w600)),
        backgroundColor: UltraTheme.surface,
        elevation: 0,
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 720),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        context.l10n.landingConfigDescriptionNote,
                        style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 13,
                            color: UltraTheme.textMuted),
                      ),
                      if (_updatedAt != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          context.l10n.landingConfigLastModifiedLabel(_formatDate(_updatedAt!)),
                          style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 12,
                              color: UltraTheme.textMuted),
                        ),
                      ],
                      const SizedBox(height: 20),
                      if (_error != null)
                        Container(
                          width: double.infinity,
                          margin: const EdgeInsets.only(bottom: 16),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: UltraTheme.error.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(_error!,
                              style: const TextStyle(
                                  color: UltraTheme.error, fontSize: 13)),
                        ),
                      _FormSection(
                        title: context.l10n.landingConfigStatusSectionTitle,
                        icon: Icons.account_balance_outlined,
                        children: [
                          _BilingualField(
                            label: context.l10n.landingConfigStatusLineFieldLabel,
                            frController: _statusLineFrCtrl,
                            enController: _statusLineEnCtrl,
                            maxLines: 2,
                            onChanged: () => setState(() {}),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _FormSection(
                        title: context.l10n.landingConfigHeroSectionTitle,
                        icon: Icons.title_outlined,
                        children: [
                          _BilingualField(
                            label: context.l10n.landingConfigMainTitleFieldLabel,
                            frController: _heroTitleFrCtrl,
                            enController: _heroTitleEnCtrl,
                            maxLines: 2,
                            onChanged: () => setState(() {}),
                          ),
                          const SizedBox(height: 10),
                          _BilingualField(
                            label: context.l10n.landingConfigSupportingLineFieldLabel,
                            frController: _heroDescriptionFrCtrl,
                            enController: _heroDescriptionEnCtrl,
                            maxLines: 2,
                            onChanged: () => setState(() {}),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _FormSection(
                        title: context.l10n.landingConfigComponentsSectionTitle,
                        icon: Icons.timeline_outlined,
                        children: [
                          for (var i = 0; i < 4; i++) ...[
                            if (i > 0) const Divider(height: 28),
                            _RoadmapItemEditor(
                              roman: _romanNumerals[i],
                              labelFrController: _roadmapLabelFrCtrls[i],
                              labelEnController: _roadmapLabelEnCtrls[i],
                              descFrController: _roadmapDescFrCtrls[i],
                              descEnController: _roadmapDescEnCtrls[i],
                              done: _roadmapDone[i],
                              onDoneChanged: (v) =>
                                  setState(() => _roadmapDone[i] = v),
                              onChanged: () => setState(() {}),
                            ),
                          ],
                          const Divider(height: 28),
                          _BilingualField(
                            label: context.l10n.landingConfigCaptionFieldLabel,
                            frController: _captionFrCtrl,
                            enController: _captionEnCtrl,
                            onChanged: () => setState(() {}),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _FormSection(
                        title: context.l10n.landingConfigPillarsSectionTitle,
                        icon: Icons.grid_view_outlined,
                        children: [
                          for (var i = 0; i < 4; i++) ...[
                            if (i > 0) const Divider(height: 28),
                            Row(children: [
                              Icon(_valueCardIcons[i],
                                  size: 16, color: UltraTheme.primary),
                              const SizedBox(width: 6),
                              Text(context.l10n.landingConfigCardIndexLabel(i + 1),
                                  style: const TextStyle(
                                      fontFamily: 'Inter',
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w700,
                                      color: UltraTheme.textMuted)),
                            ]),
                            const SizedBox(height: 8),
                            _BilingualField(
                              label: context.l10n.landingConfigKickerFieldLabel,
                              frController: _pillarKickerFrCtrls[i],
                              enController: _pillarKickerEnCtrls[i],
                              onChanged: () => setState(() {}),
                            ),
                            const SizedBox(height: 10),
                            _BilingualField(
                              label: context.l10n.landingConfigTitleFieldLabel,
                              frController: _valueTitleFrCtrls[i],
                              enController: _valueTitleEnCtrls[i],
                              onChanged: () => setState(() {}),
                            ),
                            const SizedBox(height: 10),
                            _BilingualField(
                              label: context.l10n.landingConfigTextFieldLabel,
                              frController: _valueBodyFrCtrls[i],
                              enController: _valueBodyEnCtrls[i],
                              maxLines: 2,
                              onChanged: () => setState(() {}),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 16),
                      _FormSection(
                        title: context.l10n.landingConfigArchSectionTitle,
                        icon: Icons.account_tree_outlined,
                        note: context.l10n.landingConfigArchSectionNote,
                        children: [
                          for (var i = 0; i < 6; i++) ...[
                            if (i > 0) const SizedBox(height: 10),
                            _BilingualField(
                              label: context.l10n.landingConfigStepIndexLabel(i + 1),
                              frController: _archStepFrCtrls[i],
                              enController: _archStepEnCtrls[i],
                              onChanged: () => setState(() {}),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 16),
                      _FormSection(
                        title: context.l10n.landingConfigIntelSectionTitle,
                        icon: Icons.insights_outlined,
                        children: [
                          for (var i = 0; i < 7; i++) ...[
                            if (i > 0) const SizedBox(height: 10),
                            _BilingualField(
                              label: context.l10n.landingConfigStepIndexLabel(i + 1),
                              frController: _intelStepFrCtrls[i],
                              enController: _intelStepEnCtrls[i],
                              onChanged: () => setState(() {}),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 16),
                      _FormSection(
                        title: context.l10n.landingConfigEcosystemSectionTitle,
                        icon: Icons.hub_outlined,
                        children: [
                          for (var i = 0; i < 5; i++) ...[
                            if (i > 0) const Divider(height: 28),
                            _BilingualField(
                              label: context.l10n.landingConfigBlockTitleFieldLabel(i + 1),
                              frController: _stakeTitleFrCtrls[i],
                              enController: _stakeTitleEnCtrls[i],
                              onChanged: () => setState(() {}),
                            ),
                            const SizedBox(height: 10),
                            _BilingualField(
                              label: context.l10n.landingConfigBlockTextFieldLabel(i + 1),
                              frController: _stakeBodyFrCtrls[i],
                              enController: _stakeBodyEnCtrls[i],
                              maxLines: 2,
                              onChanged: () => setState(() {}),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 16),
                      _FormSection(
                        title: context.l10n.landingConfigAboutSectionTitle,
                        icon: Icons.info_outline,
                        children: [
                          for (var i = 0; i < 3; i++) ...[
                            if (i > 0) const SizedBox(height: 14),
                            _BilingualField(
                              label: context.l10n.landingConfigParagraphIndexLabel(i + 1),
                              frController: _aboutParaFrCtrls[i],
                              enController: _aboutParaEnCtrls[i],
                              maxLines: 4,
                              onChanged: () => setState(() {}),
                            ),
                          ],
                          const Divider(height: 28),
                          _BilingualField(
                            label: context.l10n.landingAboutPositioningTitle,
                            frController: _aboutPositioningFrCtrl,
                            enController: _aboutPositioningEnCtrl,
                            maxLines: 3,
                            onChanged: () => setState(() {}),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _FormSection(
                        title: context.l10n.landingConfigObservatorySectionTitle,
                        icon: Icons.query_stats_outlined,
                        note: context.l10n.landingConfigObservatoryNote,
                        children: [
                          _BilingualField(
                            label: context.l10n.landingConfigTitleFieldLabel,
                            frController: _observatoryTitleFrCtrl,
                            enController: _observatoryTitleEnCtrl,
                            onChanged: () => setState(() {}),
                          ),
                          const SizedBox(height: 10),
                          _BilingualField(
                            label: context.l10n.landingConfigDescriptionFieldLabel,
                            frController: _observatoryDescriptionFrCtrl,
                            enController: _observatoryDescriptionEnCtrl,
                            maxLines: 3,
                            onChanged: () => setState(() {}),
                          ),
                          const Divider(height: 28),
                          for (var i = 0; i < 3; i++) ...[
                            if (i > 0) const SizedBox(height: 10),
                            _BilingualField(
                              label: context.l10n.landingConfigIndicatorIndexLabel(i + 1),
                              frController: _observatoryIndicatorFrCtrls[i],
                              enController: _observatoryIndicatorEnCtrls[i],
                              onChanged: () => setState(() {}),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 16),
                      _FormSection(
                        title: context.l10n.landingConfigCtaSectionTitle,
                        icon: Icons.campaign_outlined,
                        children: [
                          _BilingualField(
                            label: context.l10n.landingConfigTitleFieldLabel,
                            frController: _ctaTitleFrCtrl,
                            enController: _ctaTitleEnCtrl,
                            onChanged: () => setState(() {}),
                          ),
                          const SizedBox(height: 10),
                          _BilingualField(
                            label: context.l10n.landingConfigSubtextFieldLabel,
                            frController: _ctaNoteFrCtrl,
                            enController: _ctaNoteEnCtrl,
                            maxLines: 2,
                            onChanged: () => setState(() {}),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _FormSection(
                        title: context.l10n.landingConfigAccessSectionTitle,
                        icon: Icons.lock_outline_rounded,
                        children: [
                          _BilingualField(
                            label: context.l10n.landingConfigAccessNoteFieldLabel,
                            frController: _accessNoteFrCtrl,
                            enController: _accessNoteEnCtrl,
                            maxLines: 3,
                            onChanged: () => setState(() {}),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _FormSection(
                        title: context.l10n.landingConfigPreviewSectionTitle,
                        icon: Icons.visibility_outlined,
                        children: [
                          Row(
                            children: [
                              _LocaleChip(
                                label: context.l10n.landingConfigFrChipLabel,
                                selected: _previewLocale == 'fr',
                                onTap: () =>
                                    setState(() => _previewLocale = 'fr'),
                              ),
                              const SizedBox(width: 8),
                              _LocaleChip(
                                label: context.l10n.landingConfigEnChipLabel,
                                selected: _previewLocale == 'en',
                                onTap: () =>
                                    setState(() => _previewLocale = 'en'),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          _LivePreview(
                              config: _draft, locale: Locale(_previewLocale)),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _FormSection(
                        title: context.l10n.landingConfigHistorySectionTitle,
                        icon: Icons.history_outlined,
                        children: [
                          if (_historyLoading)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 8),
                              child: Center(
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2)),
                            )
                          else if (_history.isEmpty)
                            Text(
                              context.l10n.landingConfigNoHistoryMessage,
                              style: const TextStyle(
                                  fontFamily: 'Inter',
                                  fontSize: 13,
                                  color: UltraTheme.textMuted),
                            )
                          else
                            for (var i = 0; i < _history.length; i++) ...[
                              if (i > 0) const Divider(height: 20),
                              _HistoryEntry(
                                entry: _history[i],
                                restoring:
                                    _restoringId == _history[i]['id'],
                                onRestore: () =>
                                    _restore(_history[i]['id'] as String),
                              ),
                            ],
                        ],
                      ),
                      const SizedBox(height: 24),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton(
                          onPressed: _saving ? null : _save,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: UltraTheme.primary,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10)),
                          ),
                          child: _saving
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: Colors.white),
                                )
                              : Text(context.l10n.settingsSaveButton,
                                  style: const TextStyle(
                                      fontFamily: 'Inter',
                                      fontWeight: FontWeight.w600)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
    );
  }

  String _formatDate(DateTime d) {
    final local = d.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(local.day)}/${two(local.month)}/${local.year} à '
        '${two(local.hour)}:${two(local.minute)}';
  }
}

// ═══════════════════════════════════════════════════════════
// Form building blocks
// ═══════════════════════════════════════════════════════════

class _FormSection extends StatelessWidget {
  const _FormSection(
      {required this.title, required this.icon, required this.children, this.note});

  final String title;
  final IconData icon;
  final List<Widget> children;

  /// Optional banner shown under the title — for a section whose fields are
  /// still saved and validated but currently render nowhere on the public
  /// landing page, so an editor doesn't waste time on copy with no visible
  /// effect.
  final String? note;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, size: 18, color: UltraTheme.primary),
            const SizedBox(width: 8),
            Text(title,
                style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: UltraTheme.textPrimary)),
          ]),
          if (note != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: UltraTheme.warning.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: UltraTheme.warning.withValues(alpha: 0.3)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_outline, size: 15, color: UltraTheme.warning),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(note!,
                        style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 12,
                            height: 1.4,
                            color: UltraTheme.textSecondary)),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }
}

/// French + English text fields for one piece of content — side by side on
/// tablet/desktop, stacked on mobile (same breakpoint as the rest of the
/// admin area).
class _BilingualField extends StatelessWidget {
  const _BilingualField({
    required this.label,
    required this.frController,
    required this.enController,
    required this.onChanged,
    this.maxLines = 1,
  });

  final String label;
  final TextEditingController frController;
  final TextEditingController enController;
  final VoidCallback onChanged;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final frField = TextFormField(
      controller: frController,
      maxLines: maxLines,
      onChanged: (_) => onChanged(),
      decoration: InputDecoration(
        labelText: context.l10n.languageFrench,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        filled: true,
        fillColor: UltraTheme.background,
        isDense: true,
      ),
    );
    final enField = TextFormField(
      controller: enController,
      maxLines: maxLines,
      onChanged: (_) => onChanged(),
      decoration: InputDecoration(
        labelText: context.l10n.languageEnglish,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        filled: true,
        fillColor: UltraTheme.background,
        isDense: true,
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: UltraTheme.textPrimary)),
        const SizedBox(height: 8),
        if (context.isMobile)
          Column(children: [
            frField,
            const SizedBox(height: 10),
            enField,
          ])
        else
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: frField),
            const SizedBox(width: 12),
            Expanded(child: enField),
          ]),
      ],
    );
  }
}

class _RoadmapItemEditor extends StatelessWidget {
  const _RoadmapItemEditor({
    required this.roman,
    required this.labelFrController,
    required this.labelEnController,
    required this.descFrController,
    required this.descEnController,
    required this.done,
    required this.onDoneChanged,
    required this.onChanged,
  });

  final String roman;
  final TextEditingController labelFrController;
  final TextEditingController labelEnController;
  final TextEditingController descFrController;
  final TextEditingController descEnController;
  final bool done;
  final ValueChanged<bool> onDoneChanged;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Roman numeral — positional, not editable (matches the public
        // page, which always renders exactly 4 nodes in order).
        Container(
          width: 32,
          height: 32,
          margin: const EdgeInsets.only(top: 26),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: UltraTheme.primary.withValues(alpha: 0.08),
            shape: BoxShape.circle,
          ),
          child: Text(roman,
              style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: UltraTheme.primary)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _BilingualField(
                label: context.l10n.landingConfigComponentShortNameLabel(roman),
                frController: labelFrController,
                enController: labelEnController,
                onChanged: onChanged,
              ),
              const SizedBox(height: 10),
              _BilingualField(
                label: context.l10n.landingConfigComponentDescriptionLabel(roman),
                frController: descFrController,
                enController: descEnController,
                maxLines: 3,
                onChanged: onChanged,
              ),
              const SizedBox(height: 6),
              Row(children: [
                Switch(
                  value: done,
                  onChanged: onDoneChanged,
                  activeThumbColor: UltraTheme.success,
                ),
                const SizedBox(width: 4),
                Text(done ? context.l10n.landingCurrentSectionTitle : context.l10n.landingPlanned,
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color:
                            done ? UltraTheme.success : UltraTheme.textMuted)),
              ]),
            ],
          ),
        ),
      ],
    );
  }
}

/// One row in the "Historique" section — a pre-overwrite snapshot with its
/// date, a short text preview (see LandingConfigService.buildPreview), and
/// a Restaurer button.
class _HistoryEntry extends StatelessWidget {
  const _HistoryEntry({
    required this.entry,
    required this.restoring,
    required this.onRestore,
  });

  final Map<String, dynamic> entry;
  final bool restoring;
  final VoidCallback onRestore;

  String _formatDate(String iso) {
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return iso;
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(d.day)}/${two(d.month)}/${d.year} à ${two(d.hour)}:${two(d.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    final createdAt = entry['createdAt'] as String?;
    final preview = (entry['preview'] as String?)?.trim();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                createdAt != null ? _formatDate(createdAt) : '—',
                style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: UltraTheme.textPrimary),
              ),
              const SizedBox(height: 4),
              Text(
                (preview == null || preview.isEmpty) ? '—' : preview,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12.5,
                    color: UltraTheme.textMuted),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        SizedBox(
          height: 32,
          child: OutlinedButton(
            onPressed: restoring ? null : onRestore,
            style: OutlinedButton.styleFrom(
              foregroundColor: UltraTheme.primary,
              side: const BorderSide(color: UltraTheme.primary),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              shape:
                  RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: restoring
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(context.l10n.landingConfigRestoreButton,
                    style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }
}

class _LocaleChip extends StatelessWidget {
  const _LocaleChip(
      {required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected
              ? UltraTheme.primary.withValues(alpha: 0.1)
              : Colors.transparent,
          border: Border.all(
              color: selected
                  ? UltraTheme.primary
                  : UltraTheme.textMuted.withValues(alpha: 0.3)),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(label,
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: selected ? UltraTheme.primary : UltraTheme.textMuted)),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// Live preview — a compact status + component strip, kept independent
// so editing this admin screen can never break the public page.
// ═══════════════════════════════════════════════════════════

class _LivePreview extends StatelessWidget {
  const _LivePreview({required this.config, required this.locale});

  final LandingConfig config;
  final Locale locale;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      decoration: BoxDecoration(
        color: PublicColors.bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: PublicColors.gray200),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: PublicColors.greenLight,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: PublicColors.greenMid),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.account_balance_outlined,
                    size: 14, color: PublicColors.green),
                const SizedBox(width: 7),
                Flexible(
                  child: Text(
                    config.statusLine.of(locale).isEmpty
                        ? '—'
                        : config.statusLine.of(locale),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: PublicColors.greenDark),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < config.roadmap.milestones.length; i++) ...[
                if (i > 0)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 13),
                      child:
                          Container(height: 2, color: PublicColors.gray200),
                    ),
                  ),
                _PreviewNode(
                  roman: const ['I', 'II', 'III', 'IV'][i],
                  label: config.roadmap.milestones[i].label.of(locale),
                  done: config.roadmap.milestones[i].done,
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Text(
            config.roadmap.caption.of(locale).isEmpty
                ? '—'
                : config.roadmap.caption.of(locale),
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontSize: 11.5,
                color: PublicColors.gray500,
                fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}

class _PreviewNode extends StatelessWidget {
  const _PreviewNode(
      {required this.roman, required this.label, required this.done});

  final String roman;
  final String label;
  final bool done;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 84,
      child: Column(
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: done ? PublicColors.green : Colors.white,
              border: Border.all(
                  color: done ? PublicColors.green : PublicColors.gray400,
                  width: 1.5),
            ),
            child: Text(roman,
                style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: done ? Colors.white : PublicColors.gray500)),
          ),
          const SizedBox(height: 6),
          Text(
            label.isEmpty ? '—' : label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: done ? FontWeight.w700 : FontWeight.w500,
              color: done ? PublicColors.greenDark : PublicColors.gray500,
              height: 1.15,
            ),
          ),
        ],
      ),
    );
  }
}
