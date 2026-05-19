import 'package:flutter/material.dart';
import 'identification_config_models.dart';
import 'identification_vm.dart';

class IdentificationConfigFactory {
  // ============================================================
  // ENTERPRISE
  // ============================================================
  static List<SectionConfig> enterprise(IdentificationVM vm) {
    return [
      SectionConfig(
        title: "S1Q01 — Raison sociale",
        fields: [
          FieldConfig(
            label: "Nom de l'entreprise",
            hint: "Ex: SABC SA",
            controller: vm.controller("companyName"),
            focusKey: "name",
            nextFocusKey: "legal_status",
          ),
        ],
      ),
      SectionConfig(
        title: "S1Q02 — Statut juridique",
        fields: [
          RadioConfig<int>(
            label: "",
            options: const [
              RadioOption(value: 1, text: 'SA'),
              RadioOption(value: 2, text: 'SARL'),
              RadioOption(value: 3, text: 'SNC'),
              RadioOption(value: 4, text: 'SCS'),
              RadioOption(value: 5, text: 'GIE'),
              RadioOption(value: 6, text: 'Entreprise individuelle'),
              RadioOption(value: 7, text: 'Autre'),
            ],
            value: vm.get<int>("legalStatus", fallback: 1),
            onChanged: (v) => vm.set("legalStatus", v ?? 1),
            nextFocusKey: "area",
          ),
        ],
      ),
      SectionConfig(
        title: "S1Q03 — Milieu de résidence",
        fields: [
          RadioConfig<int>(
            label: "",
            options: const [
              RadioOption(value: 1, text: 'Urbain'),
              RadioOption(value: 2, text: 'Rural'),
            ],
            value: vm.get<int>("area", fallback: 1),
            onChanged: (v) => vm.set("area", v ?? 1),
            nextFocusKey: "region",
          ),
        ],
      ),
      SectionConfig(
        title: "S1Q04 — Localisation",
        fields: [
          FieldConfig(
            label: "Région",
            hint: "Ex: Littoral",
            controller: vm.controller("region"),
            focusKey: "region",
            nextFocusKey: "dept",
          ),
          FieldConfig(
            label: "Département",
            hint: "Ex: Wouri",
            controller: vm.controller("department"),
            focusKey: "dept",
            nextFocusKey: "subdiv",
          ),
          FieldConfig(
            label: "Arrondissement",
            hint: "Ex: Douala 3e",
            controller: vm.controller("subdivision"),
            focusKey: "subdiv",
            nextFocusKey: "locality",
          ),
          FieldConfig(
            label: "Localité",
            hint: "Ex: Bonamoussadi",
            controller: vm.controller("locality"),
            focusKey: "locality",
            nextFocusKey: "phone1",
          ),
        ],
      ),
      SectionConfig(
        title: "S1Q05 — Contacts",
        fields: [
          FieldConfig(
            label: "Téléphone 1",
            hint: "Ex: 677123456",
            controller: vm.controller("phone1"),
            focusKey: "phone1",
            keyboardType: TextInputType.phone,
            nextFocusKey: "phone2",
          ),
          FieldConfig(
            label: "Téléphone 2",
            hint: "Ex: 699123456",
            controller: vm.controller("phone2"),
            focusKey: "phone2",
            keyboardType: TextInputType.phone,
            nextFocusKey: "bp",
          ),
          FieldConfig(
            label: "Boîte postale",
            hint: "Ex: 1234",
            controller: vm.controller("bp"),
            focusKey: "bp",
            nextFocusKey: "sector",
          ),
        ],
      ),
    ];
  }

  // ============================================================
  // COOPERATIVE
  // ============================================================
  static List<SectionConfig> cooperative(IdentificationVM vm) {
    return [
      SectionConfig(
        title: "S1Q01 — Coopérative",
        fields: [
          FieldConfig(
            label: "Nom",
            hint: "Ex: Coopérative agricole",
            controller: vm.controller("name"),
            focusKey: "name",
            nextFocusKey: "head_office",
          ),
          FieldConfig(
            label: "Siège",
            hint: "Ex: Bafoussam",
            controller: vm.controller("headOffice"),
            focusKey: "head_office",
            nextFocusKey: "year",
          ),
          FieldConfig(
            label: "Année création",
            hint: "Ex: 2010",
            controller: vm.controller("yearOfCreation"),
            focusKey: "year",
            keyboardType: TextInputType.number,
          ),
        ],
      ),
    ];
  }

  // ============================================================
  // CTD
  // ============================================================
  static List<SectionConfig> ctd(IdentificationVM vm) {
    return [
      SectionConfig(
        title: "S1Q01 — CTD",
        fields: [
          RadioConfig<int>(
            label: "",
            options: const [
              RadioOption(value: 1, text: 'Communauté Urbaine'),
              RadioOption(value: 2, text: 'Commune'),
              RadioOption(value: 3, text: 'Région'),
            ],
            value: vm.get<int>("ctdType", fallback: 1),
            onChanged: (v) => vm.set("ctdType", v ?? 1),
          ),
        ],
      ),
    ];
  }

  // ============================================================
  // ONG
  // ============================================================
  static List<SectionConfig> ong(IdentificationVM vm) {
    return [
      SectionConfig(
        title: "S1Q01 — ONG",
        fields: [
          FieldConfig(
            label: "Nom ONG",
            hint: "Ex: CPDH",
            controller: vm.controller("name"),
            focusKey: "name",
            nextFocusKey: "head_office",
          ),
          FieldConfig(
            label: "Siège",
            hint: "Yaoundé",
            controller: vm.controller("headOffice"),
            focusKey: "head_office",
            nextFocusKey: "year",
          ),
        ],
      ),
    ];
  }
}
