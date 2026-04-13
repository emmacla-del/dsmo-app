import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

class ApiClient {
  final Dio dio;

  ApiClient()
      : dio = Dio(BaseOptions(
          baseUrl: kIsWeb
              ? 'https://dsmo-app-2.onrender.com'
              : 'http://localhost:3000',
          connectTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 30),
          headers: {'Content-Type': 'application/json'},
        )) {
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        if (kDebugMode) {
          print('🌐 ${options.method} ${options.uri}');
        }
        return handler.next(options);
      },
      onError: (error, handler) {
        if (error.response?.statusCode == 401) {
          _clearToken();
        }
        if (kDebugMode) {
          print('❌ Error: ${error.message}');
        }
        return handler.next(error);
      },
    ));
  }

  Future<String?> _getToken() async {
    try {
      final box = await Hive.openBox('tokenBox');
      return box.get('access_token') as String?;
    } catch (e) {
      return null;
    }
  }

  Future<void> setToken(String token) async {
    final box = await Hive.openBox('tokenBox');
    await box.put('access_token', token);
  }

  Future<void> _clearToken() async {
    final box = await Hive.openBox('tokenBox');
    await box.delete('access_token');
  }

  // ==================== GENERIC HTTP METHODS ====================

  Future<Response<T>> get<T>(String path,
      {Map<String, dynamic>? queryParameters, Options? options}) async {
    try {
      return await dio.get<T>(path,
          queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Response<T>> post<T>(String path,
      {dynamic data, Options? options}) async {
    try {
      return await dio.post<T>(path, data: data, options: options);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Response<T>> patch<T>(String path,
      {dynamic data, Options? options}) async {
    try {
      return await dio.patch<T>(path, data: data, options: options);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== AUTH METHODS ====================

  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required String role,
    String? region,
    String? department,
    String? matricule,
    String? poste,
    String? serviceCode,
  }) async {
    try {
      final response = await dio.post('/auth/register', data: {
        'email': email,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
        'role': role,
        if (region != null) 'region': region,
        if (department != null) 'department': department,
        if (matricule != null) 'matricule': matricule,
        if (poste != null) 'poste': poste,
        if (serviceCode != null) 'serviceCode': serviceCode,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });

      final token = response.data['access_token'];
      if (token != null) {
        await setToken(token);
      }

      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> logout() async {
    await _clearToken();
  }

  // ========== ADMIN: PENDING MINEFOP USERS ==========

  Future<List<dynamic>> getPendingMinefopUsers() async {
    try {
      final response = await dio.get('/auth/pending-minefop');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> approveUser(String userId) async {
    try {
      final response = await dio.patch('/auth/approve-user/$userId');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> rejectUser(String userId,
      {String? reason}) async {
    try {
      final response = await dio.patch('/auth/reject-user/$userId',
          data: reason != null ? {'reason': reason} : null);
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== LOCATION METHODS ====================

  Future<List<dynamic>> getRegions() async {
    try {
      final response = await dio.get('/locations/regions');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<List<dynamic>> getDepartments(String regionId) async {
    try {
      final response =
          await dio.get('/locations/regions/$regionId/departments');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<List<dynamic>> getSubdivisions(String departmentId) async {
    try {
      final response =
          await dio.get('/locations/departments/$departmentId/subdivisions');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== SECTOR METHODS ====================

  Future<List<dynamic>> getSectors() async {
    try {
      final response = await dio.get('/sectors');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== COMPANY METHODS ====================

  Future<Map<String, dynamic>> saveCompanyProfile(
      Map<String, dynamic> data) async {
    try {
      final response = await dio.post('/dsmo/company', data: data);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>?> getMyCompany() async {
    try {
      final response = await dio.get('/dsmo/company');
      return response.data as Map<String, dynamic>?;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      throw _handleError(e);
    }
  }

  // ==================== DECLARATION METHODS ====================

  Future<Map<String, dynamic>> createDeclaration(
      Map<String, dynamic> data) async {
    try {
      final response = await dio.post('/dsmo/declaration', data: data);
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<List<dynamic>> getDeclarations() async {
    try {
      final response = await dio.get('/dsmo/declarations');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<List<dynamic>> getPendingDeclarations() async {
    try {
      final response = await dio.get('/dsmo/declarations/pending');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> getDeclaration(String id) async {
    try {
      final response = await dio.get('/dsmo/declarations/$id');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> validateDeclaration(String id,
      {bool isValid = true, String? rejectionReason}) async {
    try {
      final response =
          await dio.patch('/dsmo/declarations/$id/validate', data: {
        'isValid': isValid,
        if (rejectionReason != null) 'rejectionReason': rejectionReason,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== NOTIFICATION METHODS ====================

  Future<Map<String, dynamic>> sendNotification(
      Map<String, dynamic> data) async {
    try {
      final response = await dio.post('/dsmo/notifications/send', data: data);
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<List<dynamic>> getNotifications() async {
    try {
      final response = await dio.get('/dsmo/notifications');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== ANALYTICS METHODS ====================

  Future<Map<String, dynamic>> getDashboardSummary(
      {int? year, String? region}) async {
    try {
      final query = <String, dynamic>{};
      if (year != null) query['year'] = year;
      if (region != null) query['region'] = region;
      final response = await dio.get('/dsmo/analytics/dashboard-summary',
          queryParameters: query);
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== ERROR HANDLER ====================

  String _handleError(DioException error) {
    if (error.response != null) {
      final data = error.response!.data;
      if (data is Map && data.containsKey('message')) {
        return data['message'];
      }
      if (data is Map && data.containsKey('error')) {
        return data['error'];
      }
      return 'Server error: ${error.response?.statusCode}';
    } else if (error.type == DioExceptionType.connectionTimeout) {
      return 'Connection timeout - Server taking too long to respond';
    } else if (error.type == DioExceptionType.receiveTimeout) {
      return 'Receive timeout - Server not responding';
    } else if (error.type == DioExceptionType.connectionError) {
      return 'No internet connection - Check your network';
    }
    return error.message ?? 'An unknown error occurred';
  }
}

final apiClientProvider = Provider((ref) => ApiClient());
