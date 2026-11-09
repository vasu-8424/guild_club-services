"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { getRouteTitle } from "@/lib/navigation";

interface TitleContextValue {
  title: string;
  setTitle: (title: string) => void;
}

const TitleContext = React.createContext<TitleContextValue>({
  title: "Dashboard",
  setTitle: () => {},
});

export function TitleProvider({
  initialTitle,
  children,
}: {
  initialTitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const defaultTitle = React.useMemo(() => {
    return initialTitle || getRouteTitle(pathname);
  }, [pathname, initialTitle]);

  const [title, setTitle] = React.useState<string>(defaultTitle);

  // Auto-sync title when pathname changes
  React.useEffect(() => {
    setTitle(getRouteTitle(pathname));
  }, [pathname]);

  return (
    <TitleContext.Provider value={{ title, setTitle }}>
      {children}
    </TitleContext.Provider>
  );
}

export function useTitle() {
  return React.useContext(TitleContext);
}

export function PageTitle({ title }: { title: string }) {
  const { setTitle } = useTitle();

  React.useEffect(() => {
    if (title) {
      setTitle(title);
    }
  }, [title, setTitle]);

  return null;
}

