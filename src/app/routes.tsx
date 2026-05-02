import { createBrowserRouter } from "react-router";
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
        Component: PreferencesPage,
      },
      {
        path: "recommendations",
        Component: RecommendationsPage,
      },
      {
        path: "favorites",
        Component: FavoritesPage,
      },
      {
        path: "cart",
        Component: CartPage,
      },
      {
        path: "checkout",
        Component: CheckoutPage,
      },
      {
        path: "orders",
        Component: OrdersPage,
      },
      {
        path: "admin",
        Component: AdminPage,
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
