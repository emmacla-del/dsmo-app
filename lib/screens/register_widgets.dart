// lib/screens/register_widgets.dart

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'register_constants.dart'
    show
        kStepRole,
        kStepEntityType,
        kStepRespondent,
        kStepEntityInfo,
        kStepLocation,
        kStepSecurity,
        kStepReview,
        modernInput,
        modernDropdown,
        entityConfigs,
        EntityConfig;
// kPhoneFormatters is resolved exclusively from cameroon_phone_validator
// to avoid the ambiguous-import conflict with register_constants.dart.
import '../core/focus/utils/cameroon_phone_validator.dart';
import '../core/i18n/l10n_ext.dart';
import '../data/minefop_models.dart' show EntityType;
import '../widgets/public_chrome.dart';

// ════════════════════════════════════════════════════════════════
// TopFlagStripe — green / red / gold national banner
// ════════════════════════════════════════════════════════════════

class TopFlagStripe extends StatelessWidget {
  final double height;
  const TopFlagStripe({super.key, this.height = 4});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: const Row(
        children: [
          Expanded(child: ColoredBox(color: PublicColors.green)),
          Expanded(child: ColoredBox(color: PublicColors.flagRed)),
          Expanded(child: ColoredBox(color: PublicColors.flagYellow)),
        ],
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// StepHeader — standardized 22px w700 title + 14px muted subtitle
// ════════════════════════════════════════════════════════════════

class StepHeader extends StatelessWidget {
  final String title;
  final String? subtitle;

  const StepHeader({
    super.key,
    required this.title,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: PublicColors.gray900,
          ),
        ),
        if (subtitle != null && subtitle!.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            subtitle!,
            style: const TextStyle(
              fontSize: 14,
              color: PublicColors.gray500,
            ),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }
}

// ════════════════════════════════════════════════════════════════
// FormRow — responsive field row with 170px label column on wide
// ════════════════════════════════════════════════════════════════

class FormRow extends StatelessWidget {
  final String label;
  final bool required;
  final String? hint;
  final Widget child;
  final EdgeInsetsGeometry padding;

  const FormRow({
    super.key,
    required this.label,
    this.required = false,
    this.hint,
    required this.child,
    this.padding = const EdgeInsets.only(bottom: 22),
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isWide = constraints.maxWidth >= 560;
          if (isWide) {
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 170,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 14),
                    child: Text.rich(
                      TextSpan(
                        text: label,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: PublicColors.gray700,
                        ),
                        children: [
                          if (required)
                            const TextSpan(
                              text: ' *',
                              style: TextStyle(
                                color: PublicColors.red,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                        ],
                      ),
                      textAlign: TextAlign.right,
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      child,
                      if (hint != null && hint!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          hint!,
                          style: const TextStyle(
                            fontSize: 13,
                            color: PublicColors.gray500,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            );
          } else {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text.rich(
                  TextSpan(
                    text: label,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: PublicColors.gray700,
                    ),
                    children: [
                      if (required)
                        const TextSpan(
                          text: ' *',
                          style: TextStyle(
                            color: PublicColors.red,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                    ],
                  ),
                  textAlign: TextAlign.start,
                ),
                const SizedBox(height: 6),
                child,
                if (hint != null && hint!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    hint!,
                    style: const TextStyle(
                      fontSize: 13,
                      color: PublicColors.gray500,
                    ),
                  ),
                ],
              ],
            );
          }
        },
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// SectionCard — 12px radius, 1px border, 28px/18px padding
// ════════════════════════════════════════════════════════════════

class SectionCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? margin;

  const SectionCard({
    super.key,
    required this.child,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth >= 560;
        final padding = isWide
            ? const EdgeInsets.all(28)
            : const EdgeInsets.all(18);

        return Container(
          margin: margin ?? const EdgeInsets.only(bottom: 20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: PublicColors.gray200, width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withAlpha(8),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          padding: padding,
          child: child,
        );
      },
    );
  }
}

// ════════════════════════════════════════════════════════════════
// RegisterHeader — progress bar + step title
// ════════════════════════════════════════════════════════════════

class RegisterHeader extends StatelessWidget {
  final int currentStep, totalSteps, step;
  final VoidCallback onBack;

  const RegisterHeader({
    super.key,
    required this.currentStep,
    required this.totalSteps,
    required this.step,
    required this.onBack,
  });

  String _title(BuildContext context) {
    switch (step) {
      case kStepRole:
        return context.l10n.registerStepTitleRole;
      case kStepEntityType:
        return context.l10n.registerStepTitleEntityType;
      case kStepRespondent:
        return context.l10n.registerStepTitleRespondent;
      case kStepEntityInfo:
        return context.l10n.registerStepTitleEntityInfo;
      case kStepLocation:
        return context.l10n.registerStepTitleLocation;
      case kStepSecurity:
        return context.l10n.registerStepTitleSecurity;
      case kStepReview:
        return context.l10n.registerStepTitleReview;
      default:
        return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final double progress =
        totalSteps > 1 ? currentStep / (totalSteps - 1) : 1.0;

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(8, 12, 20, 16),
      child: Row(children: [
        IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: onBack,
          color: PublicColors.green,
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(
                    child: Text(
                      _title(context),
                      style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: PublicColors.green),
                    ),
                  ),
                  Text(
                    '${currentStep + 1} / $totalSteps',
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFF666666)),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 5,
                  backgroundColor: PublicColors.gray200,
                  color: PublicColors.green,
                ),
              ),
            ],
          ),
        ),
      ]),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// RoleCard — selectable account-type card
