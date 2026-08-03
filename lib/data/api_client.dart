import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../services/reference_cache_service.dart';

class ApiException implements Exception {
  final int? statusCode;
  final String message;

  ApiException({this.statusCode, required this.message});

  @override
  String toString() => message;
}

class ApiClient {
  final Dio dio;
  final _cache = ReferenceCacheService();

  // Set on every login regardless of "Rester connecté", so the token is
  // usable for the rest of this app session either way. Only the Hive
  // write in setToken() is conditional — this is what makes an unchecked
  // "remember me" actually stop the session from surviving a cold start.
  String? _memoryToken;

  ApiClient()
      : dio = Dio(BaseOptions(
          baseUrl: 'https://dsmo-app-2.onrender.com/api',
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
    if (_memoryToken != null) return _memoryToken;
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

  /// [persist] controls whether the session survives a cold start (the
  /// "Rester connecté" checkbox on the login screen). The token is always
  /// kept in memory either way, so it works for the rest of this app
  /// session — only the Hive write, which is what _tryRestore() finds on
  /// the *next* launch, is conditional. When false, any token persisted by
  /// an earlier "remember me" login is explicitly cleared, so this login's
  /// choice — not a stale previous one — decides what happens next launch.
  Future<void> setToken(String token, {bool persist = true}) async {
    _memoryToken = token;
    final box = await Hive.openBox('tokenBox');
    if (persist) {
      await box.put('access_token', token);
    } else {
      await box.delete('access_token');
    }
  }

  Future<void> _clearToken() async {
    _memoryToken = null;
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

  Future<Response<T>> put<T>(String path,
      {dynamic data, Options? options}) async {
    try {
      return await dio.put<T>(path, data: data, options: options);
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Response<T>> delete<T>(String path,
      {dynamic data, Options? options}) async {
    try {
      return await dio.delete<T>(path, data: data, options: options);
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

  /// Self-service "identifiant oublié": resolves the establishmentId from
  /// organisation name + NIU (tax number) + phone, the only 3 fields
  /// collected for every entity type at registration.
  Future<Map<String, dynamic>> findIdentifier({
    required String companyName,
    required String taxNumber,
    required String phone,
  }) async {
    try {
      final response = await dio.post('/auth/identifier/find', data: {
        'companyName': companyName,
        'taxNumber': taxNumber,
        'phone': phone,
      });
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  /// Re-signs and returns the URL of the caller's registration attestation
  /// PDF so it can be re-downloaded anytime, not just right after signup.
  Future<String> getAttestationUrl() async {
    try {
      final response = await dio.get('/auth/attestation');
      return response.data['url'] as String;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
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

  // ==================== ADMIN: ACTIVE USER MANAGEMENT ====================

  Future<Map<String, dynamic>> listUsers({
    String? search,
    String? role,
    String? status,
    bool? isActive,
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      final response = await dio.get('/auth/users', queryParameters: {
        if (search != null && search.isNotEmpty) 'search': search,
        if (role != null) 'role': role,
        if (status != null) 'status': status,
        if (isActive != null) 'isActive': isActive.toString(),
        'page': page,
        'pageSize': pageSize,
      });
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>> updateUserRole(
      String userId, String role) async {
    try {
      final response =
          await dio.patch('/auth/users/$userId/role', data: {'role': role});
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>> suspendUser(String userId) async {
    try {
      final response = await dio.patch('/auth/users/$userId/suspend');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>> activateUser(String userId) async {
    try {
      final response = await dio.patch('/auth/users/$userId/activate');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<void> deleteUser(String userId) async {
    try {
      await dio.delete('/auth/users/$userId');
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  /// Deactivates the caller's own account (soft delete — see backend
  /// AuthService.deactivateOwnAccount). Blocks future logins immediately.
  Future<void> deleteMyAccount() async {
    try {
      await dio.delete('/auth/me');
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  // ==================== ADMIN: SYSTEM SETTINGS (SUPER_ADMIN only) ====================

  Future<Map<String, dynamic>> getSystemSettings() async {
    try {
      final response = await dio.get('/system-settings');
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<Map<String, dynamic>> updateSystemSettings({
    int? passwordMinLength,
    bool? require2FAForStaff,
    bool? maintenanceMode,
    String? maintenanceMessage,
  }) async {
    try {
      final response = await dio.patch('/system-settings', data: {
        if (passwordMinLength != null) 'passwordMinLength': passwordMinLength,
        if (require2FAForStaff != null) 'require2FAForStaff': require2FAForStaff,
        if (maintenanceMode != null) 'maintenanceMode': maintenanceMode,
        if (maintenanceMessage != null) 'maintenanceMessage': maintenanceMessage,
      });
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  // ==================== ADMIN: COMPANY DIRECTORY ====================

  Future<Map<String, dynamic>> listCompanies({
    String? search,
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      final response = await dio.get('/dsmo/companies', queryParameters: {
        if (search != null && search.isNotEmpty) 'search': search,
        'page': page,
        'pageSize': pageSize,
      });
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  // ==================== LOCATION METHODS ====================

  // Geography/sectors are effectively static administrative reference
  // data — cached for a week so dropdowns keep working offline and the
  // network isn't hit on every screen visit.
  static const _referenceTtl = Duration(days: 7);
  static const _serviceTreeTtl = Duration(days: 1);

  Future<List<dynamic>> getRegions() async {
    return _cache.getCached<List<dynamic>>(
      key: 'regions',
      ttl: _referenceTtl,
      fetch: () async {
        try {
          final response = await dio.get('/locations/regions');
          return response.data;
        } on DioException catch (e) {
          throw ApiException(
            statusCode: e.response?.statusCode,
            message: _handleError(e),
          );
        }
      },
    );
  }

  Future<List<dynamic>> getDepartments(String regionId) async {
    return _cache.getCached<List<dynamic>>(
      key: 'departments_$regionId',
      ttl: _referenceTtl,
      fetch: () async {
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
      },
    );
  }

  Future<List<dynamic>> getSubdivisions(String departmentId) async {
    return _cache.getCached<List<dynamic>>(
      key: 'subdivisions_$departmentId',
      ttl: _referenceTtl,
      fetch: () async {
        try {
          final response = await dio
              .get('/locations/departments/$departmentId/subdivisions');
          return response.data;
        } on DioException catch (e) {
          throw ApiException(
            statusCode: e.response?.statusCode,
            message: _handleError(e),
          );
        }
      },
    );
  }

// Returns the full region → department → subdivision tree in one call.
// Used by the report wizard to drive all three dropdowns locally
// without cascading network requests on each selection change.
  Future<List<dynamic>> getLocationStructure() async {
    return _cache.getCached<List<dynamic>>(
      key: 'location_structure',
      ttl: _referenceTtl,
      fetch: () async {
        try {
          final response = await dio.get('/locations/structure');
          return response.data;
        } on DioException catch (e) {
          throw ApiException(
            statusCode: e.response?.statusCode,
            message: _handleError(e),
          );
        }
      },
    );
  }
  // ==================== SECTOR METHODS ====================

  Future<List<dynamic>> getSectors() async {
    return _cache.getCached<List<dynamic>>(
      key: 'sectors',
      ttl: _referenceTtl,
      fetch: () async {
        try {
          final response = await dio.get('/sectors');
          return response.data;
        } on DioException catch (e) {
          throw ApiException(
            statusCode: e.response?.statusCode,
            message: _handleError(e),
          );
        }
      },
    );
  }

  // ==================== MINEFOP SERVICE METHODS ====================

  Future<List<dynamic>> getMinefopServices({
    required String category,
    required int level,
  }) async {
    return _cache.getCached<List<dynamic>>(
      key: 'minefop_services_${category}_$level',
      ttl: _serviceTreeTtl,
      fetch: () async {
        try {
          if (level == 1) {
            final response = await dio.get('/minefop-services/roots',
                queryParameters: {'category': category});
            return response.data;
          } else {
            final response = await dio.get('/minefop-services',
                queryParameters: {'category': category});
            return response.data;
          }
        } on DioException catch (e) {
          throw ApiException(
            statusCode: e.response?.statusCode,
            message: _handleError(e),
          );
        }
      },
    );
  }

  Future<List<dynamic>> getMinefopServiceChildren(String parentCode) async {
    return _cache.getCached<List<dynamic>>(
      key: 'minefop_children_$parentCode',
      ttl: _serviceTreeTtl,
      fetch: () async {
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
      },
    );
  }

  Future<List<dynamic>> getMinefopServicePositions(String serviceCode) async {
    return _cache.getCached<List<dynamic>>(
      key: 'minefop_positions_$serviceCode',
      ttl: _serviceTreeTtl,
      fetch: () async {
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
      },
    );
  }

  // ==================== CASCADE METHODS FOR MINEFOP REGISTRATION ====================

  /// Step 1 — position types available for a given MINEFOP role.
  /// Returns List<{ positionType: string, label: string }>.
  Future<List<dynamic>> getPositionTypesByRole(String role) async {
    return _cache.getCached<List<dynamic>>(
      key: 'position_types_$role',
      ttl: _serviceTreeTtl,
      fetch: () async {
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
      },
    );
  }

  /// Step 2 — parent units that contain at least one service with [positionType].
  /// Returns a filtered tree of ServiceNode objects.
  Future<List<dynamic>> getParentServicesForPosition(
      String positionType, String role) async {
    return _cache.getCached<List<dynamic>>(
      key: 'parent_services_${positionType}_$role',
      ttl: _serviceTreeTtl,
      fetch: () async {
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
      },
    );
  }

  /// Step 3 — child services under [parentCode] that hold [positionType].
  /// Each item includes positionTitle from ServicePosition.title.
  Future<List<dynamic>> getChildServicesForPosition(
      String parentCode, String positionType) async {
    return _cache.getCached<List<dynamic>>(
      key: 'child_services_${parentCode}_$positionType',
      ttl: _serviceTreeTtl,
      fetch: () async {
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
      },
    );
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

  // ==================== CAMPAIGN METHODS ====================

  Future<List<dynamic>> getActiveCampaigns() async {
    try {
      final response = await dio.get('/campaigns/active/current');
      return response.data as List<dynamic>? ?? [];
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  // ==================== DECLARATION METHODS ====================

  /// Get the currently active DSMO declaration period (mirrors getActiveQuarter
  /// for ONEFOP) — { isOpen, code, label, deadline }.
  Future<Map<String, dynamic>> getActiveDsmoPeriod() async {
    try {
      final response = await dio.get('/dsmo/active-period');
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

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

// ==================== ONEFOP PREVIEW ====================

  /// [languageCode] is sent as an `Accept-Language` header only — a
  /// forward-compatible hook the backend can adopt later to localize the
  /// generated PDF. It's additive and harmless if ignored; the PDF's actual
  /// language won't change until server-side support exists.
  Future<List<int>> previewQuestionnaire(
    Map<String, dynamic> data, {
    String? languageCode,
  }) async {
    try {
      final response = await dio.post(
        '/onefop/preview',
        data: data,
        options: Options(
          responseType: ResponseType.bytes,
          headers: languageCode == null
              ? null
              : {'Accept-Language': languageCode},
        ),
      );
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
      if (entityType != null && entityType != 'Tous') {
        query['entityType'] = entityType;
      }
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

  /// Get the generated PDF bytes for a submitted ONEFOP questionnaire.
  /// See [previewQuestionnaire] for the [languageCode]/Accept-Language note.
  Future<List<int>> getOnefopSubmissionPdf(
    String submissionId, {
    String? languageCode,
  }) async {
    try {
      final response = await dio.get(
        '/onefop/submissions/$submissionId/pdf',
        options: Options(
          responseType: ResponseType.bytes,
          headers: languageCode == null
              ? null
              : {'Accept-Language': languageCode},
        ),
      );
      return response.data;
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  /// Export all approved ONEFOP submissions as an Excel workbook (Super Admin only)
  Future<List<int>> exportOnefopSubmissionsExcel({
    String? region,
    String? department,
    int? year,
    String? fromDate,
    String? toDate,
  }) async {
    try {
      final response = await dio.post(
        '/data-management/export/submissions',
        data: {
          'type': 'ONEFOP',
          if (region != null) 'region': region,
          if (department != null) 'department': department,
          if (year != null) 'year': year,
          if (fromDate != null) 'fromDate': fromDate,
          if (toDate != null) 'toDate': toDate,
        },
        options: Options(responseType: ResponseType.bytes),
      );
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
    String? fromQuarter,
    String? toQuarter,
    String? startDate,
    String? endDate,
    String? region,
    String? department,
    String? subdivision,
  }) async {
    try {
      final query = <String, dynamic>{};
      if (year != null) query['year'] = year;
      if (fromQuarter != null) query['fromQuarter'] = fromQuarter;
      if (toQuarter != null) query['toQuarter'] = toQuarter;
      if (startDate != null) query['startDate'] = startDate;
      if (endDate != null) query['endDate'] = endDate;
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
    String? fromQuarter,
    String? toQuarter,
    String? startDate,
    String? endDate,
    String? region,
    String? department,
    String? subdivision,
    required String groupBy,
  }) async {
    try {
      final query = <String, dynamic>{
        'groupBy': groupBy,
        if (year != null) 'year': year,
        if (fromQuarter != null) 'fromQuarter': fromQuarter,
        if (toQuarter != null) 'toQuarter': toQuarter,
        if (startDate != null) 'startDate': startDate,
        if (endDate != null) 'endDate': endDate,
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
    String? fromQuarter,
    String? toQuarter,
    String? startDate,
    String? endDate,
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
        if (fromQuarter != null) 'fromQuarter': fromQuarter,
        if (toQuarter != null) 'toQuarter': toQuarter,
        if (startDate != null) 'startDate': startDate,
        if (endDate != null) 'endDate': endDate,
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

  // change return type from Map to List
  Future<List<dynamic>> getOnefopHires({
    int? year,
    String? fromQuarter,
    String? toQuarter,
    String? startDate,
    String? endDate,
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
      if (fromQuarter != null) query['fromQuarter'] = fromQuarter;
      if (toQuarter != null) query['toQuarter'] = toQuarter;
      if (startDate != null) query['startDate'] = startDate;
      if (endDate != null) query['endDate'] = endDate;
      if (region != null) query['region'] = region;
      if (department != null) query['department'] = department;
      if (subdivision != null) query['subdivision'] = subdivision;
      if (csp != null) query['csp'] = csp;
      if (gender != null) query['gender'] = gender;
      if (ageGroup != null) query['ageGroup'] = ageGroup;

      final response =
          await dio.get('/onefop-analytics/hires', queryParameters: query);
      return response.data is List ? response.data as List : [];
    } on DioException catch (e) {
      throw ApiException(
        statusCode: e.response?.statusCode,
        message: _handleError(e),
      );
    }
  }

  Future<dynamic> getOnefopHiresByDiploma({
    int? year,
    String? fromQuarter,
    String? toQuarter,
    String? region,
    String? department,
    String? subdivision,
    String? diploma,
    int? limit,
  }) async {
    try {
      final query = <String, dynamic>{};
      if (year != null) query['year'] = year;
      if (fromQuarter != null) query['fromQuarter'] = fromQuarter;
      if (toQuarter != null) query['toQuarter'] = toQuarter;
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
            // NestJS validation returns one raw constraint message per
            // invalid field — joining all of them produces a wall of
            // developer-facing text that can fill the entire screen.
            // Show a short, bounded summary instead.
            return 'Certains champs du formulaire sont invalides ou '
                'incomplets (${message.length} erreurs). Veuillez vérifier '
                'votre saisie. / Some form fields are invalid or '
                'incomplete (${message.length} errors). Please review '
                'your entries.';
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
