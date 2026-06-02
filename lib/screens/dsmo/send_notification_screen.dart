import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';
import '../../../theme/ultra_theme.dart';

class SendNotificationScreen extends ConsumerStatefulWidget {
  const SendNotificationScreen({super.key});

  @override
  ConsumerState<SendNotificationScreen> createState() =>
      _SendNotificationScreenState();
}

class _SendNotificationScreenState extends ConsumerState<SendNotificationScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _subjectController = TextEditingController();
  final _messageController = TextEditingController();
  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;

  String? _selectedRegion;
  String? _selectedDepartment;
  String? _selectedStatus;
  bool _isLoading = false;
  int _recipientEstimate = 0; // live preview count

  final List<String> _regions = [
    'Adamaoua',
    'Centre',
    'Est',
    'Extrême-Nord',
    'Littoral',
    'Nord',
    'Nord-Ouest',
    'Ouest',
    'Sud',
    'Sud-Ouest',
  ];
  final List<String> _departments = [
    'Bamboutos',
    'Djerem',
    'Fako',
    'Haut-Nkam',
    'Haute-Sanaga',
    'Lékié',
    'Mbam-et-Inoubou',
    'Mbam-et-Kim',
    'Mfoundi',
    'Mungo',
    'Nyong-et-Kellé',
    'Nyong-et-Mfoumou',
    "Nyong-et-So'o",
    'Vina',
    'Wouri',
  ];

  static const _statusLabels = {
    'SUBMITTED': 'Soumis',
    'DIVISION_APPROVED': 'Approuvé (Division)',
    'REGION_APPROVED': 'Approuvé (Région)',
    'FINAL_APPROVED': 'Approuvé (Final)',
  };

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 500));
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _animCtrl.forward();
    _updateEstimate();
  }

  void _updateEstimate() {
    // Rough visual estimate — replace with real API call if desired
    setState(() {
      _recipientEstimate = _selectedRegion != null ? 12 : 148;
    });
  }

  Future<void> _sendNotification() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final api = ref.read(apiClientProvider);
      final response = await api.post('/dsmo/notifications/send', data: {
        'subject': _subjectController.text,
        'message': _messageController.text,
        'filters': {
          'regionFilter': _selectedRegion,
          'departmentFilter': _selectedDepartment,
          'submissionStatus': _selectedStatus,
        },
      });
      if (!mounted) return;
      if (response.statusCode == 201) {
        _showSuccessBanner(response.data['successfulSends'] ?? 0);
        _subjectController.clear();
        _messageController.clear();
        setState(() {
          _selectedRegion = null;
          _selectedDepartment = null;
          _selectedStatus = null;
        });
        _updateEstimate();
      }
    } catch (e) {
      if (!mounted) return;
      _showErrorBanner('$e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showSuccessBanner(int count) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: UltraTheme.success.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Icon(Icons.check_circle_rounded,
              color: UltraTheme.success, size: 20),
        ),
        const SizedBox(width: 12),
        Text('Notification envoyée à $count entreprises',
            style: const TextStyle(
                fontFamily: 'Inter', fontWeight: FontWeight.w500)),
      ]),
      backgroundColor: const Color(0xFF1E293B),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
      duration: const Duration(seconds: 4),
    ));
  }

  void _showErrorBanner(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(children: [
        const Icon(Icons.error_rounded, color: UltraTheme.error, size: 20),
        const SizedBox(width: 12),
        Expanded(
            child: Text('Erreur: $msg',
                style: const TextStyle(fontFamily: 'Inter'))),
      ]),
      backgroundColor: const Color(0xFF1E293B),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnim,
      child: Scaffold(
        backgroundColor: UltraTheme.background,
        body: Form(
          key: _formKey,
          child: CustomScrollView(
            slivers: [
              // ── Header card ──────────────────────────────
              SliverToBoxAdapter(child: _buildHeader()),
              // ── Content ──────────────────────────────────
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    _buildRecipientCard(),
                    const SizedBox(height: 16),
                    _buildFiltersCard(),
                    const SizedBox(height: 16),
                    _buildMessageCard(),
                    const SizedBox(height: 24),
                    _buildActions(),
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Header ──────────────────────────────────────────────────
  Widget _buildHeader() {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 20, 20, 20),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            UltraTheme.primary,
            UltraTheme.primary.withValues(alpha: 0.75)
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: UltraTheme.primary.withValues(alpha: 0.3),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(14),
          ),
          child:
              const Icon(Icons.campaign_rounded, color: Colors.white, size: 28),
        ),
        const SizedBox(width: 16),
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Envoyer une notification',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Colors.white)),
            const SizedBox(height: 4),
            Text('Ciblage multi-critères des entreprises',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    color: Colors.white.withValues(alpha: 0.8))),
          ]),
        ),
      ]),
    );
  }

  // ── Recipient preview card ───────────────────────────────────
  Widget _buildRecipientCard() {
    return _ModernCard(
      child: Row(children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: UltraTheme.info.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(14),
          ),
          child: const Icon(Icons.groups_rounded,
              color: UltraTheme.info, size: 26),
        ),
        const SizedBox(width: 16),
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Destinataires estimés',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: UltraTheme.textMuted)),
            const SizedBox(height: 2),
            Text('$_recipientEstimate entreprises',
                style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: UltraTheme.textPrimary)),
          ]),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: UltraTheme.success.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Text('Actives',
              style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: UltraTheme.success)),
        ),
      ]),
    );
  }

  // ── Filters card ────────────────────────────────────────────
  Widget _buildFiltersCard() {
    return _ModernCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const _SectionLabel(
            label: 'Filtres des destinataires',
            icon: Icons.tune_rounded,
            color: UltraTheme.primary),
        const SizedBox(height: 16),
        _ModernDropdown<String>(
          label: 'Région',
          hint: 'Toutes les régions',
          value: _selectedRegion,
          icon: Icons.map_outlined,
          items: _regions,
          onChanged: (v) {
            setState(() => _selectedRegion = v);
            _updateEstimate();
          },
        ),
        const SizedBox(height: 12),
        _ModernDropdown<String>(
          label: 'Division / Département',
          hint: 'Toutes les divisions',
          value: _selectedDepartment,
          icon: Icons.account_tree_outlined,
          items: _departments,
          onChanged: (v) {
            setState(() => _selectedDepartment = v);
            _updateEstimate();
          },
        ),
        const SizedBox(height: 12),
        _ModernDropdown<String>(
          label: 'Statut de soumission',
          hint: 'Tous les statuts',
          value: _selectedStatus,
          icon: Icons.flag_outlined,
          items: _statusLabels.keys.toList(),
          labelBuilder: (v) => _statusLabels[v] ?? v,
          onChanged: (v) {
            setState(() => _selectedStatus = v);
            _updateEstimate();
          },
        ),
        if (_selectedRegion != null ||
            _selectedDepartment != null ||
            _selectedStatus != null) ...[
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            if (_selectedRegion != null)
              _FilterChipBadge(
                  label: _selectedRegion!,
                  onRemove: () {
                    setState(() => _selectedRegion = null);
                    _updateEstimate();
                  }),
            if (_selectedDepartment != null)
              _FilterChipBadge(
                  label: _selectedDepartment!,
                  onRemove: () {
                    setState(() => _selectedDepartment = null);
                    _updateEstimate();
                  }),
            if (_selectedStatus != null)
              _FilterChipBadge(
                  label: _statusLabels[_selectedStatus!] ?? _selectedStatus!,
                  onRemove: () {
                    setState(() => _selectedStatus = null);
                    _updateEstimate();
                  }),
          ]),
        ],
      ]),
    );
  }

  // ── Message card ────────────────────────────────────────────
  Widget _buildMessageCard() {
    return _ModernCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const _SectionLabel(
            label: 'Contenu du message',
            icon: Icons.edit_note_rounded,
            color: UltraTheme.accent),
        const SizedBox(height: 16),
        _ModernTextField(
          controller: _subjectController,
          label: 'Sujet',
          hint: 'Ex: Rappel — Échéance DSM-O 2025',
          icon: Icons.title_rounded,
          maxLength: 200,
          validator: (v) =>
              (v == null || v.isEmpty) ? 'Le sujet est requis' : null,
        ),
        const SizedBox(height: 12),
        _ModernTextField(
          controller: _messageController,
          label: 'Message',
          hint: 'Rédigez votre message ici...',
          icon: Icons.message_outlined,
          maxLength: 1000,
          maxLines: 6,
          validator: (v) =>
              (v == null || v.isEmpty) ? 'Le message est requis' : null,
        ),
      ]),
    );
  }

  // ── Actions ─────────────────────────────────────────────────
  Widget _buildActions() {
    return Column(children: [
      SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton(
          onPressed: _isLoading ? null : _sendNotification,
          style: ElevatedButton.styleFrom(
            backgroundColor: UltraTheme.primary,
            foregroundColor: Colors.white,
            elevation: 0,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          child: _isLoading
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                      strokeWidth: 2.5, color: Colors.white))
              : const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.send_rounded, size: 18),
                    SizedBox(width: 8),
                    Text('Envoyer la notification',
                        style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 15,
                            fontWeight: FontWeight.w600)),
                  ],
                ),
        ),
      ),
      const SizedBox(height: 10),
      SizedBox(
        width: double.infinity,
        height: 48,
        child: OutlinedButton(
          onPressed: () {
            _subjectController.clear();
            _messageController.clear();
            setState(() {
              _selectedRegion = null;
              _selectedDepartment = null;
              _selectedStatus = null;
            });
            _updateEstimate();
          },
          style: OutlinedButton.styleFrom(
            foregroundColor: UltraTheme.textSecondary,
            side: const BorderSide(color: Color(0xFFE2E8F0)),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          child: const Text('Effacer le formulaire',
              style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: FontWeight.w500)),
        ),
      ),
    ]);
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _subjectController.dispose();
    _messageController.dispose();
    super.dispose();
  }
}

