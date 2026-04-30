import { Buffer } from "node:buffer";
import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { config } from "../lib/config.js";

const router: import("express").Router = Router();

const generateLocationMapSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  title: z.string().trim().optional(),
  source: z.enum(["whatsapp", "project", "manual"]).optional(),
  capturedAt: z.string().trim().optional(),
  contextLabel: z.string().trim().optional(),
});

const locationSheetQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  title: z.string().trim().optional(),
  addressLabel: z.string().trim().optional(),
  source: z.enum(["whatsapp", "project", "manual"]).optional(),
  capturedAt: z.string().trim().optional(),
});

type ReverseGeocodeResult = {
  display_name?: string;
  address?: Record<string, string>;
  licence?: string;
  osm_type?: string;
  osm_id?: number;
};

type MapTile = {
  href: string;
  x: number;
  y: number;
};

type StaticMapProvider = "mapbox" | "maptiler" | "openstreetmap-tiles";

function formatCoordinate(value: number, axis: "latitude" | "longitude") {
  const hemisphere =
    axis === "latitude"
      ? value >= 0
        ? "N"
        : "S"
      : value >= 0
      ? "E"
      : "W";

  return `${Math.abs(value).toFixed(6)}° ${hemisphere}`;
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapSvgText(value: string, maxChars: number, maxLines: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length <= maxChars) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;

    if (lines.length >= maxLines) {
      break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  if (words.join(" ").length > lines.join(" ").length && lines.length > 0) {
    const lastIndex = lines.length - 1;
    lines[lastIndex] =
      lines[lastIndex].length > maxChars - 1
        ? `${lines[lastIndex].slice(0, Math.max(0, maxChars - 1)).trim()}...`
        : `${lines[lastIndex]}...`;
  }

  return lines.length ? lines : [value];
}

function renderSvgTextLines(lines: string[], x: number, firstY: number, lineHeight: number) {
  return lines
    .map((line, index) => `<tspan x="${x}" y="${firstY + index * lineHeight}">${escapeSvgText(line)}</tspan>`)
    .join("");
}

function buildOsmMapLink(latitude: number, longitude: number, zoom = 17) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${zoom}/${latitude}/${longitude}`;
}

function buildMapboxStaticMapUrl(latitude: number, longitude: number) {
  if (!config.maps.mapboxAccessToken) {
    return null;
  }

  const stylePath = (config.maps.mapboxStyleId || "mapbox/streets-v12")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const marker = `pin-l+ef4444(${longitude},${latitude})`;
  const params = new URLSearchParams({
    access_token: config.maps.mapboxAccessToken,
    attribution: "false",
    logo: "false",
  });

  return `https://api.mapbox.com/styles/v1/${stylePath}/static/${marker}/${longitude},${latitude},16,0/860x560?${params.toString()}`;
}

function buildMapTilerStaticMapUrl(latitude: number, longitude: number) {
  if (!config.maps.mapTilerApiKey) {
    return null;
  }

  const mapId = config.maps.mapTilerMapId || "satellite";
  const marker = `${longitude},${latitude},Ponto informado`;
  const params = new URLSearchParams({
    key: config.maps.mapTilerApiKey,
    markers: marker,
    attribution: "bottomright",
  });

  return `https://api.maptiler.com/maps/${encodeURIComponent(
    mapId
  )}/static/${longitude},${latitude},17/860x560.png?${params.toString()}`;
}

function buildStaticMapUrl(latitude: number, longitude: number) {
  const mapboxUrl = buildMapboxStaticMapUrl(latitude, longitude);
  if (mapboxUrl) {
    return { provider: "mapbox" as const, url: mapboxUrl };
  }

  const mapTilerUrl = buildMapTilerStaticMapUrl(latitude, longitude);
  if (mapTilerUrl) {
    return { provider: "maptiler" as const, url: mapTilerUrl };
  }

  return { provider: "openstreetmap-tiles" as const, url: null };
}

function getMapAttribution(provider: StaticMapProvider) {
  if (provider === "mapbox") {
    return "© Mapbox © OpenStreetMap contributors";
  }

  if (provider === "maptiler") {
    return "© MapTiler © OpenStreetMap contributors";
  }

  return "© OpenStreetMap contributors";
}

