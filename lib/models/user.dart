class User {
  final String id;
  final String email;
  final String role;
  final String? region;
  final String? department;

  User(
      {required this.id,
      required this.email,
      required this.role,
      this.region,
      this.department});

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'],
        email: json['email'],
        role: json['role'],
        region: json['region'],
        department: json['department'],
      );
}
