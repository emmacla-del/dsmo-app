// lib/widgets/pdf_viewer_screen_web.dart
// ─────────────────────────────────────────────────────────────
// HYBRID Web PDF viewer (Option 2)
// • Chrome/Edge/Firefox    → native <embed> (fast, zero deps)
// • Safari / iOS           → PDF.js CDN with base64 data URI
// ─────────────────────────────────────────────────────────────
// ignore: avoid_web_libraries_in_flutter
import 'dart:convert';
import 'dart:html' as html;
import 'dart:typed_data';
import 'dart:ui_web' as ui;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'pdf_cache.dart';

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
  State<PdfViewerScreen> createState() => _PdfViewerScreenState();
}

class _PdfViewerScreenState extends State<PdfViewerScreen> {
  String? _blobUrl;
  bool _confirming = false;
  late final String _viewType;

  @override
  void initState() {
    super.initState();
    _viewType = 'pdf-iframe-${identityHashCode(this)}';
    _buildBlobUrl();
  }

  void _buildBlobUrl() {
    final bytes = widget.pdfBytes ?? PdfCache.currentPdfBytes;
    if (bytes == null) return;

    final blob = html.Blob([bytes], 'application/pdf');
    final url = html.Url.createObjectUrlFromBlob(blob);
    _blobUrl = url;

    // ── Browser detection ───────────────────────────────────
    final ua = html.window.navigator.userAgent.toLowerCase();
    final isSafari = ua.contains('safari') &&
        !ua.contains('chrome') &&
        !ua.contains('chromium');
    final isIOS =
        ua.contains('iphone') || ua.contains('ipad') || ua.contains('ipod');
    final usePdfJs = isSafari || isIOS;

    // ignore: undefined_prefixed_name
    ui.platformViewRegistry.registerViewFactory(_viewType, (_) {
      if (usePdfJs) {
        // SAFARI / iOS: PDF.js CDN viewer with base64 data URI
        final b64 = base64Encode(bytes);
        final dataUri = 'data:application/pdf;base64,$b64';
        final viewerUrl =
            'https://mozilla.github.io/pdf.js/web/viewer.html?file='
            '${Uri.encodeComponent(dataUri)}';

        final iframe = html.IFrameElement()
          ..src = viewerUrl
          ..style.border = 'none'
          ..style.width = '100%'
          ..style.height = '100%'
          ..allowFullscreen = true;

        // Wrap in explicit sized container to prevent platform view warnings
        final wrapper = html.DivElement()
          ..style.width = '100%'
          ..style.height = '100%'
          ..style.overflow = 'hidden';
        wrapper.append(iframe);
        return wrapper;
      } else {
        // CHROME / EDGE / FIREFOX: native embed (fastest)
        final embed = html.Element.html(
          '<embed '
          'src="$url#toolbar=1&navpanes=0&scrollbar=1" '
          'type="application/pdf" '
          'width="100%" '
          'height="100%" '
          'style="border:none; display:block;" />',
          treeSanitizer: html.NodeTreeSanitizer.trusted,
        );

        // Wrap in explicit sized container to prevent platform view warnings
        final wrapper = html.DivElement()
          ..style.width = '100%'
          ..style.height = '100%'
          ..style.overflow = 'auto';
        wrapper.append(embed);
        return wrapper;
      }
    });

    setState(() {});
  }

  @override
  void dispose() {
    if (_blobUrl != null) html.Url.revokeObjectUrl(_blobUrl!);
    super.dispose();
  }

  void _download() {
    final bytes = widget.pdfBytes ?? PdfCache.currentPdfBytes;
    if (bytes == null) return;
    final blob = html.Blob([bytes], 'application/pdf');
    final url = html.Url.createObjectUrlFromBlob(blob);
    final anchor = html.AnchorElement(href: url)
      ..setAttribute('download', PdfCache.currentPdfName ?? widget.pdfPath)
      ..click();
    html.Url.revokeObjectUrl(url);
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
      appBar: AppBar(
        title: Text('Aperçu du formulaire',
            style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Colors.white)),
        backgroundColor: const Color(0xFF0D7377),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          TextButton.icon(
            onPressed: _download,
            icon: const Icon(Icons.download_outlined,
                color: Colors.white70, size: 18),
            label: Text('Télécharger',
                style: GoogleFonts.inter(fontSize: 13, color: Colors.white70)),
          ),
          const SizedBox(width: 8),
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
                    onPressed: _blobUrl != null ? _handleConfirm : null,
                    icon: const Icon(Icons.send_rounded, size: 18),
                    label: Text('Soumettre',
                        style: GoogleFonts.inter(
                            fontSize: 13, fontWeight: FontWeight.w700)),
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
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            color: const Color(0xFFFFF7ED),
            child: Row(children: [
              const Icon(Icons.info_outline,
                  size: 16, color: Color(0xFFD97706)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Vérifiez les informations ci-dessous avant de soumettre définitivement.',
                  style: GoogleFonts.inter(
                      fontSize: 13, color: const Color(0xFF92400E)),
                ),
              ),
            ]),
          ),
          Expanded(
            child: _blobUrl == null
                ? const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(color: Color(0xFF0D7377)),
                        SizedBox(height: 16),
                        Text('Chargement du PDF…',
                            style: TextStyle(
                                fontSize: 14, color: Color(0xFF475569))),
                      ],
                    ),
                  )
                : HtmlElementView(viewType: _viewType),
          ),
          _bottomBar(),
        ],
      ),
    );
  }

  Widget _bottomBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        boxShadow: [
          BoxShadow(
              color: Color(0x0A000000), blurRadius: 12, offset: Offset(0, -4)),
        ],
      ),
      child: SafeArea(
        child: Row(children: [
          OutlinedButton.icon(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.arrow_back, size: 16),
            label: Text('Modifier',
                style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF475569),
              side: const BorderSide(color: Color(0xFFE2E8F0)),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
          ),
          const Spacer(),
          ElevatedButton.icon(
            onPressed:
                (_blobUrl != null && !_confirming) ? _handleConfirm : null,
            icon: _confirming
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2))
                : const Icon(Icons.send_rounded, size: 18),
            label: Text(_confirming ? 'Soumission…' : 'Confirmer et soumettre',
                style: GoogleFonts.inter(
                    fontSize: 14, fontWeight: FontWeight.w700)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
              disabledBackgroundColor: const Color(0xFF94A3B8),
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ]),
      ),
    );
  }
}
