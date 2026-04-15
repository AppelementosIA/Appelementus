import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import * as fs from "fs";
import * as path from "path";

export interface TemplateData {
  // Dados gerais do relatório
  cliente_nome?: string;
  empreendimento?: string;
  condicionante?: string;
  periodo?: string;
  numero_relatorio?: string;
  data_emissao?: string;
  responsavel_tecnico?: string;
  registro_profissional?: string;

  // Seções de conteúdo (geradas pelo Agente Especialista — Camada 3)
  apresentacao?: string;
  objetivo?: string;
  materiais_metodos?: string;
  atividades_realizadas?: string;
  resultados?: string;
  conclusao?: string;
  referencias?: string;

  // Tabelas e figuras (placeholders para listas)
  tabelas?: Array<{
    titulo: string;
    headers: string[];
    rows: string[][];
  }>;
  figuras?: Array<{
    titulo: string;
    legenda: string;
    image_path?: string;
  }>;

  // Equipe técnica
  equipe?: Array<{
    nome: string;
    cargo: string;
    registro: string;
  }>;

  // Qualquer dado adicional
  [key: string]: unknown;
}

/**
 * Motor de Preenchimento — Camada 2 da Arquitetura Elementus
 *
 * Responsabilidade: Pegar o template mestre (.docx da Camada 1) e injetar
 * o conteúdo estruturado (gerado pela Camada 3 — Agente Especialista)
 * nos placeholders, SEM alterar formatação, cores, fontes ou layout.
 */
export class TemplateEngine {
  /**
   * Preenche um template .docx com os dados fornecidos.
   * @param templatePath - Caminho para o template mestre .docx
   * @param data - Dados para preencher os placeholders
   * @returns Buffer com o .docx preenchido
   */
  static fillTemplate(templatePath: string, data: TemplateData): Buffer {
    const templateContent = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(templateContent);

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

  /**
   * Preenche um template a partir de um buffer (útil quando o template
   * vem do Supabase Storage em vez do filesystem local).
   */
  static fillTemplateFromBuffer(templateBuffer: Buffer, data: TemplateData): Buffer {
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

  /**
   * Extrai os placeholders de um template .docx.
   * Útil para validar se todos os dados necessários foram fornecidos.
   */
  static extractPlaceholders(templatePath: string): string[] {
    const templateContent = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(templateContent);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{{", end: "}}" },
    });

    const text = doc.getFullText();
    const regex = /\{\{([^}]+)\}\}/g;
    const placeholders: string[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      const key = match[1].trim();
      if (!placeholders.includes(key)) {
        placeholders.push(key);
      }
    }

    return placeholders;
  }

  /**
   * Valida se todos os placeholders obrigatórios foram preenchidos.
   */
  static validateData(
    requiredPlaceholders: string[],
    data: TemplateData
  ): { valid: boolean; missing: string[] } {
    const missing = requiredPlaceholders.filter(
      (key) => data[key] === undefined || data[key] === null || data[key] === ""
    );
    return { valid: missing.length === 0, missing };
  }
}
