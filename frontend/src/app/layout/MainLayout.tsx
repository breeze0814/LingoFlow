import { ReactNode } from 'react';

type MainLayoutProps = {
  children: ReactNode;
};

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <main className="layoutShell">
      <div className="ambientGlow ambientGlowLeft" aria-hidden="true" />
      <div className="ambientGlow ambientGlowRight" aria-hidden="true" />
      <section className="layout">
        <section className="content">{children}</section>
      </section>
    </main>
  );
}
