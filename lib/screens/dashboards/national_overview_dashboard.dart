// lib/screens/dashboards/national_overview_dashboard.dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../theme/ultra_theme.dart';
import '../../widgets/common_widgets.dart';

class NationalOverviewDashboard extends StatelessWidget {
  const NationalOverviewDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildKpiRow(),
          const SizedBox(height: 24),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: 2,
                child: _buildSubmissionsByRegion(),
              ),
              const SizedBox(width: 24),
              Expanded(
                child: Column(
                  children: [
                    _buildCoverageMap(),
                    const SizedBox(height: 24),
                    _buildAgentsPending(),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildKpiRow() {
    return const Row(
      children: [
        Expanded(
          child: _KpiCard(
            title: 'Total submissions',
            value: '1,842',
            subtitle: '↑ +12% vs 2025',
            subtitleColor: UltraTheme.success,
            progressColor: UltraTheme.primary,
            progressValue: 0.7,
          ),
        ),
        SizedBox(width: 16),
        Expanded(
          child: _KpiCard(
            title: 'Companies reporting',
            value: '324',
            subtitle: '↑ +28 this year',
            subtitleColor: UltraTheme.success,
            progressColor: UltraTheme.primary,
            progressValue: 0.6,
          ),
        ),
        SizedBox(width: 16),
        Expanded(
          child: _KpiCard(
            title: 'Regional coverage',
            value: '8/10',
            subtitle: '↓ 2 regions lagging',
            subtitleColor: UltraTheme.error,
            progressColor: UltraTheme.warning,
            progressValue: 0.8,
          ),
        ),
        SizedBox(width: 16),
        Expanded(
          child: _KpiCard(
            title: 'Agents pending',
            value: '5',
            subtitle: 'Need approval',
            subtitleColor: UltraTheme.error,
            progressColor: UltraTheme.error,
            progressValue: 0.25,
          ),
        ),
      ],
    );
  }

  Widget _buildSubmissionsByRegion() {
    final regions = [
      _RegionData('Littoral', 512, UltraTheme.primary),
      _RegionData('Centre', 420, UltraTheme.primary),
      _RegionData('West', 247, UltraTheme.primaryLight),
      _RegionData('South West', 180, UltraTheme.primaryLight),
      _RegionData('North West', 160, UltraTheme.primaryLight),
      _RegionData('Far North', 130, UltraTheme.textMuted),
      _RegionData('Adamaoua', 109, UltraTheme.warning),
      _RegionData('North', 0, UltraTheme.textMuted),
    ];
    const maxValue = 512.0;

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Submissions by region · 2026',
                  style: UltraTheme.titleLarge.copyWith(fontSize: 16)),
              TextButton(
                onPressed: () {},
                child: Text('Full analytics →',
                    style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: UltraTheme.primary)),
              ),
            ],
          ),
          const SizedBox(height: 20),
          ...regions.map((r) => _buildRegionBar(r, maxValue)),
        ],
      ),
    );
  }

  Widget _buildRegionBar(_RegionData data, double max) {
    final pct = data.value / max;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          SizedBox(
            width: 100,
            child: Text(data.name,
                style: UltraTheme.bodyMedium.copyWith(
                    fontWeight: FontWeight.w500,
                    color: UltraTheme.textPrimary)),
          ),
          Expanded(
            child: Stack(
              children: [
                Container(
                  height: 8,
                  decoration: BoxDecoration(
                    color: UltraTheme.background,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                if (data.value > 0)
                  FractionallySizedBox(
                    widthFactor: pct,
                    child: Container(
                      height: 8,
                      decoration: BoxDecoration(
                        color: data.color,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 40,
            child: Text(
              data.value > 0 ? '${data.value}' : '—',
              textAlign: TextAlign.right,
              style: UltraTheme.bodyMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: data.value > 0
                      ? UltraTheme.textPrimary
                      : UltraTheme.textMuted),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCoverageMap() {
    final regions = [
      _MapRegion('Littoral', _RegionStatus.active),
      _MapRegion('Centre', _RegionStatus.active),
      _MapRegion('West', _RegionStatus.active),
      _MapRegion('S. West', _RegionStatus.active),
      _MapRegion('N. West', _RegionStatus.active),
      _MapRegion('South', _RegionStatus.active),
      _MapRegion('East', _RegionStatus.active),
      _MapRegion('Far N.', _RegionStatus.active),
      _MapRegion('Adamaoua', _RegionStatus.lagging),
      _MapRegion('North', _RegionStatus.noData),
    ];

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Coverage map',
              style: UltraTheme.titleLarge.copyWith(fontSize: 16)),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: regions.map((r) => _buildRegionChip(r)).toList(),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _buildLegendDot(UltraTheme.success, 'Active (8)'),
              const SizedBox(width: 16),
              _buildLegendDot(UltraTheme.warning, 'Lagging (1)'),
              const SizedBox(width: 16),
              _buildLegendDot(UltraTheme.textMuted, 'No data (1)'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRegionChip(_MapRegion region) {
    Color bg;
    Color fg;
    switch (region.status) {
      case _RegionStatus.active:
        bg = UltraTheme.success.withValues(alpha: 0.12);
        fg = UltraTheme.success;
        break;
      case _RegionStatus.lagging:
        bg = UltraTheme.warning.withValues(alpha: 0.12);
        fg = UltraTheme.warning;
        break;
      case _RegionStatus.noData:
        bg = UltraTheme.textMuted.withValues(alpha: 0.12);
        fg = UltraTheme.textMuted;
        break;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(UltraTheme.radiusSmall),
      ),
      child: Text(region.name,
          style: GoogleFonts.inter(
              fontSize: 12, fontWeight: FontWeight.w600, color: fg)),
    );
  }

  Widget _buildLegendDot(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label, style: UltraTheme.labelMedium),
      ],
    );
  }

  Widget _buildAgentsPending() {
    final agents = [
      _AgentData(
          'Blaise Tchinda', 'DIVISIONAL · West', 'Pending', UltraTheme.warning),
      _AgentData('Aïcha Fombé', 'REGIONAL · North', 'New', UltraTheme.info),
      _AgentData(
          'Jean Mbida', 'CENTRAL · Yaoundé', 'Pending', UltraTheme.warning),
    ];

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Agents awaiting approval',
              style: UltraTheme.titleLarge.copyWith(fontSize: 16)),
          const SizedBox(height: 16),
          ...agents.map((a) => _buildAgentRow(a)),
        ],
      ),
    );
  }

  Widget _buildAgentRow(_AgentData agent) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: UltraTheme.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
            ),
            child: Center(
              child: Text(
                agent.initials,
                style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: UltraTheme.primary),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(agent.name,
                    style: UltraTheme.bodyMedium.copyWith(
                        fontWeight: FontWeight.w600,
                        color: UltraTheme.textPrimary)),
                const SizedBox(height: 2),
                Text(agent.role, style: UltraTheme.labelMedium),
              ],
            ),
          ),
          StatusBadge(label: agent.status, color: agent.statusColor),
        ],
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final Color subtitleColor;
  final Color progressColor;
  final double progressValue;

  const _KpiCard({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.subtitleColor,
    required this.progressColor,
    required this.progressValue,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: UltraTheme.labelLarge),
          const SizedBox(height: 12),
          Text(value, style: UltraTheme.displayLarge.copyWith(fontSize: 28)),
          const SizedBox(height: 8),
          Text(subtitle,
              style: UltraTheme.bodyMedium
                  .copyWith(fontWeight: FontWeight.w600, color: subtitleColor)),
          const SizedBox(height: 12),
          Container(
            height: 4,
            decoration: BoxDecoration(
              color: UltraTheme.background,
              borderRadius: BorderRadius.circular(2),
            ),
            child: FractionallySizedBox(
              widthFactor: progressValue,
              child: Container(
                decoration: BoxDecoration(
                  color: progressColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RegionData {
  final String name;
  final int value;
  final Color color;
  _RegionData(this.name, this.value, this.color);
}

enum _RegionStatus { active, lagging, noData }

class _MapRegion {
  final String name;
  final _RegionStatus status;
  _MapRegion(this.name, this.status);
}

class _AgentData {
  final String name;
  final String role;
  final String status;
  final Color statusColor;
  _AgentData(this.name, this.role, this.status, this.statusColor);

  String get initials {
    final parts = name.split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}';
    }
    return name.isNotEmpty ? name[0] : '?';
  }
}