// ══════════════════════════════════════════════════════════════
// SHARED HELPER WIDGETS
// ══════════════════════════════════════════════════════════════

class _ModernCard extends StatelessWidget {
  const _ModernCard({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border:
            Border.all(color: const Color(0xFFE2E8F0).withValues(alpha: 0.6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(
      {required this.label, required this.icon, required this.color});
  final String label;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Container(
        padding: const EdgeInsets.all(7),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: color, size: 16),
      ),
      const SizedBox(width: 10),
      Text(label,
          style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: UltraTheme.textPrimary)),
    ]);
  }
}

class _ModernDropdown<T> extends StatelessWidget {
  const _ModernDropdown({
    required this.label,
    required this.hint,
    required this.value,
    required this.icon,
    required this.items,
    required this.onChanged,
    this.labelBuilder,
  });

  final String label;
  final String hint;
  final T? value;
  final IconData icon;
  final List<T> items;
  final ValueChanged<T?> onChanged;
  final String Function(T)? labelBuilder;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label,
          style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: UltraTheme.textMuted)),
      const SizedBox(height: 6),
      Container(
        decoration: BoxDecoration(
          color: UltraTheme.background,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
              color: value != null
                  ? UltraTheme.primary.withValues(alpha: 0.4)
                  : const Color(0xFFE2E8F0)),
        ),
        child: DropdownButtonFormField<T>(
          initialValue: value,
          decoration: InputDecoration(
            prefixIcon: Icon(icon, size: 18, color: UltraTheme.textMuted),
            border: InputBorder.none,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
            isDense: true,
          ),
          hint: Text(hint,
              style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  color: UltraTheme.textMuted)),
          style: const TextStyle(
              fontFamily: 'Inter', fontSize: 14, color: UltraTheme.textPrimary),
          dropdownColor: UltraTheme.surface,
          borderRadius: BorderRadius.circular(12),
          items: [
            DropdownMenuItem<T>(
              value: null,
              child: Text(hint,
                  style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      color: UltraTheme.textMuted)),
            ),
            ...items.map((item) => DropdownMenuItem<T>(
                  value: item,
                  child: Text(
                      labelBuilder != null ? labelBuilder!(item) : '$item',
                      style:
                          const TextStyle(fontFamily: 'Inter', fontSize: 14)),
                )),
          ],
          onChanged: onChanged,
        ),
      ),
    ]);
  }
}

