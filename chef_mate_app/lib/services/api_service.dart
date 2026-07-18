import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);

  @override
  String toString() => message;
}

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  String? _token;

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('authToken');
  }

  Future<void> saveToken(String token, {bool rememberMe = true}) async {
    _token = token;
    if (rememberMe) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('authToken', token);
    } else {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('authToken');
    }
  }

  Future<void> clearToken() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('authToken');
  }

  bool get hasToken => _token != null;

  Map<String, String> get _headers {
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    if (_token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  Future<dynamic> get(String path, {Map<String, String>? queryParams}) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path')
        .replace(queryParameters: queryParams);
    final response = await http.get(uri, headers: _headers)
        .timeout(ApiConfig.timeout);
    return _handleResponse(response);
  }

  Future<dynamic> post(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');
    final response = await http.post(
      uri,
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    ).timeout(ApiConfig.timeout);
    return _handleResponse(response);
  }

  Future<dynamic> put(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');
    final response = await http.put(
      uri,
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    ).timeout(ApiConfig.timeout);
    return _handleResponse(response);
  }

  Future<dynamic> patch(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');
    final response = await http.patch(
      uri,
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    ).timeout(ApiConfig.timeout);
    return _handleResponse(response);
  }

  Future<dynamic> postMultipart(String path, {required String fileField, required List<int> fileBytes, String fileName = 'image.jpg', Map<String, String>? fields}) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');
    final request = http.MultipartRequest('POST', uri);
    if (_token != null) {
      request.headers['Authorization'] = 'Bearer $_token';
    }
    final mimeType = fileName.endsWith('.png') ? 'png' : 'jpeg';
    request.files.add(http.MultipartFile.fromBytes(
      fileField, fileBytes,
      filename: fileName,
      contentType: MediaType('image', mimeType),
    ));
    if (fields != null) request.fields.addAll(fields);
    final streamedResponse = await request.send().timeout(ApiConfig.timeout);
    final response = await http.Response.fromStream(streamedResponse);
    return _handleResponse(response);
  }

  Future<dynamic> delete(String path) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');
    final response = await http.delete(uri, headers: _headers)
        .timeout(ApiConfig.timeout);
    return _handleResponse(response);
  }

  dynamic _handleResponse(http.Response response) {
    final body = response.body.isNotEmpty ? jsonDecode(response.body) : null;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }

    final message = body is Map ? (body['error'] ?? body['message'] ?? 'Request failed') : 'Request failed';
    throw ApiException(response.statusCode, message.toString());
  }
}
