import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout";
import { DashboardPlatformPage } from "@/pages/DashboardPlatform";
import { ProjectsPage } from "@/pages/Projects";
import { FieldDataPage } from "@/pages/FieldData";
import { ReportsPlatformPage } from "@/pages/ReportsPlatform";
import { ReportGeneratePlatformPage } from "@/pages/ReportGeneratePlatform";
import { ReportReviewPlatformPage } from "@/pages/ReportReviewPlatform";
import { DataValidationPage } from "@/pages/DataValidation";
import { TemplatesPage } from "@/pages/Templates";
import { SettingsPlatformPage } from "@/pages/SettingsPlatform";
import { UsersPage } from "@/pages/Users";
import { LoginPage } from "@/pages/Login";

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold text-elementus-blue">Conectando a plataforma</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Estamos validando sua sessao Microsoft 365 para abrir o ambiente da Elementus.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />

      <Route element={user ? <DashboardLayout /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<DashboardPlatformPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/field-data" element={<FieldDataPage />} />
        <Route path="/reports" element={<ReportsPlatformPage />} />
        <Route path="/reports/generate" element={<ReportGeneratePlatformPage />} />
        <Route path="/reports/:id" element={<ReportReviewPlatformPage />} />
        <Route path="/validation" element={<DataValidationPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/settings" element={<SettingsPlatformPage />} />
      </Route>

      <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
