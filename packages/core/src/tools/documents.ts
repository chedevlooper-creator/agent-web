import { Tool } from "../types.js";
import * as fs from "fs/promises";
import * as path from "path";
import {
  getDocument,
  createDocument as dbCreateDocument,
  updateDocument,
  createDocumentVersion,
  listDocuments,
} from "@agent-web/db";
import { v4 as uuid } from "uuid";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "documents");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  yaml: "application/x-yaml",
  yml: "application/x-yaml",
  html: "text/html",
  htm: "text/html",
  xml: "application/xml",
  rtf: "application/rtf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  tiff: "image/tiff",
  tif: "image/tiff",
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(EXT_TO_MIME));

function getExtension(filename: string): string {
  return path.extname(filename).toLowerCase().replace(".", "").split("?").shift() || "";
}

function getMimeType(extension: string): string {
  return EXT_TO_MIME[extension] || "application/octet-stream";
}

const TEXT_EXTENSIONS = new Set(["txt", "md", "json", "yaml", "yml", "html", "htm", "xml", "rtf", "csv"]);

async function readTextFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, "utf-8");
}

async function readPdf(filePath: string): Promise<string> {
  try {
    type PdfParser = (buffer: Buffer) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;
    const mod = (await import("pdf-parse")) as unknown as PdfParser | { default: PdfParser };
    const pdfParse = typeof mod === "function" ? mod : (mod as { default: PdfParser }).default;
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text || "(No text content extracted)";
  } catch (e) {
    return `Failed to parse PDF: ${(e as Error).message}`;
  }
}

async function readExcel(filePath: string): Promise<string> {
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.readFile(filePath);
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      parts.push(`=== Sheet: ${sheetName} ===`);
      for (const row of json.slice(0, 100)) {
        parts.push(
          (row as unknown[])
            .map((cell) => String(cell ?? ""))
            .join(" | ")
        );
      }
      if (json.length > 100) {
        parts.push(`... (${json.length - 100} more rows)`);
      }
    }
    return parts.join("\n");
  } catch (e) {
    return `Failed to parse Excel file: ${(e as Error).message}`;
  }
}

async function readDocx(filePath: string): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || "(No text content extracted)";
  } catch (e) {
    return `Failed to parse Word document: ${(e as Error).message}`;
  }
}

async function readPptx(filePath: string): Promise<string> {
  try {
    // PPTX files are ZIP archives containing XML files
    // Try to extract text from the presentation XML
    const JSZip = (await import("jszip")).default;
    const buffer = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(buffer);
    const slides: string[] = [];
    const slideFiles = Object.keys(zip.files).filter((name) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(name)
    );
    slideFiles.sort();
    for (const slideFile of slideFiles) {
      const content = await zip.files[slideFile].async("text");
      // Extract text from XML (simple tag stripping)
      const textMatches = content.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
      const text = textMatches
        .map((m: string) => m.replace(/<\/?a:t[^>]*>/g, ""))
        .join(" ");
      if (text.trim()) {
        slides.push(`--- Slide ${slideFiles.indexOf(slideFile) + 1} ---\n${text.trim()}`);
      }
    }
    return slides.length > 0 ? slides.join("\n\n") : "(No text content extracted from slides)";
  } catch (e) {
    return `Failed to parse PowerPoint file: ${(e as Error).message}`;
  }
}

async function readCsv(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  // Format as simple table
  return lines.slice(0, 200).join("\n") + (lines.length > 200 ? `\n... (${lines.length - 200} more rows)` : "");
}

async function readDocumentContent(filePath: string, extension: string): Promise<string> {
  switch (extension) {
    case "pdf":
      return await readPdf(filePath);
    case "xlsx":
    case "xls":
      return await readExcel(filePath);
    case "docx":
      return await readDocx(filePath);
    case "pptx":
    case "ppt":
      return await readPptx(filePath);
    case "csv":
      return await readCsv(filePath);
    default:
      if (TEXT_EXTENSIONS.has(extension)) {
        return await readTextFile(filePath);
      }
      return `Unsupported file format: .${extension}. Cannot read this type of file.`;
  }
}

// ─── Write helpers ───────────────────────────────────────────────────────────

