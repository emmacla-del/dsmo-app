import 'package:flutter/material.dart';
import 'navigation_widgets.dart';
import '../../../core/theme/onefop_colors.dart';
import '../../../core/theme/typography.dart';

class ThankYouOverlay extends StatefulWidget {
  final String referenceNumber;
  final String entityLabel;
  final VoidCallback onPreviewPdf;
  final VoidCallback onDashboard;

  const ThankYouOverlay({
    super.key,
    required this.referenceNumber,
    required this.entityLabel,
    required this.onPreviewPdf,
    required this.onDashboard,
  });

  @override
  State<ThankYouOverlay> createState() => _ThankYouOverlayState();
}

class _ThankYouOverlayState extends State<ThankYouOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;
  late final Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 600));
    _scale = CurvedAnimation(parent: _ctrl, curve: Curves.elasticOut);
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeIn);
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fade,
      child: Container(
        color: OnefopColors.bg.withAlpha(240),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const SizedBox(height: 24),
                ScaleTransition(
                  scale: _scale,
                  child: Container(
                    width: 88,
                    height: 88,
                    decoration: BoxDecoration(
                      color: OnefopColors.teal.withAlpha(30),
                      shape: BoxShape.circle,
                      border: Border.all(color: OnefopColors.teal, width: 2),
                    ),
                    child: const Icon(Icons.check_rounded,
                        size: 48, color: OnefopColors.teal),
                  ),
                ),
                const SizedBox(height: 28),
                Text('Merci !  /  Thank you!',
                    textAlign: TextAlign.center,
                    style: mono(22,
                        weight: FontWeight.bold, color: OnefopColors.white)),
                const SizedBox(height: 12),
                Text(
                  'Votre questionnaire  a ete soumis avec succes.\n'
                  'Your  questionnaire has been submitted successfully.',
                  textAlign: TextAlign.center,
                  style: mono(13, color: OnefopColors.white70),
                ),
                const SizedBox(height: 24),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: OnefopColors.teal.withAlpha(18),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: OnefopColors.teal.withAlpha(50)),
                  ),
                  child: Column(children: [
                    Text('Votre contribution est precieuse',
                        textAlign: TextAlign.center,
                        style: mono(13,
                            weight: FontWeight.bold, color: OnefopColors.teal)),
                    const SizedBox(height: 8),
                    Text(
                      "Les donnees que vous avez fournies permettront a l'ONEFOP "
                      "de mieux comprendre le marche de l'emploi au Cameroun "
                      "et d'orienter les politiques de formation professionnelle.\n\n"
                      'Your contribution helps ONEFOP track employment trends '
                      'and shape vocational training policy across Cameroon.',
                      textAlign: TextAlign.center,
                      style: mono(12, color: OnefopColors.white60),
                    ),
                  ]),
                ),
                const SizedBox(height: 24),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: OnefopColors.card,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: OnefopColors.border),
                  ),
                  child: Column(children: [
                    Text('Numero de reference / Reference number',
                        style: mono(10, color: OnefopColors.white40)),
                    const SizedBox(height: 6),
                    SelectableText(widget.referenceNumber,
                        style: mono(13,
                            weight: FontWeight.bold, color: OnefopColors.teal),
                        textAlign: TextAlign.center),
                    const SizedBox(height: 4),
                    Text('Conservez ce numero pour vos archives.',
                        style: mono(10, color: OnefopColors.white40)),
                  ]),
                ),
                const SizedBox(height: 32),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  NavPill(
                      label: 'Apercu PDF',
                      icon: Icons.picture_as_pdf_rounded,
                      onTap: widget.onPreviewPdf),
                  const SizedBox(width: 12),
                  NavPill(
                      label: 'Tableau de bord',
                      icon: Icons.home_rounded,
                      onTap: widget.onDashboard),
                ]),
                const SizedBox(height: 24),
                Text('ONEFOP — MINEFOP · Cameroun',
                    style: mono(10, color: OnefopColors.white20),
                    textAlign: TextAlign.center),
                const SizedBox(height: 4),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
