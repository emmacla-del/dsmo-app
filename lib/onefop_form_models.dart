// lib/onefop_form_models.dart
// ============================================================
// Data models for all ONEFOP questionnaire types.
//
// EntityType is imported from lib/data/minefop_models.dart —
// the single source of truth. The old local enum and its
// extension have been removed.
//
// KEY CHANGE: All integer fields are now nullable (int?)
//   null  = user left blank (missing data)
//   0     = user explicitly entered zero
//   n > 0 = user entered that value
// ============================================================

import 'data/minefop_models.dart';
import 'models/user.dart'; // ← add this (adjust path to wherever User lives)// EntityType, single source of truth

// ─── Helpers ──────────────────────────────────────────────────

AgeBreakdown _ageFromJson(dynamic m) {
  if (m == null) return AgeBreakdown();
  return AgeBreakdown(
    age15_24: (m['age15_24'] as num?)?.toInt(),
    age25_34: (m['age25_34'] as num?)?.toInt(),
    age35plus: (m['age35plus'] as num?)?.toInt(),
    total: (m['total'] as num?)?.toInt(),
  );
}

GenderAgeBreakdown _genderAgeFromJson(dynamic m) {
  final g = GenderAgeBreakdown();
  if (m == null) return g;
  if (m['male'] != null) g.male = _ageFromJson(m['male']);
  if (m['female'] != null) g.female = _ageFromJson(m['female']);
  if (m['total'] != null) g.total = _ageFromJson(m['total']);
  return g;
}

MFTCount _mftFromJson(dynamic m) {
  if (m == null) return MFTCount();
  return MFTCount(
    male: (m['male'] as num?)?.toInt(),
    female: (m['female'] as num?)?.toInt(),
    total: (m['total'] as num?)?.toInt(),
  );
}

// ─── Shared sub-types ─────────────────────────────────────────

class AgeBreakdown {
  int? age15_24;
  int? age25_34;
  int? age35plus;
  int? total;

  AgeBreakdown({
    this.age15_24,
    this.age25_34,
    this.age35plus,
    this.total,
  });

  factory AgeBreakdown.fromJson(Map<String, dynamic> m) => _ageFromJson(m);

  Map<String, dynamic> toJson() => {
        'age15_24': age15_24,
        'age25_34': age25_34,
        'age35plus': age35plus,
        'total': total,
      };

  bool get hasAnyData =>
      (age15_24 ?? 0) + (age25_34 ?? 0) + (age35plus ?? 0) > 0;

  int get calculatedTotal =>
      (age15_24 ?? 0) + (age25_34 ?? 0) + (age35plus ?? 0);
}

class GenderAgeBreakdown {
  late AgeBreakdown male;
  late AgeBreakdown female;
  late AgeBreakdown total;

  GenderAgeBreakdown() {
    male = AgeBreakdown();
    female = AgeBreakdown();
    total = AgeBreakdown();
  }

  factory GenderAgeBreakdown.fromJson(Map<String, dynamic> m) =>
      _genderAgeFromJson(m);

  Map<String, dynamic> toJson() => {
        'male': male.toJson(),
        'female': female.toJson(),
        'total': total.toJson(),
      };

  void recalcTotals() {
    male.total = male.calculatedTotal;
    female.total = female.calculatedTotal;
    total.total = (male.total ?? 0) + (female.total ?? 0);
  }

  bool get hasAnyData => male.hasAnyData || female.hasAnyData;
}

class CspGenderAgeTable {
  late GenderAgeBreakdown executives;
  late GenderAgeBreakdown foremen;
  late GenderAgeBreakdown fieldWorkers;
  late GenderAgeBreakdown total;

  CspGenderAgeTable() {
    executives = GenderAgeBreakdown();
    foremen = GenderAgeBreakdown();
    fieldWorkers = GenderAgeBreakdown();
    total = GenderAgeBreakdown();
  }

  void fromJson(Map<String, dynamic> m) {
    if (m['executives'] != null) {
      executives = GenderAgeBreakdown.fromJson(m['executives']);
    }
    if (m['foremen'] != null) {
      foremen = GenderAgeBreakdown.fromJson(m['foremen']);
    }
    if (m['fieldWorkers'] != null) {
      fieldWorkers = GenderAgeBreakdown.fromJson(m['fieldWorkers']);
    }
    if (m['total'] != null) {
      total = GenderAgeBreakdown.fromJson(m['total']);
    }
    recalcAllTotals();
  }

  Map<String, dynamic> toJson() => {
        'executives': executives.toJson(),
        'foremen': foremen.toJson(),
        'fieldWorkers': fieldWorkers.toJson(),
        'total': total.toJson(),
      };

  void recalcAllTotals() {
    executives.recalcTotals();
    foremen.recalcTotals();
    fieldWorkers.recalcTotals();

    total.male.age15_24 = (executives.male.age15_24 ?? 0) +
        (foremen.male.age15_24 ?? 0) +
        (fieldWorkers.male.age15_24 ?? 0);
    total.male.age25_34 = (executives.male.age25_34 ?? 0) +
        (foremen.male.age25_34 ?? 0) +
        (fieldWorkers.male.age25_34 ?? 0);
    total.male.age35plus = (executives.male.age35plus ?? 0) +
        (foremen.male.age35plus ?? 0) +
        (fieldWorkers.male.age35plus ?? 0);

    total.female.age15_24 = (executives.female.age15_24 ?? 0) +
        (foremen.female.age15_24 ?? 0) +
        (fieldWorkers.female.age15_24 ?? 0);
    total.female.age25_34 = (executives.female.age25_34 ?? 0) +
        (foremen.female.age25_34 ?? 0) +
        (fieldWorkers.female.age25_34 ?? 0);
    total.female.age35plus = (executives.female.age35plus ?? 0) +
        (foremen.female.age35plus ?? 0) +
        (fieldWorkers.female.age35plus ?? 0);

    total.recalcTotals();
  }

