// lib/screens/registration_status_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/i18n/l10n_ext.dart';
import '../data/api_client.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../widgets/public_chrome.dart';

/// Where a company lands after self-registration, and after every login,
/// until a reviewer activates the account (R.1).
///
/// A company in PENDING_APPROVAL or COMPLEMENTS_REQUESTED holds a real
/// session — it just has no operational screens yet — so this is the only
/// place it can go. In COMPLEMENTS_REQUESTED it also shows the reviewer's
/// message and offers to resubmit the file.
class RegistrationStatusScreen extends ConsumerStatefulWidget {
  const RegistrationStatusScreen({super.key});

  @override
  ConsumerState<RegistrationStatusScreen> createState() =>
      _RegistrationStatusScreenState();
}

class _RegistrationStatusScreenState
    extends ConsumerState<RegistrationStatusScreen> {
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    // The decision may have been taken while the app was closed, so the
    // cached user can be stale on arrival. refreshUser() is best-effort and
    // keeps the cached user on failure.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authProvider.notifier).refreshUser();
    });
  }

  Future<void> _refresh() async {
    setState(() => _busy = true);
    try {
      await ref.read(authProvider.notifier).refreshUser();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resubmit() async {
    setState(() => _busy = true);
    try {
      await ref.read(apiClientProvider).resubmitRegistration();
      await ref.read(authProvider.notifier).refreshUser();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(context.l10n.registrationResubmitDoneMessage),
          backgroundColor: PublicColors.green,
        ));
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.message),
          backgroundColor: PublicColors.red,
        ));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _logout() async {
    await ref.read(authProvider.notifier).logout();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;

    // An activated account has nothing to read here any more.
    ref.listen<AsyncValue<User?>>(authProvider, (_, next) {
      final updated = next.value;
      if (updated != null &&
          updated.role == 'COMPANY' &&
          updated.status == 'ACTIVE') {
        context.go('/home');
      }
    });

    final status = user?.status;
    final complements = status == 'COMPLEMENTS_REQUESTED';
    final rejected = status == 'REJECTED';

    return Scaffold(
      backgroundColor: PublicColors.bg,
      appBar: AppBar(
        title: Text(context.l10n.registrationStatusTitle),
        backgroundColor: PublicColors.green,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  rejected
                      ? Icons.cancel_outlined
                      : complements
                          ? Icons.edit_note_outlined
                          : Icons.hourglass_top_outlined,
                  size: 48,
                  color: rejected ? PublicColors.red : PublicColors.green,
                ),
                const SizedBox(height: 16),
                Text(
                  rejected
                      ? context.l10n.registrationRejectedHeadline
                      : complements
                          ? context.l10n.registrationComplementsHeadline
                          : context.l10n.registrationPendingHeadline,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: PublicColors.gray900,
                  ),
                ),
                const SizedBox(height: 12),
                if (rejected) ...[
                  Text(
                    user?.rejectionReason?.trim().isNotEmpty == true
                        ? user!.rejectionReason!
                        : context.l10n.registrationRejectedNoReason,
                    style: const TextStyle(
                      fontSize: 15,
                      height: 1.5,
                      color: PublicColors.gray700,
                    ),
                  ),
                ] else if (complements) ...[
                  Text(
                    context.l10n.registrationComplementsIntro,
                    style: const TextStyle(
                      fontSize: 15,
                      height: 1.5,
                      color: PublicColors.gray700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    user?.approvalComment?.trim().isNotEmpty == true
                        ? user!.approvalComment!
                        : context.l10n.registrationComplementsFallback,
                    style: const TextStyle(
                      fontSize: 15,
                      height: 1.5,
                      fontWeight: FontWeight.w600,
                      color: PublicColors.gray900,
                    ),
                  ),
                ] else
                  Text(
                    context.l10n.registrationAwaitingReviewMessage,
                    style: const TextStyle(
                      fontSize: 15,
                      height: 1.5,
                      color: PublicColors.gray700,
                    ),
                  ),
                const SizedBox(height: 24),
                // One primary action per screen: resubmitting when that is
                // what the reviewer asked for, refreshing otherwise.
                if (complements)
                  FilledButton(
                    onPressed: _busy ? null : _resubmit,
                    style: FilledButton.styleFrom(
                      backgroundColor: PublicColors.green,
                    ),
                    child: Text(context.l10n.registrationResubmitButton),
                  )
                else if (!rejected)
                  FilledButton(
                    onPressed: _busy ? null : _refresh,
                    style: FilledButton.styleFrom(
                      backgroundColor: PublicColors.green,
                    ),
                    child: Text(context.l10n.registrationStatusRefreshButton),
                  ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: _busy ? null : _logout,
                  child: Text(context.l10n.registrationStatusLogoutButton),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
