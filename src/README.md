# Frontend module notes

- `app.js`: Preparation Module v0.1.0. Emits `packet_schema_version: 1.0` and stores the handoff under `patentWorkbench.handoff.module2.v1`.
- `drafting.js`: Drafting Module v0.2.0. Reads the shared handoff, sends it to the local server API, and stores a Module 3-compatible document object under `patentWorkbench.draft.module2.v1`.
- `review.js`: Review Module v0.3.0. Shows editable numbered paragraphs, sends selected paragraph IDs to `/api/revise`, and saves confirmed DOCX versions without overwriting earlier downloads.
- `styles.css`: Preparation Module styles.
- `drafting.css`: Drafting Module styles.
- `review.css`: Review Module styles.

Run the parent project with `python3 run_server.py`; opening an HTML file directly or using Python's static-only server does not provide AI or DOCX endpoints. `/api/revise` returns structured paragraph proposals using the Responses API JSON schema format.