  int grandTotal() => total.total.total ?? 0;

  bool isEmpty() =>
      !executives.hasAnyData && !foremen.hasAnyData && !fieldWorkers.hasAnyData;
}

class MFTCount {
  int? male;
  int? female;
  int? total;

  MFTCount({this.male, this.female, this.total});

  factory MFTCount.fromJson(Map<String, dynamic> m) => _mftFromJson(m);

  Map<String, dynamic> toJson() => {
        'male': male,
        'female': female,
        'total': total,
      };

  bool get hasAnyData => (male ?? 0) + (female ?? 0) > 0;

  void recalcTotal() {
    total = (male ?? 0) + (female ?? 0);
  }
}

class PermTempRow {
  late MFTCount permanent;
  late MFTCount temporary;
  late MFTCount total;

  PermTempRow() {
    permanent = MFTCount();
    temporary = MFTCount();
    total = MFTCount();
  }

  void fromJson(Map<String, dynamic> m) {
    if (m['permanent'] != null) permanent = MFTCount.fromJson(m['permanent']);
    if (m['temporary'] != null) temporary = MFTCount.fromJson(m['temporary']);
    if (m['total'] != null) total = MFTCount.fromJson(m['total']);
    recalcAllTotals();
  }

  Map<String, dynamic> toJson() => {
        'permanent': permanent.toJson(),
        'temporary': temporary.toJson(),
        'total': total.toJson(),
      };

  void recalcAllTotals() {
    permanent.recalcTotal();
    temporary.recalcTotal();
    total.male = (permanent.male ?? 0) + (temporary.male ?? 0);
    total.female = (permanent.female ?? 0) + (temporary.female ?? 0);
    total.recalcTotal();
  }

  bool get hasAnyData => permanent.hasAnyData || temporary.hasAnyData;
}

class DismissalReason {
  String text;
  int? male;
  int? female;
  int? total;

  DismissalReason({
    this.text = '',
    this.male,
    this.female,
    this.total,
  });

  Map<String, dynamic> toJson() => {
        'text': text,
        'male': male,
        'female': female,
        'total': total,
      };

  bool get hasAnyData => (male ?? 0) + (female ?? 0) > 0 || text.isNotEmpty;

  void recalcTotal() {
    total = (male ?? 0) + (female ?? 0);
  }
}

/// Thin adapter so DismissalReason can be passed where MFTCount is expected.
class DismissalReasonMFT extends MFTCount {
  final DismissalReason _reason;

  DismissalReasonMFT(this._reason)
      : super(
          male: _reason.male,
          female: _reason.female,
          total: _reason.total,
        );

  @override
  set male(int? v) {
    _reason.male = v;
    super.male = v;
  }

  @override
  set female(int? v) {
    _reason.female = v;
    super.female = v;
  }

  @override
  set total(int? v) {
    _reason.total = v;
    super.total = v;
  }
}

class InternshipRow {
  int? male;
  int? female;
  int? total;

  InternshipRow({this.male, this.female, this.total});

  void fromJson(Map<String, dynamic> m) {
    male = (m['male'] as num?)?.toInt();
    female = (m['female'] as num?)?.toInt();
    total = (m['total'] as num?)?.toInt();
  }

  Map<String, dynamic> toJson() => {
        'male': male,
        'female': female,
        'total': total,
      };

  bool get hasAnyData => (male ?? 0) + (female ?? 0) > 0;

  void recalcTotal() {
    total = (male ?? 0) + (female ?? 0);
  }
}

class SkillNeed {
  String description;
  int? male;
  int? female;
  int? total;

  SkillNeed({
    this.description = '',
    this.male,
    this.female,
    this.total,
  });

  Map<String, dynamic> toJson() => {
        'description': description,
        'male': male,
        'female': female,
        'total': total,
      };

  bool get hasAnyData =>
      (male ?? 0) + (female ?? 0) > 0 || description.isNotEmpty;

  void recalcTotal() {
    total = (male ?? 0) + (female ?? 0);
  }
}

class TrainingNeed {
  String domain;
  int? male;
  int? female;
  int? total;

  TrainingNeed({
    this.domain = '',
    this.male,
    this.female,
    this.total,
  });

  Map<String, dynamic> toJson() => {
        'domain': domain,
        'male': male,
        'female': female,
        'total': total,
      };

  bool get hasAnyData => (male ?? 0) + (female ?? 0) > 0 || domain.isNotEmpty;

  void recalcTotal() {
    total = (male ?? 0) + (female ?? 0);
  }
}

// ─── Diploma breakdown types (S22Q03) ────────────────────────

class DiplomaGenderAgeRow {
  late AgeBreakdown male;
  late AgeBreakdown female;
  late AgeBreakdown total;

  DiplomaGenderAgeRow() {
    male = AgeBreakdown();
    female = AgeBreakdown();
    total = AgeBreakdown();
  }

