// lib/providers/sync_queue_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'providers.dart';
import '../services/sync_queue_service.dart';

final syncQueueServiceProvider = Provider<SyncQueueService>((ref) {
  return SyncQueueService(ref.read(apiClientProvider));
});

/// Bumped manually right after enqueue()/flush() calls — mirrors the
/// existing manual-refresh pattern already used for employeeListProvider
/// rather than adding a new Hive-watch/stream mechanism.
final pendingSubmissionCountProvider = StateProvider<int>((ref) => 0);
