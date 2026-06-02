// lib/core/services/mock_analytics_service.dart
// Local mock implementation for UI development – uses your existing models

import '../../features/analytics/models/dashboard_models.dart'; // adjust path if needed

class MockAnalyticsService {
  // ──────────────────────────────────────────────────────────
  // Returns full DashboardSummary (KPI card data)
  // ──────────────────────────────────────────────────────────
  static DashboardSummary getMockKpiSummary() {
    return DashboardSummary(
      totalEnterprises: 2847,
      totalWorkforce: 156420,
      jobsCreated: 28450,
      jobsLost: 8930,
      netEmploymentChange: 19520,
      femalePercentage: 34.2,
      youthPercentage: 42.8,
      topRecruitingSector: 'Tertiaire',
      topRecruitingSectorPercentage: 52.3,
    );
  }

  // ──────────────────────────────────────────────────────────
  // Employment trend (line chart data)
  // ──────────────────────────────────────────────────────────
  static List<EmploymentTrend> getMockEmploymentTrend() {
    return [
      EmploymentTrend(period: 'Jan', created: 2100, lost: 680),
      EmploymentTrend(period: 'Fév', created: 2350, lost: 720),
      EmploymentTrend(period: 'Mar', created: 2800, lost: 650),
      EmploymentTrend(period: 'Avr', created: 3100, lost: 780),
      EmploymentTrend(period: 'Mai', created: 2900, lost: 820),
      EmploymentTrend(period: 'Juin', created: 3400, lost: 690),
      EmploymentTrend(period: 'Juil', created: 3800, lost: 750),
      EmploymentTrend(period: 'Août', created: 3600, lost: 710),
      EmploymentTrend(period: 'Sep', created: 4200, lost: 680),
      EmploymentTrend(period: 'Oct', created: 3900, lost: 740),
      EmploymentTrend(period: 'Nov', created: 4500, lost: 790),
      EmploymentTrend(period: 'Déc', created: 4800, lost: 820),
    ];
  }

  // ──────────────────────────────────────────────────────────
  // Regional summary (ranking)
  // ──────────────────────────────────────────────────────────
  static List<RegionalSummary> getMockRegionalData() {
    return [
      RegionalSummary(
          region: 'Centre',
          workforceSize: 45200,
          jobsCreated: 9850,
          jobsLost: 2100,
          growthRate: 17.2),
      RegionalSummary(
          region: 'Littoral',
          workforceSize: 38900,
          jobsCreated: 7200,
          jobsLost: 1850,
          growthRate: 13.8),
      RegionalSummary(
          region: 'Ouest',
          workforceSize: 28400,
          jobsCreated: 5100,
          jobsLost: 1420,
          growthRate: 13.0),
      RegionalSummary(
          region: 'Nord-Ouest',
          workforceSize: 18700,
          jobsCreated: 3200,
          jobsLost: 980,
          growthRate: 11.9),
      RegionalSummary(
          region: 'Sud-Ouest',
          workforceSize: 15400,
          jobsCreated: 2800,
          jobsLost: 890,
          growthRate: 12.4),
      RegionalSummary(
          region: 'Adamaoua',
          workforceSize: 8900,
          jobsCreated: 1450,
          jobsLost: 520,
          growthRate: 10.5),
      RegionalSummary(
          region: 'Nord',
          workforceSize: 11200,
          jobsCreated: 1800,
          jobsLost: 650,
          growthRate: 10.3),
      RegionalSummary(
          region: 'Est',
          workforceSize: 7600,
          jobsCreated: 1200,
          jobsLost: 410,
          growthRate: 10.4),
      RegionalSummary(
          region: 'Sud',
          workforceSize: 6200,
          jobsCreated: 980,
          jobsLost: 320,
          growthRate: 10.6),
      RegionalSummary(
          region: 'Extrême-Nord',
          workforceSize: 13100,
          jobsCreated: 2150,
          jobsLost: 780,
          growthRate: 10.5),
    ];
  }

  // ──────────────────────────────────────────────────────────
  // Sector performance
  // ──────────────────────────────────────────────────────────
  static List<Sector> getMockSectorData() {
    return [
      Sector(
          sector: 'Tertiaire',
          jobsCreated: 14880,
          jobsLost: 4120,
          netChange: 10760,
          percentageOfTotal: 52.3),
      Sector(
          sector: 'Secondaire',
          jobsCreated: 8520,
          jobsLost: 2890,
          netChange: 5630,
          percentageOfTotal: 30.0),
      Sector(
          sector: 'Primaire',
          jobsCreated: 5050,
          jobsLost: 1920,
          netChange: 3130,
          percentageOfTotal: 17.7),
    ];
  }

  // ──────────────────────────────────────────────────────────
  // Gender distribution (pie chart)
  // ──────────────────────────────────────────────────────────
  static GenderDistribution getMockGenderDistribution() {
    return GenderDistribution(
      male: 102890,
      female: 53530,
      total: 156420,
    );
  }

  // ──────────────────────────────────────────────────────────
  // Age distribution (if your model supports it)
  // ──────────────────────────────────────────────────────────
  static AgeDistribution getMockAgeDistribution() {
    return AgeDistribution(
      age15_24: 42300,
      age25_34: 24680,
      age35Plus: 89440,
    );
  }

  // ──────────────────────────────────────────────────────────
  // Top skills demand
  // ──────────────────────────────────────────────────────────
  static List<SkillDemand> getMockSkillDemands() {
    return [
      SkillDemand(
          skillName: 'Gestion de projet', demandCount: 1240, percentage: 18.5),
      SkillDemand(
          skillName: 'Comptabilité', demandCount: 980, percentage: 14.6),
      SkillDemand(
          skillName: 'Marketing digital', demandCount: 850, percentage: 12.7),
      SkillDemand(
          skillName: 'Développement web', demandCount: 720, percentage: 10.7),
      SkillDemand(
          skillName: 'Ressources humaines', demandCount: 650, percentage: 9.7),
      SkillDemand(
          skillName: 'Maintenance industrielle',
          demandCount: 580,
          percentage: 8.6),
      SkillDemand(skillName: 'Logistique', demandCount: 520, percentage: 7.8),
      SkillDemand(
          skillName: 'Santé & Sécurité', demandCount: 480, percentage: 7.2),
    ];
  }

  // ──────────────────────────────────────────────────────────
  // Training needs
  // ──────────────────────────────────────────────────────────
  static List<TrainingNeed> getMockTrainingNeeds() {
    return [
      TrainingNeed(
          domain: 'Leadership & Management',
          requestCount: 890,
          percentage: 16.2),
      TrainingNeed(
          domain: 'Techniques de vente', requestCount: 720, percentage: 13.1),
      TrainingNeed(
          domain: 'Informatique bureautique',
          requestCount: 650,
          percentage: 11.8),
      TrainingNeed(
          domain: 'Gestion de projet', requestCount: 580, percentage: 10.6),
      TrainingNeed(
          domain: 'Langues (Anglais)', requestCount: 520, percentage: 9.5),
      TrainingNeed(
          domain: 'Comptabilité avancée', requestCount: 480, percentage: 8.7),
      TrainingNeed(domain: 'Communication', requestCount: 420, percentage: 7.6),
      TrainingNeed(
          domain: 'Sécurité informatique', requestCount: 380, percentage: 6.9),
    ];
  }
}
