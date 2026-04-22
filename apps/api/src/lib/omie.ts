import { config } from "./config.js";

type OmiePagination = {
  pagina?: number;
  total_de_paginas?: number;
  registros?: number;
  total_de_registros?: number;
};

export type OmieClientRecord = Record<string, unknown> & {
  codigo_cliente_omie?: number;
  codigo_cliente_integracao?: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnpj_cpf?: string;
  email?: string;
  endereco?: string;
  endereco_numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone1_ddd?: string;
  telefone1_numero?: string;
  info?: Record<string, unknown>;
};

export type OmieProjectRecord = Record<string, unknown> & {
  codigo?: number;
  codInt?: string;
  nome?: string;
  inativo?: string;
  info?: Record<string, unknown>;
};

export type OmieServiceContractRecord = Record<string, unknown> & {
  cabecalho?: Record<string, unknown> & {
    nCodCtr?: number;
    cCodIntCtr?: string;
    nCodCli?: number;
    cNumCtr?: string;
    cCodSit?: string;
    dVigInicial?: string;
    dVigFinal?: string;
  };
  departamentos?: Array<
    Record<string, unknown> & {
      cCodDep?: string;
      cDesDep?: string;
    }
  >;
  infAdic?: Record<string, unknown> & {
    nCodProj?: number;
    cCidPrestServ?: string;
    cCodObra?: string;
  };
  infoCadastro?: Record<string, unknown>;
};

type OmieListResponse<TRecord> = OmiePagination & {
  clientes_cadastro?: TRecord[];
  cadastro?: TRecord[];
  contratoCadastro?: TRecord[];
};

function assertOmieConfigured() {
  if (!config.omie.appKey || !config.omie.appSecret) {
    throw new Error("Credenciais da Omie nao configuradas neste ambiente.");
  }
}

function extractOmieError(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const directMessageKeys = [
    "faultstring",
    "error",
    "descricao",
    "description",
    "message",
    "mensagem",
  ];

  for (const key of directMessageKeys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const faultCode = record.faultcode;
  if (faultCode && typeof faultCode === "string") {
    return faultCode;
  }

  return null;
}

async function omieRequest<TResponse>(
  servicePath: string,
  call: string,
  params: Record<string, unknown>
) {
  assertOmieConfigured();

  const response = await fetch(`${config.omie.baseUrl}${servicePath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      call,
      app_key: config.omie.appKey,
      app_secret: config.omie.appSecret,
      param: [params],
    }),
  });

  const payload = (await response.json()) as TResponse;

  if (!response.ok) {
    throw new Error(`Falha HTTP ao consultar a Omie (${response.status}).`);
  }

  const apiError = extractOmieError(payload);
  if (apiError) {
    throw new Error(apiError);
  }

  return payload;
}

function normalizeListResponse<TRecord>(
  response: OmieListResponse<TRecord>,
  preferredArrayKey: "clientes_cadastro" | "cadastro" | "contratoCadastro"
) {
  const items = Array.isArray(response[preferredArrayKey])
    ? (response[preferredArrayKey] as TRecord[])
    : Array.isArray(response.cadastro)
      ? (response.cadastro as TRecord[])
      : Array.isArray(response.contratoCadastro)
        ? (response.contratoCadastro as TRecord[])
      : Array.isArray(response.clientes_cadastro)
        ? (response.clientes_cadastro as TRecord[])
        : [];

  return {
    items,
    page: response.pagina || 1,
    totalPages: response.total_de_paginas || 1,
    totalRecords: response.total_de_registros || items.length,
  };
}

export async function listOmieClientsPage(page = 1, pageSize = 50) {
  const response = await omieRequest<OmieListResponse<OmieClientRecord>>(
    "/geral/clientes/",
    "ListarClientes",
    {
      pagina: page,
      registros_por_pagina: pageSize,
      apenas_importado_api: "N",
    }
  );

  return normalizeListResponse(response, "clientes_cadastro");
}

export async function listOmieProjectsPage(page = 1, pageSize = 50) {
  const response = await omieRequest<OmieListResponse<OmieProjectRecord>>(
    "/geral/projetos/",
    "ListarProjetos",
    {
      pagina: page,
      registros_por_pagina: pageSize,
    }
  );

  return normalizeListResponse(response, "cadastro");
}

export async function listOmieServiceContractsPage(page = 1, pageSize = 50) {
  const response = await omieRequest<OmieListResponse<OmieServiceContractRecord>>(
    "/servicos/contrato/",
    "ListarContratos",
    {
      pagina: page,
      registros_por_pagina: pageSize,
      cExibirInfoCadastro: "S",
    }
  );

  return normalizeListResponse(response, "contratoCadastro");
}
