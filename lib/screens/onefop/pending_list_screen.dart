// lib/screens/onefop/pending_list_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../providers/auth_provider.dart';

class PendingListScreen extends ConsumerStatefulWidget {
  const PendingListScreen({super.key});

  @override
  ConsumerState<PendingListScreen> createState() => _PendingListScreenState();
}

class _PendingListScreenState extends ConsumerState<PendingListScreen> {
  List<dynamic> _pending = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchPending();
  }

  Future<void> _fetchPending() async {
    setState(() => _isLoading = true);
    try {
      final api = ref.read(apiClientProvider);
      final data = await api.getPendingQuestionnaires();
      setState(() {
        _pending = data;
        _isLoading = false;
        _error = null;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _approve(String id) async {
    try {
      final api = ref.read(apiClientProvider);
      await api.approveQuestionnaire(id);
      _fetchPending();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Questionnaire approved'),
              backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _reject(String id) async {
    final TextEditingController reasonController = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Rejection Reason'),
        content: TextField(
          controller: reasonController,
          decoration: const InputDecoration(hintText: 'Enter reason...'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, reasonController.text.trim()),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    if (reason != null && reason.isNotEmpty) {
      try {
        final api = ref.read(apiClientProvider);
        await api.rejectQuestionnaire(id, reason);
        _fetchPending();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text('Questionnaire rejected'),
                backgroundColor: Colors.orange),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  Future<void> _requestCorrection(String id) async {
    final TextEditingController commentsController = TextEditingController();
    final comments = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Request Correction'),
        content: TextField(
          controller: commentsController,
          maxLines: 4,
          decoration: const InputDecoration(
            hintText: 'Describe what needs to be corrected...',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () =>
                Navigator.pop(ctx, commentsController.text.trim()),
            child: const Text('Send'),
          ),
        ],
      ),
    );
    if (comments != null && comments.isNotEmpty) {
      try {
        final api = ref.read(apiClientProvider);
        await api.requestCorrection(id, comments);
        _fetchPending();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text('Correction requested'),
                backgroundColor: Colors.blue),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authAsync = ref.watch(authProvider);
    final role = authAsync.valueOrNull?.role;

    if (role != 'CENTRAL' &&
        role != 'REGIONAL' &&
        role != 'DIVISIONAL' &&
        role != 'SUPER_ADMIN') {
      return Scaffold(
        appBar: AppBar(title: const Text('Pending Submissions')),
        body: const Center(
            child: Text(
                'Accès refusé. Rôle CENTRAL, REGIONAL, DIVISIONAL ou SUPER_ADMIN requis.')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pending ONEFOP Questionnaires'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _fetchPending),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('Error: $_error'))
              : _pending.isEmpty
                  ? const Center(child: Text('No pending questionnaires'))
                  : ListView.builder(
                      itemCount: _pending.length,
                      itemBuilder: (ctx, index) {
                        final q = _pending[index];
                        final flags = q['flags'] as Map?;
                        final hasAnomalies = flags != null && flags.isNotEmpty;
                        final companyName = q['raw_data']['companyName'] ??
                            q['raw_data']['cooperativeName'] ??
                            q['raw_data']['ongName'] ??
                            'Unknown';
                        return Card(
                          margin: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          child: ExpansionTile(
                            leading: Icon(
                              hasAnomalies
                                  ? Icons.warning_amber
                                  : Icons.pending,
                              color: hasAnomalies ? Colors.orange : Colors.blue,
                            ),
                            title: Text(
                              companyName,
                              style:
                                  const TextStyle(fontWeight: FontWeight.bold),
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('ID: ${q['id']}'),
                                Text(
                                    'Type: ${q['form_type']} | Année: ${q['survey_year'] ?? q['surveyYear'] ?? '?'} | Région: ${q['region'] ?? 'N/A'}'),
                                if (hasAnomalies)
                                  const Text(
                                    '⚠️ Anomalies detected',
                                    style: TextStyle(
                                        color: Colors.orange,
                                        fontWeight: FontWeight.w500),
                                  ),
                              ],
                            ),
                            children: [
                              Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Submitted: ${q['submitted_at']}'),
                                    if (q['status'] ==
                                        'CORRECTION_REQUESTED') ...[
                                      const SizedBox(height: 8),
                                      Container(
                                        padding: const EdgeInsets.all(8),
                                        color: Colors.blue[50],
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            const Text('Correction demandée :',
                                                style: TextStyle(
                                                    fontWeight: FontWeight.bold,
                                                    color: Colors.blue)),
                                            const SizedBox(height: 4),
                                            Text(flags?['correction_request']
                                                    ?['comments'] ??
                                                ''),
                                          ],
                                        ),
                                      ),
                                    ],
                                    const SizedBox(height: 8),
                                    if (hasAnomalies)
                                      Container(
                                        padding: const EdgeInsets.all(8),
                                        color: Colors.orange[50],
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            const Text('Anomaly Flags:',
                                                style: TextStyle(
                                                    fontWeight:
                                                        FontWeight.bold)),
                                            const SizedBox(height: 4),
                                            Text(flags.toString()),
                                          ],
                                        ),
                                      ),
                                    const SizedBox(height: 12),
                                    Wrap(
                                      alignment: WrapAlignment.end,
                                      spacing: 8,
                                      runSpacing: 8,
                                      children: [
                                        ElevatedButton.icon(
                                          icon: const Icon(Icons.check,
                                              size: 16),
                                          label: const Text('Approve'),
                                          style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.green),
                                          onPressed: () => _approve(q['id']),
                                        ),
                                        OutlinedButton.icon(
                                          icon: const Icon(Icons.edit_note,
                                              size: 16),
                                          label: const Text('Correction'),
                                          style: OutlinedButton.styleFrom(
                                              foregroundColor: Colors.blue),
                                          onPressed: () =>
                                              _requestCorrection(q['id']),
                                        ),
                                        OutlinedButton.icon(
                                          icon: const Icon(Icons.close,
                                              size: 16),
                                          label: const Text('Reject'),
                                          style: OutlinedButton.styleFrom(
                                              foregroundColor: Colors.red),
                                          onPressed: () => _reject(q['id']),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
    );
  }
}
