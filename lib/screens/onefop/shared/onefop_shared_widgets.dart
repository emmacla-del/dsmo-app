// lib/screens/onefop/shared/onefop_shared_widgets.dart
import 'package:flutter/material.dart';
import '../../../core/theme/onefop_colors.dart';

// ============================================================
// TYPOGRAPHY
// ============================================================

TextStyle mono(double size,
        {Color color = OnefopColors.white70,
        FontWeight weight = FontWeight.normal}) =>
    TextStyle(
      fontFamily: 'monospace', // or 'Courier', 'RobotoMono'
      fontSize: size,
      color: color,
      fontWeight: weight,
      letterSpacing: 0.2,
    );

TextStyle sans(double size,
        {Color color = OnefopColors.white,
        FontWeight weight = FontWeight.normal}) =>
    TextStyle(
      fontFamily: 'Inter', // Use your Inter font
      fontSize: size,
      color: color,
      fontWeight: weight,
    );
// ============================================================
// FORMCARD
// ============================================================

class FormCard extends StatelessWidget {
  final String title;
  final Widget child;

  const FormCard({super.key, required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: OnefopColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: OnefopColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: OnefopColors.teal.withAlpha(22),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(12)),
            ),
            child: Text(title,
                style: mono(13,
                    weight: FontWeight.bold, color: OnefopColors.teal)),
          ),
          Padding(padding: const EdgeInsets.all(16), child: child),
        ],
      ),
    );
  }
}

// ============================================================
// FIELD
// focusNode and nextFocusNode are optional.
// When nextFocusNode is provided, Enter advances to it.
// When neither is provided, Enter advances via nextFocus().
// ============================================================

Widget field(
  String label,
  String hint,
  TextEditingController controller, {
  TextInputType type = TextInputType.text,
  int? maxLength,
  FocusNode? focusNode,
  FocusNode? nextFocusNode,
  VoidCallback? onSubmittedCallback,
}) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: mono(11, color: OnefopColors.white70)),
        const SizedBox(height: 4),
        _FieldInput(
          hint: hint,
          controller: controller,
          type: type,
          maxLength: maxLength,
          focusNode: focusNode,
          nextFocusNode: nextFocusNode,
          onSubmittedCallback: onSubmittedCallback,
        ),
      ],
    ),
  );
}

/// Stateful inner widget so we can attach a focus listener for
/// the teal border without rebuilding the whole form card.
class _FieldInput extends StatefulWidget {
  final String hint;
  final TextEditingController controller;
  final TextInputType type;
  final int? maxLength;
  final FocusNode? focusNode;
  final FocusNode? nextFocusNode;
  final VoidCallback? onSubmittedCallback;

  const _FieldInput({
    required this.hint,
    required this.controller,
    required this.type,
    this.maxLength,
    this.focusNode,
    this.nextFocusNode,
    this.onSubmittedCallback,
  });

  @override
  State<_FieldInput> createState() => _FieldInputState();
}

class _FieldInputState extends State<_FieldInput> {
  late final FocusNode _focus;
  bool _owned = false; // true when we created the node ourselves

  @override
  void initState() {
    super.initState();
    if (widget.focusNode != null) {
      _focus = widget.focusNode!;
    } else {
      _focus = FocusNode();
      _owned = true;
    }
    _focus.addListener(_rebuild);
  }

  @override
  void dispose() {
    _focus.removeListener(_rebuild);
    if (_owned) _focus.dispose();
    super.dispose();
  }

  void _rebuild() => setState(() {});

  void _advance() {
    if (widget.nextFocusNode != null) {
      widget.nextFocusNode!.requestFocus();
    } else if (widget.onSubmittedCallback != null) {
      widget.onSubmittedCallback!();
    } else {
      FocusScope.of(context).nextFocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    final active = _focus.hasFocus;
    return TextField(
      controller: widget.controller,
      focusNode: _focus,
      keyboardType: widget.type,
      maxLength: widget.maxLength,
      textInputAction: widget.nextFocusNode != null
          ? TextInputAction.next
          : TextInputAction.done,
      style: mono(13, color: OnefopColors.white),
      decoration: InputDecoration(
        hintText: widget.hint,
        hintStyle: mono(12, color: OnefopColors.white40),
        filled: true,
        fillColor: OnefopColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: OnefopColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: OnefopColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(
              color: active ? OnefopColors.teal : OnefopColors.border),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      ),
      onSubmitted: (_) => _advance(),
    );
  }
}

// ============================================================
// RADIOGROUP
// ============================================================

Widget radioGroup<T>(
  String label,
  List<({T value, String text})> options,
  T? selected,
  ValueChanged<T?> onChanged,
) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (label.isNotEmpty) ...[
        Text(label, style: mono(11, color: OnefopColors.white70)),
        const SizedBox(height: 8),
      ],
      ...options.map((opt) => Row(
            children: [
              Radio<T>(
                value: opt.value,
                groupValue: selected,
                onChanged: onChanged,
                activeColor: OnefopColors.teal,
              ),
              Text(opt.text, style: mono(12, color: OnefopColors.white)),
            ],
          )),
    ],
  );
}

