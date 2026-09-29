import 'package:flutter/material.dart';

import '../../main.dart' show router;
import 'onefop_form_constants.dart';
import 'onefop_form_controller.dart';
import 'widgets/gds_task_list.dart';

class OnefopProgressDashboardScreen extends StatefulWidget {
  final VoidCallback? onContinue;
  const OnefopProgressDashboardScreen({super.key, this.onContinue});

  static const _background = Color(0xFFF4F8F6);
  static const _ink = Color(0xFF142033);
  static const _muted = Color(0xFF596A80);
  static const _border = Color(0xFFD9E3E0);
  static const _green = Color(0xFF00866B);

  @override
  State<OnefopProgressDashboardScreen> createState() =>
      _OnefopProgressDashboardScreenState();
}

class _OnefopProgressDashboardScreenState
    extends State<OnefopProgressDashboardScreen> {
  late final OnefopFormController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = OnefopFormController(
      entityType: EntityType.vocationalTraining,
      initialData: const {},
      onSave: (_) {},
    )..initialize();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OnefopProgressDashboardScreen._background,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final compact = constraints.maxWidth < 600;
            return ListenableBuilder(
              listenable: _ctrl,
              builder: (context, _) {
                final sections = _ctrl.schema?.sections;
                if (sections == null) {
                  return const Center(child: CircularProgressIndicator());
                }
                final completed = sections
                    .where((section) => _ctrl.valid[section.id] == true)
                    .length;
                return SingleChildScrollView(
                  padding: EdgeInsets.only(bottom: compact ? 24 : 40),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 760),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _GovernmentHeader(compact: compact),
                          _ProgressHero(
                            compact: compact,
                            completed: completed,
                            total: sections.length,
                          ),
                          Padding(
                            padding: EdgeInsets.fromLTRB(
                              compact ? 16 : 28,
                              20,
                              compact ? 16 : 28,
                              0,
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                const Text(
                                  'Questionnaire auto-guidé',
                                  style: TextStyle(
                                    color: OnefopProgressDashboardScreen._ink,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                GdsTaskList(
                                  ctrl: _ctrl,
                                  sections: sections,
                                  onSelectSection: (index) {
                                    _ctrl.goto(index);
                                    (widget.onContinue ??
                                            () => router.go('/onefop/form'))();
                                  },
                                ),
                                const SizedBox(height: 12),
                                SizedBox(
                                  height: 48,
                                  child: ElevatedButton(
                                    onPressed: widget.onContinue ??
                                        () => router.go('/onefop/form'),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: OnefopProgressDashboardScreen._green,
                                      foregroundColor: Colors.white,
                                      elevation: 0,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                    child: const Text(
                                      'Continuer le questionnaire',
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class _GovernmentHeader extends StatelessWidget {
  final bool compact;
  const _GovernmentHeader({required this.compact});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: compact ? 48 : 58,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: OnefopProgressDashboardScreen._border)),
      ),
      child: Row(
        children: [
          const Expanded(
            child: _Institution(
              title: 'RÉPUBLIQUE DU CAMEROUN',
              subtitle: 'Paix · Travail · Patrie',
            ),
          ),
          Image.asset(
            'assets/images/onefop_logo.png',
            width: compact ? 28 : 34,
            height: compact ? 28 : 34,
            fit: BoxFit.contain,
          ),
          const Expanded(
            child: _Institution(
              title: 'REPUBLIC OF CAMEROON',
              subtitle: 'Peace · Work · Fatherland',
              alignEnd: true,
            ),
          ),
        ],
      ),
    );
  }
}

class _Institution extends StatelessWidget {
  final String title;
  final String subtitle;
  final bool alignEnd;
  const _Institution({
    required this.title,
    required this.subtitle,
    this.alignEnd = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment:
          alignEnd ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w800)),
        const SizedBox(height: 2),
        Text(subtitle, style: const TextStyle(fontSize: 7, color: Color(0xFF64748B))),
      ],
    );
  }
}

class _ProgressHero extends StatelessWidget {
  final bool compact;
  final int completed;
  final int total;
  const _ProgressHero({
    required this.compact,
    required this.completed,
    required this.total,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(compact ? 20 : 32, 20, compact ? 20 : 32, 20),
      decoration: const BoxDecoration(
        color: OnefopProgressDashboardScreen._green,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Cher Directeur / Dear Director',
                      style: TextStyle(
                        color: Color(0xFFFFE341),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Votre progression / Your Progress',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              CircleAvatar(
                radius: 22,
                backgroundColor: Color(0x2FFFFFFF),
                child: Icon(Icons.person_outline, color: Colors.white, size: 24),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                _ProgressRing(completed: completed, total: total),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$completed/$total sections complétées',
                        style: const TextStyle(
                          color: OnefopProgressDashboardScreen._ink,
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        '17/32 champs requis restants',
                        style: TextStyle(
                          color: OnefopProgressDashboardScreen._muted,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgressRing extends StatelessWidget {
  final int completed;
  final int total;
  const _ProgressRing({required this.completed, required this.total});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 58,
      height: 58,
      decoration: const BoxDecoration(
        color: Color(0xFFE6F3EF),
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        '${total == 0 ? 0 : (completed * 100 / total).round()}%',
        style: const TextStyle(
          color: OnefopProgressDashboardScreen._green,
          fontSize: 14,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

