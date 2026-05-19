// lib/screens/dashboards/regional_agent_dashboard.dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../theme/ultra_theme.dart';
import '../../widgets/common_widgets.dart';

class RegionalAgentDashboard extends StatelessWidget {
  const RegionalAgentDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildAlertBanner(),
          const SizedBox(height: 24),
          _buildKpiRow(),
          const SizedBox(height: 24),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: 2,
                child: _buildPendingQueue(),
              ),
              const SizedBox(width: 24),
              Expanded(
                child: Column(
                  children: [
                    _buildEntityTypeDistribution(),
                    const SizedBox(height: 24),
                    _buildMonthlyTrend(),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAlertBanner() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: UltraTheme.warning.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        border: Border.all(color: UltraTheme.warning.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: UltraTheme.warning.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
            ),
            child: Icon(Icons.warning_amber_rounded,
                color: UltraTheme.warning, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('12 submissions awaiting your review',
                    style: UltraTheme.titleMedium),
                const SizedBox(height: 4),
                Text('Oldest item: 8 days ago · SARL MegaBuild',
                    style: UltraTheme.bodyMedium),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF5D4037),
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(UltraTheme.radiusMedium)),
            ),
            child: Text('Open queue →',
                style: GoogleFonts.inter(
                    fontSize: 13, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiRow() {
    return Row(
      children: [
        Expanded(
          child: _KpiCard(
            title: 'Received this month',
            value: '34',
            subtitle: '↑ +9 vs April',
            subtitleColor: UltraTheme.success,
            progressColor: UltraTheme.primary,
            progressValue: 0.65,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: _KpiCard(
            title: 'Approval rate',
            value: '88%',
            subtitle: '↑ 189 approved',
            subtitleColor: UltraTheme.success,
            progressColor: UltraTheme.success,
            progressValue: 0.88,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: _KpiCard(
            title: 'Companies active',
            value: '67',
            subtitle: '↑ +5 vs last year',
            subtitleColor: UltraTheme.success,
            progressColor: UltraTheme.primary,
            progressValue: 0.5,
          ),
        ),
      ],
    );
  }

  Widget _buildPendingQueue() {
    final items = [
      _QueueItem('SARL MegaBuild', 'DSMO Q1 2026', '8 days waiting',
          Icons.business, UltraTheme.error, 'Urgent'),
      _QueueItem('Coopérative AgroSud', 'ONEFOP 2025', '6 days waiting',
          Icons.groups, UltraTheme.warning, 'Review'),
      _QueueItem('ONG VieSaine', 'ONEFOP 2025', 'just received',
          Icons.volunteer_activism, UltraTheme.info, 'New'),
      _QueueItem('CTD Douala 3', 'DSMO Q4 2025', '5 days waiting',
          Icons.account_balance, UltraTheme.warning, 'Review'),
    ];

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Pending queue',
                  style: UltraTheme.titleLarge.copyWith(fontSize: 16)),
              TextButton(
                onPressed: () {},
                child: Text('Open all →',
                    style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: UltraTheme.primary)),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...items
              .asMap()
              .entries
              .map((e) => _buildQueueRow(e.value, e.key + 1)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: UltraTheme.background,
              borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
            ),
            child: Row(
              children: [
                Text('+8',
                    style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: UltraTheme.textMuted)),
                const SizedBox(width: 8),
                Text('8 more items',
                    style: UltraTheme.bodyMedium
                        .copyWith(fontWeight: FontWeight.w500)),
                const Spacer(),
                Text('Open queue to see all',
                    style: UltraTheme.labelMedium
                        .copyWith(color: UltraTheme.primary)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQueueRow(_QueueItem item, int index) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          SizedBox(
            width: 24,
            child: Text('$index',
                style: UltraTheme.labelMedium.copyWith(fontSize: 13)),
          ),
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: item.iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
            ),
            child: Icon(item.icon, color: item.iconColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.title,
                    style: UltraTheme.bodyMedium.copyWith(
                        fontWeight: FontWeight.w600,
                        color: UltraTheme.textPrimary)),
                const SizedBox(height: 2),
                Text('${item.subtitle} · ${item.waitingTime}',
                    style: UltraTheme.labelMedium),
              ],
            ),
          ),
          StatusBadge(label: item.badgeLabel, color: item.badgeColor),
        ],
      ),
    );
  }

  Widget _buildEntityTypeDistribution() {
    final types = [
      _EntityType('Enterprise', 158, 158 / 252),
      _EntityType('Cooperative', 51, 51 / 252),
      _EntityType('CTD', 26, 26 / 252),
      _EntityType('ONG', 17, 17 / 252),
    ];

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('By entity type',
              style: UltraTheme.titleLarge.copyWith(fontSize: 16)),
          const SizedBox(height: 20),
          ...types.map((t) => _buildEntityTypeBar(t)),
        ],
      ),
    );
  }

  Widget _buildEntityTypeBar(_EntityType type) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        children: [
          SizedBox(
            width: 90,
            child: Text(type.name,
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
                FractionallySizedBox(
                  widthFactor: type.ratio,
                  child: Container(
                    height: 8,
                    decoration: BoxDecoration(
                      color: UltraTheme.primary,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 32,
            child: Text('${type.count}',
                textAlign: TextAlign.right,
                style: UltraTheme.bodyMedium.copyWith(
                    fontWeight: FontWeight.w600,
                    color: UltraTheme.textPrimary)),
          ),
        ],
      ),
    );
  }

  Widget _buildMonthlyTrend() {
    final months = [
      _MonthData('Jan', 0.4),
      _MonthData('Feb', 0.55),
      _MonthData('Mar', 0.45),
      _MonthData('Apr', 0.7),
      _MonthData('May', 0.6),
      _MonthData('Jun', 1.0),
    ];

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Monthly trend',
              style: UltraTheme.titleLarge.copyWith(fontSize: 16)),
          const SizedBox(height: 20),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: months
                .map((m) => Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Column(
                          children: [
                            Container(
                              height: 100 * m.heightFactor,
                              decoration: BoxDecoration(
                                color: m.name == 'Jun'
                                    ? UltraTheme.primary
                                    : UltraTheme.primary.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(m.name,
                                style: UltraTheme.labelMedium
                                    .copyWith(fontSize: 11)),
                          ],
                        ),
                      ),
                    ))
                .toList(),
          ),
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

class _QueueItem {
  final String title;
  final String subtitle;
  final String waitingTime;
  final IconData icon;
  final Color iconColor;
  final String badgeLabel;
  _QueueItem(this.title, this.subtitle, this.waitingTime, this.icon,
      this.iconColor, this.badgeLabel);

  Color get badgeColor {
    switch (badgeLabel) {
      case 'Urgent':
        return UltraTheme.error;
      case 'Review':
        return UltraTheme.warning;
      case 'New':
        return UltraTheme.info;
      default:
        return UltraTheme.textMuted;
    }
  }
}

class _EntityType {
  final String name;
  final int count;
  final double ratio;
  _EntityType(this.name, this.count, this.ratio);
}

class _MonthData {
  final String name;
  final double heightFactor;
  _MonthData(this.name, this.heightFactor);
}
