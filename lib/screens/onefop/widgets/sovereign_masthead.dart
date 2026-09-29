// lib/screens/onefop/widgets/sovereign_masthead.dart
// ══════════════════════════════════════════════════════════════
// SOVEREIGN GOVERNMENT MASTHEAD & DECLARATION CONTEXT BAR
// Designed to the standard of USWDS (USA Banner) & GOV.UK (GDS Header)
// for the Republic of Cameroon • MINEFOP / ONEFOP.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';

import '../../../core/i18n/l10n_ext.dart';

/// Sovereign Government Masthead displayed at the top of the declaration portal.
class SovereignMasthead extends StatefulWidget {
  final Map<String, dynamic>? metadata;
  final String? entityTypeName;
  final String? establishmentName;
  final String? quarterCode;
  final bool compact;

  const SovereignMasthead({
    super.key,
    this.metadata,
    this.entityTypeName,
    this.establishmentName,
    this.quarterCode,
    this.compact = false,
  });

  @override
  State<SovereignMasthead> createState() => _SovereignMastheadState();
}

class _SovereignMastheadState extends State<SovereignMasthead> {
  bool _expandedSecurity = false;

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final isEn = locale.languageCode == 'en';

    final taxNumber = widget.metadata?['__meta_tax_number'] as String? ??
        widget.metadata?['taxNumber'] as String? ??
        '';
    final cnpsNumber = widget.metadata?['__meta_cnps_number'] as String? ??
        widget.metadata?['cnpsNumber'] as String? ??
        '';
    final estName = widget.establishmentName ??
        widget.metadata?['__meta_establishment_name'] as String? ??
        '';
    final qCode = widget.quarterCode ??
        widget.metadata?['__meta_quarter_code'] as String? ??
        '2026-T1';
    final eType = widget.entityTypeName ??
        widget.metadata?['__meta_entity_type'] as String? ??
        'ENTREPRISE';

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── 1. Official Government Disclosure Banner (USWDS Style) ──
        Container(
          color: const Color(0xFF00382E), // Deep Sovereign Emerald
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 5),
          child: Row(
            children: [
              // National Tricolor Ribbon
              Container(
                width: 18,
                height: 12,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(2),
                  border: Border.all(color: Colors.white24, width: 0.5),
                ),
                clipBehavior: Clip.antiAlias,
                child: const Row(
                  children: [
                    Expanded(child: ColoredBox(color: Color(0xFF007A5E))),
                    Expanded(child: ColoredBox(color: Color(0xFFCE1126))),
                    Expanded(child: ColoredBox(color: Color(0xFFFCD116))),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  isEn
                      ? 'An official website of the Republic of Cameroon • Ministry of Employment and Vocational Training'
                      : 'Portail officiel de la République du Cameroun • Ministère de l\'Emploi et de la Formation Professionnelle',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFFE2E8F0),
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.1,
                  ),
                ),
              ),
              InkWell(
                onTap: () => setState(() => _expandedSecurity = !_expandedSecurity),
                borderRadius: BorderRadius.circular(4),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        isEn
                            ? (_expandedSecurity ? 'Hide legal notice' : 'Official legal notice')
                            : (_expandedSecurity ? 'Masquer la notice' : 'Notice légale officielle'),
                        style: const TextStyle(
                          color: Color(0xFFFFD700), // Gold
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(
                        _expandedSecurity
                            ? Icons.keyboard_arrow_up_rounded
                            : Icons.keyboard_arrow_down_rounded,
                        color: const Color(0xFFFFD700),
                        size: 14,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),

        // ── Expandable Legal/Security Notice ──
        if (_expandedSecurity)
          Container(
            color: const Color(0xFF042721),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.gpp_good_outlined, color: Color(0xFF10B981), size: 20),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isEn
                            ? 'Official National Statistical Declaration System (Law N° 91/023)'
                            : 'Dispositif Officiel de Recensement Statistique National (Loi N° 91/023)',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        isEn
                            ? 'All declarations submitted through this portal are covered by statistical secrecy. Data collected is exclusively used by ONEFOP / MINEFOP for national workforce analytics and economic policy.'
                            : 'Toutes les déclarations transmises via ce portail sont protégées par le secret statistique. Les données recueillies sont réservées exclusivement aux analyses de l\'ONEFOP / MINEFOP pour la planification nationale de l\'emploi.',
                        style: const TextStyle(
                          color: Color(0xFFCBD5E1),
                          fontSize: 11.5,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

        // ── 2. Sovereign Bilateral Header (French/English + Emblem) ──
        Container(
          color: const Color(0xFF004D43), // Primary Government Emerald
          padding: EdgeInsets.symmetric(
            horizontal: 20,
            vertical: widget.compact ? 6 : 8,
          ),
          child: Row(
            children: [
              // French Official Heading
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'RÉPUBLIQUE DU CAMEROUN',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8,
                      ),
                    ),
                    Text(
                      'Paix · Travail · Patrie',
                      style: TextStyle(
                        color: Color(0xFFE2E8F0),
                        fontSize: 9,
                        fontWeight: FontWeight.w500,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'MINISTÈRE DE L\'EMPLOI ET DE LA FORMATION PROFESSIONNELLE',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Color(0xFFFFD700),
                        fontSize: 8.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),

              // Center National Crest & Portal Brand
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Image.asset(
                      'assets/images/onefop_logo.png',
                      width: 32,
                      height: 32,
                      fit: BoxFit.contain,
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'ONEFOP · DSMO',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.2,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: const Color(0xFF007A5E),
                            borderRadius: BorderRadius.circular(3),
                            border: Border.all(color: const Color(0xFFFFD700), width: 0.5),
                          ),
                          child: Text(
                            isEn ? 'SOVEREIGN DECLARATION PORTAL' : 'PORTAIL NATIONAL DE DÉCLARATION',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 7.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // English Official Heading
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'REPUBLIC OF CAMEROON',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8,
                      ),
                    ),
                    Text(
                      'Peace · Work · Fatherland',
                      style: TextStyle(
                        color: Color(0xFFE2E8F0),
                        fontSize: 9,
                        fontWeight: FontWeight.w500,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'MINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Color(0xFFFFD700),
                        fontSize: 8.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // ── 3. Establishment Identification Bar ──
        if (estName.isNotEmpty || taxNumber.isNotEmpty || cnpsNumber.isNotEmpty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
            decoration: const BoxDecoration(
              color: Color(0xFFF1F5F9), // Sober slate-50
              border: Border(
                bottom: BorderSide(color: Color(0xFFCBD5E1), width: 1),
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.domain_rounded, size: 16, color: Color(0xFF334155)),
                const SizedBox(width: 8),
                if (estName.isNotEmpty) ...[
                  Text(
                    estName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFF0F172A),
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Text('•', style: TextStyle(color: Color(0xFF94A3B8))),
                  const SizedBox(width: 12),
                ],
                if (taxNumber.isNotEmpty) ...[
                  _MetaTag(label: context.l10n.niuLabel, value: taxNumber),
                  const SizedBox(width: 8),
                ],
                if (cnpsNumber.isNotEmpty) ...[
                  _MetaTag(label: context.l10n.mastheadCnpsLabel, value: cnpsNumber),
                  const SizedBox(width: 8),
                ],
                _MetaTag(label: isEn ? 'PERIOD' : 'CAMPAGNE', value: qCode),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF006B5E),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    eType.toUpperCase(),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _MetaTag extends StatelessWidget {
  final String label;
  final String value;
  const _MetaTag({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: const Color(0xFFCBD5E1)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '$label: ',
            style: const TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
              color: Color(0xFF64748B),
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0F172A),
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }
}
