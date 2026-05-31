import './globals.css';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'], weight: ['300', '400', '600', '800'] });

export const metadata = {
  title: 'Luxe Premium Store',
  description: 'Curated premium bags and accessories',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={outfit.className}>
        <div className="bg-animated"></div>
        {children}
      </body>
    </html>
  );
}