// ════════════════════════════════════════════════════════════════

class RoleCard extends StatelessWidget {
  final String value, selected, title, subtitle;
  final IconData icon;
  final Color color;
  final ValueChanged<String> onTap;

  const RoleCard({
    super.key,
    required this.value,
    required this.selected,
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final bool isSelected = selected == value;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: isSelected ? color.withAlpha(18) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: isSelected ? color : PublicColors.gray300,
            width: isSelected ? 2 : 1),
        boxShadow: [
          BoxShadow(
            color: isSelected ? color.withAlpha(40) : Colors.black.withAlpha(8),
            blurRadius: isSelected ? 12 : 4,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => onTap(value),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                  color: color.withAlpha(25),
                  borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: isSelected ? color : Colors.black87)),
                    const SizedBox(height: 3),
                    Text(subtitle,
                        style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF666666),
                            height: 1.4)),
                  ]),
            ),
            const SizedBox(width: 6),
            Icon(
              isSelected ? Icons.check_circle : Icons.circle_outlined,
              color: isSelected ? color : PublicColors.gray300,
            ),
          ]),
        ),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// EntityTypeCard — selectable entity-type card
// ════════════════════════════════════════════════════════════════

class EntityTypeCard extends StatelessWidget {
  final EntityType type;
  final EntityType? selected;
  final ValueChanged<EntityType> onTap;

  const EntityTypeCard({
    super.key,
    required this.type,
    required this.selected,
    required this.onTap,
  });

  String _subtitle(BuildContext context, EntityType type) {
    switch (type) {
      case EntityType.enterprise:
        return context.l10n.registerEntitySubtitleEnterprise;
      case EntityType.cooperative:
        return context.l10n.registerEntitySubtitleCooperative;
      case EntityType.ctd:
        return context.l10n.registerEntitySubtitleCtd;
      case EntityType.ong:
        return context.l10n.registerEntitySubtitleOng;
      case EntityType.administration:
        return context.l10n.registerEntitySubtitleAdministration;
      case EntityType.projectProgram:
        return context.l10n.registerEntitySubtitleProjectProgram;
      case EntityType.vocationalTraining:
        return context.l10n.registerEntitySubtitleVocationalTraining;
    }
  }

