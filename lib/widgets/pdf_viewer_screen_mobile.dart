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

import '../theme/app_colors.dart';
import 'pdf_cache.dart'; // ← IMPORT shared PdfCache (was defined locally before)

// This screen is shared across the ONEFOP and DSMO flows (see
// employee_list_screen.dart), so it can't reach into either flow's own
// design tokens — these mirror the app's actual palette (AppColors,
// plus the same border/warning values ONEFOP's own screens use) instead
// of the unrelated teal/slate one this screen used to draw in.
const _kAccent = AppColors.deepEmerald;
const _kCanvas = AppColors.pageBackground;
const _kSurface = AppColors.cardWhite;
const _kInk = AppColors.obsidian;
const _kInkSoft = AppColors.slate;
const _kBorder = Color(0xFFE4E9E6);
const _kWarning = Color(0xFFAC7A26);
const _kDanger = Color(0xFFCF4433);
const _kRadius = 10.0;

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
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Dossier de téléchargement introuvable.',
                  style: TextStyle(
                      fontFamily: 'Inter', fontSize: 13, color: Colors.white)),
              backgroundColor: _kDanger,
              behavior: SnackBarBehavior.floating,
              margin: EdgeInsets.all(16),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.all(Radius.circular(12))),
            ),
          );
        }
        return;
      }

      final dest = File('${destDir.path}/${_filename()}');
      await File(_tempPath!).copy(dest.path);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(children: [
              const Icon(Icons.check_circle_outline,
                  color: Colors.white, size: 20),
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
            backgroundColor: _kInk,
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Téléchargement échoué : $e',
                style: const TextStyle(
                    fontFamily: 'Inter', fontSize: 13, color: Colors.white)),
            backgroundColor: _kDanger,
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
      backgroundColor: _kCanvas,
      appBar: _appBar(),
      body: Column(children: [
        _infoBanner(),
        Expanded(child: _body()),
        _bottomBar(),
      ]),
    );
  }

  // Flat, bordered chrome (kSurface + a hairline bottom border) instead
  // of a solid brand-color fill — matches OnefopAppBar's own treatment
  // elsewhere in the app. The only action up here is the lightweight
  // download icon; the actual submit decision belongs to one clear,
  // full-width button in the bottom bar, not a second, smaller one
  // competing with it for attention.
  PreferredSizeWidget _appBar() => AppBar(
        title: const Text('Aperçu du formulaire',
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: _kInk)),
        backgroundColor: _kSurface,
        foregroundColor: _kInk,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        shape: const Border(bottom: BorderSide(color: _kBorder, width: 1)),
        actions: [
          _downloading
              ? const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Center(
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          color: _kInkSoft, strokeWidth: 2),
                    ),
                  ),
                )
              : IconButton(
                  icon: const Icon(Icons.download_outlined, color: _kInkSoft),
                  tooltip: 'Télécharger le PDF',
                  onPressed: _ready ? _download : null,
                ),
          const SizedBox(width: 4),
        ],
      );

  Widget _infoBanner() => Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: _kWarning.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(_kRadius - 2),
            border: Border.all(color: _kWarning.withValues(alpha: 0.3)),
          ),
          child: const Row(children: [
            Icon(Icons.info_outline, size: 16, color: _kWarning),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'Vérifiez les informations ci-dessous avant de soumettre définitivement.',
                style: TextStyle(fontFamily: 'Inter', fontSize: 13, color: _kWarning),
              ),
            ),
          ]),
        ),
      );

  Widget _body() {
    if (!_ready) {
      return const Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          CircularProgressIndicator(color: _kAccent),
          SizedBox(height: 16),
          Text('Chargement du PDF…',
              style: TextStyle(fontSize: 14, color: _kInkSoft)),
        ]),
      );
    }
    if (_tempPath == null) {
      return const Center(
        child: Text(
          'Impossible de charger le PDF.',
          style: TextStyle(fontFamily: 'Inter', fontSize: 14, color: _kDanger),
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
          color: _kSurface,
          border: Border(top: BorderSide(color: _kBorder)),
          boxShadow: [
            BoxShadow(color: Color(0x0A000000), blurRadius: 12, offset: Offset(0, -4)),
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
                foregroundColor: _kInkSoft,
                side: const BorderSide(color: _kBorder),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                shape:
                    RoundedRectangleBorder(borderRadius: BorderRadius.circular(_kRadius)),
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton.icon(
              onPressed: (_ready && !_downloading) ? _download : null,
              icon: _downloading
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2, color: _kAccent))
                  : const Icon(Icons.download_outlined, size: 16, color: _kAccent),
              label: const Text('Télécharger',
                  style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: _kAccent)),
              style: OutlinedButton.styleFrom(
                foregroundColor: _kAccent,
                side: const BorderSide(color: _kAccent),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                shape:
                    RoundedRectangleBorder(borderRadius: BorderRadius.circular(_kRadius)),
              ),
            ),
            const Spacer(),
            // The one, unambiguous submit action — deliberately the only
            // filled/high-contrast button on this bar, so it reads as the
            // primary action rather than one of three equally-weighted
            // choices.
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
                backgroundColor: _kAccent,
                foregroundColor: Colors.white,
                disabledBackgroundColor: _kBorder,
                elevation: 0,
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape:
                    RoundedRectangleBorder(borderRadius: BorderRadius.circular(_kRadius)),
              ),
            ),
          ]),
        ),
      );
}
