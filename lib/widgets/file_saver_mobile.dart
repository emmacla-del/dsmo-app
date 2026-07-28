// lib/widgets/file_saver_mobile.dart
import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';

/// Saves [bytes] as [filename] to the device's Downloads folder
/// (Android) or Documents folder (iOS/desktop). Returns the saved path.
Future<String> saveBytesAsFile(List<int> bytes, String filename,
    {String mimeType = 'application/octet-stream'}) async {
  Directory? destDir;
  if (Platform.isAndroid) {
    destDir = Directory('/storage/emulated/0/Download');
    if (!destDir.existsSync()) {
      destDir = await getExternalStorageDirectory();
    }
  } else {
    destDir = await getApplicationDocumentsDirectory();
  }

  if (destDir == null) {
    throw Exception('Dossier de téléchargement introuvable.');
  }

  final file = File('${destDir.path}/$filename');
  await file.writeAsBytes(Uint8List.fromList(bytes));
  return file.path;
}