class _ModernTextField extends StatelessWidget {
  const _ModernTextField({
    required this.controller,
    required this.label,
    required this.hint,
    required this.icon,
    this.maxLength,
    this.maxLines = 1,
    this.validator,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData icon;
  final int? maxLength;
  final int maxLines;
  final FormFieldValidator<String>? validator;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label,
          style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: UltraTheme.textMuted)),
      const SizedBox(height: 6),
      TextFormField(
        controller: controller,
        maxLength: maxLength,
        maxLines: maxLines,
        validator: validator,
        style: const TextStyle(
            fontFamily: 'Inter', fontSize: 14, color: UltraTheme.textPrimary),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(
              fontFamily: 'Inter', fontSize: 14, color: UltraTheme.textMuted),
          prefixIcon: Icon(icon, size: 18, color: UltraTheme.textMuted),
          filled: true,
          fillColor: UltraTheme.background,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: UltraTheme.primary, width: 1.5),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: UltraTheme.error),
          ),
          counterStyle: const TextStyle(
              fontFamily: 'Inter', fontSize: 11, color: UltraTheme.textMuted),
        ),
      ),
    ]);
  }
}

class _FilterChipBadge extends StatelessWidget {
  const _FilterChipBadge({required this.label, required this.onRemove});
  final String label;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: UltraTheme.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: UltraTheme.primary.withValues(alpha: 0.2)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(label,
            style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: UltraTheme.primary)),
        const SizedBox(width: 6),
        GestureDetector(
          onTap: onRemove,
          child: const Icon(Icons.close_rounded,
              size: 14, color: UltraTheme.primary),
        ),
      ]),
    );
  }
}
