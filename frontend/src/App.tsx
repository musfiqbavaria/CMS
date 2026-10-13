import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import Providers from "./app/providers";
import { bootstrapSession } from "./features/auth/api";

export default function App() {
  useEffect(() => {
    void bootstrapSession();
  }, []);

  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
