class User {
  final String id;
  final String email;
  final String? firstName;
  final String? lastName;
  final String role;
  final String? region;
  final String? department;
  final String? subdivision;
  final String? matricule;
  final String? serviceCode;
  final String? positionType;
  final String? positionTitle;
  final bool isActive;

  User({
    required this.id,
    required this.email,
    this.firstName,
    this.lastName,
    required this.role,
    this.region,
    this.department,
    this.subdivision,
    this.matricule,
    this.serviceCode,
    this.positionType,
    this.positionTitle,
    required this.isActive,
  });

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as String,
        email: json['email'] as String,
        firstName: json['firstName'] as String?,
        lastName: json['lastName'] as String?,
        role: json['role'] as String,
        region: json['region'] as String?,
        department: json['department'] as String?,
        subdivision: json['subdivision'] as String?,
        matricule: json['matricule'] as String?,
        serviceCode: json['serviceCode'] as String?,
        positionType: json['positionType'] as String?,
        positionTitle: json['positionTitle'] as String?,
        isActive: json['isActive'] as bool? ?? true,
      );
}
