import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout";
import { IntakePlatformPage } from "@/pages/IntakePlatform";
import { AssemblyPlatformPage } from "@/pages/AssemblyPlatform";
import { ReportWorkspacePlatformPage } from "@/pages/ReportWorkspacePlatform";
import { ImagesPlatformPage } from "@/pages/ImagesPlatform";
import { DeliveryPlatformPage } from "@/pages/DeliveryPlatform";
import { SettingsPlatformPage } from "@/pages/SettingsPlatform";
import { UsersPlatformPage } from "@/pages/UsersPlatform";
import { LoginPage } from "@/pages/LoginAccess";
import { OnboardingPage } from "@/pages/Onboarding";

function LegacyReportRedirect() {
  const params = useParams();

  return <Navigate to={`/relatorio?report=${params.id ?? ""}`} replace />;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();
  const needsOnboarding = user && user.onboarding_status !== "active";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold text-elementus-blue">Conectando a plataforma</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Estamos validando sua sessao da plataforma para abrir o ambiente da Elementus.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? <Navigate to={needsOnboarding ? "/onboarding" : "/entrada"} replace /> : <LoginPage />
        }
      />
      <Route
        path="/onboarding"
        element={user ? <OnboardingPage /> : <Navigate to="/login" replace />}
      />

      <Route
        element={
          user ? (
            needsOnboarding ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <DashboardLayout />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route path="/" element={<Navigate to="/entrada" replace />} />
        <Route path="/entrada" element={<IntakePlatformPage />} />
        <Route path="/montagem" element={<AssemblyPlatformPage />} />
        <Route path="/relatorio" element={<ReportWorkspacePlatformPage />} />
        <Route path="/imagens" element={<ImagesPlatformPage />} />
        <Route path="/envio" element={<DeliveryPlatformPage />} />
        <Route path="/projects" element={<Navigate to="/entrada" replace />} />
        <Route path="/field-data" element={<Navigate to="/montagem" replace />} />
        <Route path="/reports" element={<Navigate to="/relatorio" replace />} />
        <Route path="/reports/generate" element={<Navigate to="/montagem" replace />} />
        <Route path="/reports/:id" element={<LegacyReportRedirect />} />
        <Route path="/validation" element={<Navigate to="/entrada" replace />} />
        <Route path="/templates" element={<Navigate to="/relatorio" replace />} />
        <Route path="/users" element={<UsersPlatformPage />} />
        <Route path="/settings" element={<SettingsPlatformPage />} />
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to={user ? (needsOnboarding ? "/onboarding" : "/entrada") : "/login"}
            replace
          />
        }
      />
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
