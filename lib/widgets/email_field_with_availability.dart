import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/email_availability_provider.dart';

/// A self-contained email form field that checks availability in real‑time.
class EmailFieldWithAvailability extends ConsumerStatefulWidget {
  final TextEditingController controller;
  final String label;
  final bool isRequired;
  final VoidCallback? onEmailValidated;
  final void Function(bool)? onEmailAvailabilityChanged;

  const EmailFieldWithAvailability({
    super.key,
    required this.controller,
    required this.label,
    this.isRequired = true,
    this.onEmailValidated,
    this.onEmailAvailabilityChanged,
  });

  @override
  ConsumerState<EmailFieldWithAvailability> createState() =>
      _EmailFieldWithAvailabilityState();
}

class _EmailFieldWithAvailabilityState
    extends ConsumerState<EmailFieldWithAvailability> {
  Timer? _debounce;
  String? _availabilityError;
  bool _isChecking = false;
  bool _dirty = false;
  String? _lastCheckedEmail;

  static final _emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$');

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onEmailChanged);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    widget.controller.removeListener(_onEmailChanged);
    super.dispose();
  }

  void _onEmailChanged() {
    final email = widget.controller.text.trim();
    _debounce?.cancel();

    if (email.isEmpty) {
      setState(() {
        _availabilityError = null;
        _isChecking = false;
        _dirty = false;
        _lastCheckedEmail = null;
      });
      widget.onEmailValidated?.call();
      widget.onEmailAvailabilityChanged?.call(true);
      return;
    }

    // Clear stale error immediately when user starts typing again
    setState(() {
      _availabilityError = null;
      _dirty = false;
    });
    widget.onEmailAvailabilityChanged?.call(true);

    _debounce = Timer(const Duration(milliseconds: 500), () async {
      if (!mounted) return;

      final latestEmail = widget.controller.text.trim();

      if (!_emailRegex.hasMatch(latestEmail)) {
        setState(() => _isChecking = false);
        widget.onEmailAvailabilityChanged?.call(true);
        return;
      }

      // Skip if we already checked this exact email
      if (latestEmail == _lastCheckedEmail) return;
      _lastCheckedEmail = latestEmail;

      setState(() => _isChecking = true);

      final available =
          await ref.read(emailAvailabilityProvider(latestEmail).future);
      if (!mounted) return;

      setState(() {
        _dirty = true;
        _isChecking = false;
        _availabilityError = available ? null : 'Cet email est déjà utilisé.';
      });
      widget.onEmailValidated?.call();
      widget.onEmailAvailabilityChanged?.call(available);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextFormField(
          controller: widget.controller,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
          decoration: _modernEmailInput(
            label: widget.label,
            isChecking: _isChecking,
            hasError: _availabilityError != null,
          ),
          validator: (v) {
            if (widget.isRequired && (v == null || v.trim().isEmpty)) {
              return 'Email requis';
            }
            if (v != null && v.trim().isNotEmpty) {
              if (!_emailRegex.hasMatch(v.trim())) {
                return 'Email invalide';
              }
              if (_availabilityError != null) return _availabilityError;
            }
            return null;
          },
        ),

        // ── Checking spinner ──────────────────────────────────
        if (_isChecking)
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Row(
              children: [
                SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                SizedBox(width: 8),
                Text(
                  'Vérification...',
                  style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
          ),

        // ── Email already taken ───────────────────────────────
        if (!_isChecking && _availabilityError != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(
              children: [
                const Icon(Icons.cancel_outlined,
                    size: 14, color: Color(0xFFE24B4A)),
                const SizedBox(width: 6),
                Text(
                  _availabilityError!,
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFFE24B4A)),
                ),
              ],
            ),
          ),

        // ── Email available ───────────────────────────────────
        if (!_isChecking && _dirty && _availabilityError == null)
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Row(
              children: [
                Icon(Icons.check_circle_outline,
                    size: 14, color: Color(0xFF006B5E)),
                SizedBox(width: 6),
                Text(
                  'Email disponible',
                  style: TextStyle(fontSize: 12, color: Color(0xFF006B5E)),
                ),
              ],
            ),
          ),
      ],
    );
  }

  InputDecoration _modernEmailInput({
    required String label,
    required bool isChecking,
    required bool hasError,
  }) {
    return InputDecoration(
      labelText: label,
      prefixIcon: const Icon(Icons.email_outlined, size: 20),
      suffixIcon: isChecking
          ? const SizedBox(
              width: 20,
              height: 20,
              child: Padding(
                padding: EdgeInsets.all(4),
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          : null,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      filled: true,
      fillColor: hasError ? const Color(0xFFFEF2F2) : const Color(0xFFF8FAFC),
      border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(
              color: hasError
                  ? const Color(0xFFE24B4A)
                  : const Color(0xFFE2E8F0))),
      focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(
              color:
                  hasError ? const Color(0xFFE24B4A) : const Color(0xFF006B5E),
              width: 2)),
      errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE24B4A))),
      focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE24B4A), width: 2)),
    );
  }
}