async function createPdf(content: string, outputPath: string): Promise<void> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const lines = content.split("\n");
  const pageSize = 50; // lines per page
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += pageSize) {
    chunks.push(lines.slice(i, i + pageSize));
  }

  for (const chunk of chunks) {
    const page = doc.addPage([612, 792]); // US Letter
    let y = 750;
    for (const line of chunk) {
      page.drawText(line, { x: 50, y, size: 11, font, color: rgb(0, 0, 0) });
      y -= 16;
    }
  }

  const bytes = await doc.save();
  await fs.writeFile(outputPath, Buffer.from(bytes));
}

async function createDocx(content: string, outputPath: string): Promise<void> {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const lines = content.split("\n");
  const paragraphs = lines.map(
    (line) =>
      new Paragraph({
        children: [new TextRun(line || " ")],
      })
  );

  const doc = new Document({ sections: [{ children: paragraphs }] });
  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(outputPath, Buffer.from(buffer));
}

async function createXlsx(content: string, outputPath: string): Promise<void> {
  const XLSX = await import("xlsx");
  const lines = content.split("\n").filter((l) => l.trim());
  const data = lines.map((line) => line.split(/[,\t|]/).map((c) => c.trim()));
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  XLSX.writeFile(workbook, outputPath);
}

async function createPptx(content: string, outputPath: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PptxGenJS = (await import("pptxgenjs")) as any;
  const Ctor = PptxGenJS.default || PptxGenJS;
  const pres = new Ctor();
  const slides = content.split("\n---\n");
  for (const slideContent of slides) {
    const slide = pres.addSlide();
    const lines = slideContent.trim().split("\n").filter((l) => l.trim());
    slide.addText(
      lines.map((l) => ({ text: l, options: { fontSize: 18, breakType: "none" } })),
      { x: 0.5, y: 0.5, w: 9, h: 6 }
    );
  }
  await pres.writeFile({ fileName: outputPath });
}

