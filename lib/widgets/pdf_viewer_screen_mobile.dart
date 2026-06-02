// lib/widgets/pdf_viewer_screen_mobile.dart
// ─────────────────────────────────────────────────────────────
// Mobile PDF viewer — view inline with SfPdfViewer,
// download to device, and confirm submission.
// ─────────────────────────────────────────────────────────────
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';

import 'pdf_cache.dart'; // ← IMPORT shared PdfCache (was defined locally before)

class PdfViewerScreen extends StatefulWidget {
  final Uint8List? pdfBytes;
  final String pdfPath;
  final Future<void> Function() onConfirm;

  const PdfViewerScreen({
    super.key,
    required this.pdfPath,
    required this.onConfirm,
    this.pdfBytes,
  });

  @override
  State<PdfViewerScreen> createState() => _State();
}

class _State extends State<PdfViewerScreen> {
  String? _tempPath;
  bool _ready = false;
  bool _confirming = false;
  bool _downloading = false;
  String? _downloadMsg;

  @override
  void initState() {
    super.initState();
    _prepare();
  }

  Future<void> _prepare() async {
    final bytes = widget.pdfBytes ?? PdfCache.currentPdfBytes;
    if (bytes != null) {
      final dir = await getTemporaryDirectory();
      final name = _filename();
      final file = File('${dir.path}/$name');
      await file.writeAsBytes(bytes);
      if (mounted) {
        setState(() {
          _tempPath = file.path;
          _ready = true;
        });
      }
    } else if (widget.pdfPath.isNotEmpty) {
      if (mounted) {
        setState(() {
          _tempPath = widget.pdfPath;
          _ready = true;
        });
      }
    }
  }

  String _filename() =>
      PdfCache.currentPdfName ??
      'onefop_preview_${DateTime.now().millisecondsSinceEpoch}.pdf';

  Future<void> _download() async {
    if (_tempPath == null) return;
    setState(() {
      _downloading = true;
      _downloadMsg = null;
    });
    try {
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
        setState(() => _downloadMsg = 'Dossier de téléchargement introuvable.');
        return;
      }

      final dest = File('${destDir.path}/${_filename()}');
      await File(_tempPath!).copy(dest.path);

      if (mounted) {
        setState(() => _downloadMsg = 'Enregistré dans : ${dest.path}');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(children: [
              const Icon(Icons.check_circle_outline,
                  color: Color(0xFF10B981), size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  Platform.isAndroid
                      ? 'PDF enregistré dans Téléchargements'
                      : 'PDF enregistré dans Documents',
                  style: const TextStyle(
                      fontFamily: 'Inter', fontSize: 13, color: Colors.white),
                ),
              ),
            ]),
            backgroundColor: const Color(0xFF1E293B),
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.all(16),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _downloadMsg = 'Erreur : $e');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Téléchargement échoué : $e',
                style: const TextStyle(
                    fontFamily: 'Inter', fontSize: 13, color: Colors.white)),
            backgroundColor: const Color(0xFFEF4444),
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.all(16),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  Future<void> _handleConfirm() async {
    setState(() => _confirming = true);
    try {
      await widget.onConfirm();
    } finally {
      if (mounted) setState(() => _confirming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: _appBar(),
      body: Column(children: [
        _infoBanner(),
        Expanded(child: _body()),
        _bottomBar(),
      ]),
    );
  }

  AppBar _appBar() => AppBar(
        title: const Text('Aperçu du formulaire',
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Colors.white)),
        backgroundColor: const Color(0xFF0D7377),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          _downloading
              ? const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Center(
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          color: Colors.white70, strokeWidth: 2),
                    ),
                  ),
                )
              : IconButton(
                  icon: const Icon(Icons.download_outlined,
                      color: Colors.white70),
                  tooltip: 'Télécharger le PDF',
                  onPressed: _ready ? _download : null,
                ),
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: _confirming
                ? const Center(
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                    ),
                  )
                : ElevatedButton.icon(
                    onPressed: _ready ? _handleConfirm : null,
                    icon: const Icon(Icons.send_rounded, size: 18),
                    label: const Text('Soumettre',
                        style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 13,
                            fontWeight: FontWeight.w700)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                    ),
                  ),
          ),
        ],
      );

  Widget _infoBanner() => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        color: const Color(0xFFFFF7ED),
        child: const Row(children: [
          Icon(Icons.info_outline, size: 16, color: Color(0xFFD97706)),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Vérifiez les informations ci-dessous avant de soumettre définitivement.',
              style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  color: Color(0xFF92400E)),
            ),
          ),
        ]),
      );

  Widget _body() {
    if (!_ready) {
      return const Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          CircularProgressIndicator(color: Color(0xFF0D7377)),
          SizedBox(height: 16),
          Text('Chargement du PDF…',
              style: TextStyle(fontSize: 14, color: Color(0xFF475569))),
        ]),
      );
    }
    if (_tempPath == null) {
      return const Center(
        child: Text(
          'Impossible de charger le PDF.',
          style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              color: Color(0xFFEF4444)),
        ),
      );
    }
    return SfPdfViewer.file(
      File(_tempPath!),
      enableDoubleTapZooming: true,
      enableTextSelection: true,
      pageLayoutMode: PdfPageLayoutMode.continuous,
    );
  }

  Widget _bottomBar() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
          boxShadow: [
            BoxShadow(
                color: Color(0x0A000000),
                blurRadius: 12,
                offset: Offset(0, -4)),
          ],
        ),
        child: SafeArea(
          child: Row(children: [
            OutlinedButton.icon(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.arrow_back, size: 16),
              label: const Text('Modifier',
                  style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w600)),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF475569),
                side: const BorderSide(color: Color(0xFFE2E8F0)),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton.icon(
              onPressed: (_ready && !_downloading) ? _download : null,
              icon: _downloading
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Color(0xFF0D7377)))
                  : const Icon(Icons.download_outlined,
                      size: 16, color: Color(0xFF0D7377)),
              label: const Text('Télécharger',
                  style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF0D7377))),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF0D7377),
                side: const BorderSide(color: Color(0xFF0D7377)),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const Spacer(),
            ElevatedButton.icon(
              onPressed: (_ready && !_confirming) ? _handleConfirm : null,
              icon: _confirming
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : const Icon(Icons.send_rounded, size: 18),
              label: Text(
                  _confirming ? 'Soumission…' : 'Confirmer et soumettre',
                  style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w700)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                foregroundColor: Colors.white,
                disabledBackgroundColor: const Color(0xFF94A3B8),
                elevation: 0,
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ]),
        ),
      );
}
