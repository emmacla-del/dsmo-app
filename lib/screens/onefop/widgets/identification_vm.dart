import 'package:flutter/material.dart';

class IdentificationVM {
  final Map<String, dynamic> values = {};
  final Map<String, TextEditingController> controllers = {};

  /// GET VALUE SAFE
  T get<T>(String key, {T? fallback}) {
    return (values[key] ?? fallback) as T;
  }

  /// SET VALUE
  void set<T>(String key, T value) {
    values[key] = value;
  }

  /// CONTROLLER FACTORY
  TextEditingController controller(String key) {
    return controllers.putIfAbsent(
      key,
      () => TextEditingController(
        text: values[key]?.toString() ?? '',
      ),
    );
  }

  /// CLEANUP
  void dispose() {
    for (final c in controllers.values) {
      c.dispose();
    }
  }
}
