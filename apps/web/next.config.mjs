/** @type {import('next').NextConfig} */
const nextConfig = {
    serverExternalPackages: [
        'puppeteer',
        'puppeteer-extra',
        'puppeteer-extra-plugin-stealth',
        'cheerio',
    ],
};

export default nextConfig;
