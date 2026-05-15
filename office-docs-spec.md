# Office Document Processing Module — Specification

## 1. Overview

**Feature Name:** Office Document Processing Module
**Project:** agent-web (current monorepo)
**Type:** Cross-cutting feature (apps/web + packages/core)
**Date:** Generated from user interviews

A document management and processing module that allows users to upload, analyze, edit, create, and convert office documents (PDF, Excel, Word, PowerPoint, images) through AI-powered chat interactions in the Agent Web platform.

---

## 2. Goals & User Stories

### Primary Goals
- Upload office documents via chat or a dedicated file management panel
- Read, analyze, and summarize document contents using AI
- Edit/modify existing documents (update text, fix tables, reformat)
- Create new documents from scratch (reports, invoices, forms)
- Convert between formats (PDF ↔ Word, Excel → PDF, etc.)
- Extract data from documents and generate reports
- Handle all operations via AI agent tools in chat

### User Stories
- "As a user, I want to upload a PDF and ask the AI to summarize it."
- "As a user, I want to upload an Excel file and ask the AI to update specific cells."
- "As a user, I want to create a Word document report from chat data."
- "As a user, I want to convert a PDF to an editable Word document."
- "As a user, I want to extract tables from a PDF into an Excel file."
- "As a user, I want to manage my uploaded files in a panel on the right sidebar."

---

## 3. File Formats

### Supported Formats (v1)
| Format    | Extension(s)      | Read | Edit | Create | Convert |
|-----------|-------------------|------|------|--------|---------|
| PDF       | .pdf              | ✅   | ✅   | ✅     | ✅      |
| Excel     | .xlsx, .xls       | ✅   | ✅   | ✅     | ✅      |
| Word      | .docx             | ✅   | ✅   | ✅     | ✅      |
| PowerPoint| .pptx             | ✅   | ⬜   | ⬜     | ✅      |
| Images    | .png, .jpg, .webp | ✅   | ⬜   | ⬜     | ⬜      |
| Plain Text| .txt, .md, .csv   | ✅   | ✅   | ✅     | ✅      |
| HTML      | .html             | ✅   | ⬜   | ⬜     | ✅      |

### Future Formats (post-v1)
- PowerPoint edit/create
- Image edit/generation
- Email (.eml, .msg)
- Markdown → PDF/Word

---

## 4. Architecture

### 4.1 Package Structure

```
agent-web/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── api/
│       │   │   ├── documents/          ← NEW: Document CRUD API
│       │   │   │   ├── route.ts        (list, upload)
│       │   │   │   └── [id]/
│       │   │   │       ├── route.ts    (get, delete)
│       │   │   │       ├── download/route.ts
│       │   │   │       └── preview/route.ts
│       │   │   └── ... (existing)
│       ├── components/
│       │   ├── documents/              ← NEW: Document UI components
│       │   │   ├── document-panel.tsx
│       │   │   ├── document-upload.tsx
│       │   │   ├── document-list.tsx
│       │   │   ├── document-viewer.tsx
│       │   │   └── format-converter.tsx
│       │   └── ... (existing)
│       └── lib/
│           ├── document-store.ts       ← NEW: Zustand store for documents
│           └── ... (existing)
│
├── packages/
│   ├── core/
│   │   └── src/
│   │       └── tools/
│   │           ├── documents/          ← NEW: Document processing tools
│   │           │   ├── index.ts        (tool registration)
│   │           │   ├── read.ts         (read/analyze)
│   │           │   ├── edit.ts         (edit/modify)
│   │           │   ├── create.ts       (create from scratch)
│   │           │   ├── convert.ts      (format conversion)
│   │           │   └── extract.ts      (data extraction)
│   │           └── ... (existing)
│   │
│   └── db/
│       └── src/
│           ├── schema.ts               ← NEW: documents table
│           └── ... (existing)
```

### 4.2 Data Flow

```
User Uploads File
       │
       ▼
[API Route] POST /api/documents
       │
       ├─► Save file to uploads/ directory
       ├─► Store metadata in SQLite (documents table)
       └─► Return document ID + metadata
       
User Asks AI About File (in chat)
       │
       ▼
[Chat Engine] → [AI Model] decides to use document tool
       │
       ▼
[Document Tool] handles operation
       │
       ├─► Read: Parse file → Return content
       ├─► Edit: Parse → AI modifies → Save
       ├─► Create: AI generates content → Write file
       ├─► Convert: Load → Transform → Save new format
       └─► Extract: Parse → Extract structured data → Return
```

