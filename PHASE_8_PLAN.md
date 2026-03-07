# PHASE 8 PLAN: Evolution & Artifact Export

## Overview

Phase 8 shifts Polaris from **Analysis** to **Iteration and Reporting**. We will implement the "Evolution" layer — allowing users to see how specific ad improvements impact their scores — and the "Export" layer for executive-ready reporting. 

This phase delivers on the core proposition of "Score before publishing" by giving the user the "Before vs. After" comparison that justifies creative budget shifts.

---

## Scope

### New Features:
1.  **Creative Evolution Tracking**: A "Snapshot & Compare" feature in the frontend that allows a user to save a current result and see it side-by-side with a new variant (e.g., "Original" vs "Optimized").
2.  **Executive PDF Export**: A backend endpoint using `reportlab` to generate a high-fidelity PDF summary of the results, including the Resonance Graph, for stakeholders.
3.  **Variant Generator (LLM)**: A "Improve Ad Copy" button that uses Phase 6's diagnostic gaps to suggest 3 specific copy variants directly in the `Compose` view.

---

## Technical Details

### 1. Backend: PDF Export Endpoint
- **New Dependency**: `reportlab`
- **Endpoint**: `POST /api/v1/export/pdf`
- **Logic**: 
    - Takes `QuantitativeMetrics` + `Diagnostic` + `Headline/Body`
    - Renders a branded PDF with a summary table, the Resonance Graph (as a static plot using `matplotlib` to mirror the SVG), and the executive prose.

### 2. Frontend: Evolution UI
- **Storage**: Use the existing `useSessions.js` (IndexedDB) to "Pin" sessions as base variants.
- **Comparison View**: A new `EvolutionSection.jsx` that renders a diff of 2 sessions:
  - Quality Score Delta (e.g., +1.2 pts)
  - eCPC Delta (e.g., -$0.22)
  - Sentiment shift viz.

### 3. Frontend: Variant Iteration
- **Button**: Add "Refine Copy ✨" to `Compose.jsx`.
- **Logic**: Sends the current analysis to `/api/v1/generate_variants`.
- **Prompt**: Uses the gap analysis from `_build_signal_brief` (Phase 6) to specifically target "low-momentum" or "high-risk" signals.

---

## Files to be Created/Modified

### Backend (3):
- `backend/requirements.txt` — add `reportlab`
- `backend/main.py` — add `/api/v1/export/pdf` and `/api/v1/generate_variants`
- `backend/tests/test_phase8_evolution.py` — 14 tests for PDF generation and variant logic

### Frontend (4):
- `frontend-react/src/components/results/EvolutionSection.jsx` — new comparison component
- `frontend-react/src/components/Compose.jsx` — add "Refine" button + variant selector
- `frontend-react/src/components/Results.jsx` — import + render `<EvolutionSection>`
- `frontend-react/src/lib/pdf.js` — client-side trigger for PDF download

---

## Tests

- `test_pdf_export_structure`: Verifies API returns a binary PDF stream.
- `test_variant_generator_targeting`: Verifies that LLM variants address "high-risk" signals if present.
- `test_evolution_diff_calculation`: Verifies frontend delta math (e.g., eCPC calculation).
- `test_pdf_export_encoding`: Verifies Unicode handling for international entities.

---

## Progress Tracking

- [ ] Backend: reportlab PDF generation service
- [ ] Backend: Variant generation prompt & endpoint
- [ ] Frontend: EvolutionSection (Comparison Viz)
- [ ] Frontend: Refine Copy integration in Compose
- [ ] Final integration & 315 tests passing