  void fromJson(Map<String, dynamic> m) {
    if (m['male'] != null) male = AgeBreakdown.fromJson(m['male']);
    if (m['female'] != null) female = AgeBreakdown.fromJson(m['female']);
    if (m['total'] != null) total = AgeBreakdown.fromJson(m['total']);
  }

  Map<String, dynamic> toJson() => {
        'male': male.toJson(),
        'female': female.toJson(),
        'total': total.toJson(),
      };

  bool get hasAnyData => male.hasAnyData || female.hasAnyData;

  void recalcTotals() {
    male.total = male.calculatedTotal;
    female.total = female.calculatedTotal;
    total.total = (male.total ?? 0) + (female.total ?? 0);
  }
}

extension DiplomaRowAsGenderAge on DiplomaGenderAgeRow {
  GenderAgeBreakdown toGenderAge() {
    final g = GenderAgeBreakdown();
    g.male = male;
    g.female = female;
    g.total = total;
    return g;
  }
}

class DiplomaBreakdown {
  late DiplomaGenderAgeRow cepCepe;
  late DiplomaGenderAgeRow bepcCap;
  late DiplomaGenderAgeRow probatoire;
  late DiplomaGenderAgeRow bac;
  late DiplomaGenderAgeRow btsDut;
  late DiplomaGenderAgeRow licence;
  late DiplomaGenderAgeRow maitrise;
  late DiplomaGenderAgeRow master;
  late DiplomaGenderAgeRow dqp;
  late DiplomaGenderAgeRow cqp;
  late DiplomaGenderAgeRow autres;
  late DiplomaGenderAgeRow sansDiplome;
  late DiplomaGenderAgeRow total;

  DiplomaBreakdown() {
    cepCepe = DiplomaGenderAgeRow();
    bepcCap = DiplomaGenderAgeRow();
    probatoire = DiplomaGenderAgeRow();
    bac = DiplomaGenderAgeRow();
    btsDut = DiplomaGenderAgeRow();
    licence = DiplomaGenderAgeRow();
    maitrise = DiplomaGenderAgeRow();
    master = DiplomaGenderAgeRow();
    dqp = DiplomaGenderAgeRow();
    cqp = DiplomaGenderAgeRow();
    autres = DiplomaGenderAgeRow();
    sansDiplome = DiplomaGenderAgeRow();
    total = DiplomaGenderAgeRow();
  }

  void fromJson(dynamic raw) {
    if (raw == null) return;
    final m = raw as Map<String, dynamic>;

    void restoreRow(String key, DiplomaGenderAgeRow row) {
      if (m[key] != null) row.fromJson(m[key] as Map<String, dynamic>);
    }

    restoreRow('cepCepe', cepCepe);
    restoreRow('bepcCap', bepcCap);
    restoreRow('probatoire', probatoire);
    restoreRow('bac', bac);
    restoreRow('btsDut', btsDut);
    restoreRow('licence', licence);
    restoreRow('maitrise', maitrise);
    restoreRow('master', master);
    restoreRow('dqp', dqp);
    restoreRow('cqp', cqp);
    restoreRow('autres', autres);
    restoreRow('sansDiplome', sansDiplome);
    restoreRow('total', total);

    recalcAllTotals();
  }

  DiplomaGenderAgeRow _rowByKey(String key) {
    switch (key) {
      case 'cepCepe':
        return cepCepe;
      case 'bepcCap':
        return bepcCap;
      case 'probatoire':
        return probatoire;
      case 'bac':
        return bac;
      case 'btsDut':
        return btsDut;
      case 'licence':
        return licence;
      case 'maitrise':
        return maitrise;
      case 'master':
        return master;
      case 'dqp':
        return dqp;
      case 'cqp':
        return cqp;
      case 'autres':
        return autres;
      case 'sansDiplome':
        return sansDiplome;
      default:
        return total;
    }
  }

  GenderAgeBreakdown rowFor(String key) => _rowByKey(key).toGenderAge();

  List<DiplomaGenderAgeRow> get _dataRows => [
        cepCepe,
        bepcCap,
        probatoire,
        bac,
        btsDut,
        licence,
        maitrise,
        master,
        dqp,
        cqp,
        autres,
        sansDiplome,
      ];

  void recalcAllTotals() {
    for (final row in _dataRows) {
      row.recalcTotals();
    }
    total.male.age15_24 =
        _dataRows.fold<int>(0, (s, r) => s + (r.male.age15_24 ?? 0));
    total.male.age25_34 =
        _dataRows.fold<int>(0, (s, r) => s + (r.male.age25_34 ?? 0));
    total.male.age35plus =
        _dataRows.fold<int>(0, (s, r) => s + (r.male.age35plus ?? 0));
    total.female.age15_24 =
        _dataRows.fold<int>(0, (s, r) => s + (r.female.age15_24 ?? 0));
    total.female.age25_34 =
        _dataRows.fold<int>(0, (s, r) => s + (r.female.age25_34 ?? 0));
    total.female.age35plus =
        _dataRows.fold<int>(0, (s, r) => s + (r.female.age35plus ?? 0));
    total.recalcTotals();
  }

  int grandTotal() => _dataRows.fold(0, (s, r) => s + (r.total.total ?? 0));
  int grandMaleTotal() => _dataRows.fold(0, (s, r) => s + (r.male.total ?? 0));
  int grandFemaleTotal() =>
      _dataRows.fold(0, (s, r) => s + (r.female.total ?? 0));

  bool isEmpty() => grandTotal() == 0;

