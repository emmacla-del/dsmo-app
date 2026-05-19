// ==================================================================
// movements_tab.dart – movement cards and net balance
// ==================================================================
import 'package:flutter/material.dart';
import '../models/dashboard_models.dart';
import 'common_cards.dart';

class MovementsTab extends StatelessWidget {
  final DashboardSummary dashboard;
  final List<Animation<double>> cardAnimations;

  const MovementsTab(
      {super.key, required this.dashboard, required this.cardAnimations});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          sectionLabel('Mouvements du personnel · ${dashboard.year}'),
          const SizedBox(height: 10),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.6,
            children: [
              MvCard(
                  label: 'Recrutements',
                  value: dashboard.totalRecruitments,
                  icon: Icons.person_add_alt_1_rounded,
                  color: AccentColor.teal),
              MvCard(
                  label: 'Départs',
                  value: dashboard.totalDismissals,
                  icon: Icons.person_remove_alt_1_rounded,
                  color: AccentColor.rose),
              MvCard(
                  label: 'Retraites',
                  value: dashboard.totalRetirements,
                  icon: Icons.elderly_rounded,
                  color: AccentColor.gold),
              MvCard(
                  label: 'Promotions',
                  value: dashboard.totalPromotions,
                  icon: Icons.trending_up_rounded,
                  color: AccentColor.blue),
            ],
          ),
          const SizedBox(height: 14),
          AnimatedCard(
              animation: cardAnimations[0],
              child: NetBalanceCard(
                  rec: dashboard.totalRecruitments,
                  out: dashboard.totalDismissals + dashboard.totalRetirements)),
        ],
      ),
    );
  }
}

class MvCard extends StatelessWidget {
  final String label;
  final int value;
  final IconData icon;
  final Color color;
  const MvCard(
      {super.key,
      required this.label,
      required this.value,
      required this.icon,
      required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
          color: InkColor.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withAlpha(40))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Icon(icon, color: color, size: 18),
            Container(
                width: 3,
                height: 3,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle))
          ]),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(formatNumber(value),
                  style: textMono(20, color: color, weight: FontWeight.bold)),
              const SizedBox(height: 2),
              Text(label, style: textMono(8, color: TextColor.label)),
            ],
          ),
        ],
      ),
    );
  }
}

class NetBalanceCard extends StatelessWidget {
  final int rec, out;
  const NetBalanceCard({super.key, required this.rec, required this.out});

  @override
  Widget build(BuildContext context) {
    final net = rec - out;
    final pos = net >= 0;
    final color = pos ? AccentColor.teal : AccentColor.rose;
    final ratio = rec == 0 ? 0.0 : (rec / (rec + out)).clamp(0.0, 1.0);
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Solde net des mouvements',
              style: textMono(9, color: TextColor.muted)),
          const SizedBox(height: 8),
          Row(children: [
            Icon(Icons.balance_rounded, color: color, size: 18),
            const SizedBox(width: 10),
            Text('${pos ? '+' : ''}${formatNumber(net)} employés',
                style: textMono(20, color: color, weight: FontWeight.bold))
          ]),
          const SizedBox(height: 8),
          Text(
              '${formatNumber(rec)} recrutements — ${formatNumber(out)} départs',
              style: textMono(10, color: TextColor.muted)),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
                value: ratio,
                minHeight: 5,
                backgroundColor: AccentColor.rose.withAlpha(40),
                valueColor: const AlwaysStoppedAnimation(AccentColor.teal)),
          ),
        ],
      ),
    );
  }
}