  @override
  Widget build(BuildContext context) {
    final EntityConfig config = entityConfigs[type]!;
    final bool isSelected = selected == type;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: isSelected ? config.color.withAlpha(18) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: isSelected ? config.color : PublicColors.gray300,
            width: isSelected ? 2 : 1),
        boxShadow: [
          BoxShadow(
            color: isSelected
                ? config.color.withAlpha(40)
                : Colors.black.withAlpha(8),
            blurRadius: isSelected ? 12 : 4,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => onTap(type),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                  color: config.color.withAlpha(25),
                  borderRadius: BorderRadius.circular(12)),
              child: Icon(config.icon, color: config.color, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(config.title.of(context.loc),
                        style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: isSelected ? config.color : Colors.black87)),
                    const SizedBox(height: 3),
                    Text(_subtitle(context, type),
                        style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF666666),
                            height: 1.4)),
                  ]),
            ),
            const SizedBox(width: 6),
            Icon(
              isSelected ? Icons.check_circle : Icons.circle_outlined,
              color: isSelected ? config.color : PublicColors.gray300,
            ),
          ]),
        ),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// FieldLabel — small bold label above a form field
// ════════════════════════════════════════════════════════════════

class FieldLabel extends StatelessWidget {
  final String label;
  const FieldLabel({super.key, required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: const TextStyle(
          fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// PhoneField — Cameroon phone with live counter & validation
// ════════════════════════════════════════════════════════════════

class PhoneField extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final bool isRequired;

  const PhoneField({
    super.key,
    required this.controller,
    required this.label,
    required this.isRequired,
  });

  @override
  State<PhoneField> createState() => _PhoneFieldState();
}

class _PhoneFieldState extends State<PhoneField> {
  bool _dirty = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onTextChanged);
  }

  @override
  void didUpdateWidget(PhoneField old) {
    super.didUpdateWidget(old);
    if (old.controller != widget.controller) {
      old.controller.removeListener(_onTextChanged);
      widget.controller.addListener(_onTextChanged);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onTextChanged);
    super.dispose();
  }

  void _onTextChanged() {
    if (!_dirty && widget.controller.text.isNotEmpty) {
      setState(() => _dirty = true);
    } else if (_dirty) {
      setState(() {});
    }
  }

  bool get _hasError =>
      _dirty &&
      cameroonPhoneError(context, widget.controller.text, required: widget.isRequired) !=
          null;

  @override
  Widget build(BuildContext context) {
    final int length = widget.controller.text.length;
    return TextFormField(
      controller: widget.controller,
      keyboardType: TextInputType.phone,
      textInputAction: TextInputAction.next,
      inputFormatters: kPhoneFormatters,
      autovalidateMode:
          _dirty ? AutovalidateMode.always : AutovalidateMode.disabled,
      style: const TextStyle(
        fontSize: 14,
        color: Color(0xFF1E293B),
        letterSpacing: 1.2,
      ),
      decoration: modernInput(
        hasError: _hasError,
        hintText: widget.isRequired ? context.l10n.phoneHintShort : context.l10n.optional,
        suffixText: _dirty ? '$length / 9' : null,
        suffixStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: length == 9
              ? PublicColors.green
              : _hasError
                  ? const Color(0xFFE24B4A)
                  : const Color(0xFF94A3B8),
        ),
      ),
      validator: (v) => cameroonPhoneError(context, v, required: widget.isRequired),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// Field — generic text form field
// ════════════════════════════════════════════════════════════════

class Field extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final String? hint;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final String? Function(String?)? validator;
  final bool required;
  final int maxLines;
  final TextInputAction? textInputAction;

  const Field({
    super.key,
    required this.controller,
    required this.label,
    required this.icon,
    this.hint,
    this.keyboardType,
    this.inputFormatters,
    this.validator,
    this.required = true,
    this.maxLines = 1,
    this.textInputAction = TextInputAction.next,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        inputFormatters: inputFormatters,
        textInputAction: textInputAction,
        maxLines: maxLines,
        style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
        decoration: modernInput(
          hasError: false,
          labelText: label,
          hintText: hint,
          prefixIcon: Icon(icon, size: 20),
        ),
        validator: required
            ? validator ??
                (v) => (v == null || v.trim().isEmpty)
                    ? context.l10n.requiredShort
                    : null
            : validator,
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// InfoBox — tinted informational banner
// ════════════════════════════════════════════════════════════════

class InfoBox extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String text;

  const InfoBox({
    super.key,
    required this.icon,
    required this.color,
    required this.text,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
          color: color.withAlpha(15),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withAlpha(60))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 8),
        Expanded(
            child: Text(text,
                style: TextStyle(fontSize: 12, color: color, height: 1.5))),
      ]),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// LoadingField — shimmer placeholder while data loads
// ════════════════════════════════════════════════════════════════

class LoadingField extends StatelessWidget {
  final String? label;
  const LoadingField({super.key, this.label});

  @override
  Widget build(BuildContext context) {
    final box = Container(
      height: 48,
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
      ),
      child: const Center(
        child: SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
    );
    if (label != null && label!.isNotEmpty) {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        FieldLabel(label: label!),
        const SizedBox(height: 6),
        box,
      ]);
    }
    return box;
  }
}

// ════════════════════════════════════════════════════════════════
// LocationDropdown — region / department / subdivision picker
// ════════════════════════════════════════════════════════════════

class LocationDropdown extends StatelessWidget {
  final String label, hint;
  final IconData icon;
  final List<dynamic> items;
  final Map<String, dynamic>? selected;
  final ValueChanged<Map<String, dynamic>?>? onChanged;
  final bool required;