### 4.3 Database Schema (New Tables)

```sql
-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,               -- Original filename
  original_name TEXT NOT NULL,          -- Original name with extension
  mime_type TEXT NOT NULL,              -- application/pdf, etc.
  extension TEXT NOT NULL,              -- pdf, docx, xlsx, etc.
  file_size INTEGER NOT NULL,           -- Size in bytes
  storage_path TEXT NOT NULL,           -- Path to file on disk
  content TEXT,                         -- Cached text content (for search)
  metadata TEXT,                        -- JSON: author, pages, etc.
  uploaded_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Document versions (for tracking edits)
CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  change_summary TEXT,                  -- AI-generated summary of changes
  created_by TEXT,                      -- 'user' or 'ai'
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. Implementation Plan

### Phase 1: Foundation (Database + Storage)

**Package: `packages/db`**

1. Add `documents` and `document_versions` tables to schema.ts
2. Add CRUD functions to packages/db/src/index.ts
3. Run migration (drizzle-kit push)

### Phase 2: API Layer

**Package: `apps/web`**

1. Create `POST /api/documents` — Upload endpoint
   - Accept multipart/form-data (file + optional sessionId)
   - Validate file type and size (max 50MB)
   - Save to `uploads/documents/` directory
   - Insert metadata into documents table
   - Return document ID + metadata

2. Create `GET /api/documents` — List documents (filterable by sessionId)
3. Create `GET /api/documents/[id]` — Get document metadata
4. Create `DELETE /api/documents/[id]` — Delete document + file
5. Create `GET /api/documents/[id]/download` — Download original file
6. Create `GET /api/documents/[id]/preview` — Get text content for preview
7. Create `POST /api/documents/convert` — Format conversion endpoint

### Phase 3: Core Document Tools

**Package: `packages/core`**

Create document processing tools that use Python scripts (via child_process) or Node.js libraries:

#### Tool 1: `document_read`
- **Description:** Read and analyze a document's content
- **Parameters:** `{ documentId: string, format?: "text" | "metadata" | "full" }`
- **Implementation:**
  - PDF → pdfplumber (Python) or pdf-parse (Node.js)
  - Excel → openpyxl (Python) or exceljs (Node.js)
  - Word → python-docx (Python) or mammoth/docx (Node.js)
  - PPTX → python-pptx (Python) or pptxgenjs (Node.js)

#### Tool 2: `document_edit`
- **Description:** Edit/modify an existing document
- **Parameters:** `{ documentId: string, instructions: string }`
- **Implementation:**
  - AI generates the modified content/structure
  - Library writes the new file
  - Saves as new version in document_versions

#### Tool 3: `document_create`
- **Description:** Create a new document from scratch
- **Parameters:** `{ filename: string, format: string, content: string }`
- **Implementation:**
  - AI generates content
  - Library creates file in specified format
  - Stores document with proper metadata

#### Tool 4: `document_convert`
- **Description:** Convert document between formats
- **Parameters:** `{ documentId: string, targetFormat: string }`
- **Implementation:**
  - Use LibreOffice CLI for general conversions (most reliable)
  - Fallback to specialized libraries for common conversions
  - Returns new document ID

#### Tool 5: `document_extract`
- **Description:** Extract structured data from document
- **Parameters:** `{ documentId: string, extractType: "tables" | "text" | "images" | "metadata" }`
- **Implementation:**
  - Parse document
  - Extract requested data
  - Return as structured JSON

### Phase 4: Frontend Components

**Package: `apps/web`**

1. **Document Store** (`lib/document-store.ts` with Zustand):
   - documents list with metadata
   - current selected document
   - upload progress tracking
   - file management actions (upload, delete, download)

2. **Context Panel Tab** — Add "Documents" tab to existing Context Panel:
   - File list with icons per type
   - Upload button (drag & drop)
   - Search/filter within documents
   - Quick actions per file (download, delete, copy ID)

3. **Chat Enhancements:**
   - File attachment button in chat input
   - Inline document preview (for images, text previews)
   - Download buttons for created/converted files
   - Version history display

4. **Document Viewer:**
   - Inline text preview for PDFs
   - Table view for Excel files
   - Rendered view for Word documents

### Phase 5: Backend Processing

**Python Scripts or Node.js Libraries:**

Create a document processor module:

| Library | Purpose | Type |
|---------|---------|------|
| **pdf-parse** (Node.js) | PDF text extraction | Node.js |
| **pdf-lib** (Node.js) | PDF creation/modification | Node.js |
| **exceljs** (Node.js) | Excel read/write/create | Node.js |
| **docx** (Node.js) | Word document creation | Node.js |
| **mammoth** (Node.js) | DOCX → HTML/Markdown | Node.js |
| **LibreOffice CLI** | Format conversion (all formats) | CLI tool |
| **pdfplumber** (Python) | Advanced PDF table extraction | Python |
| **python-docx** (Python) | Advanced Word processing | Python |
| **openpyxl** (Python) | Advanced Excel processing | Python |
| **python-pptx** (Python) | PowerPoint processing | Python |

Node.js libraries should be preferred (simpler dependency management). Python subprocess should be used when Node.js libraries are insufficient. LibreOffice CLI should be used for format conversions.

---

## 6. UI Components Detail

### 6.1 Document Panel (Context Panel Tab)

```
┌────────────────────────────────┐
│ 📄 Documents          [+ New] │
├────────────────────────────────┤
│ 🔍 Search documents...         │
├────────────────────────────────┤
│ 📄 report.pdf         50 KB   │
│ 📊 budget.xlsx       120 KB   │
│ 📝 proposal.docx     200 KB   │
│ 📄 invoice.pdf        30 KB   │
├────────────────────────────────┤
│                Total: 4 files  │
│                Used: 400 KB    │
└────────────────────────────────┘
```

### 6.2 File Upload (Drag & Drop)

```
┌────────────────────────────────────┐
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  ⬆️ Drop files here               │
│     or click to browse            │
│  │ Supported: PDF, Excel, Word,  │  │
│     PowerPoint, Images            │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                    │
│  📄 report.pdf   ════════░░ 45%   │
└────────────────────────────────────┘
```

### 6.3 Chat File Attachment

```
┌──────────────────────────────────┐
│ Message Agent Web...  📎  📤    │
└──────────────────────────────────┘
       │
       ▼
