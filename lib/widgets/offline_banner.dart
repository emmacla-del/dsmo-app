// lib/widgets/offline_banner.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme/app_theme.dart';
import '../providers/connectivity_provider.dart';
import '../providers/sync_queue_provider.dart';

/// Slim app-wide bar showing connectivity state and any unsynced
/// submissions. Collapses to nothing when online with an empty queue.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  Future<void> _retry(WidgetRef ref) async {
    await ref.read(syncQueueServiceProvider).flush();
    final count = await ref.read(syncQueueServiceProvider).pendingCount();
    ref.read(pendingSubmissionCountProvider.notifier).state = count;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isOnline = ref.watch(isOnlineProvider);
    final pendingCount = ref.watch(pendingSubmissionCountProvider);

    if (isOnline && pendingCount == 0) return const SizedBox.shrink();

    final String message;
    final Color color;
    if (!isOnline) {
      message = pendingCount > 0
          ? 'Hors ligne — $pendingCount élément(s) en attente / Offline — $pendingCount pending'
          : 'Hors ligne — Mode dégradé / Offline mode';
      color = AppColors.danger;
    } else {
      message =
          '$pendingCount élément(s) en attente d\'envoi / $pendingCount item(s) pending';
      color = AppColors.warning;
    }

    return Material(
      color: color,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              Icon(isOnline ? Icons.cloud_upload_outlined : Icons.cloud_off,
                  color: Colors.white, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  message,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                ),
              ),
              if (pendingCount > 0)
                TextButton(
                  onPressed: () => _retry(ref),
                  style: TextButton.styleFrom(foregroundColor: Colors.white),
                  child: const Text('Réessayer'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
