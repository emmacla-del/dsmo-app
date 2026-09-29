# Statistical Integrity Rules

- `onefop_ast.dart` is the canonical questionnaire source.
- Never manually edit generated schema artifacts.
- Do not change statistical semantics to solve UI problems.
- Preserve normalized relational storage.
- Preserve gateway applicability logic.
- Preserve advisory/non-blocking coherence behaviour unless explicitly changed.
- Consider downstream SPSS, Excel, PDF and analytics implications.