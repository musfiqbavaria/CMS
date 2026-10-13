import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import Providers from "./app/providers";
import { bootstrapSession } from "./features/auth/api";
import { useUiStore } from "./stores/ui";

export default function App() {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    void bootstrapSession();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
