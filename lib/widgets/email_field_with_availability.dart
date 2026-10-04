import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/email_availability_provider.dart';
import 'public_chrome.dart';

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
  bool _checkFailed = false;
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
        _checkFailed = false;
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
      _checkFailed = false;
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

      try {
        final available =
            await ref.read(emailAvailabilityProvider(latestEmail).future);
        if (!mounted) return;

        setState(() {
          _dirty = true;
          _isChecking = false;
          _checkFailed = false;
          _availabilityError =
              available ? null : 'Cet email est déjà utilisé.';
        });
        widget.onEmailValidated?.call();
        widget.onEmailAvailabilityChanged?.call(available);
      } catch (e) {
        if (!mounted) return;
        // Couldn't reach the server (e.g. slow cold start) — don't claim
        // the email is taken. The backend re-checks uniqueness on submit.
        _lastCheckedEmail = null;
        setState(() {
          _dirty = false;
          _isChecking = false;
          _checkFailed = true;
          _availabilityError = null;
        });
        widget.onEmailValidated?.call();
        widget.onEmailAvailabilityChanged?.call(true);
      }
    });
  }

  Widget _statusRow({
    required IconData icon,
    required Color color,
    required String text,
  }) {
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              text,
              style: TextStyle(fontSize: 12, color: color),
            ),
          ),
        ],
      ),
    );
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Vérification...',
                    style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                  ),
                ),
              ],
            ),
          ),

        // ── Email already taken ───────────────────────────────
        if (!_isChecking && _availabilityError != null)
          _statusRow(
            icon: Icons.cancel_outlined,
            color: const Color(0xFFE24B4A),
            text: _availabilityError!,
          ),

        // ── Email available ───────────────────────────────────
        if (!_isChecking && _dirty && _availabilityError == null)
          _statusRow(
            icon: Icons.check_circle_outline,
            color: PublicColors.green,
            text: 'Email disponible',
          ),

        // ── Verification unreachable (e.g. slow/cold server) ──
        if (!_isChecking && _checkFailed)
          _statusRow(
            icon: Icons.wifi_off_rounded,
            color: const Color(0xFF94A3B8),
            text: "Vérification impossible pour l'instant, "
                'continuez — elle sera revérifiée à la soumission.',
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
      hintText: 'nom@exemple.cm',
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
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      filled: true,
      fillColor: hasError ? const Color(0xFFFEF2F2) : const Color(0xFFF8FAFC),
      border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.5)),
      enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(
              color: hasError
                  ? const Color(0xFFE24B4A)
                  : const Color(0xFFE2E8F0),
              width: 1.5)),
      focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(
              color:
                  hasError ? const Color(0xFFE24B4A) : PublicColors.green,
              width: 1.5)),
      errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFE24B4A), width: 1.5)),
      focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFE24B4A), width: 1.5)),
    );
  }
}