async function createDocumentFile(
  content: string,
  extension: string,
  outputPath: string
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  switch (extension) {
    case "pdf":
      await createPdf(content, outputPath);
      break;
    case "docx":
      await createDocx(content, outputPath);
      break;
    case "xlsx":
      await createXlsx(content, outputPath);
      break;
    case "pptx":
      await createPptx(content, outputPath);
      break;
    default:
      // Text-based formats
      await fs.writeFile(outputPath, content, "utf-8");
      break;
  }
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export const documentTools: Tool[] = [
  {
    name: "read_document",
    description:
      "Read and extract text content from an uploaded office document. Supports PDF, Word (.docx), Excel (.xlsx/.xls), PowerPoint (.pptx), CSV, text files (.txt, .md, .json). Returns the full text content of the document.",
    parameters: {
      type: "object",
      properties: {
        documentId: {
          type: "string",
          description: "The ID of the document to read",
        },
      },
      required: ["documentId"],
    },
    handler: async (args) => {
      const documentId = args.documentId as string;
      if (!documentId) return "Error: documentId is required";

      try {
        const doc = await getDocument(documentId);
        if (!doc) return `Error: Document not found (ID: ${documentId})`;

        const ext = doc.extension.toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          return `Error: Unsupported file format (.${ext}). Allowed formats: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}`;
        }

        // Check if file exists on disk
        try {
          await fs.access(doc.storagePath);
        } catch {
          return `Error: File not found on disk at ${doc.storagePath}. The file may have been deleted.`;
        }

        const content = await readDocumentContent(doc.storagePath, ext);
        const sizeKB = (doc.fileSize / 1024).toFixed(1);

        return [
          `📄 **${doc.originalName}** (.${ext}, ${sizeKB} KB)`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          content,
        ].join("\n");
      } catch (e) {
        return `Error reading document: ${(e as Error).message}`;
      }
    },
    toolset: "document",
  },
  {
    name: "edit_document",
    description:
      "Edit an existing office document by replacing its content. For text-based files (TXT, MD, CSV, JSON), directly rewrites the file. For PDF, DOCX, XLSX, creates a new version with the provided content. The original file is preserved as a version in the document history.",
    parameters: {
      type: "object",
      properties: {
        documentId: {
          type: "string",
          description: "The ID of the document to edit",
        },
        newContent: {
          type: "string",
          description:
            "The new text content to write to the document. For structured formats, provide properly formatted content.",
        },
        changeSummary: {
          type: "string",
          description: "Description of what changed (stored in version history)",
        },
      },
      required: ["documentId", "newContent"],
    },
    handler: async (args) => {
      const documentId = args.documentId as string;
      const newContent = args.newContent as string;
      const changeSummary = (args.changeSummary as string) || "Updated via edit_document tool";

      if (!documentId || !newContent) return "Error: documentId and newContent are required";

      try {
        const doc = await getDocument(documentId);
        if (!doc) return `Error: Document not found (ID: ${documentId})`;

        const ext = doc.extension.toLowerCase();

        // Save the current file as a version before overwriting
        const versionId = uuid();
        const versionDir = path.join(UPLOADS_DIR, "versions", documentId);
        const versionPath = path.join(versionDir, `v${Date.now()}.${ext}`);

        try {
          await fs.mkdir(versionDir, { recursive: true });
          // Copy current file to version storage
          const currentContent = await fs.readFile(doc.storagePath);
          await fs.writeFile(versionPath, currentContent);
        } catch (e) {
          // Non-critical if versioning fails
          console.warn("Version backup failed:", (e as Error).message);
        }

        // Write new content
        await createDocumentFile(newContent, ext, doc.storagePath);

        // Update DB record
        await updateDocument(documentId, {
          content: newContent.substring(0, 100_000), // Store preview in DB
          fileSize: (await fs.stat(doc.storagePath)).size,
        });

        // Record version
        try {
          await createDocumentVersion({
            id: versionId,
            documentId,
            versionNumber: Date.now(),
            storagePath: versionPath,
            changeSummary,
            createdBy: "ai",
          });
        } catch (e) {
          console.warn("Version record failed:", (e as Error).message);
        }

        return `✅ Document "${doc.originalName}" updated successfully.\nChange: ${changeSummary}\nNew size: ${((await fs.stat(doc.storagePath)).size / 1024).toFixed(1)} KB`;
      } catch (e) {
        return `Error editing document: ${(e as Error).message}`;
      }
    },
    toolset: "document",
  },
  {
    name: "create_document",
    description:
      "Create a new office document with the provided content. Automatically detects format from the filename extension. Supports: .txt, .md, .json, .csv, .pdf, .docx, .xlsx, .pptx. The document is saved to the uploads directory and registered in the database.",
    parameters: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description:
            "Desired filename with extension (e.g., 'report.docx', 'data.csv', 'presentation.pptx'). Determines the output format.",
        },
        content: {
          type: "string",
          description:
            "The content to write. For TXT/MD: plain text. For CSV: comma/pipe/tab separated lines. For JSON: valid JSON. For PDF/DOCX/XLSX/PPTX: text content that will be rendered into the document.",
        },
        sessionId: {
          type: "string",
          description: "Optional session ID to associate the document with a conversation",
        },
      },
      required: ["filename", "content"],
    },
    handler: async (args) => {
      const filename = args.filename as string;
      const content = args.content as string;
      const sessionId = args.sessionId as string | undefined;

      if (!filename || !content) return "Error: filename and content are required";

      const ext = getExtension(filename);
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return `Error: Unsupported format (.${ext}). Supported formats: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}`;
      }

      try {
        const docId = uuid();
        const storageFilename = `${docId}.${ext}`;
        const storagePath = path.join(UPLOADS_DIR, storageFilename);

        // Create the file
        await createDocumentFile(content, ext, storagePath);

        // Register in DB
        const stat = await fs.stat(storagePath);
        const mimeType = getMimeType(ext);

        await dbCreateDocument({
          id: docId,
          sessionId: sessionId || undefined,
          filename: storageFilename,
          originalName: filename,
          mimeType,
          extension: ext,
          fileSize: stat.size,
          storagePath,
          content: content.substring(0, 100_000),
        });

        return [
          `✅ Document created successfully!`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Name: ${filename}`,
          `Format: .${ext} (${mimeType})`,
          `Size: ${(stat.size / 1024).toFixed(1)} KB`,
          `ID: ${docId}`,
          `Storage: ${storagePath}`,
        ].join("\n");
      } catch (e) {
        return `Error creating document: ${(e as Error).message}`;
      }
    },
    toolset: "document",
  },
  {
    name: "list_documents",
    description:
      "List all uploaded office documents. Optionally filter by session ID. Returns document names, formats, sizes, and upload dates.",
    parameters: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Optional session ID to filter documents by conversation",
        },
        limit: {
          type: "number",
          description: "Maximum number of documents to return (default: 20)",
        },
      },
      required: [],
    },
    handler: async (args) => {
      const sessionId = args.sessionId as string | undefined;
      const limit = (args.limit as number) || 20;

      try {
        const docs = await listDocuments({ sessionId, limit });
        if (docs.length === 0) return "No documents found.";

        const lines = docs.map((doc, i) => {
          const sizeKB = (doc.fileSize / 1024).toFixed(1);
          const date = new Date(doc.uploadedAt).toLocaleDateString("tr-TR");
          return `${i + 1}. **${doc.originalName}** (.${doc.extension}, ${sizeKB} KB, ${date})\n   ID: ${doc.id}`;
        });

        return [`📁 **Documents (${docs.length})**`, ...lines].join("\n\n");
      } catch (e) {
        return `Error listing documents: ${(e as Error).message}`;
      }
    },
    toolset: "document",
  },
  {
    name: "delete_document",
    description:
      "Delete an uploaded document from the database and file system. This action cannot be undone.",
    parameters: {
      type: "object",
      properties: {
        documentId: {
          type: "string",
          description: "The ID of the document to delete",
        },
      },
      required: ["documentId"],
    },
    handler: async (args) => {
      const documentId = args.documentId as string;
      if (!documentId) return "Error: documentId is required";

      try {
        const doc = await getDocument(documentId);
        if (!doc) return `Error: Document not found (ID: ${documentId})`;

        // Try to delete file from disk
        try {
          await fs.unlink(doc.storagePath);
        } catch {
          // File might already be deleted, that's ok
        }

        // Delete from DB
        const { deleteDocument } = await import("@agent-web/db");
        await deleteDocument(documentId);

        return `✅ Document "${doc.originalName}" deleted.`;
      } catch (e) {
        return `Error deleting document: ${(e as Error).message}`;
      }
    },
    toolset: "document",
  },
  {
    name: "convert_document",
    description:
      "Convert an uploaded document from one format to another. Reads the source document and creates a new file in the target format. Supports conversions between: PDF, TXT, MD, CSV, DOCX, XLSX.",
    parameters: {
      type: "object",
      properties: {
        documentId: {
          type: "string",
          description: "The ID of the source document to convert",
        },
        targetFormat: {
          type: "string",
          description:
            "Target format extension (e.g., 'pdf', 'txt', 'csv', 'docx', 'xlsx', 'md'). The converted file will be saved as a new document.",
        },
        filename: {
          type: "string",
          description:
            "Optional custom filename for the converted document (without extension). Defaults to source name + target format.",
        },
      },
      required: ["documentId", "targetFormat"],
    },
    handler: async (args) => {
      const documentId = args.documentId as string;
      const targetFormat = (args.targetFormat as string).toLowerCase().replace(".", "");
      const customName = args.filename as string | undefined;

      if (!documentId || !targetFormat)
        return "Error: documentId and targetFormat are required";

      if (!ALLOWED_EXTENSIONS.has(targetFormat)) {
        return `Error: Unsupported target format (.${targetFormat}). Supported: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}`;
      }

      try {
        const doc = await getDocument(documentId);
        if (!doc) return `Error: Source document not found (ID: ${documentId})`;

        // Read the source content
        const sourceExt = doc.extension.toLowerCase();
        const textContent = await readDocumentContent(doc.storagePath, sourceExt);

        // Create new file in target format
        const newDocId = uuid();
        const newFilename = customName
          ? `${customName}.${targetFormat}`
          : `${path.basename(doc.originalName, path.extname(doc.originalName))}.${targetFormat}`;
        const storageFilename = `${newDocId}.${targetFormat}`;
        const storagePath = path.join(UPLOADS_DIR, storageFilename);

        await createDocumentFile(textContent, targetFormat, storagePath);

        // Register in DB
        const stat = await fs.stat(storagePath);
        await dbCreateDocument({
          id: newDocId,
          sessionId: doc.sessionId ?? undefined,
          filename: storageFilename,
          originalName: newFilename,
          mimeType: getMimeType(targetFormat),
          extension: targetFormat,
          fileSize: stat.size,
          storagePath,
          content: textContent.substring(0, 100_000),
          metadata: JSON.stringify({
            convertedFrom: doc.id,
            sourceFormat: sourceExt,
            targetFormat,
          }),
        });

        return [
          `✅ Conversion complete!`,
          `━━━━━━━━━━━━━━━━━━━━━━━`,
          `Source: ${doc.originalName} (.${sourceExt})`,
          `Target: ${newFilename} (.${targetFormat})`,
          `Size: ${(stat.size / 1024).toFixed(1)} KB`,
          `New Document ID: ${newDocId}`,
        ].join("\n");
      } catch (e) {
        return `Error converting document: ${(e as Error).message}`;
      }
    },
    toolset: "document",
  },
];
