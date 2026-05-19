class UserFeatures {
  final bool onefopBasicAnalytics;
  final bool onefopBenchmarking;
  final String? onefopSubmissionStatus;
  final int? onefopSurveyYear;
  final bool onefopHasDraft;

  UserFeatures({
    this.onefopBasicAnalytics = false,
    this.onefopBenchmarking = false,
    this.onefopSubmissionStatus,
    this.onefopSurveyYear,
    this.onefopHasDraft = false,
  });

  factory UserFeatures.fromJson(Map<String, dynamic> json) => UserFeatures(
        onefopBasicAnalytics: json['onefopBasicAnalytics'] ?? false,
        onefopBenchmarking: json['onefopBenchmarking'] ?? false,
        onefopSubmissionStatus: json['onefopSubmissionStatus'],
        onefopSurveyYear: json['onefopSurveyYear'],
        onefopHasDraft: json['onefopHasDraft'] ?? false,
      );
}

class User {
  final String id;
  final String email;
  final String? firstName;
  final String? lastName;
  final String role;
  final String? stream;
  final String? region;
  final String? department;
  final String? subdivision;
  final String? matricule;
  final String? serviceCode;
  final String? positionType;
  final String? positionTitle;
  final bool isActive;
  final UserFeatures features;

  User({
    required this.id,
    required this.email,
    this.firstName,
    this.lastName,
    required this.role,
    this.stream,
    this.region,
    this.department,
    this.subdivision,
    this.matricule,
    this.serviceCode,
    this.positionType,
    this.positionTitle,
    required this.isActive,
    required this.features,
  });

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as String,
        email: json['email'] as String,
        firstName: json['firstName'] as String?,
        lastName: json['lastName'] as String?,
        role: json['role'] as String,
        stream: json['stream'] as String?,
        region: json['region'] as String?,
        department: json['department'] as String?,
        subdivision: json['subdivision'] as String?,
        matricule: json['matricule'] as String?,
        serviceCode: json['serviceCode'] as String?,
        positionType: json['positionType'] as String?,
        positionTitle: json['positionTitle'] as String?,
        isActive: json['isActive'] as bool? ?? true,
        features: UserFeatures.fromJson(json['features'] ?? {}),
      );
}
