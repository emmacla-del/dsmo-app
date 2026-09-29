// lib/screens/onefop/widgets/gds_task_list.dart
// ══════════════════════════════════════════════════════════════
// GDS TASK LIST OVERVIEW (GOV.UK & USWDS STANDARD)
// Clean, structured task list displaying declaration sections,
// item counts, and official government status tags.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/focus/schema/section_schema.dart';
import '../onefop_form_constants.dart';
import '../onefop_form_controller.dart';

enum GdsTaskStatus {
  completed,
  inProgress,
  notStarted,
  blocked,
}

class GdsTaskList extends StatelessWidget {
  final OnefopFormController ctrl;
  final List<SectionSchema> sections;
  final void Function(int pageIndex) onSelectSection;

  const GdsTaskList({
    super.key,
    required this.ctrl,
    required this.sections,
    required this.onSelectSection,
  });

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final isEn = locale.languageCode == 'en';

    final totalSections = sections.length;
    var completedCount = 0;

    for (final s in sections) {
      if (ctrl.valid[s.id] == true) {
        completedCount++;
      }
    }

    final ratio = totalSections == 0 ? 0.0 : completedCount / totalSections;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: const Color(0xFFCBD5E1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Task List Header
          Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              color: Color(0xFFF8FAFC),
              border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(6),
                topRight: Radius.circular(6),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.fact_check_outlined, color: Color(0xFF006B5E), size: 22),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        isEn ? 'Questionnaire Sections Overview' : 'Aperçu des Sections du Questionnaire',
                        style: const TextStyle(
                          color: Color(0xFF0F172A),
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2,
                        ),
                      ),
                    ),
                    Text(
                      '$completedCount / $totalSections ${isEn ? "complete" : "complétées"}',
                      style: const TextStyle(
                        color: Color(0xFF006B5E),
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: ratio,
                    minHeight: 6,
                    backgroundColor: const Color(0xFFE2E8F0),
                    color: const Color(0xFF006B5E),
                  ),
                ),
              ],
            ),
          ),

          // Task List Section Rows
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: sections.length,
            separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFE2E8F0)),
            itemBuilder: (context, idx) {
              final sec = sections[idx];
              final meta = kSidebarMeta[sec.id];
              final title = meta?.label.of(locale) ?? sec.id;
              final isCurrent = ctrl.currentPage == idx;
              final isValid = ctrl.valid[sec.id] == true;

              // Compute fill status
              var filledFields = 0;
              for (final fid in sec.fieldIds) {
                if (ctrl.data.containsKey(fid) && ctrl.data[fid] != null) {
                  filledFields++;
                }
              }

              GdsTaskStatus status;
              if (isValid) {
                status = GdsTaskStatus.completed;
              } else if (filledFields > 0) {
                status = GdsTaskStatus.inProgress;
              } else if (ctrl.advanceBlockedPage == idx) {
                status = GdsTaskStatus.blocked;
              } else {
                status = GdsTaskStatus.notStarted;
              }

              return InkWell(
                onTap: () => onSelectSection(idx),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  color: isCurrent ? const Color(0xFFE6F4F2) : Colors.white,
                  child: Row(
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isValid
                              ? const Color(0xFF006B5E)
                              : isCurrent
                                  ? const Color(0xFF004D43)
                                  : const Color(0xFFF1F5F9),
                          border: Border.all(
                            color: isValid || isCurrent
                                ? const Color(0xFF006B5E)
                                : const Color(0xFFCBD5E1),
                          ),
                        ),
                        child: isValid
                            ? const Icon(Icons.check, color: Colors.white, size: 16)
                            : Text(
                                '${idx + 1}',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: isCurrent ? Colors.white : const Color(0xFF475569),
                                ),
                              ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w600,
                                color: const Color(0xFF0F172A),
                              ),
                            ),
                            if (sec.fieldIds.isNotEmpty) ...[
                              const SizedBox(height: 2),
                              Text(
                                '${sec.fieldIds.length} ${isEn ? "fields" : "champs"}',
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      _GdsStatusTag(status: status, isEn: isEn),
                      const SizedBox(width: 8),
                      const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8), size: 20),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _GdsStatusTag extends StatelessWidget {
  final GdsTaskStatus status;
  final bool isEn;

  const _GdsStatusTag({required this.status, required this.isEn});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    String label;

    switch (status) {
      case GdsTaskStatus.completed:
        bg = const Color(0xFF006B5E);
        fg = Colors.white;
        label = isEn ? 'COMPLETED' : 'COMPLÉTÉ';
        break;
      case GdsTaskStatus.inProgress:
        bg = const Color(0xFFE0F2FE);
        fg = const Color(0xFF0369A1);
        label = isEn ? 'IN PROGRESS' : 'EN COURS';
        break;
      case GdsTaskStatus.blocked:
        bg = const Color(0xFFFEE2E2);
        fg = const Color(0xFFB91C1C);
        label = isEn ? 'ATTENTION' : 'A CORRIGER';
        break;
      case GdsTaskStatus.notStarted:
        bg = const Color(0xFFF1F5F9);
        fg = const Color(0xFF475569);
        label = isEn ? 'NOT STARTED' : 'À REMPLIR';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(3),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          color: fg,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
