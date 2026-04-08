import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';
import '../../../theme/app_colors.dart';

class SendNotificationScreen extends ConsumerStatefulWidget {
  const SendNotificationScreen({super.key});

  @override
  ConsumerState<SendNotificationScreen> createState() =>
      _SendNotificationScreenState();
}

class _SendNotificationScreenState
    extends ConsumerState<SendNotificationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _subjectController = TextEditingController();
  final _messageController = TextEditingController();

  String? _selectedRegion;
  String? _selectedDepartment;
  String? _selectedStatus;
  bool _isLoading = false;

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
    'Adamaoua',
    'Bamboutos',
    'Centre',
    'Djerem',
    'Est',
    'Extrême-Nord',
    'Fako',
    'Haut-Nkam',
    'Haute-Sanaga',
    'Lékié',
    'Littoral',
    'Mbam-et-Inoubou',
    'Mbam-et-Kim',
    'Mfoundi',
    'Mungo',
    'Nord',
    'Nord-Ouest',
    'Nyong-et-Kellé',
    'Nyong-et-Mfoumou',
    'Nyong-et-So\'o',
    'Ouest',
    'Sud',
    'Sud-Ouest',
    'Vina',
    'Wouri',
  ];
  final List<String> _statuses = [
    'SUBMITTED',
    'DIVISION_APPROVED',
    'REGION_APPROVED',
    'FINAL_APPROVED',
  ];

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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                'Notification envoyée à ${response.data['successfulSends']} entreprises'),
            backgroundColor: Colors.green,
          ),
        );
        _subjectController.clear();
        _messageController.clear();
        setState(() {
          _selectedRegion = null;
          _selectedDepartment = null;
          _selectedStatus = null;
        });
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Envoyer une notification'),
        backgroundColor: AppColors.deepEmerald,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Filtres des destinataires',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: AppColors.deepEmerald,
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _selectedRegion,
                decoration: const InputDecoration(
                    labelText: 'Région (optionnel)',
                    border: OutlineInputBorder()),
                items: ['Toutes', ..._regions]
                    .map((r) => DropdownMenuItem(
                        value: r == 'Toutes' ? null : r, child: Text(r)))
                    .toList(),
                onChanged: (value) => setState(() => _selectedRegion = value),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _selectedDepartment,
                decoration: const InputDecoration(
                    labelText: 'Division (optionnel)',
                    border: OutlineInputBorder()),
                items: ['Toutes', ..._departments]
                    .map((d) => DropdownMenuItem(
                        value: d == 'Toutes' ? null : d, child: Text(d)))
                    .toList(),
                onChanged: (value) =>
                    setState(() => _selectedDepartment = value),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _selectedStatus,
                decoration: const InputDecoration(
                    labelText: 'Statut de soumission (optionnel)',
                    border: OutlineInputBorder()),
                items: ['Tous', ..._statuses]
                    .map((s) => DropdownMenuItem(
                        value: s == 'Tous' ? null : s, child: Text(s)))
                    .toList(),
                onChanged: (value) =>
                    setState(() => _selectedStatus = value),
              ),
              const SizedBox(height: 24),
              Text(
                'Contenu du message',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: AppColors.deepEmerald,
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _subjectController,
                decoration: const InputDecoration(
                  labelText: 'Sujet *',
                  border: OutlineInputBorder(),
                  hintText: 'Ex: Rappel - Échéance de soumission DSM-O 2024',
                ),
                validator: (value) =>
                    (value == null || value.isEmpty) ? 'Sujet requis' : null,
                maxLength: 200,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _messageController,
                decoration: const InputDecoration(
                  labelText: 'Message *',
                  border: OutlineInputBorder(),
                  hintText: 'Entrez le message à envoyer aux entreprises...',
                ),
                validator: (value) =>
                    (value == null || value.isEmpty) ? 'Message requis' : null,
                maxLines: 6,
                maxLength: 1000,
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _sendNotification,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.deepEmerald,
                    minimumSize: const Size(double.infinity, 50),
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('ENVOYER LA NOTIFICATION',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () {
                    _subjectController.clear();
                    _messageController.clear();
                    setState(() {
                      _selectedRegion = null;
                      _selectedDepartment = null;
                      _selectedStatus = null;
                    });
                  },
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 50),
                  ),
                  child: const Text('EFFACER'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _subjectController.dispose();
    _messageController.dispose();
    super.dispose();
  }
}
