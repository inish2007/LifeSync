import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'LifeLoop — Your obligations, connected',description:'Turn bills, notices, and documents into a connected personal timeline.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
