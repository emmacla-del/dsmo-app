// lib/services/sync_queue_service.dart
// ─────────────────────────────────────────────────────────────
// Local "outbox" for submissions that fail due to a genuine network
// problem (not a validation rejection). Items are durably queued in
// Hive and replayed through the same ApiClient used everywhere else,
// so they automatically pick up the current auth token and the
// existing error classification.
// ─────────────────────────────────────────────────────────────

import 'package:hive_flutter/hive_flutter.dart';
import '../data/api_client.dart';
import '../models/pending_submission.dart';

class SyncQueueService {
  static const String boxName = 'syncQueueBox';

  final ApiClient _api;
  Box? _box;

  SyncQueueService(this._api);

  Future<Box> _openBox() async {
    _box ??= await Hive.openBox(boxName);
    return _box!;
  }

  Future<void> enqueue({
    required String method,
    required String path,
    required Map<String, dynamic> payload,
    required String label,
  }) async {
    final box = await _openBox();
    final item = PendingSubmission(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      method: method,
      path: path,
      payload: payload,
      label: label,
      createdAt: DateTime.now(),
    );
    await box.put(item.id, item.toMap());
  }

  Future<int> pendingCount() async {
    final box = await _openBox();
    return box.length;
  }

  Future<List<PendingSubmission>> pendingItems() async {
    final box = await _openBox();
    return box.values
        .map((v) => PendingSubmission.fromMap(v as Map))
        .toList();
  }

  /// Replays every queued item once. Never loops internally — a single
  /// pass per call, so a dead network doesn't get hammered repeatedly.
  ///
  /// - 2xx → removed from the queue.
  /// - Network/server-class failure (statusCode null or >= 500) → kept,
  ///   attemptCount bumped, lastError recorded for the next flush().
  /// - Definitive 4xx → kept but no longer auto-retried (resending an
  ///   unmodified rejection will never succeed) — flagged via lastError
  ///   rather than silently dropped, so the data isn't lost.
  ///
  /// Mutates entries in place (never calls enqueue()), so a failed flush
  /// can never create a duplicate queue entry.
  Future<void> flush() async {
    final box = await _openBox();
    final items = await pendingItems();

    for (final item in items) {
      try {
        switch (item.method) {
          case 'post':
            await _api.post(item.path, data: item.payload);
            break;
          case 'patch':
            await _api.patch(item.path, data: item.payload);
            break;
          case 'put':
            await _api.put(item.path, data: item.payload);
            break;
        }
        await box.delete(item.id);
      } on ApiException catch (e) {
        item.attemptCount++;
        final retryEligible = e.statusCode == null || e.statusCode! >= 500;
        item.lastError =
            retryEligible ? e.message : '${e.statusCode}: ${e.message}';
        await box.put(item.id, item.toMap());
      } catch (e) {
        item.attemptCount++;
        item.lastError = e.toString();
        await box.put(item.id, item.toMap());
      }
    }
  }
}
