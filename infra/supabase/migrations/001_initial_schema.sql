-- ============================================
-- Elementus Fase 1 — Schema Inicial
-- Motor de Relatórios e Dados
-- ============================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";  -- pgvector para RAG

-- ============================================
-- PROJETOS
-- ============================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_logo_url TEXT,
  enterprise TEXT NOT NULL,
  description TEXT,
  environmental_permit TEXT,
  condicionante TEXT,
  organ TEXT NOT NULL DEFAULT 'IBAMA'
    CHECK (organ IN ('IBAMA', 'IGAM', 'SUPRAM', 'CETESB', 'IEF', 'SEMAD', 'OTHER')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CAMPANHAS
-- ============================================
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other'
    CHECK (type IN ('fauna', 'flora', 'water', 'soil', 'noise', 'reforestation', 'condicionante', 'other')),
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'in_field', 'data_collection', 'processing', 'review', 'completed')),
  responsible_technician TEXT,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PONTOS DE COLETA
-- ============================================
CREATE TABLE collection_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- DADOS DE CAMPO
-- ============================================
CREATE TABLE field_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  collection_point_id UUID REFERENCES collection_points(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (source IN ('whatsapp', 'upload', 'manual')),
  type TEXT NOT NULL
    CHECK (type IN ('photo', 'audio', 'spreadsheet', 'pdf', 'location', 'text', 'document')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'validated', 'rejected', 'error')),
  raw_content_url TEXT,
  processed_data JSONB DEFAULT '{}',
  ai_extracted_text TEXT,
  whatsapp_message_id TEXT,
  sent_by TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- VALIDAÇÕES
-- ============================================
CREATE TABLE validation_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_data_id UUID REFERENCES field_data(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('error', 'warning', 'info')),
  type TEXT NOT NULL
    CHECK (type IN ('missing_field', 'out_of_range', 'duplicate', 'format_error',
                    'legal_limit_exceeded', 'atypical_value', 'missing_collection_point')),
  message TEXT NOT NULL,
  field TEXT,
  expected_value TEXT,
  actual_value TEXT,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TEMPLATES DE RELATÓRIO
-- ============================================
CREATE TABLE report_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('implantation', 'quarterly_monitoring', 'semester_condicionante',
                    'annual_consolidated', 'technical_opinion')),
  description TEXT,
  template_url TEXT NOT NULL,
  placeholders JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- RELATÓRIOS
-- ============================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  template_id UUID NOT NULL REFERENCES report_templates(id),
  title TEXT NOT NULL,
  report_number TEXT NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('implantation', 'quarterly_monitoring', 'semester_condicionante',
                    'annual_consolidated', 'technical_opinion')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generating', 'review', 'approved', 'delivered', 'archived')),
  generated_data JSONB DEFAULT '{}',
  docx_url TEXT,
  pdf_url TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  generated_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- BASE RAG — Documentos de referência (pgvector)
-- ============================================
CREATE TABLE reference_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('report', 'regulation', 'glossary', 'style_guide')),
  content TEXT NOT NULL,
  embedding VECTOR(1536),  -- OpenAI text-embedding-3-small
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para busca vetorial (RAG)
CREATE INDEX ON reference_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX idx_campaigns_project ON campaigns(project_id);
CREATE INDEX idx_field_data_campaign ON field_data(campaign_id);
CREATE INDEX idx_field_data_project ON field_data(project_id);
CREATE INDEX idx_field_data_status ON field_data(status);
CREATE INDEX idx_reports_project ON reports(project_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_validation_issues_field_data ON validation_issues(field_data_id);
CREATE INDEX idx_validation_issues_resolved ON validation_issues(resolved);

-- ============================================
-- TRIGGERS — auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER report_templates_updated_at BEFORE UPDATE ON report_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER reports_updated_at BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS (Row Level Security) — habilitado, políticas básicas
-- ============================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_documents ENABLE ROW LEVEL SECURITY;

-- Política básica: authenticated users podem ler tudo
-- (refinar conforme necessidade de permissões por equipe)
CREATE POLICY "authenticated_read_all" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_all" ON campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_all" ON collection_points FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_all" ON field_data FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_all" ON validation_issues FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_all" ON report_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_all" ON reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_all" ON reference_documents FOR SELECT TO authenticated USING (true);

-- Políticas de escrita para authenticated
CREATE POLICY "authenticated_write" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_write" ON campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_write" ON collection_points FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_write" ON field_data FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_write" ON validation_issues FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_write" ON report_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_write" ON reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_write" ON reference_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
