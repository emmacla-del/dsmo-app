// lib/core/focus/utils/vt_quiz.dart
//
// The training-centre (vocational training) preliminary quiz: which tables
// apply. Dart port of react-web/src/lib/vt-quiz.ts — the two must give the
// same answers, because the server checks what either app submits by the
// same rule (OnefopShadowValidatorService.incompleteVtTables):
//
//   quiz-governed table   Oui → REPORTED · Non → NONE · unanswered → undecided
//   4.6 (FI years)        REPORTED when 2.1.14 includes Formation Initiale, else NONE
//   every other table     always REPORTED (an operating centre always has them)
//
// A centre declared non-functional or closed in 1.12 answers Section 1 only:
// no quiz, no table statuses. The quiz gates tables only — never an ordinary
// question. Answers live in data['_scopeConfig']['vocationalTraining'].

import '../../i18n/localized_text.dart';
import '../renderers/vt_table_defs.dart';
import '../renderers/vt_table_types.dart';
import '../schema/field_schema.dart';

class VtQuizQuestion {
  final String id;
  final String tableId;
  final String tableCode;
  final LocalizedText text;

  /// Asked only when this question is answered Oui.
  final String? parent;

  const VtQuizQuestion({
    required this.id,
    required this.tableId,
    required this.tableCode,
    required this.text,
    this.parent,
  });
}

const List<VtQuizQuestion> kVtQuizQuestions = [
  VtQuizQuestion(
    id: 'unemployedQualified',
    tableId: 'VT4_3',
    tableCode: '4.3',
    text: LocalizedText(
      fr: 'Avez-vous des apprenants qualifiés, en âge de travailler et non occupés ?',
      en: 'Do you have qualified learners of working age who are not in work?',
    ),
  ),
  VtQuizQuestion(
    id: 'informalSector',
    tableId: 'VT4_4',
    tableCode: '4.4',
    text: LocalizedText(
      fr: 'Avez-vous des apprenants travaillant dans le secteur informel ?',
      en: 'Do you have learners working in the informal sector?',
    ),
  ),
  VtQuizQuestion(
    id: 'vulnerable',
    tableId: 'VT4_9',
    tableCode: '4.9',
    text: LocalizedText(
      fr: 'Accueillez-vous des personnes socialement vulnérables (handicap, réfugiés, déplacés internes, orphelins, populations autochtones…) ?',
      en: 'Do you train socially vulnerable people (disability, refugees, internally displaced, orphans, indigenous peoples…)?',
    ),
  ),
  VtQuizQuestion(
    id: 'scholarships',
    tableId: 'VT4_11',
    tableCode: '4.11',
    text: LocalizedText(
      fr: 'Des apprenants bénéficient-ils de bourses ?',
      en: 'Do any learners receive scholarships?',
    ),
  ),
  VtQuizQuestion(
    id: 'formerStudents',
    tableId: 'VT4_10',
    tableCode: '4.10',
    text: LocalizedText(
      fr: "Avez-vous eu des sortants l'année antérieure ?",
      en: 'Did you have outgoing trainees last year?',
    ),
  ),
  VtQuizQuestion(
    id: 'formerStudentsPlaced',
    tableId: 'VT6_13',
    tableCode: '6.3',
    parent: 'formerStudents',
    text: LocalizedText(
      fr: "Des sortants de l'année antérieure ont-ils été insérés ?",
      en: "Were any of last year's outgoing trainees placed in work?",
    ),
  ),
  VtQuizQuestion(
    id: 'trainersWithDisability',
    tableId: 'VT8_6',
    tableCode: '8.6',
    text: LocalizedText(
      fr: 'Avez-vous des formateurs en situation de handicap ?',
      en: 'Do you have trainers with a disability?',
    ),
  ),
];

const String kVtReported = 'REPORTED';
const String kVtNone = 'NONE';

/// Where a training-centre table's status is recorded in the submission.
String vtStatusKey(String tableId) => '${tableId}_RESPONSE_STATUS';

/// 1.12 says the centre is non-functional or closed: Section 1 only.
bool isVtCentreClosed(Map<String, dynamic> data) {
  final status = data['VT1_12'];
  return status is String &&
      (status.startsWith('Non-fonctionnelle') || status.startsWith('Fermée'));
}

/// Sections 2–9 of a closed or non-functional centre are not answered.
bool isVtSectionWaived(String sectionId, Map<String, dynamic> data) =>
    sectionId.endsWith('_vocationalTraining') &&
    sectionId != 'section1_vocationalTraining' &&
    isVtCentreClosed(data);

Map<String, dynamic>? readVtQuiz(Map<String, dynamic> data) {
  final scope = data['_scopeConfig'];
  if (scope is! Map) return null;
  final vt = scope['vocationalTraining'];
  return vt is Map ? Map<String, dynamic>.from(vt) : null;
}

