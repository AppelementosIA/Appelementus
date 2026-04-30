import Docxtemplater from "docxtemplater";
import ImageModuleImport from "docxtemplater-image-module-free";
import PizZip from "pizzip";
import { config } from "./config.js";

type ImagePayload = {
  buffer?: Buffer | { type: "Buffer"; data: number[] };
  base64?: string;
  data?: string;
  mimeType?: string;
  width?: number;
  height?: number;
};

type TemplateRenderInput = {
  templateUrl: string;
  data: Record<string, unknown>;
};

type TemplateRenderResult = {
  buffer: Buffer;
  source: string;
};

type ImageRegistry = Map<string, ImagePayload>;

function encodeObjectPath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function isSupabaseStorageObjectUrl(url: string) {
  return url.includes("/storage/v1/object/");
}

function withSupabaseAuthHeaders(url: string): Record<string, string> {
  if (!isSupabaseStorageObjectUrl(url) || !config.supabase.serviceRoleKey) {
    return {};
  }

  return {
    apikey: config.supabase.serviceRoleKey,
    Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
  };
}

async function fetchBuffer(url: string) {
  const response = await fetch(url, {
    headers: withSupabaseAuthHeaders(url),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Nao foi possivel baixar o template (${response.status}): ${detail}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function imagePayloadToBuffer(value: ImagePayload | null | undefined) {
  if (!value) {
    return Buffer.alloc(0);
  }

  if (Buffer.isBuffer(value.buffer)) {
    return value.buffer;
  }

  if (
    value.buffer &&
    typeof value.buffer === "object" &&
    "type" in value.buffer &&
    value.buffer.type === "Buffer" &&
    "data" in value.buffer &&
    Array.isArray(value.buffer.data)
  ) {
    return Buffer.from(value.buffer.data as number[]);
  }

  if (value.base64) {
    return Buffer.from(value.base64, "base64");
  }

  if (value.data) {
    const dataUrlMatch = value.data.match(/^data:[^;]+;base64,(.+)$/);
    return Buffer.from(dataUrlMatch?.[1] || value.data, "base64");
  }

  return Buffer.alloc(0);
}

function imageExtensionFromPayload(value: ImagePayload | undefined, buffer: Buffer) {
  const mimeType = String(value?.mimeType || "").toLowerCase();
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpeg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("webp")) return "webp";

  if (buffer.length >= 4) {
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpeg";
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return "png";
    }
    if (buffer.toString("ascii", 0, 3) === "GIF") return "gif";
    if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
      return "webp";
    }
  }

  return "png";
}

function imageSizeFromPayload(value: unknown, tagName?: string): [number, number] {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const width = Number(record.width);
  const height = Number(record.height);

  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return [Math.round(width), Math.round(height)];
  }

  if (tagName === "assinatura") {
    return [260, 95];
  }

  if (tagName === "mapa_localizacao") {
    return [520, 520];
  }

  return [520, 340];
}

function isImagePayload(value: Record<string, unknown>) {
  return (
    Buffer.isBuffer(value.buffer) ||
    typeof value.base64 === "string" ||
    typeof value.data === "string" ||
    (value.buffer &&
      typeof value.buffer === "object" &&
      !Array.isArray(value.buffer) &&
      (value.buffer as Record<string, unknown>).type === "Buffer" &&
      Array.isArray((value.buffer as Record<string, unknown>).data))
  );
}

function registerImagePayload(value: ImagePayload, registry: ImageRegistry) {
  const id = `__elementus_image_${registry.size + 1}__`;
  registry.set(id, value);
  return id;
}

function normalizeTemplateData(value: unknown, registry: ImageRegistry): unknown {
  if (Buffer.isBuffer(value)) {
    return registerImagePayload({
      base64: value.toString("base64"),
    }, registry);
  }

  if (Array.isArray(value)) {
    return value.map((child) => normalizeTemplateData(child, registry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  if (record.type === "Buffer" && Array.isArray(record.data)) {
    return registerImagePayload({
      base64: Buffer.from(record.data as number[]).toString("base64"),
    }, registry);
  }

  if (isImagePayload(record)) {
    const normalized: ImagePayload = {
      mimeType:
        typeof record.mimeType === "string"
          ? record.mimeType
          : typeof record.mime_type === "string"
            ? record.mime_type
            : undefined,
      width: Number.isFinite(Number(record.width)) ? Number(record.width) : undefined,
      height: Number.isFinite(Number(record.height)) ? Number(record.height) : undefined,
    };

    if (Buffer.isBuffer(record.buffer)) {
      normalized.base64 = record.buffer.toString("base64");
    } else if (
      record.buffer &&
      typeof record.buffer === "object" &&
      !Array.isArray(record.buffer) &&
      (record.buffer as Record<string, unknown>).type === "Buffer" &&
      Array.isArray((record.buffer as Record<string, unknown>).data)
    ) {
      normalized.base64 = Buffer.from(
        (record.buffer as Record<string, number[]>).data
      ).toString("base64");
    } else if (typeof record.base64 === "string") {
      normalized.base64 = record.base64;
    } else if (typeof record.data === "string") {
      normalized.data = record.data;
    }

    return registerImagePayload(normalized, registry);
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    normalized[key] = normalizeTemplateData(child, registry);
  }
  return normalized;
}

export async function renderTemplateDocx(input: TemplateRenderInput): Promise<TemplateRenderResult> {
  if (!input.templateUrl) {
    throw new Error("template_url e obrigatorio para renderizar o modelo Word.");
  }

  const templateBuffer = await fetchBuffer(input.templateUrl);
  const imageRegistry: ImageRegistry = new Map();
  const templateData = normalizeTemplateData(input.data, imageRegistry) as Record<string, unknown>;
  const ImageModule = ImageModuleImport as unknown as typeof ImageModuleImport;
  let nextImageExtension = "png";
  const imageModule = new ImageModule({
    centered: false,
    getImage: (tagValue, tagName) => {
      const payload = imageRegistry.get(String(tagValue));
      const buffer = imagePayloadToBuffer(payload || (tagValue as ImagePayload));
      if (!buffer.length) {
        throw new Error(`Imagem vazia ou invalida no placeholder ${tagName || "desconhecido"}.`);
      }
      nextImageExtension = imageExtensionFromPayload(payload, buffer);
      return buffer;
    },
    getSize: (_image, tagValue, tagName) =>
      imageSizeFromPayload(imageRegistry.get(String(tagValue)) || tagValue, tagName),
  });
  (imageModule as unknown as { getNextImageName: () => string; imageNumber: number }).getNextImageName =
    function getNextImageName(this: { imageNumber: number }) {
      const extension = nextImageExtension || "png";
      const name = `image_generated_${this.imageNumber}.${extension}`;
      this.imageNumber += 1;
      nextImageExtension = "png";
      return name;
    };
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    modules: [imageModule],
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });

  doc.render(templateData);

  return {
    buffer: doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    }) as Buffer,
    source: "elementus-api-template-docxtemplater",
  };
}

export function buildSupabaseObjectUrl(bucket: string, storagePath: string) {
  return `${config.supabase.url.replace(/\/+$/, "")}/storage/v1/object/${bucket}/${encodeObjectPath(storagePath)}`;
}
