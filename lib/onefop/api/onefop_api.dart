// lib/onefop/onefop_api.dart (or wherever this file is located)

import 'package:dsmo_app/data/api_client.dart';

class OnefopApi {
  final ApiClient api;

  OnefopApi(this.api);

  // V2: Accepts a Map instead of OnefopQuestionnaire model
  Future<dynamic> submitQuestionnaire(Map<String, dynamic> data) async {
    try {
      final response = await api.post(
        '/questionnaires',
        data: data,
      );
      return response.data;
    } catch (e) {
      rethrow;
    }
  }

  // Optional: Keep old method with deprecation notice
  @Deprecated('Use submitQuestionnaire(Map<String, dynamic>) instead')
  Future<void> submitQuestionnaireOld(dynamic data) async {
    await api.post(
      '/questionnaires',
      data: data.toJson(),
    );
  }
}