  const LocationDropdown({
    super.key,
    required this.label,
    required this.hint,
    required this.icon,
    required this.items,
    required this.selected,
    required this.onChanged,
    this.required = true,
  });

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      FieldLabel(label: label),
      const SizedBox(height: 6),
      DropdownButtonFormField<Map<String, dynamic>>(
        initialValue: selected,
        isExpanded: true,
        decoration: modernDropdown().copyWith(
          prefixIcon: Icon(icon, size: 20),
        ),
        hint: Text(hint,
            style: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
        items: items
            .map((item) => DropdownMenuItem<Map<String, dynamic>>(
                  value: item as Map<String, dynamic>,
                  child: Text(
                    item['name'] as String? ?? '',
                    overflow: TextOverflow.ellipsis,
                    style:
                        const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
                  ),
                ))
            .toList(),
        onChanged: onChanged,
        validator: required
            ? (v) => v == null ? context.l10n.requiredShort : null
            : null,
      ),
    ]);
  }
}

// ════════════════════════════════════════════════════════════════
// ReviewCard — summary card in the final review step
// ════════════════════════════════════════════════════════════════

class ReviewCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<(String, String)> rows;

  const ReviewCard({
    super.key,
    required this.title,
    required this.icon,
    required this.rows,
  });

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const SizedBox.shrink();
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: PublicColors.gray200),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withAlpha(8),
              blurRadius: 8,
              offset: const Offset(0, 2))
        ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Card header
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
          child: Row(children: [
            Icon(icon, size: 16, color: PublicColors.green),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                title,
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: PublicColors.green),
              ),
            ),
          ]),
        ),
        const Divider(height: 1),

        // Rows
        LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth >= 560;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: rows.map((row) {
                final (label, value) = row;
                return Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                  child: isWide
                      ? Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(
                              width: 170,
                              child: Text(
                                label,
                                textAlign: TextAlign.right,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF666666),
                                ),
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Text(
                                value.isEmpty ? '—' : value,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              label,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF666666),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              value.isEmpty ? '—' : value,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                );
              }).toList(),
            );
          },
        ),
      ]),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// SectionDivider — labelled divider between form sections
// ════════════════════════════════════════════════════════════════

class SectionDivider extends StatelessWidget {
  final String label;
  final Color color;

  const SectionDivider({
    super.key,
    required this.label,
    this.color = Colors.teal,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(children: [
        Expanded(child: Divider(color: color.withAlpha(150))),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Text(
            label,
            style: TextStyle(
                fontSize: 11, fontWeight: FontWeight.w600, color: color),
          ),
        ),
        Expanded(child: Divider(color: color.withAlpha(150))),
      ]),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// PrefillBadge — small chip showing which form field is pre-filled
// ════════════════════════════════════════════════════════════════
//
// Usage (optional, informational):
//   PrefillBadge(label: 'ONEFOP S1.Q1')
//   PrefillBadge(label: 'DSMO raisonSociale', color: Colors.blue)

class PrefillBadge extends StatelessWidget {
  final String label;
  final Color color;

  const PrefillBadge({
    super.key,
    required this.label,
    this.color = Colors.teal,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withAlpha(60)),
      ),
      child: Text(
        label,
        style:
            TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }
}
