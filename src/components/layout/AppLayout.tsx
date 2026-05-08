import { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
  fullScreen?: boolean;
}

/**
 * Wrapper de página. O TopBar global é renderizado em App.tsx via <GlobalTopBar />,
 * então aqui apenas envolvemos o conteúdo com o background do app.
 */
const AppLayout = ({ children, fullScreen = false }: AppLayoutProps) => {
  return (
    <div className={`${fullScreen ? 'lg:h-screen lg:overflow-hidden min-h-screen' : 'min-h-screen'} bg-[hsl(270,60%,4%)]`}>
      <main className={`flex-1 ${fullScreen ? 'lg:h-[calc(100vh-57px)] lg:overflow-hidden' : ''}`}>
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