  Map<String, dynamic> toJson() => {
        'cepCepe': cepCepe.toJson(),
        'bepcCap': bepcCap.toJson(),
        'probatoire': probatoire.toJson(),
        'bac': bac.toJson(),
        'btsDut': btsDut.toJson(),
        'licence': licence.toJson(),
        'maitrise': maitrise.toJson(),
        'master': master.toJson(),
        'dqp': dqp.toJson(),
        'cqp': cqp.toJson(),
        'autres': autres.toJson(),
        'sansDiplome': sansDiplome.toJson(),
        'total': total.toJson(),
      };
}

// ─── First-time employed types (S23Q02) ──────────────────────

class FirstTimeEmployedStatus {
  late GenderAgeBreakdown executives;
  late GenderAgeBreakdown foremen;
  late GenderAgeBreakdown fieldWorkers;
  late GenderAgeBreakdown subtotal;

  FirstTimeEmployedStatus() {
    executives = GenderAgeBreakdown();
    foremen = GenderAgeBreakdown();
    fieldWorkers = GenderAgeBreakdown();
    subtotal = GenderAgeBreakdown();
  }

  void fromJson(dynamic raw) {
    if (raw == null) return;
    final m = raw as Map<String, dynamic>;
    if (m['executives'] != null) {
      executives = GenderAgeBreakdown.fromJson(m['executives']);
    }
    if (m['foremen'] != null) {
      foremen = GenderAgeBreakdown.fromJson(m['foremen']);
    }
    if (m['fieldWorkers'] != null) {
      fieldWorkers = GenderAgeBreakdown.fromJson(m['fieldWorkers']);
    }
    if (m['subtotal'] != null) {
      subtotal = GenderAgeBreakdown.fromJson(m['subtotal']);
    }
    recalcTotals();
  }

  GenderAgeBreakdown cspFor(String key) {
    switch (key) {
      case 'executives':
        return executives;
      case 'foremen':
        return foremen;
      case 'fieldWorkers':
        return fieldWorkers;
      default:
        return subtotal;
    }
  }

  void recalcTotals() {
    executives.recalcTotals();
    foremen.recalcTotals();
    fieldWorkers.recalcTotals();

    subtotal.male.age15_24 = (executives.male.age15_24 ?? 0) +
        (foremen.male.age15_24 ?? 0) +
        (fieldWorkers.male.age15_24 ?? 0);
    subtotal.male.age25_34 = (executives.male.age25_34 ?? 0) +
        (foremen.male.age25_34 ?? 0) +
        (fieldWorkers.male.age25_34 ?? 0);
    subtotal.male.age35plus = (executives.male.age35plus ?? 0) +
        (foremen.male.age35plus ?? 0) +
        (fieldWorkers.male.age35plus ?? 0);
    subtotal.female.age15_24 = (executives.female.age15_24 ?? 0) +
        (foremen.female.age15_24 ?? 0) +
        (fieldWorkers.female.age15_24 ?? 0);
    subtotal.female.age25_34 = (executives.female.age25_34 ?? 0) +
        (foremen.female.age25_34 ?? 0) +
        (fieldWorkers.female.age25_34 ?? 0);
    subtotal.female.age35plus = (executives.female.age35plus ?? 0) +
        (foremen.female.age35plus ?? 0) +
        (fieldWorkers.female.age35plus ?? 0);
    subtotal.recalcTotals();
  }

  Map<String, dynamic> toJson() => {
        'executives': executives.toJson(),
        'foremen': foremen.toJson(),
        'fieldWorkers': fieldWorkers.toJson(),
        'subtotal': subtotal.toJson(),
      };
}

class FirstTimeEmployed {
  late FirstTimeEmployedStatus permanent;
  late FirstTimeEmployedStatus temporary;
  late GenderAgeBreakdown total;

  FirstTimeEmployed() {
    permanent = FirstTimeEmployedStatus();
    temporary = FirstTimeEmployedStatus();
    total = GenderAgeBreakdown();
  }

  void fromJson(dynamic raw) {
    if (raw == null) return;
    final m = raw as Map<String, dynamic>;
    if (m['permanent'] != null) permanent.fromJson(m['permanent']);
    if (m['temporary'] != null) temporary.fromJson(m['temporary']);
    if (m['total'] != null) total = GenderAgeBreakdown.fromJson(m['total']);
    recalcAllTotals();
  }

  void recalcAllTotals() {
    permanent.recalcTotals();
    temporary.recalcTotals();

    total.male.age15_24 = (permanent.subtotal.male.age15_24 ?? 0) +
        (temporary.subtotal.male.age15_24 ?? 0);
    total.male.age25_34 = (permanent.subtotal.male.age25_34 ?? 0) +
        (temporary.subtotal.male.age25_34 ?? 0);
    total.male.age35plus = (permanent.subtotal.male.age35plus ?? 0) +
        (temporary.subtotal.male.age35plus ?? 0);
    total.female.age15_24 = (permanent.subtotal.female.age15_24 ?? 0) +
        (temporary.subtotal.female.age15_24 ?? 0);
    total.female.age25_34 = (permanent.subtotal.female.age25_34 ?? 0) +
        (temporary.subtotal.female.age25_34 ?? 0);
    total.female.age35plus = (permanent.subtotal.female.age35plus ?? 0) +
        (temporary.subtotal.female.age35plus ?? 0);
    total.recalcTotals();
  }

  Map<String, dynamic> toJson() => {
        'permanent': permanent.toJson(),
        'temporary': temporary.toJson(),
        'total': total.toJson(),
      };
}