function pickAddressLabel(reverse: ReverseGeocodeResult | null, fallback: string) {
  if (reverse?.display_name?.trim()) {
    return reverse.display_name.trim();
  }

  return fallback;
}

function getMapSourceLabel(source?: "whatsapp" | "project" | "manual") {
  return source === "project"
    ? "Coordenada cadastrada no projeto"
    : source === "manual"
    ? "Coordenada informada manualmente"
    : "Coordenada compartilhada pelo WhatsApp";
}

function getRequestBaseUrl(req: Request) {
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || req.protocol || "https";
  const host = req.get("host") || "appelementus-api.vercel.app";

  return `${protocol}://${host}`;
}

function buildLocationSheetUrl(
  req: Request,
  input: {
    latitude: number;
    longitude: number;
    title: string;
    addressLabel: string;
    source?: "whatsapp" | "project" | "manual";
    capturedAt?: string;
  }
) {
  const params = new URLSearchParams({
    latitude: String(input.latitude),
    longitude: String(input.longitude),
    title: input.title,
    addressLabel: input.addressLabel,
    source: input.source || "whatsapp",
    sheetVersion: "20260429-v2",
  });

  if (input.capturedAt) {
    params.set("capturedAt", input.capturedAt);
  }

  return `${getRequestBaseUrl(req)}/api/maps/location-sheet.svg?${params.toString()}`;
}

async function fetchImageAsDataUrl(url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      "User-Agent": config.maps.userAgent,
      Referer: "https://relatoriosapp.appelementus.com.br",
    },
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`Static map failed with status ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());

  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

function longitudeToTileX(longitude: number, zoom: number) {
  return ((longitude + 180) / 360) * 2 ** zoom;
}

function latitudeToTileY(latitude: number, zoom: number) {
  const latitudeRadians = (latitude * Math.PI) / 180;

  return (
    ((1 -
      Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) /
      2) *
    2 ** zoom
  );
}

async function fetchOsmTilesAsDataUrls(latitude: number, longitude: number, zoom = 17) {
  const tileSize = 256;
  const mapWidth = 860;
  const mapHeight = 560;
  const centerTileX = longitudeToTileX(longitude, zoom);
  const centerTileY = latitudeToTileY(latitude, zoom);
  const centerPixelX = centerTileX * tileSize;
  const centerPixelY = centerTileY * tileSize;
  const leftPixel = centerPixelX - mapWidth / 2;
  const topPixel = centerPixelY - mapHeight / 2;
  const firstTileX = Math.floor(leftPixel / tileSize);
  const lastTileX = Math.floor((leftPixel + mapWidth) / tileSize);
  const firstTileY = Math.floor(topPixel / tileSize);
  const lastTileY = Math.floor((topPixel + mapHeight) / tileSize);
  const maxTile = 2 ** zoom;
  const tileRequests: Array<Promise<MapTile>> = [];

  for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
    for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
      if (tileY < 0 || tileY >= maxTile) {
        continue;
      }

      const wrappedTileX = ((tileX % maxTile) + maxTile) % maxTile;
      const url = `https://tile.openstreetmap.org/${zoom}/${wrappedTileX}/${tileY}.png`;
      tileRequests.push(
        fetchImageAsDataUrl(url).then((href) => ({
          href,
          x: tileX * tileSize - leftPixel,
          y: tileY * tileSize - topPixel,
        }))
      );
    }
  }

  return Promise.all(tileRequests);
}

