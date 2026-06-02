import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

class ApiException implements Exception {
  final int? statusCode;
  final String message;

  ApiException({this.statusCode, required this.message});

  @override
  String toString() => message;
}

class ApiClient {
  final Dio dio;

  ApiClient()
      : dio = Dio(BaseOptions(
          baseUrl: kIsWeb
              ? 'https://dsmo-app-2.onrender.com/api'
              : 'https://dsmo-app-2.onrender.com/api',
          connectTimeout: const Duration(seconds: 60),
          receiveTimeout: const Duration(seconds: 60),
          headers: {'Content-Type': 'application/json'},
        )) {
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        if (kDebugMode &&
            const bool.fromEnvironment('VERBOSE_API', defaultValue: false)) {
          debugPrint('🌐 ${options.method} ${options.uri}');
        }
        return handler.next(options);
      },
      onError: (error, handler) {
        if (error.response?.statusCode == 401) {
          _clearToken();
        }
        if (kDebugMode &&
            const bool.fromEnvironment('VERBOSE_API', defaultValue: false) &&
            error.response?.statusCode != 403) {
          debugPrint('❌ Error: ${error.message}');
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

  /// Public getter used by AuthNotifier._tryRestore() to check
  /// for a stored token on app startup without exposing Hive directly.
  Future<String?> getStoredToken() => _getToken();

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
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Response<T>> post<T>(String path,
      {dynamic data, Options? options}) async {
    try {
      return await dio.post<T>(path, data: data, options: options);
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Response<T>> patch<T>(String path,
      {dynamic data, Options? options}) async {
    try {
      return await dio.patch<T>(path, data: data, options: options);
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  // ==================== AUTH METHODS ====================

  Future<Map<String, dynamic>> registerMinefopUser({
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
    String? positionType,
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
        if (positionType != null) 'positionType': positionType,
      });
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>> registerCompany({
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
    required String companyName,
    required String taxNumber,
    required String mainActivity,
    required String address,
    String? parentCompany,
    String? secondaryActivity,
    String? cnpsNumber,
    String? fax,
    int? socialCapital,
    String? subdivision,
    String? entityType,
    String? area,
    String? sectorId,
    String? phone,
    String? phone2,
    String? poBox,
    String? legalStatus,
    String? cooperativeType,
    dynamic yearOfCreation,
    String? ctdType,
    String? mainMission,
    String? registrationNumber,
    String? trainingDomains,
    String? branch,
    String? respondentPhone,
    String? respondentPhone2,
    String? respondentFunction,
  }) async {
    try {
      final response = await dio.post('/auth/register-company', data: {
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
        'companyName': companyName,
        'taxNumber': taxNumber,
        'mainActivity': mainActivity,
        'address': address,
        if (parentCompany != null) 'parentCompany': parentCompany,
        if (secondaryActivity != null) 'secondaryActivity': secondaryActivity,
        if (cnpsNumber != null) 'cnpsNumber': cnpsNumber,
        if (fax != null) 'fax': fax,
        if (socialCapital != null) 'socialCapital': socialCapital,
        if (subdivision != null) 'subdivision': subdivision,
        if (entityType != null) 'entityType': entityType,
        if (area != null) 'area': area,
        if (sectorId != null) 'sectorId': sectorId,
        if (phone != null) 'phone': phone,
        if (phone2 != null) 'phone2': phone2,
        if (poBox != null) 'poBox': poBox,
        if (legalStatus != null) 'legalStatus': legalStatus,
        if (cooperativeType != null) 'cooperativeType': cooperativeType,
        if (yearOfCreation != null) 'yearOfCreation': yearOfCreation,
        if (ctdType != null) 'ctdType': ctdType,
        if (mainMission != null) 'mainMission': mainMission,
        if (registrationNumber != null)
          'registrationNumber': registrationNumber,
        if (trainingDomains != null) 'trainingDomains': trainingDomains,
        if (branch != null) 'branch': branch,
        if (respondentPhone != null) 'respondentPhone': respondentPhone,
        if (respondentPhone2 != null) 'respondentPhone2': respondentPhone2,
        if (respondentFunction != null)
          'respondentFunction': respondentFunction,
      });

      final token = response.data['access_token'];
      if (token != null) {
        await setToken(token);
      }

      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  @Deprecated(
      'Use registerCompany() for COMPANY users or registerMinefopUser() for MINEFOP users')
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
    return registerMinefopUser(
      email: email,
      password: password,
      firstName: firstName,
      lastName: lastName,
      role: role,
      region: region,
      department: department,
      matricule: matricule,
      poste: poste,
      serviceCode: serviceCode,
    );
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
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
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
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>> approveUser(String userId) async {
    try {
      final response = await dio.patch('/auth/approve-user/$userId');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>> rejectUser(String userId,
      {String? reason}) async {
    try {
      final response = await dio.patch('/auth/reject-user/$userId',
          data: reason != null ? {'reason': reason} : null);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  // ==================== LOCATION METHODS ====================

  Future<List<dynamic>> getRegions() async {
    try {
      final response = await dio.get('/locations/regions');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<List<dynamic>> getDepartments(String regionId) async {
    try {
      final response =
          await dio.get('/locations/regions/$regionId/departments');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<List<dynamic>> getSubdivisions(String departmentId) async {
    try {
      final response =
          await dio.get('/locations/departments/$departmentId/subdivisions');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

// Returns the full region → department → subdivision tree in one call.
// Used by the report wizard to drive all three dropdowns locally
// without cascading network requests on each selection change.
  Future<List<dynamic>> getLocationStructure() async {
    try {
      final response = await dio.get('/locations/structure');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }
  // ==================== SECTOR METHODS ====================

  Future<List<dynamic>> getSectors() async {
    try {
      final response = await dio.get('/sectors');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  // ==================== MINEFOP SERVICE METHODS ====================

  Future<List<dynamic>> getMinefopServices({
    required String category,
    required int level,
  }) async {
    try {
      if (level == 1) {
        final response = await dio.get('/minefop-services/roots',
            queryParameters: {'category': category});
        return response.data;
      } else {
        final response = await dio
            .get('/minefop-services', queryParameters: {'category': category});
        return response.data;
      }
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<List<dynamic>> getMinefopServiceChildren(String parentCode) async {
    try {
      final response = await dio.get('/minefop-services/children',
          queryParameters: {'parentCode': parentCode});
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<List<dynamic>> getMinefopServicePositions(String serviceCode) async {
    try {
      final response =
          await dio.get('/minefop-services/$serviceCode/positions');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  // ==================== CASCADE METHODS FOR MINEFOP REGISTRATION ====================

  /// Step 1 — position types available for a given MINEFOP role.
  /// Returns List<{ positionType: string, label: string }>.
  Future<List<dynamic>> getPositionTypesByRole(String role) async {
    try {
      final response = await dio.get(
        '/minefop-services/positions/by-role',
        queryParameters: {'role': role},
      );
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  /// Step 2 — parent units that contain at least one service with [positionType].
  /// Returns a filtered tree of ServiceNode objects.
  Future<List<dynamic>> getParentServicesForPosition(
      String positionType, String role) async {
    try {
      final response = await dio.get(
        '/minefop-services/parents-for-position',
        queryParameters: {'positionType': positionType, 'role': role},
      );
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  /// Step 3 — child services under [parentCode] that hold [positionType].
  /// Each item includes positionTitle from ServicePosition.title.
  Future<List<dynamic>> getChildServicesForPosition(
      String parentCode, String positionType) async {
    try {
      final response = await dio.get(
        '/minefop-services/children-for-position',
        queryParameters: {
          'parentCode': parentCode,
          'positionType': positionType,
        },
      );
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  /// Draft restoration — resolves a [serviceCode] back to its parent and full
  /// service unit details in a single backend call.
  ///
  /// Used by [StepMinefopInfo] on back-navigation to restore a previously saved
  /// selection without scanning all parent units (fast path B).
  ///
  /// Returns:
  /// ```json
  /// {
  ///   "parentCode": "SOUS_DIR_PERS",
  ///   "serviceUnit": {
  ///     "code": "SERV_PAIE",
  ///     "name": "Service de la Paie",
  ///     "nameEn": null,
  ///     "acronym": "SP",
  ///     "level": 4,
  ///     "category": "CENTRAL",
  ///     "displayName": "SP — Service de la Paie",
  ///     "positionTitle": "Chef du Service de la Paie"
  ///   }
  /// }
  /// ```
  ///
  /// Throws [ApiException] with statusCode 404 if the service is not found,
  /// or 400 if the service has no parent (not a valid position-holder in the cascade).
  Future<Map<String, dynamic>> resolvePosition(String serviceCode) async {
    try {
      final response = await dio.get(
        '/minefop-services/resolve-position',
        queryParameters: {'serviceCode': serviceCode},
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  // ==================== COMPANY METHODS ====================

  Future<Map<String, dynamic>> saveCompanyProfile(
      Map<String, dynamic> data) async {
    try {
      final response = await dio.post('/dsmo/company', data: data);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>?> getMyCompany() async {
    try {
      final response = await dio.get('/dsmo/company');
      final data = response.data;
      if (data is Map<String, dynamic>) return data;
      return null;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  // ==================== DECLARATION METHODS ====================

  Future<Map<String, dynamic>> createDeclaration(
      Map<String, dynamic> data) async {
    try {
      final response = await dio.post('/dsmo/declaration', data: data);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<List<dynamic>> getDeclarations() async {
    try {
      final response = await dio.get('/dsmo/declarations');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<List<dynamic>> getPendingDeclarations() async {
    try {
      final response = await dio.get('/dsmo/declarations/pending');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>> getDeclaration(String id) async {
    try {
      final response = await dio.get('/dsmo/declarations/$id');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
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
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  // ==================== NOTIFICATION METHODS ====================

  Future<Map<String, dynamic>> sendNotification(
      Map<String, dynamic> data) async {
    try {
      final response = await dio.post('/dsmo/notifications/send', data: data);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<List<dynamic>> getNotifications() async {
    try {
      final response = await dio.get('/dsmo/notifications');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  // ==================== ANALYTICS METHODS (DSMO) ====================

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
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  // ==================== ONEFOP QUESTIONNAIRE METHODS ====================

  Future<Map<String, dynamic>> submitQuestionnaire(
      Map<String, dynamic> data) async {
    try {
      final response = await dio.post('/onefop/submit', data: data);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  // ==================== ONEFOP SUBMISSIONS VIEWER (NEW) ====================

  /// Get all ONEFOP submissions with optional filters
  /// Used by SubmissionsViewerScreen for admin users
  Future<List<dynamic>> getOnefopSubmissions({
    String? status,
    String? entityType,
    String? region,
    String? establishmentId,
    String? quarterCode,
  }) async {
    try {
      final query = <String, dynamic>{};
      if (status != null && status != 'Tous') query['status'] = status;
      if (entityType != null && entityType != 'Tous')
        query['entityType'] = entityType;
      if (region != null && region != 'Toutes') query['region'] = region;
      if (establishmentId != null) query['establishmentId'] = establishmentId;
      if (quarterCode != null) query['quarterCode'] = quarterCode;

      final response =
          await dio.get('/onefop/submissions', queryParameters: query);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  /// Get detailed information for a single submission
  Future<Map<String, dynamic>> getOnefopSubmissionDetail(
      String submissionId) async {
    try {
      final response = await dio.get('/onefop/submissions/$submissionId');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  /// Get the currently active quarter for ONEFOP submissions
  Future<Map<String, dynamic>> getActiveQuarter() async {
    try {
      final response = await dio.get('/onefop/active-quarter');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  // ==================== ONEFOP FORM SUBMIT (NEW VERSION) ====================

  Future<Map<String, dynamic>> submitOnefopForm(
      Map<String, dynamic> data) async {
    try {
      final response = await dio.post('/onefop/submit-form', data: data);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>> previewOnefopForm(
      Map<String, dynamic> data) async {
    try {
      final response = await dio.post('/onefop/preview-form', data: data);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<List<dynamic>> getPendingQuestionnaires() async {
    try {
      final response = await dio.get('/admin/questionnaires/pending');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>> approveQuestionnaire(String id) async {
    try {
      final response = await dio.patch('/admin/questionnaires/$id/approve');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>> rejectQuestionnaire(
      String id, String reason) async {
    try {
      final response = await dio
          .patch('/admin/questionnaires/$id/reject', data: {'reason': reason});
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>> requestCorrection(
      String id, String comments) async {
    try {
      final response = await dio.patch(
          '/admin/questionnaires/$id/request-correction',
          data: {'comments': comments});
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  // ==================== ONEFOP ANALYTICS METHODS ====================

  Future<Map<String, dynamic>> getOnefopDashboard({
    int? year,
    String? region,
    String? department,
    String? subdivision,
  }) async {
    try {
      final query = <String, dynamic>{};
      if (year != null) query['year'] = year;
      if (region != null) query['region'] = region;
      if (department != null) query['department'] = department;
      if (subdivision != null) query['subdivision'] = subdivision;
      final response =
          await dio.get('/onefop-analytics/dashboard', queryParameters: query);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<List<dynamic>> getOnefopEmployment({
    int? year,
    String? region,
    String? department,
    String? subdivision,
    required String groupBy,
  }) async {
    try {
      final query = <String, dynamic>{
        'groupBy': groupBy,
        if (year != null) 'year': year,
        if (region != null) 'region': region,
        if (department != null) 'department': department,
        if (subdivision != null) 'subdivision': subdivision,
      };
      final response =
          await dio.get('/onefop-analytics/employment', queryParameters: query);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<List<dynamic>> getOnefopRecruitmentTrends({
    required int startYear,
    required int endYear,
    String? region,
    String? department,
    String? subdivision,
    required String granularity,
  }) async {
    try {
      final query = <String, dynamic>{
        'startYear': startYear,
        'endYear': endYear,
        'granularity': granularity,
        if (region != null) 'region': region,
        if (department != null) 'department': department,
        if (subdivision != null) 'subdivision': subdivision,
      };
      final response = await dio.get('/onefop-analytics/recruitment-trends',
          queryParameters: query);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>> getOnefopHires({
    int? year,
    String? region,
    String? department,
    String? subdivision,
    String? csp,
    String? gender,
    String? ageGroup,
  }) async {
    try {
      final query = <String, dynamic>{};
      if (year != null) query['year'] = year;
      if (region != null) query['region'] = region;
      if (department != null) query['department'] = department;
      if (subdivision != null) query['subdivision'] = subdivision;
      if (csp != null) query['csp'] = csp;
      if (gender != null) query['gender'] = gender;
      if (ageGroup != null) query['ageGroup'] = ageGroup;
      final response =
          await dio.get('/onefop-analytics/hires', queryParameters: query);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<dynamic> getOnefopHiresByDiploma({
    int? year,
    String? region,
    String? department,
    String? subdivision,
    String? diploma,
    int? limit,
  }) async {
    try {
      final query = <String, dynamic>{};
      if (year != null) query['year'] = year;
      if (region != null) query['region'] = region;
      if (department != null) query['department'] = department;
      if (subdivision != null) query['subdivision'] = subdivision;
      if (diploma != null) query['diploma'] = diploma;
      if (limit != null) query['limit'] = limit;
      final response = await dio.get('/onefop-analytics/hires/diploma',
          queryParameters: query);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<List<dynamic>> getOnefopVacancies({
    int? year,
    String? region,
    String? department,
    String? subdivision,
    required String groupBy,
  }) async {
    try {
      final query = <String, dynamic>{
        'groupBy': groupBy,
        if (year != null) 'year': year,
        if (region != null) 'region': region,
        if (department != null) 'department': department,
        if (subdivision != null) 'subdivision': subdivision,
      };
      final response =
          await dio.get('/onefop-analytics/vacancies', queryParameters: query);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<List<dynamic>> getOnefopSkills({
    int? year,
    String? region,
    String? department,
    String? subdivision,
    int? limit,
  }) async {
    try {
      final query = <String, dynamic>{};
      if (year != null) query['year'] = year;
      if (region != null) query['region'] = region;
      if (department != null) query['department'] = department;
      if (subdivision != null) query['subdivision'] = subdivision;
      if (limit != null) query['limit'] = limit;
      final response =
          await dio.get('/onefop-analytics/skills', queryParameters: query);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>> getOnefopTrainingGap({
    int? year,
    String? region,
    String? department,
    String? subdivision,
  }) async {
    try {
      final query = <String, dynamic>{};
      if (year != null) query['year'] = year;
      if (region != null) query['region'] = region;
      if (department != null) query['department'] = department;
      if (subdivision != null) query['subdivision'] = subdivision;
      final response = await dio.get('/onefop-analytics/training-gap',
          queryParameters: query);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>> getOnefopGenderParity({
    int? year,
    String? region,
    String? department,
    String? subdivision,
  }) async {
    try {
      final query = <String, dynamic>{};
      if (year != null) query['year'] = year;
      if (region != null) query['region'] = region;
      if (department != null) query['department'] = department;
      if (subdivision != null) query['subdivision'] = subdivision;
      final response = await dio.get('/onefop-analytics/gender-parity',
          queryParameters: query);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>> getOnefopYouthEmployment({
    int? year,
    String? region,
    String? department,
    String? subdivision,
  }) async {
    try {
      final query = <String, dynamic>{};
      if (year != null) query['year'] = year;
      if (region != null) query['region'] = region;
      if (department != null) query['department'] = department;
      if (subdivision != null) query['subdivision'] = subdivision;
      final response = await dio.get('/onefop-analytics/youth-employment',
          queryParameters: query);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>> getOnefopInclusion({
    int? year,
    String? region,
    String? department,
    String? subdivision,
    String? breakdownBy,
  }) async {
    try {
      final query = <String, dynamic>{};
      if (year != null) query['year'] = year;
      if (region != null) query['region'] = region;
      if (department != null) query['department'] = department;
      if (subdivision != null) query['subdivision'] = subdivision;
      if (breakdownBy != null) query['breakdownBy'] = breakdownBy;
      final response =
          await dio.get('/onefop-analytics/inclusion', queryParameters: query);
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  // ==================== ERROR HANDLER ====================

  String _handleError(DioException error) {
    if (error.response != null) {
      final response = error.response!;
      final data = response.data;
      final statusCode = response.statusCode;

      if (data != null) {
        if (data is Map) {
          final message = data['message'];

          if (message is List && message.isNotEmpty) {
            if (message.length == 1) {
              return message.first.toString();
            }
            return 'Validation échouée: ${message.join(', ')}';
          }

          if (message is String && message.isNotEmpty) {
            return message;
          }

          if (data['error'] is String) {
            final errorMsg = data['error'] as String;
            if (statusCode != null && statusCode != 200) {
              return '$statusCode: $errorMsg';
            }
            return errorMsg;
          }

          if (statusCode == 400) {
            return 'Requête invalide. Veuillez vérifier les données saisies.';
          }
          if (statusCode == 401) {
            return 'Session expirée. Veuillez vous reconnecter.';
          }
          if (statusCode == 403) {
            return 'Accès non autorisé. Vous ne disposez pas des droits nécessaires.';
          }
          if (statusCode == 404) return 'Ressource non trouvée.';
          if (statusCode == 409) return 'Conflit: Cette ressource existe déjà.';
          if (statusCode == 422) {
            return 'Données invalides. Veuillez vérifier les champs.';
          }
          if (statusCode != null && statusCode >= 500) {
            return 'Erreur serveur. Veuillez réessayer plus tard.';
          }
        }

        if (data is String && data.isNotEmpty) return data;
      }

      if (statusCode != null) return 'Erreur serveur (HTTP $statusCode)';
      return 'Une erreur est survenue lors de la communication avec le serveur.';
    }

    if (error.type == DioExceptionType.connectionTimeout) {
      return 'Délai de connexion dépassé. Vérifiez votre connexion internet.';
    }
    if (error.type == DioExceptionType.receiveTimeout) {
      return 'Délai de réception dépassé. Le serveur met trop de temps à répondre.';
    }
    if (error.type == DioExceptionType.sendTimeout) {
      return 'Délai d\'envoi dépassé.';
    }
    if (error.type == DioExceptionType.connectionError) {
      return 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.';
    }
    if (error.type == DioExceptionType.cancel) {
      return 'La requête a été annulée.';
    }

    if (error.message != null && error.message!.isNotEmpty) {
      return error.message!;
    }

    return 'Une erreur inattendue est survenue. Veuillez réessayer.';
  }
}

final apiClientProvider = Provider((ref) => ApiClient());
