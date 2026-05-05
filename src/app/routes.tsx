import type { ReactNode } from "react";
import { Navigate, createBrowserRouter, useLocation } from "react-router";
import { Root } from "./components/Root";
import { HomePage } from "./components/HomePage";
import { CatalogPage } from "./components/CatalogPage";
import { SemanticSearchPage } from "./components/SemanticSearchPage";
import { BookDetailsPage } from "./components/BookDetailsPage";
import { AuthPage } from "./components/AuthPages";
import { PreferencesPage } from "./components/PreferencesPage";
import { RecommendationsPage } from "./components/RecommendationsPage";
import { FavoritesPage, CartPage, CheckoutPage, OrdersPage } from "./components/CartFavCheckoutPages";
import { AdminPage } from "./components/AdminPage";
import { ErrorPage } from "./components/ErrorPages";
import { useAuth } from "./auth/AuthContext";
import { BRAND } from "./components/brand";

function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: Array<"user" | "admin">;
}) {
  const location = useLocation();
  const { loading, isAuthenticated, role, isAdmin, profile } = useAuth();

  console.info("[Интеллекта][route] ProtectedRoute", {
    path: location.pathname,
    requiredRoles: roles ?? null,
    loading,
    isAuthenticated,
    isAdmin,
    role,
    profileRole: profile?.role ?? null,
    profileEmail: profile?.email ?? null,
  });

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 md:px-8 py-16 text-center fade-in">
        <div className="font-serif" style={{ color: BRAND.navy, fontSize: 28 }}>
          Проверяем авторизацию…
        </div>
        <p style={{ color: BRAND.slate, marginTop: 8 }}>
          Это займет несколько секунд.
        </p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(role as "user" | "admin")) {
    return <ErrorPage code={403} />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      {
        index: true,
        Component: HomePage,
      },
      {
        path: "catalog",
        Component: CatalogPage,
      },
      {
        path: "search",
        Component: SemanticSearchPage,
      },
      {
        path: "book/:bookId",
        Component: BookDetailsPage,
      },
      {
        path: "login",
        element: <AuthPage mode="login" />,
      },
      {
        path: "register",
        element: <AuthPage mode="register" />,
      },
      {
        path: "preferences",
        element: <ProtectedRoute><PreferencesPage /></ProtectedRoute>,
      },
      {
        path: "recommendations",
        element: <ProtectedRoute><RecommendationsPage /></ProtectedRoute>,
      },
      {
        path: "favorites",
        element: <ProtectedRoute><FavoritesPage /></ProtectedRoute>,
      },
      {
        path: "cart",
        Component: CartPage,
      },
      {
        path: "checkout",
        element: <ProtectedRoute><CheckoutPage /></ProtectedRoute>,
      },
      {
        path: "orders",
        element: <ProtectedRoute><OrdersPage /></ProtectedRoute>,
      },
      {
        path: "admin",
        element: <ProtectedRoute roles={["admin"]}><AdminPage /></ProtectedRoute>,
      },
      {
        path: "401",
        element: <ErrorPage code={401} />,
      },
      {
        path: "403",
        element: <ErrorPage code={403} />,
      },
      {
        path: "404",
        element: <ErrorPage code={404} />,
      },
      {
        path: "*",
        element: <ErrorPage code={404} />,
      },
    ],
  },
]);