// ─── Section 0 — Respondent ───────────────────────────────────

class RespondentSection {
  String name = '';
  String function_ = '';
  String phone1 = '';
  String phone2 = '';
  String email = '';

  Map<String, dynamic> toJson() => {
        'respondentName': name,
        'respondentFunction': function_,
        'respondentPhone1': phone1,
        'respondentPhone2': phone2,
        'respondentEmail': email,
      };
}

// ─── Section 1 variants ───────────────────────────────────────

class EntrepriseSection1 {
  int legalStatus = 1;
  String companyName = '';
  int area = 1;
  String region = '';
  String department = '';
  String subdivision = '';
  String locality = '';
  String phone1 = '';
  String phone2 = '';
  String poBox = '';
  int businessSector = 1;
  String branchActivity = '';
  String mainActivity = '';
  String headOffice = '';
  int permanentWorkers = 0;
  int vacancies = 0;
  int companySize = 1;

  Map<String, dynamic> toJson() => {
        'formType': 'entreprise',
        'legalStatus': legalStatus,
        'companyName': companyName,
        'area': area,
        'region': region,
        'department': department,
        'subdivision': subdivision,
        'locality': locality,
        'phone1': phone1,
        'phone2': phone2,
        'poBox': poBox,
        'businessSector': businessSector,
        'branchActivity': branchActivity,
        'mainActivity': mainActivity,
        'headOffice': headOffice,
        'permanentWorkers': permanentWorkers,
        'vacancies': vacancies,
        'companySize': companySize,
      };
}

class CooperativeSection1 {
  String cooperativeName = '';
  String headOffice = '';
  int? yearOfCreation;
  int area = 1;
  String region = '';
  String department = '';
  String subdivision = '';
  String locality = '';
  String phone1 = '';
  String phone2 = '';
  String poBox = '';
  int businessSector = 1;
  String branchActivity = '';
  String mainActivity = '';
  int cooperativeType = 1;
  String cooperativeTypeOther = '';
  int permanentWorkers = 0;
  int vacancies = 0;

  Map<String, dynamic> toJson() => {
        'formType': 'cooperative',
        'cooperativeName': cooperativeName,
        'headOffice': headOffice,
        'yearOfCreation': yearOfCreation,
        'area': area,
        'region': region,
        'department': department,
        'subdivision': subdivision,
        'locality': locality,
        'phone1': phone1,
        'phone2': phone2,
        'poBox': poBox,
        'businessSector': businessSector,
        'branchActivity': branchActivity,
        'mainActivity': mainActivity,
        'cooperativeType': cooperativeType,
        'cooperativeTypeOther': cooperativeTypeOther,
        'permanentWorkers': permanentWorkers,
        'vacancies': vacancies,
      };
}

class CtdSection1 {
  int ctdType = 1;
  int? communeType;
  int? yearOfCreation;
  int area = 1;
  String region = '';
  String department = '';
  String subdivision = '';
  String locality = '';
  String phone1 = '';
  String phone2 = '';
  String poBox = '';
  int businessSector = 1;
  String branchActivity = '';
  int permanentWorkers = 0;
  int vacancies = 0;

  Map<String, dynamic> toJson() => {
        'formType': 'ctd',
        'ctdType': ctdType,
        'communeType': communeType,
        'yearOfCreation': yearOfCreation,
        'area': area,
        'region': region,
        'department': department,
        'subdivision': subdivision,
        'locality': locality,
        'phone1': phone1,
        'phone2': phone2,
        'poBox': poBox,
        'businessSector': businessSector,
        'branchActivity': branchActivity,
        'permanentWorkers': permanentWorkers,
        'vacancies': vacancies,
      };
}

class OngSection1 {
  String ongName = '';
  String headOffice = '';
  int? yearOfCreation;
  int area = 1;
  String region = '';
  String department = '';
  String subdivision = '';
  String locality = '';
  String phone1 = '';
  String phone2 = '';
  String poBox = '';
  int businessSector = 1;
  String branchActivity = '';
  String mainMission = '';
  int permanentWorkers = 0;
  int vacancies = 0;

  Map<String, dynamic> toJson() => {
        'formType': 'ong',
        'ongName': ongName,
        'headOffice': headOffice,
        'yearOfCreation': yearOfCreation,
        'area': area,
        'region': region,
        'department': department,
        'subdivision': subdivision,
        'locality': locality,
        'phone1': phone1,
        'phone2': phone2,
        'poBox': poBox,
        'businessSector': businessSector,
        'branchActivity': branchActivity,
        'mainMission': mainMission,
        'permanentWorkers': permanentWorkers,
        'vacancies': vacancies,
      };
}

// ─── Sections 2–4 (shared across all form types) ──────────────

class EmploymentSection {
  late Map<String, PermTempRow> disabledRecruitments;
  late Map<String, PermTempRow> vulnerableRecruitments;

  EmploymentSection() {
    disabledRecruitments = {
      'executives': PermTempRow(),
      'foremen': PermTempRow(),
      'fieldWorkers': PermTempRow(),
      'total': PermTempRow(),
    };
    vulnerableRecruitments = {
      'internalDisplaced': PermTempRow(),
      'refugees': PermTempRow(),
      'orphans': PermTempRow(),
      'total': PermTempRow(),
    };
  }