function buildProfessionalMapSheet(input: {
  title: string;
  addressLabel: string;
  latitude: number;
  longitude: number;
  capturedAt?: string;
  datum: string;
  projection: string;
  scaleLabel: string;
  sourceLabel: string;
  attribution: string;
  mapImageDataUrl?: string;
  mapTiles?: MapTile[];
}) {
  const title = escapeSvgText(input.title);
  const addressLines = wrapSvgText(input.addressLabel, 112, 2);
  const coordinatePair = escapeSvgText(
    `${formatCoordinate(input.latitude, "latitude")} / ${formatCoordinate(input.longitude, "longitude")}`
  );
  const decimalPair = escapeSvgText(`${input.latitude.toFixed(6)}, ${input.longitude.toFixed(6)}`);
  const capturedAt = input.capturedAt
    ? escapeSvgText(new Date(input.capturedAt).toLocaleString("pt-BR"))
    : "Não informado";
  const datum = escapeSvgText(input.datum);
  const projection = escapeSvgText(input.projection);
  const scaleLabel = escapeSvgText(input.scaleLabel);
  const sourceLines = wrapSvgText(input.sourceLabel, 34, 2);
  const attributionLines = wrapSvgText(input.attribution, 34, 2);
  const footerLines = wrapSvgText(
    "* Escala gráfica aproximada para referência visual. Confirmar escala oficial quando o órgão licenciador exigir prancha georreferenciada em padrão específico.",
    160,
    2
  );
  const mapContent = input.mapImageDataUrl
    ? `<image href="${input.mapImageDataUrl}" x="0" y="0" width="860" height="560" preserveAspectRatio="xMidYMid slice"/>`
    : (input.mapTiles || [])
        .map(
          (tile) =>
            `<image href="${tile.href}" x="${tile.x.toFixed(2)}" y="${tile.y.toFixed(
              2
            )}" width="256" height="256" preserveAspectRatio="none"/>`
        )
        .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900" role="img" aria-label="${title}">
  <defs>
    <clipPath id="mapClip">
      <rect x="0" y="0" width="860" height="560" rx="10"/>
    </clipPath>
  </defs>
  <rect width="1400" height="900" fill="#f8fafc"/>
  <rect x="32" y="28" width="1336" height="832" rx="18" fill="#ffffff" stroke="#1f4f78" stroke-width="2"/>

  <g transform="translate(64 62)">
    <text x="0" y="0" fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700">${title}</text>
    <text fill="#475569" font-family="Arial, Helvetica, sans-serif" font-size="16">${renderSvgTextLines(addressLines, 0, 34, 21)}</text>
    <text x="0" y="${addressLines.length > 1 ? 82 : 62}" fill="#1f4f78" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700">Coordenadas: ${coordinatePair}</text>
  </g>

  <g transform="translate(64 160)">
    <rect x="0" y="0" width="860" height="560" rx="10" fill="#e2e8f0" stroke="#0f3554" stroke-width="2"/>
    <g clip-path="url(#mapClip)">${mapContent}</g>
    <rect x="0" y="0" width="860" height="560" rx="10" fill="none" stroke="#0f3554" stroke-width="2"/>

    <g transform="translate(430 280)" aria-label="Marcador da coordenada informada">
      <circle cx="0" cy="0" r="14" fill="#ef4444" stroke="#ffffff" stroke-width="3"/>
      <circle cx="0" cy="0" r="5" fill="#ffffff"/>
    </g>

    <g transform="translate(458 230)">
      <rect x="0" y="0" width="238" height="58" rx="8" fill="#ffffff" opacity="0.94" stroke="#94a3b8"/>
      <circle cx="22" cy="24" r="7" fill="#ef4444" stroke="#7f1d1d" stroke-width="2"/>
      <text x="40" y="22" fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700">Ponto informado</text>
      <text x="40" y="40" fill="#475569" font-family="Arial, Helvetica, sans-serif" font-size="11">${decimalPair}</text>
    </g>

    <g transform="translate(36 34)">
      <rect x="-14" y="-16" width="82" height="120" rx="10" fill="#ffffff" opacity="0.92" stroke="#cbd5e1"/>
      <path d="M27 0 L46 66 L27 52 L8 66 Z" fill="#0f3554"/>
      <text x="20" y="94" fill="#0f3554" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700">N</text>
    </g>

    <g transform="translate(34 492)">
      <rect x="0" y="0" width="262" height="42" rx="7" fill="#ffffff" opacity="0.94" stroke="#94a3b8"/>
      <rect x="18" y="14" width="66" height="10" fill="#0f3554"/>
      <rect x="84" y="14" width="66" height="10" fill="#ffffff" stroke="#0f3554"/>
      <rect x="150" y="14" width="66" height="10" fill="#0f3554"/>
      <text x="18" y="35" fill="#334155" font-family="Arial, Helvetica, sans-serif" font-size="11">0</text>
      <text x="78" y="35" fill="#334155" font-family="Arial, Helvetica, sans-serif" font-size="11">50</text>
      <text x="143" y="35" fill="#334155" font-family="Arial, Helvetica, sans-serif" font-size="11">100 m</text>
      <text x="224" y="25" fill="#334155" font-family="Arial, Helvetica, sans-serif" font-size="10">*</text>
    </g>

    <g transform="translate(614 502)">
      <rect x="0" y="0" width="218" height="32" rx="8" fill="#ffffff" opacity="0.90" stroke="#94a3b8"/>
      <circle cx="19" cy="16" r="7" fill="#ef4444" stroke="#7f1d1d" stroke-width="2"/>
      <text x="34" y="20" fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700">Marcador central da coordenada</text>
    </g>
  </g>

  <g transform="translate(960 160)">
    <rect x="0" y="0" width="360" height="560" rx="12" fill="#ffffff" stroke="#cbd5e1"/>
    <text x="24" y="42" fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700">Quadro técnico</text>
    <line x1="24" y1="60" x2="336" y2="60" stroke="#cbd5e1"/>

    <text x="24" y="100" fill="#64748b" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700">SISTEMA DE REFERÊNCIA</text>
    <text x="24" y="126" fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="15">${datum}</text>
    <text x="24" y="151" fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="15">${projection}</text>

    <text x="24" y="198" fill="#64748b" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700">COORDENADAS GEOGRÁFICAS</text>
    <text x="24" y="225" fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="15">Lat: ${escapeSvgText(formatCoordinate(input.latitude, "latitude"))}</text>
    <text x="24" y="251" fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="15">Long: ${escapeSvgText(formatCoordinate(input.longitude, "longitude"))}</text>

    <text x="24" y="298" fill="#64748b" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700">ESCALA</text>
    <text x="24" y="324" fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="15">${scaleLabel}</text>

    <text x="24" y="371" fill="#64748b" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700">FONTE</text>
    <text fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="14">${renderSvgTextLines(sourceLines, 24, 397, 19)}</text>
    <text x="24" y="${sourceLines.length > 1 ? 440 : 422}" fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="14">Captura: ${capturedAt}</text>

    <text x="24" y="469" fill="#64748b" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700">ATRIBUIÇÃO</text>
    <text fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="13">${renderSvgTextLines(attributionLines, 24, 494, 18)}</text>

    <rect x="24" y="520" width="312" height="24" rx="6" fill="#eff6ff" stroke="#bfdbfe"/>
    <text x="38" y="537" fill="#1f4f78" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700">Peça técnica gerada por coordenada real</text>
  </g>

  <text fill="#64748b" font-family="Arial, Helvetica, sans-serif" font-size="12">${renderSvgTextLines(footerLines, 64, 790, 18)}</text>
</svg>`;
}

async function reverseGeocode(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: "jsonv2",
    addressdetails: "1",
    zoom: "18",
    "accept-language": "pt-BR,pt,en",
  });

  const response = await fetch(`${config.maps.nominatimBaseUrl}/reverse?${params.toString()}`, {
    headers: {
      "User-Agent": config.maps.userAgent,
      Referer: "https://relatoriosapp.appelementus.com.br",
    },
  });

  if (!response.ok) {
    throw new Error(`Reverse geocoding failed with status ${response.status}`);
  }

  return (await response.json()) as ReverseGeocodeResult;
}

router.get("/location-sheet.svg", async (req, res) => {
  const parsed = locationSheetQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).type("text/plain").send("Coordenadas inválidas para geração de mapa.");
    return;
  }

  const input = parsed.data;
  const title = input.title || "Mapa de localização do atendimento";
  const addressLabel = input.addressLabel || getMapSourceLabel(input.source);
  const datum = "SIRGAS 2000";
  const projection = "EPSG:4674 - Coordenadas geográficas";
  const scaleLabel = "Escala gráfica aproximada sobre base cartográfica real";
  const staticMap = buildStaticMapUrl(input.latitude, input.longitude);
  const provider = staticMap.provider;
  const attribution = getMapAttribution(provider);

  let mapImageDataUrl: string | undefined;
  let mapTiles: MapTile[] | undefined;

  try {
    mapImageDataUrl = staticMap.url ? await fetchImageAsDataUrl(staticMap.url) : undefined;
    mapTiles = staticMap.url
      ? undefined
      : await fetchOsmTilesAsDataUrls(input.latitude, input.longitude);
  } catch (error) {
    console.warn("Map tiles unavailable for SVG sheet", error);
    mapTiles = [];
  }

  const svg = buildProfessionalMapSheet({
    title,
    addressLabel,
    latitude: input.latitude,
    longitude: input.longitude,
    capturedAt: input.capturedAt,
    datum,
    projection,
    scaleLabel,
    sourceLabel: getMapSourceLabel(input.source),
    attribution,
    mapImageDataUrl,
    mapTiles,
  });

  res
    .status(200)
    .setHeader("Content-Type", "image/svg+xml; charset=utf-8")
    .setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400")
    .send(svg);
});

router.post("/location", async (req, res) => {
  const parsed = generateLocationMapSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Coordenadas inválidas para geração de mapa.",
      details: parsed.error.flatten(),
    });
    return;
  }

  const input = parsed.data;
  const fallbackLabel =
    input.source === "project"
      ? input.contextLabel || "Coordenada cadastrada no projeto"
      : "Coordenada enviada pelo WhatsApp";

  let reverse: ReverseGeocodeResult | null = null;
  let reverseGeocodingStatus: "ok" | "failed" = "ok";

  try {
    reverse = await reverseGeocode(input.latitude, input.longitude);
  } catch (error) {
    reverseGeocodingStatus = "failed";
    console.warn("Reverse geocoding unavailable", error);
  }

  const staticMap = buildStaticMapUrl(input.latitude, input.longitude);
  const provider = staticMap.provider;
  const baseMapUrl = staticMap.url || buildOsmMapLink(input.latitude, input.longitude);
  const attribution = getMapAttribution(provider);
  const title = input.title || "Mapa de localização do atendimento";
  const addressLabel = pickAddressLabel(reverse, fallbackLabel);
  const datum = "SIRGAS 2000";
  const projection = "EPSG:4674 - Coordenadas geográficas";
  const scaleLabel = "Escala gráfica aproximada sobre base cartográfica real";
  const staticMapUrl = buildLocationSheetUrl(req, {
    latitude: input.latitude,
    longitude: input.longitude,
    title,
    addressLabel,
    source: input.source || "whatsapp",
    capturedAt: input.capturedAt,
  });
  const sheetStatus: "ok" | "failed" = "ok";

  res.json({
    id: `location-map-${input.latitude.toFixed(6)}-${input.longitude.toFixed(6)}`,
    title,
    addressLabel,
    coordinates: {
      latitude: input.latitude,
      longitude: input.longitude,
      formattedLatitude: formatCoordinate(input.latitude, "latitude"),
      formattedLongitude: formatCoordinate(input.longitude, "longitude"),
    },
    datum,
    projection,
    scaleLabel,
    source: input.source || "whatsapp",
    capturedAt: input.capturedAt,
    staticMapUrl,
    staticMapStoragePath: null,
    staticMapBucket: null,
    inlineStaticMapUrl: null,
    baseMapUrl,
    provider,
    reverseGeocodingStatus,
    sheetStatus,
    attribution,
    notes: [
      "Mapa gerado a partir da latitude e longitude recebidas, sem reaproveitar endereço do cadastro do cliente.",
      reverseGeocodingStatus === "ok"
        ? "Endereço aproximado obtido por geocodificação reversa."
        : "Geocodificação reversa indisponível no momento; validar o endereço textual antes da emissão.",
      sheetStatus === "ok"
        ? "Prancha técnica montada com base cartográfica real, seta norte, escala gráfica e quadro de coordenadas."
        : "Base cartográfica real disponível; montagem da prancha técnica deve ser repetida antes da emissão.",
      "Validar escala e base cartográfica quando o órgão licenciador exigir peça georreferenciada específica.",
    ],
  });
});

export default router;
