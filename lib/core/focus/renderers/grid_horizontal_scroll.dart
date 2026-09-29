// lib/core/focus/renderers/grid_horizontal_scroll.dart
//
// Wraps a GridLayoutEngine table too wide for its available space in a
// horizontal scroll — without this, the hard cut mid-header (e.g. "Total"
// clipped to "T" on a narrow phone) reads as a rendering bug rather than
// "scroll for more". Extracted from generic_spreadsheet_table.dart's own
// (formerly private) _HorizontalScrollTable so VtSpreadsheetTable can share
// the exact same fade-hint/swipe-hint behavior instead of re-implementing
// it — the two are visually identical desktop-table chrome, not two
// independent designs.

import 'package:flutter/material.dart';
import 'grid_theme.dart';
import '../../i18n/localized_text.dart';
import '../../i18n/l10n_ext.dart';

// Stateful only to track scroll position for the fade/hint below, which
// hide themselves once the user has actually scrolled to the true right
// edge.
class GridHorizontalScrollTable extends StatefulWidget {
  final Widget grid;
  const GridHorizontalScrollTable({super.key, required this.grid});

  @override
  State<GridHorizontalScrollTable> createState() => _GridHorizontalScrollTableState();
}

class _GridHorizontalScrollTableState extends State<GridHorizontalScrollTable> {
  final _controller = ScrollController();
  bool _hasMoreToScroll = true;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_updateHasMoreToScroll);
    // The controller has no attached position until after the first
    // layout pass, so the real extent isn't known synchronously here.
    WidgetsBinding.instance.addPostFrameCallback((_) => _updateHasMoreToScroll());
  }

  void _updateHasMoreToScroll() {
    if (!_controller.hasClients) return;
    final remaining = _controller.position.maxScrollExtent - _controller.position.pixels;
    final hasMore = remaining > 1;
    if (hasMore != _hasMoreToScroll) {
      setState(() => _hasMoreToScroll = hasMore);
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_updateHasMoreToScroll);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Stack(
          children: [
            SingleChildScrollView(
              controller: _controller,
              scrollDirection: Axis.horizontal,
              child: widget.grid,
            ),
            if (_hasMoreToScroll)
              Positioned(
                top: 0,
                right: 0,
                bottom: 0,
                child: IgnorePointer(
                  child: Container(
                    width: 28,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                        colors: [
                          Colors.white.withValues(alpha: 0),
                          Colors.white.withValues(alpha: 0.95),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
        if (_hasMoreToScroll)
          Padding(
            padding: const EdgeInsets.only(top: 4, bottom: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.swipe_left_alt_rounded, size: 14, color: GridTheme.borderColor),
                const SizedBox(width: 4),
                Text(
                  const LocalizedText(
                    fr: 'Faites glisser pour voir plus',
                    en: 'Swipe to see more',
                  ).of(context.loc),
                  style: const TextStyle(fontSize: 11, color: GridTheme.borderColor),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