  void fromJson(Map<String, dynamic> m) {
    final dis = m['disabledRecruitments'] as Map<String, dynamic>?;
    final vuln = m['vulnerableRecruitments'] as Map<String, dynamic>?;
    if (dis != null) {
      for (final k in disabledRecruitments.keys) {
        if (dis[k] != null) {
          disabledRecruitments[k]!.fromJson(dis[k] as Map<String, dynamic>);
        }
      }
    }
    if (vuln != null) {
      for (final k in vulnerableRecruitments.keys) {
        if (vuln[k] != null) {
          vulnerableRecruitments[k]!.fromJson(vuln[k] as Map<String, dynamic>);
        }
      }
    }
  }

  Map<String, dynamic> toJson() => {
        'disabledRecruitments': {
          for (final e in disabledRecruitments.entries) e.key: e.value.toJson()
        },
        'vulnerableRecruitments': {
          for (final e in vulnerableRecruitments.entries)
            e.key: e.value.toJson()
        },
      };

  void recalcAllTotals() {
    for (final row in disabledRecruitments.values) {
      row.recalcAllTotals();
    }
    for (final row in vulnerableRecruitments.values) {
      row.recalcAllTotals();
    }
  }

  int disabledTotal() =>
      disabledRecruitments.values.fold(0, (s, r) => s + (r.total.total ?? 0));
  int vulnerableTotal() =>
      vulnerableRecruitments.values.fold(0, (s, r) => s + (r.total.total ?? 0));

  bool isEmpty() {
    for (final r in disabledRecruitments.values) {
      if (r.hasAnyData) return false;
    }
    for (final r in vulnerableRecruitments.values) {
      if (r.hasAnyData) return false;
    }
    return true;
  }
}

class DeparturesSection {
  late Map<String, Map<String, MFTCount>> departures;
  late List<DismissalReason> dismissalReasons;
  late Map<String, Map<String, MFTCount>> dismissalTechUnemp;

  DeparturesSection() {
    departures = {};
    for (final csp in ['executives', 'foremen', 'fieldWorkers', 'total']) {
      departures[csp] = {};
      for (final t in [
        'dismissals',
        'resignations',
        'retirements',
        'others',
        'ensemble'
      ]) {
        departures[csp]![t] = MFTCount();
      }
    }

    dismissalReasons = [
      DismissalReason(),
      DismissalReason(),
      DismissalReason(),
    ];

    dismissalTechUnemp = {};
    for (final csp in ['executives', 'foremen', 'fieldWorkers', 'total']) {
      dismissalTechUnemp[csp] = {};
      for (final t in ['dismissal', 'technicalUnemployment', 'total']) {
        dismissalTechUnemp[csp]![t] = MFTCount();
      }
    }
  }

  void fromJson(Map<String, dynamic> m) {
    final deps = m['departures'] as Map<String, dynamic>?;
    if (deps != null) {
      for (final csp in departures.keys) {
        final cspMap = deps[csp] as Map<String, dynamic>?;
        if (cspMap != null) {
          for (final t in departures[csp]!.keys) {
            if (cspMap[t] != null) {
              departures[csp]![t] = MFTCount.fromJson(cspMap[t]);
            }
          }
        }
      }
    }

    final reasons = m['dismissalReasons'] as List<dynamic>?;
    if (reasons != null) {
      for (int i = 0; i < 3 && i < reasons.length; i++) {
        final r = reasons[i] as Map<String, dynamic>;
        dismissalReasons[i] = DismissalReason(
          text: r['text'] as String? ?? '',
          male: (r['male'] as num?)?.toInt(),
          female: (r['female'] as num?)?.toInt(),
          total: (r['total'] as num?)?.toInt(),
        );
      }
    }

    final dtu = m['dismissalTechUnemployment'] as Map<String, dynamic>?;
    if (dtu != null) {
      for (final csp in dismissalTechUnemp.keys) {
        final cspMap = dtu[csp] as Map<String, dynamic>?;
        if (cspMap != null) {
          for (final t in dismissalTechUnemp[csp]!.keys) {
            if (cspMap[t] != null) {
              dismissalTechUnemp[csp]![t] = MFTCount.fromJson(cspMap[t]);
            }
          }
        }
      }
    }

    recalcAllTotals();
  }

  void recalcAllTotals() {
    for (final csp in departures.values) {
      for (final type in csp.values) {
        type.recalcTotal();
      }
    }
    for (final reason in dismissalReasons) {
      reason.recalcTotal();
    }
    for (final csp in dismissalTechUnemp.values) {
      for (final type in csp.values) {
        type.recalcTotal();
      }
    }
  }

  Map<String, dynamic> toJson() => {
        'departures': {
          for (final csp in departures.entries)
            csp.key: {
              for (final t in csp.value.entries) t.key: t.value.toJson()
            }
        },
        'dismissalReasons': dismissalReasons.map((r) => r.toJson()).toList(),
        'dismissalTechUnemployment': {
          for (final csp in dismissalTechUnemp.entries)
            csp.key: {
              for (final t in csp.value.entries) t.key: t.value.toJson()
            }
        },
      };

  int grandTotal() => ensembleTotal();

  int ensembleTotal() {
    int sum = 0;
    for (final csp in ['executives', 'foremen', 'fieldWorkers']) {
      sum += departures[csp]?['ensemble']?.total ?? 0;
    }
    return sum;
  }

  bool isEmpty() {
    for (final csp in departures.values) {
      for (final t in csp.values) {
        if (t.hasAnyData) return false;
      }
    }
    for (final r in dismissalReasons) {
      if (r.hasAnyData) return false;
    }
    for (final csp in dismissalTechUnemp.values) {
      for (final t in csp.values) {
        if (t.hasAnyData) return false;
      }
    }
    return true;
  }
}

