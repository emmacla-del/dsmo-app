// lib/models/pending_submission.dart
import 'dart:convert';

/// One durable entry in the offline submission outbox. Stored in a plain
/// Hive box as a Map<String, dynamic> (no custom TypeAdapter — the payload
/// is arbitrary nested JSON, not a fixed-shape record, so a hand-rolled
/// positional BinaryReader/Writer is exactly the wrong tool here).
///
/// [payload] is round-tripped through jsonEncode/jsonDecode rather than
/// stored as a raw nested Map, so storage never depends on Hive's nested
/// type support — safe by construction, since every queued payload already
/// has to be JSON-serializable today to be POSTed as a request body.
class PendingSubmission {
  final String id;
  final String method; // post | patch | put
  final String path;
  final Map<String, dynamic> payload;
  final String label;
  final DateTime createdAt;
  int attemptCount;
  String? lastError;

  PendingSubmission({
    required this.id,
    required this.method,
    required this.path,
    required this.payload,
    required this.label,
    required this.createdAt,
    this.attemptCount = 0,
    this.lastError,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'method': method,
        'path': path,
        'payload': jsonEncode(payload),
        'label': label,
        'createdAt': createdAt.toIso8601String(),
        'attemptCount': attemptCount,
        'lastError': lastError,
      };

  factory PendingSubmission.fromMap(Map map) => PendingSubmission(
        id: map['id'] as String,
        method: map['method'] as String,
        path: map['path'] as String,
        payload: Map<String, dynamic>.from(jsonDecode(map['payload'] as String) as Map),
        label: map['label'] as String,
        createdAt: DateTime.parse(map['createdAt'] as String),
        attemptCount: map['attemptCount'] as int? ?? 0,
        lastError: map['lastError'] as String?,
      );
}
