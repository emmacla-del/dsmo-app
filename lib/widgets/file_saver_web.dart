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
  final anchor = html.AnchorElement(href: url)
    ..setAttribute('download', filename);
  html.document.body?.append(anchor);
  anchor.click();
  Future.delayed(const Duration(seconds: 2), () {
    anchor.remove();
    html.Url.revokeObjectUrl(url);
  });
  return filename;
}
