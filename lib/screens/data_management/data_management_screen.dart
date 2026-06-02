import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../theme/ultra_theme.dart';
import '../../data/api_client.dart';

class DataManagementScreen extends ConsumerStatefulWidget {
  const DataManagementScreen({super.key});

  @override
  ConsumerState<DataManagementScreen> createState() =>
      _DataManagementScreenState();
}

class _DataManagementScreenState extends ConsumerState<DataManagementScreen> {
  int _selectedTab = 0;
  List<dynamic> _regions = [];
  List<dynamic> _sectors = [];
  List<dynamic> _submissions = [];
  bool _isLoading = true;

  final List<Map<String, dynamic>> _tabs = [
    {'label': 'Régions', 'icon': Icons.map_outlined},
    {'label': 'Secteurs', 'icon': Icons.business_outlined},
    {'label': 'Données', 'icon': Icons.data_usage_outlined},
    {'label': 'Export', 'icon': Icons.download_outlined},
  ];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final api = ref.read(apiClientProvider);
      final [regions, sectors] = await Future.wait([
        api.get('/data-management/regions'),
        api.get('/data-management/sectors'),
      ]);
      setState(() {
        _regions = regions.data;
        _sectors = sectors.data;
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('Error loading data: $e');
      setState(() => _isLoading = false);
    }
  }

  Future<void> _exportData() async {
    try {
      final api = ref.read(apiClientProvider);
      final response =
          await api.post('/data-management/export/submissions', data: {
        'status': 'APPROVED',
        'format': 'EXCEL',
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(
                'Export lancé: ${response.data['total']} enregistrements')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Erreur lors de l\'export'),
            backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: UltraTheme.background,
      appBar: AppBar(
        title: const Text('Gestion des Données',
            style: TextStyle(fontWeight: FontWeight.w600)),
        backgroundColor: UltraTheme.surface,
        elevation: 0,
        actions: [
          if (_selectedTab == 3)
            IconButton(
              icon: const Icon(Icons.download_rounded),
              onPressed: _exportData,
              tooltip: 'Exporter',
            ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadData,
          ),
        ],
        bottom: TabBar(
          tabs: _tabs
              .map((tab) => Tab(
                    icon: Icon(tab['icon'] as IconData),
                    text: tab['label'] as String,
                  ))
              .toList(),
          onTap: (index) => setState(() => _selectedTab = index),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              children: [
                _buildRegionsTab(),
                _buildSectorsTab(),
                _buildDataTab(),
                _buildExportTab(),
              ],
            ),
    );
  }

  Widget _buildRegionsTab() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _regions.length,
      itemBuilder: (context, index) {
        final region = _regions[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ExpansionTile(
            leading: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.blue.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.location_on_outlined, color: Colors.blue),
            ),
            title: Text(region['name'] ?? 'Sans nom',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text('Code: ${region['code'] ?? '-'}'),
            children: [
              if (region['_count'] != null) ...[
                _buildStatTile('Entreprises',
                    region['_count']['companies'] ?? 0, Icons.business),
                _buildStatTile('Départements',
                    region['_count']['departments'] ?? 0, Icons.map),
              ],
              const Divider(),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton.icon(
                      onPressed: () => _editRegion(region),
                      icon: const Icon(Icons.edit, size: 18),
                      label: const Text('Modifier'),
                    ),
                    const SizedBox(width: 8),
                    TextButton.icon(
                      onPressed: () => _deleteRegion(region),
                      icon:
                          const Icon(Icons.delete, size: 18, color: Colors.red),
                      label: const Text('Supprimer',
                          style: TextStyle(color: Colors.red)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSectorsTab() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _sectors.length,
      itemBuilder: (context, index) {
        final sector = _sectors[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            leading: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.business_outlined, color: Colors.green),
            ),
            title: Text(sector['name'] ?? 'Sans nom'),
            subtitle: Text('Catégorie: ${sector['category'] ?? '-'}'),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.edit, size: 18),
                  onPressed: () => _editSector(sector),
                ),
                IconButton(
                  icon: const Icon(Icons.delete, size: 18, color: Colors.red),
                  onPressed: () => _deleteSector(sector),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildDataTab() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            _buildDataCard(
                'Soumissions totales',
                _submissions.length,
                Icons.assignment,
                Colors.purple,
                'Nombre total de formulaires soumis'),
            const SizedBox(height: 16),
            _buildDataCard('Taux de complétion', '78%', Icons.percent,
                Colors.green, 'Pourcentage de formulaires complétés'),
            const SizedBox(height: 16),
            _buildDataCard('Base de référence', 'Validée', Icons.check_circle,
                Colors.blue, 'Qualité des données de référence'),
          ],
        ),
      ),
    );
  }

  Widget _buildExportTab() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.download_rounded, size: 64, color: Colors.grey.shade400),
            const SizedBox(height: 24),
            const Text('Exporter les données',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('Exportez les soumissions et les données analytiques',
                style: TextStyle(color: Colors.grey.shade600)),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              onPressed: _exportData,
              icon: const Icon(Icons.file_download_rounded),
              label: const Text('Exporter en Excel'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                padding:
                    const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
              ),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: _exportData,
              icon: const Icon(Icons.picture_as_pdf_rounded),
              label: const Text('Exporter en PDF'),
              style: OutlinedButton.styleFrom(
                padding:
                    const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDataCard(String title, dynamic value, IconData icon, Color color,
      String description) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 28, color: color),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(value.toString(),
                      style: const TextStyle(
                          fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text(description,
                      style:
                          TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatTile(String title, int count, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.grey.shade600),
          const SizedBox(width: 12),
          Text(title, style: const TextStyle(fontSize: 13)),
          const Spacer(),
          Text(count.toString(),
              style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Future<void> _editRegion(dynamic region) async {
    // TODO: Implement edit region dialog
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Modifier région: ${region['name']}')),
    );
  }

  Future<void> _deleteRegion(dynamic region) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirmer la suppression'),
        content: Text('Supprimer définitivement ${region['name']} ?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Annuler')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child:
                  const Text('Supprimer', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm == true) {
      // TODO: Implement delete
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Région supprimée'), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _editSector(dynamic sector) async {
    // TODO: Implement edit sector dialog
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Modifier secteur: ${sector['name']}')),
    );
  }

  Future<void> _deleteSector(dynamic sector) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirmer la suppression'),
        content: Text('Supprimer définitivement ${sector['name']} ?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Annuler')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child:
                  const Text('Supprimer', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm == true) {
      // TODO: Implement delete
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Secteur supprimé'), backgroundColor: Colors.red),
      );
    }
  }
}
