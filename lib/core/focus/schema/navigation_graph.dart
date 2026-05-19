// lib/core/focus/schema/navigation_graph.dart

import 'types.dart'; // Import Direction from the same file

class NavigationGraph {
  final Map<String, String?> next;
  final Map<String, String?> prev;
  final Map<String, Map<Direction, String?>> gridNeighbors;

  const NavigationGraph({
    required this.next,
    required this.prev,
    required this.gridNeighbors,
  });

  String? getNext(String id) => next[id];
  String? getPrev(String id) => prev[id];
  String? getGridNeighbor(String id, Direction direction) =>
      gridNeighbors[id]?[direction];

  void validate() {
    final visited = <String>{};
    final recursionStack = <String>{};

    bool hasCycle(String node) {
      if (recursionStack.contains(node)) return true;
      if (visited.contains(node)) return false;

      visited.add(node);
      recursionStack.add(node);

      final nextNode = next[node];
      if (nextNode != null && hasCycle(nextNode)) {
        return true;
      }

      recursionStack.remove(node);
      return false;
    }

    for (final node in next.keys) {
      if (hasCycle(node)) {
        throw Exception('Navigation cycle detected at: $node');
      }
    }
  }
}