// ============================================================
// PAGESCAFFOLD
// ============================================================

class PageScaffold extends StatelessWidget {
  final String sectionCode;
  final String sectionTitle;
  final String sectionTitleEn;
  final Widget child;

  const PageScaffold({
    super.key,
    required this.sectionCode,
    required this.sectionTitle,
    required this.sectionTitleEn,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OnefopColors.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(sectionTitle,
                  style: mono(18,
                      weight: FontWeight.bold, color: OnefopColors.white)),
              const SizedBox(height: 4),
              Text(sectionTitleEn,
                  style: mono(13, color: OnefopColors.white60)),
              const SizedBox(height: 16),
              Expanded(child: SingleChildScrollView(child: child)),
            ],
          ),
        ),
      ),
    );
  }
}

// ============================================================
// TOPBAR
// ============================================================

class TopBar extends StatelessWidget {
  final String entityLabel;
  final String stepTitle;
  final double progressValue;
  final VoidCallback? onBack;
  final int currentStep;
  final int totalSteps;

  const TopBar({
    super.key,
    required this.entityLabel,
    required this.stepTitle,
    required this.progressValue,
    this.onBack,
    required this.currentStep,
    required this.totalSteps,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      decoration: const BoxDecoration(
        color: OnefopColors.card,
        border:
            Border(bottom: BorderSide(color: OnefopColors.border, width: 0.5)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              if (onBack != null)
                GestureDetector(
                  onTap: onBack,
                  child: const Icon(Icons.arrow_back_rounded,
                      color: OnefopColors.white70, size: 22),
                ),
              Expanded(
                child: Column(
                  children: [
                    Text(entityLabel.toUpperCase(),
                        style: mono(10,
                            color: OnefopColors.teal, weight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(stepTitle,
                        style: mono(14,
                            weight: FontWeight.bold,
                            color: OnefopColors.white)),
                  ],
                ),
              ),
              if (onBack != null) const SizedBox(width: 40),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Text('$currentStep/$totalSteps',
                  style: mono(10, color: OnefopColors.white40)),
              const SizedBox(width: 8),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progressValue,
                    backgroundColor: OnefopColors.border,
                    valueColor:
                        const AlwaysStoppedAnimation<Color>(OnefopColors.teal),
                    minHeight: 4,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ============================================================
// PHASECHIPS
// ============================================================

class PhaseChips extends StatelessWidget {
  final int currentStep;
  final int totalSteps;
  final void Function(int phase) onPhaseTap;

  const PhaseChips({
    super.key,
    required this.currentStep,
    required this.totalSteps,
    required this.onPhaseTap,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: List.generate(totalSteps, (index) {
          final isActive = index == currentStep;
          final isCompleted = index < currentStep;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => onPhaseTap(index),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: isActive
                      ? OnefopColors.teal
                      : (isCompleted
                          ? OnefopColors.teal.withAlpha(30)
                          : OnefopColors.surface),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isActive ? OnefopColors.teal : OnefopColors.border,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (isCompleted)
                      const Padding(
                        padding: EdgeInsets.only(right: 6),
                        child: Icon(Icons.check_rounded,
                            size: 12, color: Colors.white),
                      ),
                    Text(
                      'Section ${index + 1}',
                      style: mono(11,
                          color: isActive || isCompleted
                              ? Colors.white
                              : OnefopColors.white70),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

// ============================================================
// RESPONDENT PAGE
// ============================================================

class RespondentPage extends StatelessWidget {
  final TextEditingController nameCtrl;
  final TextEditingController funcCtrl;
  final TextEditingController phone1Ctrl;
  final TextEditingController phone2Ctrl;
  final TextEditingController emailCtrl;

  // Focus nodes — owned by the parent form screen so they can be
  // chained across cards.
  final FocusNode? nameFocus;
  final FocusNode? funcFocus;
  final FocusNode? phone1Focus;
  final FocusNode? phone2Focus;
  final FocusNode? emailFocus;

  // ✅ NEW: callback when last field (email) is submitted
  final VoidCallback? onLastFieldSubmitted;

  const RespondentPage({
    super.key,
    required this.nameCtrl,
    required this.funcCtrl,
    required this.phone1Ctrl,
    required this.phone2Ctrl,
    required this.emailCtrl,
    this.nameFocus,
    this.funcFocus,
    this.phone1Focus,
    this.phone2Focus,
    this.emailFocus,
    this.onLastFieldSubmitted, // ✅ added
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: 16),
        _buildCard(
          title: 'S0Q01 — Nom et prénom',
          child: field(
            'Nom complet',
            'Ex: Jean Dupont',
            nameCtrl,
            focusNode: nameFocus,
            nextFocusNode: funcFocus,
          ),
        ),
        const SizedBox(height: 12),
        _buildCard(
          title: 'S0Q02 — Fonction',
          child: field(
            'Fonction',
            'Ex: DRH',
            funcCtrl,
            focusNode: funcFocus,
            nextFocusNode: phone1Focus,
          ),
        ),
        const SizedBox(height: 12),
        _buildCard(
          title: 'S0Q03 — Contact',
          child: Column(
            children: [
              field(
                'Téléphone 1',
                'Ex: 677123456',
                phone1Ctrl,
                type: TextInputType.phone,
                focusNode: phone1Focus,
                nextFocusNode: phone2Focus,
              ),

              const SizedBox(height: 12),

              field(
                'Téléphone 2',
                'Ex: 699123456',
                phone2Ctrl,
                type: TextInputType.phone,
                focusNode: phone2Focus,
                nextFocusNode: emailFocus,
              ),

              const SizedBox(height: 12),

              // ✅ CRITICAL FIX HERE
              field(
                'Email',
                'Ex: contact@entreprise.com',
                emailCtrl,
                type: TextInputType.emailAddress,
                focusNode: emailFocus,
                onSubmittedCallback:
                    onLastFieldSubmitted, // ✅ triggers step change
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _buildCard({required String title, required Widget child}) {
    return Container(
      decoration: BoxDecoration(
        color: OnefopColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: OnefopColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: OnefopColors.teal.withAlpha(20),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Text(
              title,
              style: mono(
                13,
                weight: FontWeight.bold,
                color: OnefopColors.teal,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: child,
          ),
        ],
      ),
    );
  }
}
// ============================================================
// SECTION INFO BANNER
// ============================================================

class SectionInfoBanner extends StatelessWidget {
  final String code;
  final String label;
  final String description;

  const SectionInfoBanner({
    super.key,
    required this.code,
    required this.label,
    required this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: OnefopColors.blue.withAlpha(15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: OnefopColors.blue.withAlpha(40)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: OnefopColors.blue.withAlpha(25),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(code,
                style:
                    mono(9, weight: FontWeight.bold, color: OnefopColors.blue)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: mono(12,
                        weight: FontWeight.bold, color: OnefopColors.white)),
                const SizedBox(height: 2),
                Text(description, style: sans(10, color: OnefopColors.white40)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// WELCOME CTA
// ============================================================

class WelcomeCta extends StatelessWidget {
  final VoidCallback onTap;
  const WelcomeCta({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [OnefopColors.teal, OnefopColors.teal.withGreen(80)],
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: OnefopColors.teal.withAlpha(40),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('COMMENCER',
                style: mono(14, weight: FontWeight.bold, color: Colors.white)),
            const SizedBox(width: 8),
            const Icon(Icons.arrow_forward_rounded,
                color: Colors.white, size: 18),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// STEP DOTS
// ============================================================

class StepDots extends StatelessWidget {
  final int current;
  final int total;

  const StepDots({super.key, required this.current, required this.total});

  @override
  Widget build(BuildContext context) {
    if (total > 8) {
      return Text('$current / $total',
          style: mono(11, color: OnefopColors.white40));
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(total, (i) {
        final active = i == current;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          margin: const EdgeInsets.symmetric(horizontal: 3),
          width: active ? 16 : 6,
          height: 6,
          decoration: BoxDecoration(
            color: active ? OnefopColors.teal : OnefopColors.border,
            borderRadius: BorderRadius.circular(3),
          ),
        );
      }),
    );
  }
}

// ============================================================
// NAV ICON BTN
// ============================================================

class NavIconBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const NavIconBtn({super.key, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: OnefopColors.surface,
            border: Border.all(color: OnefopColors.border),
          ),
          child: Icon(icon, size: 20, color: OnefopColors.white60),
        ),
      );
}

// ============================================================
// NAV PILL
// ============================================================

class NavPill extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final bool loading;
  final bool isSubmit;

  const NavPill({
    super.key,
    required this.label,
    required this.icon,
    this.onTap,
    this.loading = false,
    this.isSubmit = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = isSubmit ? OnefopColors.gold : OnefopColors.teal;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          color: onTap == null ? color.withAlpha(80) : color,
          borderRadius: BorderRadius.circular(24),
        ),
        child: loading
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white))
            : Row(mainAxisSize: MainAxisSize.min, children: [
                Text(label,
                    style:
                        mono(13, weight: FontWeight.w700, color: Colors.white)),
                const SizedBox(width: 6),
                Icon(icon, size: 15, color: Colors.white),
              ]),
      ),
    );
  }
}
