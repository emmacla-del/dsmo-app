// lib/widgets/file_saver_web.dart
// ignore: avoid_web_libraries_in_flutter, deprecated_member_use
import 'dart:html' as html;

/// Triggers a browser download of [bytes] as [filename].
/// Returns the filename, matching the mobile implementation's contract
/// of returning where the file ended up.
Future<String> saveBytesAsFile(List<int> bytes, String filename,
    {String mimeType = 'application/octet-stream'}) async {
  final blob = html.Blob([bytes], mimeType);
  final url = html.Url.createObjectUrlFromBlob(blob);
  html.AnchorElement(href: url)
    ..setAttribute('download', filename)
    ..click();
  html.Url.revokeObjectUrl(url);
  return filename;
}
