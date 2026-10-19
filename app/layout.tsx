import './globals.css';
import '@fontsource/cormorant-garamond/latin-300.css';
import '@fontsource/cormorant-garamond/latin-300-italic.css';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/jost/latin-300.css';
import '@fontsource/jost/latin-400.css';
import type { Metadata, Viewport } from 'next';
export const metadata: Metadata = {
  title: 'LT Living · La casa, en calma',
  description: 'Lima Toralla Living. Todo lo que ocurre en casa, anticipado con discreción.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, title: 'LT Living', statusBarStyle: 'default' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#F4F2EE' };
const themeScript = `try{var t=localStorage.getItem('lt-living-theme');if(t==='dark'){document.documentElement.dataset.theme='dark';document.documentElement.style.colorScheme='dark';}}catch(e){}`;
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="es-GT" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body>{children}</body></html>;
}
