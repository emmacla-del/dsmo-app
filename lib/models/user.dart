class User {
  final String id;
  final String email;
  final String role;
  final String? region;
  final String? department;
  final String? serviceCode;

  User(
      {required this.id,
      required this.email,
      required this.role,
      this.region,
      this.department,
      this.serviceCode});

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'],
        email: json['email'],
        role: json['role'],
        region: json['region'],
        department: json['department'],
        serviceCode: json['serviceCode'],
      );
}
