import {
  lazy,
  Suspense,
  type ReactNode
} from "react";
import {
  Navigate,
  Route,
  Routes,
  useParams
} from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/features/auth/auth-context";
import { LoginPage } from "@/features/auth/LoginPage";
import { RecoveryPage } from "@/features/auth/RecoveryPage";
import { RecoverySetupPage } from "@/features/auth/RecoverySetupPage";
import { RegisterPage } from "@/features/auth/RegisterPage";

const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then(
    (module) => ({
      default: module.DashboardPage
    })
  )
);

const RecipesPage = lazy(() =>
  import("@/features/recipes/RecipesPage").then(
    (module) => ({
      default: module.RecipesPage
    })
  )
);

const RecipeDetailPage = lazy(() =>
  import(
    "@/features/recipes/RecipeDetailPage"
  ).then((module) => ({
    default: module.RecipeDetailPage
  }))
);

const KnowledgePage = lazy(() =>
  import(
    "@/features/knowledge/KnowledgePage"
  ).then((module) => ({
    default: module.KnowledgePage
  }))
);

const KnowledgeArticlePage = lazy(() =>
  import(
    "@/features/knowledge/KnowledgeArticlePage"
  ).then((module) => ({
    default: module.KnowledgeArticlePage
  }))
);

const AttestationPage = lazy(() =>
  import(
    "@/features/attestation/AttestationPage"
  ).then((module) => ({
    default: module.AttestationPage
  }))
);

const ShiftPage = lazy(() =>
  import("@/features/shift/ShiftPage").then(
    (module) => ({
      default: module.ShiftPage
    })
  )
);

const HandoverPage = lazy(() =>
  import(
    "@/features/handover/HandoverPage"
  ).then((module) => ({
    default: module.HandoverPage
  }))
);

const ProfilePage = lazy(() =>
  import("@/pages/ProfilePage").then(
    (module) => ({
      default: module.ProfilePage
    })
  )
);

function BootScreen() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bf-bg)] px-6">
      <div className="text-center">
        <img
          src="/assets/icons/profile-avatar.png"
          alt=""
          width="72"
          height="72"
          className="mx-auto size-[72px]"
        />
        <p className="mt-4 text-sm font-semibold text-[var(--bf-muted)]">
          Проверяем сессию…
        </p>
      </div>
    </main>
  );
}

function RouteLoader() {
  return (
    <div
      className="grid min-h-[34dvh] place-items-center"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold text-[var(--bf-muted)]">
        Загружаем раздел…
      </p>
    </div>
  );
}

function ProtectedApp() {
  const { state } = useAuth();

  if (state.status === "booting") {
    return <BootScreen />;
  }

  if (state.status !== "authenticated") {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (state.recoveryRequired) {
    return (
      <Navigate
        to="/setup-recovery"
        replace
      />
    );
  }

  return <AppShell />;
}

function PublicOnly({
  children
}: {
  children: ReactNode;
}) {
  const { state } = useAuth();

  if (state.status === "booting") {
    return <BootScreen />;
  }

  if (state.status === "authenticated") {
    return (
      <Navigate
        to={
          state.recoveryRequired
            ? "/setup-recovery"
            : "/"
        }
        replace
      />
    );
  }

  return children;
}

function LazyRoute({
  children
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<RouteLoader />}>
      {children}
    </Suspense>
  );
}

function LegacyArticleRedirect() {
  const { articleId = "" } =
    useParams();

  return (
    <Navigate
      to={`/knowledge/${encodeURIComponent(
        articleId
      )}`}
      replace
    />
  );
}

export function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        }
      />
      <Route
        path="/recovery"
        element={
          <PublicOnly>
            <RecoveryPage />
          </PublicOnly>
        }
      />
      <Route
        path="/setup-recovery"
        element={<RecoverySetupPage />}
      />

      <Route element={<ProtectedApp />}>
        <Route
          index
          element={
            <LazyRoute>
              <DashboardPage />
            </LazyRoute>
          }
        />

        <Route
          path="menu"
          element={
            <LazyRoute>
              <RecipesPage />
            </LazyRoute>
          }
        />
        <Route
          path="menu/:recipeId"
          element={
            <LazyRoute>
              <RecipeDetailPage />
            </LazyRoute>
          }
        />

        <Route
          path="knowledge"
          element={
            <LazyRoute>
              <KnowledgePage />
            </LazyRoute>
          }
        />
        <Route
          path="knowledge/:articleId"
          element={
            <LazyRoute>
              <KnowledgeArticlePage />
            </LazyRoute>
          }
        />

        <Route
          path="training"
          element={
            <Navigate
              to="/knowledge"
              replace
            />
          }
        />
        <Route
          path="article/:articleId"
          element={
            <LegacyArticleRedirect />
          }
        />

        <Route
          path="attestation"
          element={
            <LazyRoute>
              <AttestationPage />
            </LazyRoute>
          }
        />

        <Route
          path="shift"
          element={
            <LazyRoute>
              <ShiftPage />
            </LazyRoute>
          }
        />

        <Route
          path="handover"
          element={
            <LazyRoute>
              <HandoverPage />
            </LazyRoute>
          }
        />

        <Route
          path="profile"
          element={
            <LazyRoute>
              <ProfilePage />
            </LazyRoute>
          }
        />
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />
    </Routes>
  );
}
