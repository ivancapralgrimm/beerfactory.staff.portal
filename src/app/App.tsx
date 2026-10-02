import {
  Component,
  lazy,
  Suspense,
  type ErrorInfo,
  type ReactNode
} from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams
} from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/features/auth/auth-context";
import { canManageChecklistsClient } from "@/types/auth";
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

const KnowledgeEditorPage = lazy(() => import("@/features/knowledge/editor/KnowledgeEditorPage").then(module => ({default: module.KnowledgeEditorPage})));
const KnowledgeManagePage = lazy(() => import("@/features/knowledge/editor/KnowledgeManagePage").then(module => ({default: module.KnowledgeManagePage})));

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

const ChecklistEditorPage = lazy(() =>
  import(
    "@/features/shift/ChecklistEditorPage"
  ).then((module) => ({
    default: module.ChecklistEditorPage
  }))
);

const FeedPage = lazy(() =>
  import(
    "@/features/feed/FeedPage"
  ).then((module) => ({
    default: module.FeedPage
  }))
);

const AdminPage = lazy(() =>
  import(
    "@/features/admin/AdminPage"
  ).then((module) => ({
    default: module.AdminPage
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
      className="pointer-events-none fixed inset-x-0 top-[calc(10px+env(safe-area-inset-top))] z-[80] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-full border border-[var(--bf-line-strong)] bg-[var(--bf-surface-2)] px-4 py-2 text-xs font-black text-[var(--bf-cream)] shadow-lg">
        Загружаем раздел…
      </div>
    </div>
  );
}

function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /dynamically imported module|module script|chunk|importing a module/i.test(message);
}

class RouteLoadBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    if (!isChunkLoadError(error)) {
      console.error(error);
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section className="mx-auto mt-8 max-w-md rounded-[22px] border border-[var(--bf-line)] bg-[var(--bf-surface)] p-5 text-center">
        <h2 className="text-lg font-black text-[var(--bf-cream)]">
          Не удалось загрузить раздел
        </h2>
        <p className="mt-2 text-sm text-[var(--bf-muted)]">
          Проверьте соединение и обновите этот экран. Незавершённый текст в редакторе лучше сначала скопировать.
        </p>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-xl border border-[var(--bf-line-strong)] bg-[var(--bf-surface-2)] px-4 text-sm font-black text-[var(--bf-cream)]"
          onClick={() => window.location.reload()}
        >
          Обновить экран
        </button>
      </section>
    );
  }
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


function ChecklistEditorOnly({
  children
}: {
  children: ReactNode;
}) {
  const { state } = useAuth();

  if (state.status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  const canManage = canManageChecklistsClient(state.user);

  if (!canManage) {
    return <Navigate to="/shift" replace />;
  }

  return children;
}

function LazyRoute({
  children
}: {
  children: ReactNode;
}) {
  const location = useLocation();

  return (
    <RouteLoadBoundary key={location.pathname}>
      <Suspense key={location.pathname} fallback={<RouteLoader />}>
        {children}
      </Suspense>
    </RouteLoadBoundary>
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
          path="knowledge/new"
          element={<LazyRoute><KnowledgeEditorPage /></LazyRoute>}
        />
        <Route path="knowledge/manage" element={<LazyRoute><KnowledgeManagePage /></LazyRoute>} />
        <Route path="knowledge/:articleId/edit" element={<LazyRoute><KnowledgeEditorPage /></LazyRoute>} />
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
          path="shift/editor"
          element={
            <ChecklistEditorOnly>
              <LazyRoute>
                <ChecklistEditorPage />
              </LazyRoute>
            </ChecklistEditorOnly>
          }
        />

        <Route
          path="feed"
          element={
            <LazyRoute>
              <FeedPage />
            </LazyRoute>
          }
        />

        <Route
          path="handover"
          element={
            <Navigate
              to="/feed"
              replace
            />
          }
        />

        <Route
          path="admin"
          element={
            <LazyRoute>
              <AdminPage />
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
