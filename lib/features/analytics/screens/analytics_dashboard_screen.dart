// lib/features/analytics/screens/analytics_dashboard_screen.dart
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:excel/excel.dart';
import 'package:share_plus/share_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';
// FIX: hide Granularity from dashboard_providers to resolve ambiguous_import.
// Granularity is defined in both time_series_data.dart and dashboard_providers.dart.
// We keep the one from time_series_data.dart as the canonical definition.
import '../providers/dashboard_providers.dart';
import '../models/dashboard_models.dart';
import '../models/time_series_data.dart';
import '../widgets/common_cards.dart';
import '../widgets/tab_bar_widget.dart';

class AnalyticsDashboardScreen extends ConsumerStatefulWidget {
  const AnalyticsDashboardScreen({super.key});

  @override
  ConsumerState<AnalyticsDashboardScreen> createState() =>
      _AnalyticsDashboardScreenState();
}

class _AnalyticsDashboardScreenState
    extends ConsumerState<AnalyticsDashboardScreen>
    with TickerProviderStateMixin {
  late final List<Animation<double>> _cardAnimations;

  @override
  void initState() {
    super.initState();
    _cardAnimations = [];
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _prepareAnimations(8);
  }

  void _prepareAnimations(int count) {
    if (_cardAnimations.length == count) return;
    _cardAnimations.clear();
    for (int i = 0; i < count; i++) {
      final controller = AnimationController(
        vsync: this,
        duration: Duration(milliseconds: 400 + (i * 40)),
      )..forward();
      _cardAnimations
          .add(CurvedAnimation(parent: controller, curve: Curves.easeOutCubic));
    }
  }

  @override
  void dispose() {
    for (final anim in _cardAnimations) {
      if (anim is AnimationController) anim.dispose();
    }
    super.dispose();
  }

  int get _startYear => ref.read(startYearProvider);
  int get _endYear => ref.read(endYearProvider);
  Granularity get _granularity => ref.read(granularityProvider);

  void _setStartYear(int year) {
    if (year > _endYear) return;
    ref.read(startYearProvider.notifier).state = year;
    _refreshAll();
  }

  void _setEndYear(int year) {
    if (year < _startYear) return;
    ref.read(endYearProvider.notifier).state = year;
    _refreshAll();
  }

  void _setGranularity(Granularity g) {
    if (_granularity == g) return;
    ref.read(granularityProvider.notifier).state = g;
    _refreshAll();
  }

  void _changeYear(int year) {
    ref.read(yearProvider.notifier).state = year;
    _refreshAll();
  }

  void _changeRegion(String? id, String? name) {
    ref.read(regionIdProvider.notifier).state = id;
    ref.read(regionNameProvider.notifier).state = name;
    _refreshAll();
  }

  void _clearRegion() => _changeRegion(null, null);

  void _refreshAll() {
    final year = ref.read(yearProvider);
    final regionId = ref.read(regionIdProvider);
    // FIX: read departmentId from its provider, just like regionId
    final departmentId = ref.read(departmentIdProvider);
    ref.invalidate(dashboardSummaryProvider(year));
    ref.invalidate(previousYearSummaryProvider(year));
    ref.invalidate(employmentTrendsProvider((
      startYear: _startYear,
      endYear: _endYear,
      regionId: regionId,
      // FIX: added missing departmentId argument
      departmentId: departmentId,
      granularity: _granularity,
    )));
    ref.invalidate(sectorsProvider(year));
    ref.invalidate(genderDistributionProvider(year));
  }

  @override
  Widget build(BuildContext context) {
    final year = ref.watch(yearProvider);
    final regionName = ref.watch(regionNameProvider);
    final regionId = ref.watch(regionIdProvider);
    // FIX: watch departmentId from its provider
    final departmentId = ref.watch(departmentIdProvider);

    final dashboardAsync = ref.watch(dashboardSummaryProvider(year));
    final prevAsync = ref.watch(previousYearSummaryProvider(year));
    final trendsAsync = ref.watch(employmentTrendsProvider((
      startYear: _startYear,
      endYear: _endYear,
      regionId: regionId,
      // FIX: added missing departmentId argument
      departmentId: departmentId,
      granularity: _granularity,
    )));
    final sectorsAsync = ref.watch(sectorsProvider(year));
    final genderAsync = ref.watch(genderDistributionProvider(year));
    final regionsAsync = ref.watch(regionsProvider);

    final isLoading = dashboardAsync.isLoading ||
        prevAsync.isLoading ||
        trendsAsync.isLoading ||
        sectorsAsync.isLoading ||
        genderAsync.isLoading;

    final error = dashboardAsync.error ??
        prevAsync.error ??
        trendsAsync.error ??
        sectorsAsync.error ??
        genderAsync.error;

    return Scaffold(
      backgroundColor: InkColor.base,
      body: NestedScrollView(
        headerSliverBuilder: (_, __) => [_appBar(regionName)],
        body: isLoading
            ? _skeleton()
            : error != null
                ? _errorState(error.toString())
                : RefreshIndicator(
                    onRefresh: () async => _refreshAll(),
                    color: AccentColor.teal,
                    backgroundColor: InkColor.card,
                    child: _body(
                      dashboard: dashboardAsync.requireValue,
                      previous: prevAsync.value,
                      trends: trendsAsync.requireValue,
                      sectors: sectorsAsync.requireValue,
                      gender: genderAsync.requireValue,
                      regions: regionsAsync.value ?? [],
                      cardAnimations: _cardAnimations,
                      onChangeYear: _changeYear,
                      onChangeRegion: _changeRegion,
                      onClearRegion: _clearRegion,
                      startYear: _startYear,
                      endYear: _endYear,
                      granularity: _granularity,
                      onStartYearChanged: _setStartYear,
                      onEndYearChanged: _setEndYear,
                      onGranularityChanged: _setGranularity,
                    ),
                  ),
      ),
    );
  }

  SliverAppBar _appBar(String? regionName) {
    return SliverAppBar(
      expandedHeight: 100,
      pinned: true,
      backgroundColor: InkColor.surface,
      foregroundColor: Colors.white,
      elevation: 0,
      actions: [
        IconButton(
          tooltip: 'Filtrer par région',
          icon: Stack(
            clipBehavior: Clip.none,
            children: [
              const Icon(Icons.tune_rounded, size: 20),
              if (regionName != null)
                Positioned(
                  right: -1,
                  top: -1,
                  child: Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                        color: AccentColor.gold, shape: BoxShape.circle),
                  ),
                ),
            ],
          ),
          onPressed: () => _showFilterSheet(),
        ),
        IconButton(
          tooltip: 'Exporter',
          icon: const Icon(Icons.download_rounded, size: 20),
          onPressed: _showExportDialog,
        ),
        const SizedBox(width: 4),
      ],
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.fromLTRB(20, 0, 0, 14),
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  margin: const EdgeInsets.only(right: 8),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AccentColor.teal,
                    boxShadow: [
                      BoxShadow(
                          color: AccentColor.teal.withAlpha(120), blurRadius: 6)
                    ],
                  ),
                ),
                Text('MINEFOP · Marché du travail',
                    style: textMono(11, color: TextColor.muted)),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              regionName ?? 'Cameroun national',
              style: GoogleFonts.dmSans(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white),
            ),
          ],
        ),
        background: Container(color: InkColor.surface),
      ),
    );
  }

  void _showFilterSheet() async {
    final regions = await ref.read(regionsProvider.future);
    if (!mounted) return;
    final selectedId = ref.read(regionIdProvider);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => FilterSheet(
        regions: regions
            .map((r) => RegionItem(
                r['id']?.toString() ?? '', r['name']?.toString() ?? ''))
            .toList(),
        selectedId: selectedId,
        onSelect: (id, name) {
          Navigator.pop(context);
          _changeRegion(id, name);
        },
        onClear: () {
          Navigator.pop(context);
          _clearRegion();
        },
      ),
    );
  }

  void _showExportDialog() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: InkColor.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Exporter',
            style: textMono(14,
                color: TextColor.primary, weight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ExportTile(
              icon: Icons.picture_as_pdf_rounded,
              color: AccentColor.rose,
              label: 'Rapport PDF',
              sub: 'Mise en page complète',
              onTap: () {
                Navigator.pop(context);
                _toast('Export PDF — bientôt disponible');
              },
            ),
            const SizedBox(height: 8),
            ExportTile(
              icon: Icons.table_chart_rounded,
              color: AccentColor.teal,
              label: 'Tableur Excel (.xlsx)',
              sub: 'KPIs + tendances + secteurs',
              onTap: () {
                Navigator.pop(context);
                _exportExcel();
              },
            ),
            const SizedBox(height: 8),
            ExportTile(
              icon: Icons.table_rows_rounded,
              color: AccentColor.blue,
              label: 'CSV brut',
              sub: 'Tendances emploi, séparées par virgule',
              onTap: () {
                Navigator.pop(context);
                _exportCsv();
              },
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Fermer', style: textMono(12, color: AccentColor.teal)),
          ),
        ],
      ),
    );
  }

  Future<void> _exportCsv() async {
    final year = ref.read(yearProvider);
    // FIX: added departmentId to both export provider calls
    final departmentId = ref.read(departmentIdProvider);
    final trends = ref
            .read(employmentTrendsProvider((
              startYear: _startYear,
              endYear: _endYear,
              regionId: ref.read(regionIdProvider),
              departmentId: departmentId,
              granularity: _granularity,
            )))
            .value ??
        [];

    final buffer = StringBuffer();
    buffer.writeln('Période,Label,Effectif total');
    for (final t in trends) {
      buffer.writeln('"${t.period}","${t.label}",${t.totalEmployees}');
    }

    final dashboard = ref.read(dashboardSummaryProvider(year)).value;
    if (dashboard != null) {
      buffer.writeln('');
      buffer.writeln('KPI,Valeur');
      buffer.writeln('Année,${dashboard.year}');
      buffer.writeln('Effectif total,${dashboard.totalEmployees}');
      buffer.writeln('Déclarations,${dashboard.totalDeclarations}');
      buffer.writeln('Recrutements,${dashboard.totalRecruitments}');
      buffer.writeln('Départs,${dashboard.totalDismissals}');
      buffer.writeln('Retraites,${dashboard.totalRetirements}');
      buffer.writeln('Variation nette,${dashboard.netChange}');
    }

    final bytes = Uint8List.fromList(buffer.toString().codeUnits);
    await _shareFile(bytes, 'dsmo_export_$year.csv', 'text/csv');
  }

  Future<void> _exportExcel() async {
    final year = ref.read(yearProvider);
    final dashboard = ref.read(dashboardSummaryProvider(year)).value;
    final sectors = ref.read(sectorsProvider(year)).value ?? [];
    // FIX: added departmentId to export provider call
    final departmentId = ref.read(departmentIdProvider);
    final trends = ref
            .read(employmentTrendsProvider((
              startYear: _startYear,
              endYear: _endYear,
              regionId: ref.read(regionIdProvider),
              departmentId: departmentId,
              granularity: _granularity,
            )))
            .value ??
        [];

    final xlsxFile = Excel.createExcel();

    // ── Sheet 1: KPIs ──
    final kpiSheet = xlsxFile['KPIs'];
    kpiSheet.appendRow([TextCellValue('Indicateur'), TextCellValue('Valeur')]);
    if (dashboard != null) {
      kpiSheet
          .appendRow([TextCellValue('Année'), IntCellValue(dashboard.year)]);
      kpiSheet.appendRow([
        TextCellValue('Effectif total'),
        IntCellValue(dashboard.totalEmployees)
      ]);
      kpiSheet.appendRow([
        TextCellValue('Déclarations'),
        IntCellValue(dashboard.totalDeclarations)
      ]);
      kpiSheet.appendRow([
        TextCellValue('Recrutements'),
        IntCellValue(dashboard.totalRecruitments)
      ]);
      kpiSheet.appendRow(
          [TextCellValue('Départs'), IntCellValue(dashboard.totalDismissals)]);
      kpiSheet.appendRow([
        TextCellValue('Retraites'),
        IntCellValue(dashboard.totalRetirements)
      ]);
      kpiSheet.appendRow([
        TextCellValue('Variation nette'),
        IntCellValue(dashboard.netChange)
      ]);
      kpiSheet.appendRow([
        TextCellValue('Taux de croissance (%)'),
        DoubleCellValue(dashboard.employmentGrowthRate)
      ]);
    }

    // ── Sheet 2: Employment Trends ──
    final trendsSheet = xlsxFile['Tendances'];
    trendsSheet.appendRow([
      TextCellValue('Période'),
      TextCellValue('Label'),
      TextCellValue('Effectif total'),
    ]);
    for (final t in trends) {
      trendsSheet.appendRow([
        TextCellValue(t.period),
        TextCellValue(t.label),
        IntCellValue(t.totalEmployees),
      ]);
    }

    // ── Sheet 3: Sectors ──
    final sectorsSheet = xlsxFile['Secteurs'];
    sectorsSheet.appendRow([
      TextCellValue('Secteur'),
      TextCellValue('Effectif'),
      TextCellValue('Hommes'),
      TextCellValue('Femmes'),
    ]);
    for (final s in sectors) {
      sectorsSheet.appendRow([
        TextCellValue(s.sector),
        IntCellValue(s.employees),
        IntCellValue(s.male),
        IntCellValue(s.female),
      ]);
    }

    // Remove default empty sheet
    xlsxFile.delete('Sheet1');

    final bytes = xlsxFile.save();
    if (bytes == null) {
      _toast('Erreur lors de la génération du fichier');
      return;
    }
    await _shareFile(Uint8List.fromList(bytes), 'dsmo_export_$year.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  Future<void> _shareFile(
      Uint8List bytes, String fileName, String mimeType) async {
    try {
      if (Platform.isAndroid || Platform.isIOS) {
        final dir = await getTemporaryDirectory();
        final file = File('${dir.path}/$fileName');
        await file.writeAsBytes(bytes);
        await Share.shareXFiles(
          [XFile(file.path, mimeType: mimeType)],
          subject: fileName,
        );
      } else {
        // Web / Desktop: download via anchor element or save dialog
        _toast('Téléchargement non supporté sur cette plateforme');
      }
    } catch (e) {
      _toast('Erreur export : $e');
    }
  }

  void _toast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: textMono(12)),
      backgroundColor: InkColor.card,
    ));
  }

  Widget _body({
    required DashboardSummary dashboard,
    required DashboardSummary? previous,
    required List<TimeSeriesData> trends,
    required List<Sector> sectors,
    required List<GenderRegion> gender,
    required List<Map<String, dynamic>> regions,
    required List<Animation<double>> cardAnimations,
    required void Function(int) onChangeYear,
    required void Function(String?, String?) onChangeRegion,
    required VoidCallback onClearRegion,
    required int startYear,
    required int endYear,
    required Granularity granularity,
    required void Function(int) onStartYearChanged,
    required void Function(int) onEndYearChanged,
    required void Function(Granularity) onGranularityChanged,
  }) {
    return DefaultTabController(
      length: 4,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: Column(
              children: [
                _buildTimeControls(
                  startYear: startYear,
                  endYear: endYear,
                  granularity: granularity,
                  onStartYearChanged: onStartYearChanged,
                  onEndYearChanged: onEndYearChanged,
                  onGranularityChanged: onGranularityChanged,
                ),
                YearTabBar(year: dashboard.year, onYear: onChangeYear),
                const TabBarWidget(),
                const SizedBox(height: 16),
                TabContent(
                  dashboard: dashboard,
                  previous: previous,
                  trends: trends,
                  sectors: sectors,
                  gender: gender,
                  cardAnimations: cardAnimations,
                  granularity: granularity,
                  onGranularityChanged: onGranularityChanged,
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimeControls({
    required int startYear,
    required int endYear,
    required Granularity granularity,
    required void Function(int) onStartYearChanged,
    required void Function(int) onEndYearChanged,
    required void Function(Granularity) onGranularityChanged,
  }) {
    final currentYear = DateTime.now().year;
    final years = List.generate(10, (i) => currentYear - 9 + i);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Période : ', style: textMono(12)),
              DropdownButton<int>(
                value: startYear,
                items: years
                    .map((y) => DropdownMenuItem(value: y, child: Text('$y')))
                    .toList(),
                onChanged: (v) => onStartYearChanged(v!),
                underline: const SizedBox(),
              ),
              const Text(' – '),
              DropdownButton<int>(
                value: endYear,
                items: years
                    .where((y) => y >= startYear)
                    .map((y) => DropdownMenuItem(value: y, child: Text('$y')))
                    .toList(),
                onChanged: (v) => onEndYearChanged(v!),
                underline: const SizedBox(),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Text('Granularité : ', style: textMono(12)),
              const SizedBox(width: 8),
              // FIX: removed const — Granularity enum values from time_series_data.dart
              // are not const-compatible in this context once the ambiguity was resolved.
              SegmentedButton<Granularity>(
                segments: const [
                  ButtonSegment(value: Granularity.year, label: Text('Année')),
                  ButtonSegment(
                      value: Granularity.semester, label: Text('Semestre')),
                  ButtonSegment(
                      value: Granularity.quarter, label: Text('Trimestre')),
                ],
                selected: {granularity},
                onSelectionChanged: (Set<Granularity> newSelection) {
                  onGranularityChanged(newSelection.first);
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _skeleton() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: List.generate(
          7,
          (i) => Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Shimmer(
                    height: i == 1
                        ? 130
                        : i < 2
                            ? 48
                            : 180),
              )),
    );
  }

  Widget _errorState(String error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off_rounded,
                size: 56, color: TextColor.muted),
            const SizedBox(height: 16),
            Text('Connexion impossible',
                style: GoogleFonts.dmSans(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: TextColor.primary)),
            const SizedBox(height: 8),
            Text(error,
                style: textMono(11, color: TextColor.muted),
                textAlign: TextAlign.center),
            const SizedBox(height: 24),
            TealButton(
              label: 'Réessayer',
              icon: Icons.refresh_rounded,
              onTap: () => _refreshAll(),
            ),
          ],
        ),
      ),
    );
  }
}