┌──────────────────┐
│ 📄 Upload file    │
│ 📷 Take photo     │
│ 📋 Paste from     │
│    clipboard      │
└──────────────────┘
```

---

## 7. Technical Constraints

### File Size Limit
- **Maximum file size:** 50 MB
- Enforced on frontend (before upload) and backend

### Storage
- Files stored on disk at `uploads/documents/{sessionId}/{fileId}.{ext}`
- Metadata stored in SQLite `documents` table
- File content extracted to text cached in `content` column for search

### Security
- Validate MIME types on upload
- Scan for malicious content (limit to document types only)
- Session-scoped access (users only see their own session's files)
- Sanitize filenames to prevent path traversal

### Performance
- Large files should be processed asynchronously
- Text extraction should be cached after first read
- Stream file downloads (don't load entire file into memory)

---

## 8. Dependencies to Add

### Node.js Packages
```json
{
  "pdf-parse": "^1.1.1",
  "pdf-lib": "^1.17.1",
  "exceljs": "^4.4.0",
  "docx": "^8.5.0",
  "mammoth": "^1.8.0",
  "mime-types": "^2.1.35",
  "multer": "^1.4.5-lts.1"
}
```

### Python Packages (for advanced features)
```txt
pdfplumber>=0.11.0
python-docx>=1.1.0
openpyxl>=3.1.0
python-pptx>=0.6.23
```

### System Requirements
- LibreOffice (optional, for format conversions): `apt install libreoffice-core libreoffice-writer libreoffice-calc libreoffice-impress`

---

## 9. Success Criteria

1. ✅ User can upload PDF, Excel, Word, PPTX, and image files
2. ✅ User can ask AI to read and summarize any uploaded document
3. ✅ User can ask AI to edit documents (modify text, update cells)
4. ✅ User can create new documents via AI chat
5. ✅ User can convert documents between formats
6. ✅ User can extract tables/data from documents
7. ✅ User can view and manage files in the Context Panel
8. ✅ All operations work as AI agent tools in chat
9. ✅ Files persist between sessions (scoped to user session)

---

## 10. Future Enhancements (Post-v1)

- Document templates (create from template library)
- Batch processing (operate on multiple files at once)
- Document collaboration (share files between sessions)
- OCR for scanned documents
- AI-powered document search (semantic search across uploaded docs)
- Integration with external storage (Google Drive, OneDrive)
- Watermark and digital signatures
- Document comparison (diff view)