class TrainingSection {
  late Map<String, InternshipRow> internships;
  late List<SkillNeed> skillsNeeds;
  late List<TrainingNeed> trainingNeeds;

  TrainingSection() {
    internships = {
      'holiday': InternshipRow(),
      'academic': InternshipRow(),
      'professional': InternshipRow(),
      'preWork': InternshipRow(),
      'total': InternshipRow(),
    };
    skillsNeeds = [SkillNeed(), SkillNeed(), SkillNeed()];
    trainingNeeds = [TrainingNeed(), TrainingNeed(), TrainingNeed()];
  }

  void fromJson(Map<String, dynamic> m) {
    final ints = m['internships'] as Map<String, dynamic>?;
    if (ints != null) {
      for (final k in internships.keys) {
        if (ints[k] != null) {
          internships[k]!.fromJson(ints[k] as Map<String, dynamic>);
        }
      }
    }

    final skills = m['skillsNeeds'] as List<dynamic>?;
    if (skills != null) {
      for (int i = 0; i < 3 && i < skills.length; i++) {
        final s = skills[i] as Map<String, dynamic>;
        skillsNeeds[i] = SkillNeed(
          description: s['description'] as String? ?? '',
          male: (s['male'] as num?)?.toInt(),
          female: (s['female'] as num?)?.toInt(),
          total: (s['total'] as num?)?.toInt(),
        );
      }
    }

    final trainings = m['trainingNeeds'] as List<dynamic>?;
    if (trainings != null) {
      for (int i = 0; i < 3 && i < trainings.length; i++) {
        final t = trainings[i] as Map<String, dynamic>;
        trainingNeeds[i] = TrainingNeed(
          domain: t['domain'] as String? ?? '',
          male: (t['male'] as num?)?.toInt(),
          female: (t['female'] as num?)?.toInt(),
          total: (t['total'] as num?)?.toInt(),
        );
      }
    }

    recalcAllTotals();
  }

  void recalcAllTotals() {
    for (final row in internships.values) {
      row.recalcTotal();
    }
    for (final skill in skillsNeeds) {
      skill.recalcTotal();
    }
    for (final training in trainingNeeds) {
      training.recalcTotal();
    }
  }

  Map<String, dynamic> toJson() => {
        'internships': {
          for (final e in internships.entries) e.key: e.value.toJson()
        },
        'skillsNeeds': skillsNeeds.map((s) => s.toJson()).toList(),
        'trainingNeeds': trainingNeeds.map((t) => t.toJson()).toList(),
      };

  bool isEmpty() {
    for (final r in internships.values) {
      if (r.hasAnyData) return false;
    }
    for (final s in skillsNeeds) {
      if (s.hasAnyData) return false;
    }
    for (final t in trainingNeeds) {
      if (t.hasAnyData) return false;
    }
    return true;
  }
}

// ─── Master form state ────────────────────────────────────────

class OnefopFormState {
  final EntityType entityType;
  RespondentSection section0 = RespondentSection();

  // Exactly one of these is non-null, determined by entityType.
  // vocational has no ONEFOP Section 1 model — it is DSMO-only.
  EntrepriseSection1? entrepriseS1;
  CooperativeSection1? cooperativeS1;
  CtdSection1? ctdS1;
  OngSection1? ongS1;

  CspGenderAgeTable jobApplications = CspGenderAgeTable();
  CspGenderAgeTable recruitmentsPermanent = CspGenderAgeTable();
  CspGenderAgeTable recruitmentsTemporary = CspGenderAgeTable();
  DiplomaBreakdown recruitmentsByDiploma = DiplomaBreakdown();
  CspGenderAgeTable firstTimeJobSeekers = CspGenderAgeTable();
  CspGenderAgeTable firstTimeWorkers = CspGenderAgeTable();
  FirstTimeEmployed firstTimeRecruitments = FirstTimeEmployed();
  EmploymentSection sectionEmployment = EmploymentSection();
  DeparturesSection sectionDepartures = DeparturesSection();
  TrainingSection sectionTraining = TrainingSection();

  OnefopFormState(this.entityType) {
    switch (entityType) {
      case EntityType.enterprise:
        entrepriseS1 = EntrepriseSection1();
      case EntityType.cooperative:
        cooperativeS1 = CooperativeSection1();
      case EntityType.ctd:
        ctdS1 = CtdSection1();
      case EntityType.ong:
        ongS1 = OngSection1();
      case EntityType.vocational:
        break; // DSMO-only path — no ONEFOP Section 1 variant
    }
  }

  void recalcAllTotals() {
    jobApplications.recalcAllTotals();
    recruitmentsPermanent.recalcAllTotals();
    recruitmentsTemporary.recalcAllTotals();
    recruitmentsByDiploma.recalcAllTotals();
    firstTimeJobSeekers.recalcAllTotals();
    firstTimeWorkers.recalcAllTotals();
    firstTimeRecruitments.recalcAllTotals();
    sectionEmployment.recalcAllTotals();
    sectionDepartures.recalcAllTotals();
    sectionTraining.recalcAllTotals();
  }

