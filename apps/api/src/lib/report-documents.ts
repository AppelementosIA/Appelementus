import { readFile } from "node:fs/promises";
import type { ReportGeneratedData, ReportSectionImage } from "@elementus/shared";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { sanitizeFileName } from "./microsoft-graph.js";

interface ReportProjectSnapshot {
  client_name?: string | null;
  enterprise?: string | null;
  name?: string | null;
}

interface ReportTemplateSnapshot {
  name?: string | null;
  template_url?: string | null;
}

export interface ReportDocumentSource {
  id: string;
  title: string;
  report_number: string;
  type: string;
  generated_at?: string | null;
  approved_by?: string | null;
  updated_at: string;
  generated_data?: ReportGeneratedData;
  projects?: ReportProjectSnapshot | null;
  report_templates?: ReportTemplateSnapshot | null;
}

export interface ReportAttachmentUpload {
  id: string;
  sectionId: string;
  sectionNumber: string;
  sectionTitle: string;
  fileName: string;
  caption: string;
  mimeType: string;
  buffer: Buffer;
}

interface TemplateData {
  cliente_nome?: string;
  empreendimento?: string;
  condicionante?: string;
  periodo?: string;
  numero_relatorio?: string;
  data_emissao?: string;
  responsavel_tecnico?: string;
  apresentacao?: string;
  objetivo?: string;
  materiais_metodos?: string;
  atividades_realizadas?: string;
  resultados?: string;
  conclusao?: string;
  referencias?: string;
  signatarios?: Array<{
    nome: string;
    cargo?: string;
    registro?: string;
  }>;
  figuras?: Array<{
    titulo: string;
    legenda: string;
  }>;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDateLabel(dateValue?: string | null) {
  const date = dateValue ? new Date(dateValue) : new Date();
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function buildParagraphXml(text: string, options?: { bold?: boolean }) {
  const normalized = text.trim();
  const value = normalized.length > 0 ? normalized : " ";
  const runProperties = options?.bold ? "<w:rPr><w:b/></w:rPr>" : "";

  return `<w:p><w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(
    value
  )}</w:t></w:r></w:p>`;
}

function buildMultilineParagraphs(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => buildParagraphXml(line))
    .join("");
}

function buildSectionLookup(report: ReportDocumentSource) {
  const sections = report.generated_data?.sections ?? [];

  return new Map(
    sections.map((section) => [
      section.id || section.key,
      section.content,
    ])
  );
}

function buildTemplateData(report: ReportDocumentSource): TemplateData {
  const sections = buildSectionLookup(report);
  const variables = (report.generated_data?.variables || {}) as Record<string, unknown>;
  const reportSigners = Array.isArray(variables.report_signers)
    ? (variables.report_signers as Array<Record<string, unknown>>)
    : [];
  const photosSection = report.generated_data?.sections.find(
    (section) => section.id === "photos" || section.key === "photos"
  );

  return {
    cliente_nome: report.projects?.client_name || "",
    empreendimento: report.projects?.enterprise || "",
    condicionante: report.projects?.name || "",
    periodo: String(variables.period || ""),
    numero_relatorio: report.report_number,
    data_emissao: formatDateLabel(report.generated_at || report.updated_at),
    responsavel_tecnico:
      String(variables.responsible_technical || report.approved_by || "Equipe Elementus"),
    apresentacao: sections.get("presentation"),
    objetivo: sections.get("objective") || sections.get("general") || sections.get("scope"),
    materiais_metodos: sections.get("general"),
    atividades_realizadas: sections.get("activities"),
    resultados: sections.get("results"),
    conclusao: sections.get("conclusion"),
    referencias: sections.get("references"),
    signatarios: reportSigners.map((signer) => {
      const registry = [signer.registry_type, signer.registry_number]
        .filter((value) => typeof value === "string" && value.trim())
        .join(" ");

      return {
        nome: String(signer.name || ""),
        cargo: typeof signer.role === "string" ? signer.role : undefined,
        registro: registry || undefined,
      };
    }),
    figuras:
      photosSection?.images?.map((image) => ({
        titulo: image.name,
        legenda: image.caption,
      })) || [],
  };
}

function buildFallbackDocumentXml(report: ReportDocumentSource) {
  const variables = (report.generated_data?.variables || {}) as Record<string, unknown>;
  const reportSigners = Array.isArray(variables.report_signers)
    ? (variables.report_signers as Array<Record<string, unknown>>)
    : [];
  const sections = report.generated_data?.sections ?? [];
  const paragraphs: string[] = [];

  paragraphs.push(buildParagraphXml(report.title || "Relatorio Elementus", { bold: true }));
  paragraphs.push(buildParagraphXml(`Numero do relatorio: ${report.report_number}`));
  paragraphs.push(buildParagraphXml(`Cliente: ${report.projects?.client_name || "Nao informado"}`));
  paragraphs.push(buildParagraphXml(`Projeto: ${report.projects?.name || "Nao informado"}`));
  paragraphs.push(
    buildParagraphXml(`Empreendimento: ${report.projects?.enterprise || "Nao informado"}`)
  );
  paragraphs.push(buildParagraphXml(`Periodo: ${String(variables.period || "Nao informado")}`));
  paragraphs.push(
    buildParagraphXml(
      `Responsavel tecnico: ${String(
        variables.responsible_technical || report.approved_by || "Equipe Elementus"
      )}`
    )
  );
  if (reportSigners.length > 0) {
    paragraphs.push(buildParagraphXml("Assinaturas selecionadas:", { bold: true }));

    for (const signer of reportSigners) {
      const registry = [signer.registry_type, signer.registry_number]
        .filter((value) => typeof value === "string" && value.trim())
        .join(" ");
      const role = typeof signer.role === "string" && signer.role.trim() ? ` - ${signer.role}` : "";
      const registryLabel = registry ? ` (${registry})` : "";

      paragraphs.push(buildParagraphXml(`- ${String(signer.name || "Signatario")}${role}${registryLabel}`));
    }
  }
  paragraphs.push(buildParagraphXml(`Data de emissao: ${formatDateLabel(report.updated_at)}`));
  paragraphs.push(buildParagraphXml(" "));

  for (const section of sections) {
    paragraphs.push(
      buildParagraphXml(
        `${section.number || ""} ${section.title}`.trim(),
        { bold: true }
      )
    );
    paragraphs.push(buildMultilineParagraphs(section.content));

    if (section.images && section.images.length > 0) {
      paragraphs.push(buildParagraphXml("Imagens anexadas:", { bold: true }));

      for (const image of section.images) {
        const imageReference = image.microsoft365_url
          ? `${image.caption} - ${image.microsoft365_url}`
          : `${image.caption} - ${image.name}`;
        paragraphs.push(buildParagraphXml(`- ${imageReference}`));
      }
    }

    paragraphs.push(buildParagraphXml(" "));
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join("")}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838" />
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0" />
    </w:sectPr>
  </w:body>
</w:document>`;
}

function buildCorePropertiesXml(report: ReportDocumentSource) {
  const timestamp = new Date(report.updated_at || new Date().toISOString()).toISOString();

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(report.title)}</dc:title>
  <dc:creator>Elementus Plataforma</dc:creator>
  <cp:lastModifiedBy>Elementus Plataforma</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>
</cp:coreProperties>`;
}

function buildAppPropertiesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Elementus Plataforma</Application>
</Properties>`;
}

function buildMinimalDocxBuffer(report: ReportDocumentSource) {
  const zip = new PizZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="xml" ContentType="application/xml" />
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" />
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml" />
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml" />
</Types>`
  );

  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml" />
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml" />
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml" />
</Relationships>`
  );

  zip.folder("docProps")?.file("core.xml", buildCorePropertiesXml(report));
  zip.folder("docProps")?.file("app.xml", buildAppPropertiesXml());
  zip.folder("word")?.file("document.xml", buildFallbackDocumentXml(report));

  return zip.generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;
}

async function loadTemplateBuffer(templateUrl: string) {
  if (!templateUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(templateUrl)) {
    const response = await fetch(templateUrl);

    if (!response.ok) {
      throw new Error(`Nao foi possivel baixar o template (${response.status}).`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  return readFile(templateUrl);
}

function fillTemplateBuffer(templateBuffer: Buffer, data: TemplateData) {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  });

  doc.render(data);

  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function getExtensionFromMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }
  if (mimeType === "image/gif") {
    return "gif";
  }

  return "bin";
}

function ensureFileExtension(fileName: string, mimeType: string) {
  if (/\.[a-z0-9]+$/i.test(fileName)) {
    return fileName;
  }

  return `${fileName}.${getExtensionFromMimeType(mimeType)}`;
}

function getSafeAttachmentName(sectionNumber: string, image: ReportSectionImage, mimeType: string) {
  const baseName = sanitizeFileName(image.name || image.caption || image.id);
  const sectionPrefix = sectionNumber ? `secao-${sectionNumber}-` : "";
  return ensureFileExtension(`${sectionPrefix}${baseName}`, mimeType);
}

export function extractReportAttachments(report: ReportDocumentSource) {
  const attachments: ReportAttachmentUpload[] = [];

  for (const section of report.generated_data?.sections || []) {
    for (const image of section.images || []) {
      if (!image.preview_url) {
        continue;
      }

      const parsed = parseDataUrl(image.preview_url);

      if (!parsed) {
        continue;
      }

      attachments.push({
        id: image.id,
        sectionId: section.id || section.key,
        sectionNumber: section.number || "",
        sectionTitle: section.title,
        fileName: getSafeAttachmentName(section.number || "", image, parsed.mimeType),
        caption: image.caption,
        mimeType: parsed.mimeType,
        buffer: parsed.buffer,
      });
    }
  }

  return attachments;
}

export async function buildReportDocxBuffer(report: ReportDocumentSource) {
  const templateUrl = report.report_templates?.template_url;

  if (templateUrl) {
    try {
      const templateBuffer = await loadTemplateBuffer(templateUrl);

      if (templateBuffer) {
        return fillTemplateBuffer(templateBuffer, buildTemplateData(report));
      }
    } catch {
      // fallback below when the template is not available or compatible
    }
  }

  return buildMinimalDocxBuffer(report);
}

export function buildReportDocxFileName(report: ReportDocumentSource) {
  const baseName = sanitizeFileName(report.report_number || report.title || "relatorio-elementus");
  return `${baseName || "relatorio-elementus"}.docx`;
}
