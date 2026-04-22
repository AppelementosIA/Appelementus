import { supabase } from "./supabase.js";
import {
  listOmieClientsPage,
  listOmieProjectsPage,
  listOmieServiceContractsPage,
  type OmieClientRecord,
  type OmieProjectRecord,
  type OmieServiceContractRecord,
} from "./omie.js";

type SyncOptions = {
  pageSize?: number;
  maxPages?: number;
};

type SyncResult = {
  synced: number;
  skipped: number;
  pagesProcessed: number;
  totalFromOmie: number;
};

type OmieClientMirrorRow = {
  codigo_cliente_omie: number;
  codigo_cliente_integracao: string | null;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  representante_nome: string | null;
  representante_cpf: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  raw_omie_payload: Record<string, unknown>;
  synced_at: string;
};

type OmieProjectMirrorRow = {
  codigo_projeto_omie: number;
  codigo_integracao: string | null;
  client_id: string;
  nome: string;
  empreendimento_nome: string | null;
  empreendimento_endereco: string | null;
  empreendimento_cidade: string | null;
  empreendimento_estado: string | null;
  latitude: number | null;
  longitude: number | null;
  utm_easting: number | null;
  utm_northing: number | null;
  utm_zone: string | null;
  utm_datum: string | null;
  numero_contrato: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
  raw_omie_payload: Record<string, unknown>;
  synced_at: string;
};

function toNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function toNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");

    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function toIsoDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function chunkItems<TItem>(items: TItem[], size: number) {
  const chunks: TItem[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function buildPhone(
  ddd: unknown,
  number: unknown,
  fallbackKeys: Array<unknown> = []
) {
  const parts = [
    toNullableString(ddd),
    toNullableString(number),
    ...fallbackKeys.map(toNullableString),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : null;
}

function buildAddress(client: OmieClientRecord) {
  const parts = [
    toNullableString(client.endereco),
    toNullableString(client.endereco_numero),
    toNullableString(client.complemento),
    toNullableString(client.bairro),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

function extractContractDepartmentNames(contract: OmieServiceContractRecord) {
  const departments = Array.isArray(contract.departamentos) ? contract.departamentos : [];
  const names = departments
    .map((department) => {
      const description = toNullableString(department.cDesDep);
      if (description) {
        return description;
      }

      return toNullableString(department.cCodDep);
    })
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(names));
}

function mapContractStatus(statusCode: unknown) {
  switch (toNullableString(statusCode)) {
    case "10":
      return "active";
    case "30":
      return "finished";
    case "40":
      return "cancelled";
    default:
      return "active";
  }
}

function buildContractProjectName(
  contract: OmieServiceContractRecord,
  codigoContrato: number
) {
  const header = (contract.cabecalho as Record<string, unknown> | undefined) ?? {};
  const additional = (contract.infAdic as Record<string, unknown> | undefined) ?? {};
  const contractNumber = toNullableString(header.cNumCtr);
  const departmentNames = extractContractDepartmentNames(contract);
  const serviceCity = toNullableString(additional.cCidPrestServ);

  const baseName = contractNumber || `Contrato ${codigoContrato}`;
  const descriptors = [...departmentNames];

  if (serviceCity) {
    descriptors.push(serviceCity);
  }

  if (descriptors.length === 0) {
    return baseName;
  }

  return `${baseName} - ${descriptors.join(" / ")}`;
}

function mapOmieClient(client: OmieClientRecord, syncedAt: string): OmieClientMirrorRow | null {
  const codigoCliente = toNullableNumber(client.codigo_cliente_omie);
  const razaoSocial =
    toNullableString(client.razao_social) ||
    toNullableString(client.nome_fantasia);

  if (!codigoCliente || !razaoSocial) {
    return null;
  }

  const info = (client.info as Record<string, unknown> | undefined) ?? {};

  return {
    codigo_cliente_omie: codigoCliente,
    codigo_cliente_integracao: toNullableString(client.codigo_cliente_integracao),
    razao_social: razaoSocial,
    nome_fantasia: toNullableString(client.nome_fantasia),
    cnpj: toNullableString(client.cnpj_cpf),
    endereco: buildAddress(client),
    cidade: toNullableString(client.cidade),
    estado: toNullableString(client.estado),
    cep: toNullableString(client.cep),
    telefone: buildPhone(client.telefone1_ddd, client.telefone1_numero, [
      client.telefone2_ddd,
      client.telefone2_numero,
    ]),
    email: toNullableString(client.email),
    representante_nome:
      toNullableString(client.representante_nome) ||
      toNullableString(info.representante_nome),
    representante_cpf:
      toNullableString(client.representante_cpf) ||
      toNullableString(info.representante_cpf),
    contato_nome: toNullableString(client.contato_nome),
    contato_telefone: buildPhone(client.contato_ddd, client.contato_numero),
    contato_email: toNullableString(client.contato_email),
    raw_omie_payload: client,
    synced_at: syncedAt,
  };
}

async function upsertClientBatch(batch: OmieClientMirrorRow[]) {
  const { error } = await supabase
    .from("omie_clients_mirror")
    .upsert(batch, {
      onConflict: "codigo_cliente_omie",
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(error.message);
  }
}

function resolveProjectClientCode(project: OmieProjectRecord) {
  const numericCandidates = [
    project.codigo_cliente_omie,
    project.codigo_cliente,
    project.cliente_codigo_omie,
    project.cliente_codigo,
  ];

  for (const candidate of numericCandidates) {
    const parsed = toNullableNumber(candidate);

    if (parsed) {
      return {
        by: "omie_code" as const,
        value: parsed,
      };
    }
  }

  const integrationCandidates = [
    project.codigo_cliente_integracao,
    project.cliente_codigo_integracao,
  ];

  for (const candidate of integrationCandidates) {
    const parsed = toNullableString(candidate);

    if (parsed) {
      return {
        by: "integration_code" as const,
        value: parsed,
      };
    }
  }

  return null;
}

async function loadClientLookup(projects: OmieProjectRecord[]) {
  const omieCodes = new Set<number>();
  const integrationCodes = new Set<string>();

  for (const project of projects) {
    const resolved = resolveProjectClientCode(project);

    if (!resolved) {
      continue;
    }

    if (resolved.by === "omie_code") {
      omieCodes.add(resolved.value as number);
    } else {
      integrationCodes.add(resolved.value as string);
    }
  }

  const lookup = new Map<string, string>();

  if (omieCodes.size > 0) {
    const { data, error } = await supabase
      .from("omie_clients_mirror")
      .select("id, codigo_cliente_omie")
      .in("codigo_cliente_omie", Array.from(omieCodes));

    if (error) {
      throw new Error(error.message);
    }

    for (const row of data || []) {
      lookup.set(`omie_code:${row.codigo_cliente_omie}`, row.id);
    }
  }

  if (integrationCodes.size > 0) {
    const { data, error } = await supabase
      .from("omie_clients_mirror")
      .select("id, codigo_cliente_integracao")
      .in("codigo_cliente_integracao", Array.from(integrationCodes));

    if (error) {
      throw new Error(error.message);
    }

    for (const row of data || []) {
      if (row.codigo_cliente_integracao) {
        lookup.set(`integration_code:${row.codigo_cliente_integracao}`, row.id);
      }
    }
  }

  return lookup;
}

async function loadClientLookupByOmieCodes(clientCodes: number[]) {
  const uniqueCodes = Array.from(new Set(clientCodes));
  const lookup = new Map<string, string>();

  if (uniqueCodes.length === 0) {
    return lookup;
  }

  const { data, error } = await supabase
    .from("omie_clients_mirror")
    .select("id, codigo_cliente_omie")
    .in("codigo_cliente_omie", uniqueCodes);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data || []) {
    lookup.set(`omie_code:${row.codigo_cliente_omie}`, row.id);
  }

  return lookup;
}

function mapOmieProject(
  project: OmieProjectRecord,
  clientLookup: Map<string, string>,
  syncedAt: string
): OmieProjectMirrorRow | null {
  const codigoProjeto = toNullableNumber(project.codigo);
  const nome = toNullableString(project.nome);
  const resolvedClient = resolveProjectClientCode(project);

  if (!codigoProjeto || !nome || !resolvedClient) {
    return null;
  }

  const clientId = clientLookup.get(`${resolvedClient.by}:${resolvedClient.value}`);

  if (!clientId) {
    return null;
  }

  return {
    codigo_projeto_omie: codigoProjeto,
    codigo_integracao: toNullableString(project.codInt),
    client_id: clientId,
    nome,
    empreendimento_nome:
      toNullableString(project.empreendimento_nome) ||
      toNullableString(project.nome),
    empreendimento_endereco: toNullableString(project.empreendimento_endereco),
    empreendimento_cidade: toNullableString(project.empreendimento_cidade),
    empreendimento_estado: toNullableString(project.empreendimento_estado),
    latitude: toNullableNumber(project.latitude),
    longitude: toNullableNumber(project.longitude),
    utm_easting: toNullableNumber(project.utm_easting),
    utm_northing: toNullableNumber(project.utm_northing),
    utm_zone: toNullableString(project.utm_zone),
    utm_datum: toNullableString(project.utm_datum) || "SIRGAS 2000",
    numero_contrato: toNullableString(project.numero_contrato),
    data_inicio: toIsoDate(project.data_inicio),
    data_fim: toIsoDate(project.data_fim),
    status: project.inativo === "S" ? "inactive" : "active",
    raw_omie_payload: project,
    synced_at: syncedAt,
  };
}

function mapOmieServiceContractAsProject(
  contract: OmieServiceContractRecord,
  clientLookup: Map<string, string>,
  syncedAt: string
): OmieProjectMirrorRow | null {
  const header = (contract.cabecalho as Record<string, unknown> | undefined) ?? {};
  const additional = (contract.infAdic as Record<string, unknown> | undefined) ?? {};
  const codigoContrato = toNullableNumber(header.nCodCtr);
  const clientCode = toNullableNumber(header.nCodCli);

  if (!codigoContrato || !clientCode) {
    return null;
  }

  const clientId = clientLookup.get(`omie_code:${clientCode}`);

  if (!clientId) {
    return null;
  }

  const nome = buildContractProjectName(contract, codigoContrato);
  const departmentNames = extractContractDepartmentNames(contract);

  return {
    codigo_projeto_omie: codigoContrato,
    codigo_integracao: toNullableString(header.cCodIntCtr),
    client_id: clientId,
    nome,
    empreendimento_nome: departmentNames[0] || nome,
    empreendimento_endereco: toNullableString(additional.cCodObra),
    empreendimento_cidade: toNullableString(additional.cCidPrestServ),
    empreendimento_estado: null,
    latitude: null,
    longitude: null,
    utm_easting: null,
    utm_northing: null,
    utm_zone: null,
    utm_datum: "SIRGAS 2000",
    numero_contrato: toNullableString(header.cNumCtr),
    data_inicio: toIsoDate(header.dVigInicial),
    data_fim: toIsoDate(header.dVigFinal),
    status: mapContractStatus(header.cCodSit),
    raw_omie_payload: {
      source: "service_contract",
      ...contract,
    },
    synced_at: syncedAt,
  };
}

async function upsertProjectBatch(batch: OmieProjectMirrorRow[]) {
  const { error } = await supabase
    .from("omie_projects_mirror")
    .upsert(batch, {
      onConflict: "codigo_projeto_omie",
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(error.message);
  }
}

export async function syncOmieClients(options: SyncOptions = {}): Promise<SyncResult> {
  const pageSize = Math.max(1, Math.min(options.pageSize || 50, 500));
  const maxPages = options.maxPages || Number.POSITIVE_INFINITY;
  const syncedAt = new Date().toISOString();

  let page = 1;
  let totalPages = 1;
  let synced = 0;
  let skipped = 0;
  let totalFromOmie = 0;

  do {
    const response = await listOmieClientsPage(page, pageSize);
    totalPages = Math.min(response.totalPages, maxPages);
    totalFromOmie = response.totalRecords;

    const rows = response.items
      .map((item) => mapOmieClient(item, syncedAt))
      .filter((item): item is OmieClientMirrorRow => Boolean(item));

    skipped += response.items.length - rows.length;

    for (const batch of chunkItems(rows, 100)) {
      await upsertClientBatch(batch);
      synced += batch.length;
    }

    page += 1;
  } while (page <= totalPages);

  return {
    synced,
    skipped,
    pagesProcessed: Math.max(0, page - 1),
    totalFromOmie,
  };
}

export async function syncOmieProjects(options: SyncOptions = {}): Promise<SyncResult> {
  try {
    const contractsResult = await syncOmieServiceContractsAsProjects(options);

    if (contractsResult.totalFromOmie > 0) {
      return contractsResult;
    }
  } catch (error) {
    console.warn(
      "[omie] Falha ao consultar Contratos de Servico. Aplicando fallback para /geral/projetos.",
      error instanceof Error ? error.message : error
    );
  }

  const pageSize = Math.max(1, Math.min(options.pageSize || 50, 500));
  const maxPages = options.maxPages || Number.POSITIVE_INFINITY;
  const syncedAt = new Date().toISOString();

  let page = 1;
  let totalPages = 1;
  let synced = 0;
  let skipped = 0;
  let totalFromOmie = 0;

  do {
    const response = await listOmieProjectsPage(page, pageSize);
    totalPages = Math.min(response.totalPages, maxPages);
    totalFromOmie = response.totalRecords;

    const clientLookup = await loadClientLookup(response.items);
    const rows = response.items
      .map((item) => mapOmieProject(item, clientLookup, syncedAt))
      .filter((item): item is OmieProjectMirrorRow => Boolean(item));

    skipped += response.items.length - rows.length;

    for (const batch of chunkItems(rows, 100)) {
      await upsertProjectBatch(batch);
      synced += batch.length;
    }

    page += 1;
  } while (page <= totalPages);

  return {
    synced,
    skipped,
    pagesProcessed: Math.max(0, page - 1),
    totalFromOmie,
  };
}

async function syncOmieServiceContractsAsProjects(
  options: SyncOptions = {}
): Promise<SyncResult> {
  const pageSize = Math.max(1, Math.min(options.pageSize || 50, 500));
  const maxPages = options.maxPages || Number.POSITIVE_INFINITY;
  const syncedAt = new Date().toISOString();

  let page = 1;
  let totalPages = 1;
  let synced = 0;
  let skipped = 0;
  let totalFromOmie = 0;

  do {
    const response = await listOmieServiceContractsPage(page, pageSize);
    totalPages = Math.min(response.totalPages, maxPages);
    totalFromOmie = response.totalRecords;

    const clientCodes = response.items
      .map((item) => {
        const header = (item.cabecalho as Record<string, unknown> | undefined) ?? {};
        return toNullableNumber(header.nCodCli);
      })
      .filter((value): value is number => Boolean(value));

    const clientLookup = await loadClientLookupByOmieCodes(clientCodes);
    const rows = response.items
      .map((item) => mapOmieServiceContractAsProject(item, clientLookup, syncedAt))
      .filter((item): item is OmieProjectMirrorRow => Boolean(item));

    skipped += response.items.length - rows.length;

    for (const batch of chunkItems(rows, 100)) {
      await upsertProjectBatch(batch);
      synced += batch.length;
    }

    page += 1;
  } while (page <= totalPages);

  return {
    synced,
    skipped,
    pagesProcessed: Math.max(0, page - 1),
    totalFromOmie,
  };
}
