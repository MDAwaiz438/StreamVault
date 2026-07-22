import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'StreamVault — Multi-Server Player',
  description: 'Premium multi-server video player with quality selection and downloads',
};

import AntiInspect from '../components/AntiInspect';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AntiInspect />
        {children}
      </body>
    </html>
  );
}
