import './globals.css';
import type { Metadata, Viewport } from 'next';
export const metadata:Metadata={title:'FamilyOS · Un hogar en armonía',description:'Tu hogar, en armonía. Demo familiar.',manifest:'/manifest.webmanifest',icons:{apple:'/icon-192.png'},appleWebApp:{capable:true,title:'FamilyOS',statusBarStyle:'default'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#f5f4ed'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="es-GT"><body>{children}</body></html>}