/// Whether a question is asked, given the answers so far.
bool isVtQuizQuestionAsked(VtQuizQuestion q, Map<String, dynamic>? answers) =>
    q.parent == null || answers?[q.parent] == true;

/// Every asked question answered Oui or Non.
bool isVtQuizComplete(Map<String, dynamic>? answers) {
  if (answers == null) return false;
  return kVtQuizQuestions
      .every((q) => !isVtQuizQuestionAsked(q, answers) || answers[q.id] is bool);
}

VtQuizQuestion? vtQuizQuestionForTable(String tableId) {
  for (final q in kVtQuizQuestions) {
    if (q.tableId == tableId) return q;
  }
  return null;
}

/// A training-centre table's status from the quiz and 2.1.14, or null while
/// the quiz question that decides it is unanswered.
String? vtTableStatus(String tableId, Map<String, dynamic> data) {
  if (tableId == 'VT4_6') {
    final types = data['VT2_18'];
    final hasFi = types is List &&
        types.any((t) => t is String && t.startsWith('Formation Initiale'));
    return hasFi ? kVtReported : kVtNone;
  }
  final q = vtQuizQuestionForTable(tableId);
  if (q == null) return kVtReported;
  final answers = readVtQuiz(data);
  if (answers == null) return null;
  if (q.parent != null && answers[q.parent] == false) return kVtNone;
  final answer = answers[q.id];
  if (answer == true) return kVtReported;
  if (answer == false) return kVtNone;
  return null;
}

/// The VT table definition behind a compiled table field, if it is one.
VtTableDef? vtTableDefForField(FieldSchema f) {
  final spec = f.tableSpec;
  final template = spec?['template'] as String?;
  if (spec == null || template == null) return null;
  return vtTableDefFor(template, spec);
}

bool _entered(dynamic v) => v != null && !(v is String && v.trim().isEmpty);

bool _isTrue(dynamic v) => v == true || v == 'true' || v == 'Oui/ Yes' || v == '1';

/// Cells missing from a REPORTED training-centre table. Fixed-row tables need
/// every count (0 allowed). Row-by-row tables (specialties, staff list) need
/// at least one row, and every started row complete: a specialty row its
/// name and every count, "homologué" only when the curriculum exists; a staff
/// row its name, first name and sex. Computed totals are never required.
/// Returns the missing cell ids, or [tableId] alone when no row was started.
List<String> missingVtTableCells(
    String tableId, VtTableDef def, Map<String, dynamic> data) {
  final rowByRow = def.progressiveRows || def.isRoster;
  final missing = <String>[];
  var startedRows = 0;
  for (final row in def.rows) {
    final started = def.cells.any((c) =>
        c.kind != VtCellKind.computed && _entered(data[def.cellId(row, c)]));
    if (rowByRow && !started) continue;
    startedRows++;
    for (final cell in def.cells) {
      if (cell.kind == VtCellKind.computed) continue;
      if (def.isRoster &&
          !const {'lastName', 'firstName', 'sex'}.contains(cell.key)) {
        continue;
      }
      if (cell.dependsOnKey != null) {
        final parent = def.cells.where((p) => p.key == cell.dependsOnKey);
        if (parent.isNotEmpty && !_isTrue(data[def.cellId(row, parent.first)])) {
          continue;
        }
      }
      final id = def.cellId(row, cell);
      if (!_entered(data[id])) missing.add(id);
    }
  }
  if (rowByRow && startedRows == 0) return [tableId];
  return missing;
}

/// The submission payload for a training centre, as the web form builds it
/// (react-web QuizSemantics.applyVocationalTrainingSemantics): each table's
/// status in <table>_RESPONSE_STATUS; a NONE fixed-row table as zeros, a NONE
/// row-by-row table as no rows; nothing for an undecided table; nothing at
/// all for a closed centre. The quiz answers are stripped.
Map<String, dynamic> applyVtSubmissionSemantics(
    Iterable<FieldSchema> fields, Map<String, dynamic> data) {
  final out = Map<String, dynamic>.from(data)..remove('_scopeConfig');
  if (isVtCentreClosed(data)) return out;
  for (final f in fields) {
    if (f.type != 'table' && f.type != 'repeating_table') continue;
    final def = vtTableDefForField(f);
    if (def == null) continue;
    final status = vtTableStatus(f.id, data);
    if (status == null) continue;
    out[vtStatusKey(f.id)] = status;
    if (status != kVtNone) continue;
    final rowByRow = def.progressiveRows || def.isRoster;
    for (final row in def.rows) {
      for (final cell in def.cells) {
        final id = def.cellId(row, cell);
        final numeric =
            cell.kind == VtCellKind.number || cell.kind == VtCellKind.computed;
        if (!rowByRow && numeric) {
          out[id] = 0;
        } else {
          out.remove(id);
        }
      }
    }
  }
  return out;
}
