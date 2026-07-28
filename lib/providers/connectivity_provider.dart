// lib/providers/connectivity_provider.dart
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// True when the device radio reports a link (wifi/cellular/ethernet).
/// Cheap, instant signal for the offline banner only — it does NOT
/// guarantee the backend is reachable. The authoritative signal for
/// whether to queue a failed submission is the DioException type seen
/// by ApiClient, not this provider.
final connectivityProvider = StreamProvider<bool>((ref) {
  final connectivity = Connectivity();
  return connectivity.onConnectivityChanged.map(
    (results) => !results.contains(ConnectivityResult.none),
  );
});

/// Synchronous-friendly bool. Defaults to "online" before the first event
/// arrives, to avoid a flash of the offline banner at cold start.
final isOnlineProvider = Provider<bool>((ref) {
  return ref.watch(connectivityProvider).maybeWhen(
        data: (online) => online,
        orElse: () => true,
      );
});