  Map<String, dynamic> toJson() {
    // vocational entities have no ONEFOP Section 1 payload
    final s1 = switch (entityType) {
      EntityType.enterprise => entrepriseS1!.toJson(),
      EntityType.cooperative => cooperativeS1!.toJson(),
      EntityType.ctd => ctdS1!.toJson(),
      EntityType.ong => ongS1!.toJson(),
      EntityType.vocational => <String, dynamic>{},
    };
    return {
      ...section0.toJson(),
      ...s1,
      'surveyYear': DateTime.now().year,
      'copy': 1,
      'jobApplications': jobApplications.toJson(),
      'recruitmentsPermanent': recruitmentsPermanent.toJson(),
      'recruitmentsTemporary': recruitmentsTemporary.toJson(),
      'recruitmentsByDiploma': recruitmentsByDiploma.toJson(),
      'firstTimeJobSeekers': firstTimeJobSeekers.toJson(),
      'firstTimeWorkers': firstTimeWorkers.toJson(),
      'firstTimeRecruitments': firstTimeRecruitments.toJson(),
      ...sectionEmployment.toJson(),
      ...sectionDepartures.toJson(),
      ...sectionTraining.toJson(),
    };
  }
}

// ─── Pre-fill extensions ──────────────────────────────────────
//
// These bridge the registration flow → ONEFOP form automatically.
// Call OnefopFormState.prefillFromUser(user) immediately after
// construction, then prefillFromCompanyData(data) once the
// company-profile API response arrives.
//
// NOTE: The User type is referenced here but not imported — add
//   import 'path/to/your/user_model.dart';
// at the top of this file (kept separate to avoid coupling to
// auth internals from a pure-models file).

extension RespondentSectionPrefill on RespondentSection {
  /// Pre-fills Section 0 from the logged-in user's account data.
  void prefillFromUser(User user) {
    name = [user.firstName, user.lastName]
        .where((s) => s != null && s.isNotEmpty)
        .join(' ');
    email = user.email;
    // phone1 / phone2 / function_ are not stored on User — require
    // manual entry or a separate profile fetch.
  }
}

extension EntrepriseSection1Prefill on EntrepriseSection1 {
  /// Pre-fills geographic location from the user account.
  void prefillFromUser(User user) {
    region = user.region ?? region;
    department = user.department ?? department;
    subdivision = user.subdivision ?? subdivision;
  }

  /// Pre-fills company-specific fields from a company-profile API response.
  void prefillFromCompanyData(Map<String, dynamic> data) {
    companyName = data['companyName'] as String? ?? companyName;
    mainActivity = data['mainActivity'] as String? ?? mainActivity;
    branchActivity = data['branch'] as String? ?? branchActivity;
    headOffice = data['address'] as String? ?? headOffice;
    phone1 = data['phone'] as String? ?? phone1;
    phone2 = data['phone2'] as String? ?? phone2;
    poBox = data['poBox'] as String? ?? poBox;
    permanentWorkers =
        (data['permanentWorkers'] as num?)?.toInt() ?? permanentWorkers;
  }
}

extension CooperativeSection1Prefill on CooperativeSection1 {
  void prefillFromUser(User user) {
    region = user.region ?? region;
    department = user.department ?? department;
    subdivision = user.subdivision ?? subdivision;
  }

  void prefillFromCompanyData(Map<String, dynamic> data) {
    cooperativeName = data['cooperativeName'] as String? ?? cooperativeName;
    headOffice = data['cooperativeHeadOffice'] as String? ?? headOffice;
    mainActivity = data['mainActivity'] as String? ?? mainActivity;
    phone1 = data['phone'] as String? ?? phone1;
    phone2 = data['phone2'] as String? ?? phone2;
    poBox = data['poBox'] as String? ?? poBox;
  }
}

extension CtdSection1Prefill on CtdSection1 {
  void prefillFromUser(User user) {
    region = user.region ?? region;
    department = user.department ?? department;
    subdivision = user.subdivision ?? subdivision;
  }

  void prefillFromCompanyData(Map<String, dynamic> data) {
    phone1 = data['phone'] as String? ?? phone1;
    phone2 = data['phone2'] as String? ?? phone2;
    poBox = data['poBox'] as String? ?? poBox;
  }
}

extension OngSection1Prefill on OngSection1 {
  void prefillFromUser(User user) {
    region = user.region ?? region;
    department = user.department ?? department;
    subdivision = user.subdivision ?? subdivision;
  }

  void prefillFromCompanyData(Map<String, dynamic> data) {
    ongName = data['ngoName'] as String? ?? ongName;
    headOffice = data['address'] as String? ?? headOffice;
    mainMission = data['mainMission'] as String? ?? mainMission;
    phone1 = data['phone'] as String? ?? phone1;
    phone2 = data['phone2'] as String? ?? phone2;
    poBox = data['poBox'] as String? ?? poBox;
  }
}

/// Convenience methods on [OnefopFormState] — delegates to whichever
/// Section 1 variant is active.
extension OnefopFormStatePrefill on OnefopFormState {
  void prefillFromUser(User user) {
    section0.prefillFromUser(user);
    entrepriseS1?.prefillFromUser(user);
    cooperativeS1?.prefillFromUser(user);
    ctdS1?.prefillFromUser(user);
    ongS1?.prefillFromUser(user);
    // vocational has no Section 1 — nothing to prefill
  }

  void prefillFromCompanyData(Map<String, dynamic> data) {
    entrepriseS1?.prefillFromCompanyData(data);
    cooperativeS1?.prefillFromCompanyData(data);
    ctdS1?.prefillFromCompanyData(data);
    ongS1?.prefillFromCompanyData(data);
    // vocational has no Section 1 — nothing to prefill
  }
}
