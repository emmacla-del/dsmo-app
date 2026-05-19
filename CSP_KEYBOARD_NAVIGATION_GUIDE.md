# CSP Fast Entry Mode - Keyboard Navigation Guide

## 🎯 Overview
Complete desktop-optimized data entry system with full keyboard navigation support for the CSP (Cadres/Supervisory Personnel) table.

## 🎹 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Arrow Keys** ↑↓←→ | Navigate 2D grid (up/down rows, left/right columns) |
| **Tab** | Move to next cell (linear) |
| **Shift+Tab** | Move to previous cell (linear) |
| **Enter** | Confirm current value and advance to next cell |
| **Backspace** | Clear input field |

## 📊 Table Structure

The CSP table has the following layout:
```
Rows (3):           Columns (6 per row):
- Executives        - Male 15-24, Male 25-34, Male 35+
- Foremen           - Female 15-24, Female 25-34, Female 35+
- Field Workers     
```

**Total cells**: 18 cells (3 rows × 6 columns)

Navigation path with arrow keys:
```
    M 15-24  M 25-34  M 35+  F 15-24  F 25-34  F 35+
Exec   [1]    [2]     [3]     [4]      [5]      [6]
Foremen [7]   [8]     [9]    [10]     [11]     [12]
Workers [13]  [14]   [15]    [16]     [17]     [18]
```

## 🖥️ UI Components

### 1. CspFastEntryMode Widget
Main entry interface with:
- Large, centered numeric input field
- Keyboard navigation handler
- Current cell context display (position, category, gender, age)
- Data overview showing running totals
- Previous/Next buttons for mouse users
- Auto-advancing on value entry

**Example Usage:**
```dart
CspFastEntryMode(
  table: table,
  onChanged: () {
    setState(() {});
  },
)
```

### 2. CspTableGridWidget
Reference table showing all data in grid format:
- Full DataTable matching the original form layout
- Highlights current active cell
- Shows all totals (male, female, overall)
- Color-coded sections

**Example Usage:**
```dart
CspTableGridWidget(
  table: table,
  highlightCell: cursor.current, // Optional: highlight active cell
)
```

### 3. Integration Example
Display both entry mode and reference table side-by-side:

```dart
class CspDataEntryScreen extends StatefulWidget {
  @override
  State<CspDataEntryScreen> createState() => _CspDataEntryScreenState();
}

class _CspDataEntryScreenState extends State<CspDataEntryScreen> {
  late CspGenderAgeTable table;

  @override
  void initState() {
    super.initState();
    table = CspGenderAgeTable(
      executives: GenderAgeBreakdown(...),
      foremen: GenderAgeBreakdown(...),
      fieldWorkers: GenderAgeBreakdown(...),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('CSP Data Entry')),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              // Reference table (scrollable)
              Expanded(
                child: CspTableGridWidget(table: table),
              ),
              const SizedBox(height: 20),
              const Divider(),
              const SizedBox(height: 20),
              
              // Entry form
              CspFastEntryMode(
                table: table,
                onChanged: () {
                  setState(() {});
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

## 🔧 Navigation Classes

### CspFastCursor
Manages current position in the table grid.

**Methods:**
- `next()` - Advance to next cell (linear)
- `previous()` - Go to previous cell (linear)
- `moveRight()` - Move one column right
- `moveLeft()` - Move one column left
- `moveDown()` - Move one row down
- `moveUp()` - Move one row up

**Properties:**
- `current` - Get current cell reference
- `position` - 0-based index (0-17)
- `length` - Total cells (18)
- `isFirst` - Is at first cell
- `isLast` - Is at last cell

### CspCellRef
References a specific cell in the table.

**Properties:**
- `csp` - Category: 'executives' | 'foremen' | 'fieldWorkers'
- `ageField` - Age band: AgeField.age15_24 | .age25_34 | .age35plus
- `gender` - Gender type: GenderType.male | .female

### CspCursorBuilder
Creates cursor navigation structures.

**Methods:**
- `build()` - Returns flat list of all cells (for linear navigation)
- `build2D()` - Returns nested list by row (for 2D navigation)

## 📱 Workflow

### Typical Data Entry Session:
1. **Focus**: Input field auto-focuses on load
2. **Entry**: User types numeric value
3. **Confirmation**: Press Enter or Tab
4. **Auto-advance**: Cursor moves to next cell, input clears
5. **Navigation**: Use arrow keys to jump around as needed
6. **Context**: Always shows current cell category and position
7. **Review**: Reference table shows all entered data with totals

## 🎨 Visual Feedback

- **Current Cell Position**: "1/18 • Executives • Male 15-24"
- **Data Overview**: Running totals for each category
- **Table Highlighting**: Active cell highlighted in reference grid
- **Status Indicators**: Shows male/female/total counts
- **Input Hints**: "Type value (current: 0)"

## 🚀 Performance Notes

- **No network calls** - All data manipulation is local
- **Efficient state updates** - Only updates on data change
- **Smooth keyboard handling** - RawKeyboardListener for low-latency input
- **Minimal redraws** - Strategic use of setState()

## 🐛 Debugging

If keyboard navigation isn't working:
1. Verify input field has focus: `inputFocusNode.requestFocus()`
2. Check that RawKeyboardListener is wrapping the build
3. Confirm cursor position updates: Print `cursor.position` on key events
4. Test with different keys: Arrow vs Tab navigation

## 📝 File Structure

```
lib/screens/onefop/widgets/csp_fast_entry/
├── csp_fast_entry_mode.dart          ← Main entry widget
├── csp_table_grid_widget.dart        ← Reference table display
├── csp_fast_cursor.dart              ← Navigation logic
├── csp_cursor_builder.dart           ← Cursor initialization
├── csp_cell_ref.dart                 ← Cell reference types
├── csp_intelligence_engine.dart      ← Validation logic
├── csp_intelligence_models.dart      ← Data models
└── csp_block.dart                    ← Block display
```

## ✅ Testing Checklist

- [ ] Tab key moves to next cell
- [ ] Shift+Tab moves to previous cell
- [ ] Arrow keys navigate 2D grid correctly
- [ ] Enter confirms and moves forward
- [ ] Input field maintains focus after navigation
- [ ] Cell position display updates correctly
- [ ] Reference table highlights current cell
- [ ] Data totals update in real-time
- [ ] No crashes on edge cells (first/last)
- [ ] Keyboard shortcut help displays correctly

---

**Version**: 1.0 (Desktop-optimized)  
**Status**: Production-ready  
**Last Updated**: April 2026
