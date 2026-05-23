// lib/screens/register_widgets.dart

import 'package:flutter/material.dart';
import 'register_constants.dart'
    show
        kStepRole,
        kStepEntityType,
        kStepRespondent,
        kStepEntityInfo,
        kStepLocation,
        kStepMinefopInfo,
        kStepSecurity,
        kStepReview,
        modernInput,
        modernDropdown,
        entityConfigs,
        EntityConfig;
// kPhoneFormatters is resolved exclusively from cameroon_phone_validator
// to avoid the ambiguous-import conflict with register_constants.dart.
import '../core/focus/utils/cameroon_phone_validator.dart';
import '../data/minefop_models.dart' show EntityType;

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

  String get _title {
    switch (step) {
      case kStepRole:
        return 'Type de compte';
      case kStepEntityType:
        return "Type d'entité";
      case kStepRespondent:
        return 'Informations du répondant';
      case kStepEntityInfo:
        return "Informations de l'entité";
      case kStepLocation:
        return 'Localisation';
      case kStepMinefopInfo:
        return 'Informations MINEFOP';
      case kStepSecurity:
        return 'Sécurité';
      case kStepReview:
        return 'Récapitulatif';
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
          color: const Color(0xFF006B5E),
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
                      _title,
                      style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF006B5E)),
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
                  backgroundColor: Colors.grey.shade200,
                  color: const Color(0xFF006B5E),
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
            color: isSelected ? color : Colors.grey.shade300,
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
              color: isSelected ? color : Colors.grey.shade300,
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

  String _subtitle(EntityType type) {
    switch (type) {
      case EntityType.enterprise:
        return 'Société commerciale, SA, SARL, établissement à but lucratif.';
      case EntityType.cooperative:
        return "Société coopérative ou groupement d'intérêt économique.";
      case EntityType.ctd:
        return 'Collectivité Territoriale Décentralisée (commune, région).';
      case EntityType.ong:
        return 'Organisation Non Gouvernementale ou association.';
      case EntityType.vocational:
        return 'Centre de formation technique et professionnelle agréé.';
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
            color: isSelected ? config.color : Colors.grey.shade300,
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
                    Text(config.title,
                        style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: isSelected ? config.color : Colors.black87)),
                    const SizedBox(height: 3),
                    Text(_subtitle(type),
                        style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF666666),
                            height: 1.4)),
                  ]),
            ),
            const SizedBox(width: 6),
            Icon(
              isSelected ? Icons.check_circle : Icons.circle_outlined,
              color: isSelected ? config.color : Colors.grey.shade300,
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
      cameroonPhoneError(widget.controller.text, required: widget.isRequired) !=
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
        labelText: widget.label,
        hintText: widget.isRequired ? '6XXXXXXXX' : 'Optionnel',
        prefixIcon: Icon(
          Icons.phone_outlined,
          size: 20,
          color: _hasError ? const Color(0xFFE24B4A) : null,
        ),
        suffixText: _dirty ? '$length / 9' : null,
        suffixStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: length == 9
              ? const Color(0xFF006B5E)
              : _hasError
                  ? const Color(0xFFE24B4A)
                  : const Color(0xFF94A3B8),
        ),
      ),
      validator: (v) => cameroonPhoneError(v, required: widget.isRequired),
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
                (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null
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
  final String label;
  const LoadingField({super.key, required this.label});

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      FieldLabel(label: label),
      const SizedBox(height: 6),
      Container(
        height: 52,
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Center(
            child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2))),
      ),
    ]);
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
        validator: required ? (v) => v == null ? 'Requis' : null : null,
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
        border: Border.all(color: Colors.grey.shade200),
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
            Icon(icon, size: 16, color: const Color(0xFF006B5E)),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                title,
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF006B5E)),
              ),
            ),
          ]),
        ),
        const Divider(height: 1),

        // Rows
        ...rows.map((row) {
          final (label, value) = row;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 140,
                  child: Text(label,
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF666666))),
                ),
                Expanded(
                    child: Text(
                  value.isEmpty ? '—' : value,
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w500),
                )),
              ],
            ),
          );
        }),
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
