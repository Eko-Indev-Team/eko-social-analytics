import { createBrowserRouter, Outlet, RouterProvider, type RouteObject } from 'react-router-dom';
import { Providers } from '@/app/Providers';
import { routes } from '@/app/routes';

/** One provider tree (auth, toasts, preview state…) shared by every route, inside the router context. */
export function withProviders(routeList: RouteObject[]): RouteObject[] {
  return [{ element: <Providers><Outlet /></Providers>, children: routeList }];
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';
const router = createBrowserRouter(withProviders(routes), { basename });

export default function App() {
  return <RouterProvider router={router} />;
}
