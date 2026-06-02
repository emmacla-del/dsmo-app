// lib/core/services/analytics_service.dart
// Simple Dio-based API client – no code generation needed

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/analytics/models/dashboard_models.dart';

class AnalyticsService {
  final Dio _dio;

  AnalyticsService(this._dio);

  // ──────────────────────────────────────────────────────────
  // Dashboard KPI summary
  // ──────────────────────────────────────────────────────────
  Future<DashboardSummary> getKpiSummary({
    required int year,
    String? regionId,
    String? departmentId,
    String? sectorId,
  }) async {
    final query = _buildQuery(year, regionId, departmentId, sectorId);
    final response =
        await _dio.get('/analytics/kpi-summary', queryParameters: query);
    return DashboardSummary.fromJson(response.data);
  }

  // ──────────────────────────────────────────────────────────
  // Employment trend (line chart)
  // ──────────────────────────────────────────────────────────
  Future<List<EmploymentTrend>> getEmploymentTrend({
    required int year,
    String? regionId,
    String? departmentId,
    String? sectorId,
  }) async {
    final query = _buildQuery(year, regionId, departmentId, sectorId);
    final response =
        await _dio.get('/analytics/employment-trend', queryParameters: query);
    final List<dynamic> list = response.data;
    return list.map((json) => EmploymentTrend.fromJson(json)).toList();
  }

  // ──────────────────────────────────────────────────────────
  // Regional summary (ranking)
  // ──────────────────────────────────────────────────────────
  Future<List<RegionalSummary>> getRegionalData({
    required int year,
    String? regionId,
    String? departmentId,
  }) async {
    final query = _buildQuery(year, regionId, departmentId, null);
    final response =
        await _dio.get('/analytics/regional', queryParameters: query);
    final List<dynamic> list = response.data;
    return list.map((json) => RegionalSummary.fromJson(json)).toList();
  }

  // ──────────────────────────────────────────────────────────
  // Sector performance
  // ──────────────────────────────────────────────────────────
  Future<List<Sector>> getSectorData({
    required int year,
    String? regionId,
    String? departmentId,
  }) async {
    final query = _buildQuery(year, regionId, departmentId, null);
    final response =
        await _dio.get('/analytics/sectors', queryParameters: query);
    final List<dynamic> list = response.data;
    return list.map((json) => Sector.fromJson(json)).toList();
  }

  // ──────────────────────────────────────────────────────────
  // Gender distribution (for pie chart)
  // ──────────────────────────────────────────────────────────
  Future<GenderDistribution> getGenderDistribution({
    required int year,
    String? regionId,
    String? departmentId,
    String? sectorId,
  }) async {
    final query = _buildQuery(year, regionId, departmentId, sectorId);
    final response =
        await _dio.get('/analytics/gender', queryParameters: query);
    return GenderDistribution.fromJson(response.data);
  }

  // ──────────────────────────────────────────────────────────
  // Top skills demand
  // ──────────────────────────────────────────────────────────
  Future<List<SkillDemand>> getTopSkills({
    required int year,
    String? regionId,
    String? departmentId,
    String? sectorId,
    int limit = 10,
  }) async {
    final query = _buildQuery(year, regionId, departmentId, sectorId);
    query['limit'] = limit;
    final response =
        await _dio.get('/analytics/skills', queryParameters: query);
    final List<dynamic> list = response.data;
    return list.map((json) => SkillDemand.fromJson(json)).toList();
  }

  // ──────────────────────────────────────────────────────────
  // Training needs
  // ──────────────────────────────────────────────────────────
  Future<List<TrainingNeed>> getTrainingNeeds({
    required int year,
    String? regionId,
    String? departmentId,
    String? sectorId,
    int limit = 10,
  }) async {
    final query = _buildQuery(year, regionId, departmentId, sectorId);
    query['limit'] = limit;
    final response =
        await _dio.get('/analytics/training', queryParameters: query);
    final List<dynamic> list = response.data;
    return list.map((json) => TrainingNeed.fromJson(json)).toList();
  }

  // ──────────────────────────────────────────────────────────
  // Export report (CSV / Excel)
  // ──────────────────────────────────────────────────────────
  Future<List<int>> exportReport({
    required int year,
    String? regionId,
    String? departmentId,
    String? sectorId,
    required String format, // 'csv' or 'xlsx'
  }) async {
    final query = _buildQuery(year, regionId, departmentId, sectorId);
    query['format'] = format;
    final response = await _dio.get(
      '/analytics/export',
      queryParameters: query,
      options: Options(responseType: ResponseType.bytes),
    );
    return response.data;
  }

  // ──────────────────────────────────────────────────────────
  // Helper: build query parameters
  // ──────────────────────────────────────────────────────────
  Map<String, dynamic> _buildQuery(
    int year,
    String? regionId,
    String? departmentId,
    String? sectorId,
  ) {
    final map = <String, dynamic>{'year': year};
    if (regionId != null && regionId.isNotEmpty) map['regionId'] = regionId;
    if (departmentId != null && departmentId.isNotEmpty) {
      map['departmentId'] = departmentId;
    }
    if (sectorId != null && sectorId.isNotEmpty) map['sectorId'] = sectorId;
    return map;
  }
}

// ──────────────────────────────────────────────────────────
// Dio client provider
// ──────────────────────────────────────────────────────────
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl:
        'https://your-api.onrender.com/api', // ← change to your backend URL
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 30),
    headers: {'Content-Type': 'application/json'},
  ));
  // Add interceptors if needed (auth token, logging)
  dio.interceptors.add(LogInterceptor(requestBody: true, responseBody: true));
  return dio;
});

final analyticsServiceProvider = Provider<AnalyticsService>((ref) {
  final dio = ref.watch(dioProvider);
  return AnalyticsService(dio);
});
